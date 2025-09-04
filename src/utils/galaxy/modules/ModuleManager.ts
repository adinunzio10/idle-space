import React from 'react';
import { ModuleRegistry } from './ModuleRegistry';
import {
  GalaxyMapModule,
  ModuleContext,
  ModuleRenderResult,
  ModuleEventBus,
} from './types';

export interface ModuleManagerConfig {
  performanceMode?: boolean;
  debugMode?: boolean;
  maxRenderTime?: number; // Max time budget per frame in ms
  adaptivePerformance?: boolean; // Auto-adjust based on performance
  performanceThresholds?: {
    autoDisableFps: number; // FPS threshold for auto-disabling modules
    performanceModeFps: number; // FPS threshold for enabling performance mode
    warningRenderTime: number; // Render time threshold for warnings
  };
}

export class ModuleManager {
  private registry: ModuleRegistry;
  private eventBus: ModuleEventBus;
  private frameCount = 0;
  private lastFrameTime = 0;
  private config: ModuleManagerConfig;
  private globalFpsHistory: number[] = [];
  private globalAverageFps = 60;
  private disabledModulesForPerformance: Set<string> = new Set();
  private userNotificationQueue: { type: string; message: string; moduleId?: string }[] = [];

  constructor(config: ModuleManagerConfig = {}) {
    this.registry = new ModuleRegistry();
    this.eventBus = this.registry.getEventBus();
    this.config = {
      performanceMode: false,
      debugMode: false,
      maxRenderTime: 16.67, // 60fps budget
      adaptivePerformance: true,
      performanceThresholds: {
        autoDisableFps: 45, // Auto-disable modules below 45fps
        performanceModeFps: 55, // Enable performance mode below 55fps
        warningRenderTime: 20, // Warn if module takes more than 20ms
      },
      ...config,
    };
  }

  // Module lifecycle management
  async registerModule(module: GalaxyMapModule): Promise<void> {
    this.registry.register(module);
    
    // Initialize with empty context for dependency checking
    const emptyContext = this.createEmptyContext();
    await module.initialize(emptyContext);
    
    if (module.config.enabled) {
      await module.enable();
    }
  }

  unregisterModule(moduleId: string): void {
    this.registry.unregister(moduleId);
  }

  enableModule(moduleId: string): void {
    this.registry.enableModule(moduleId);
  }

  disableModule(moduleId: string): void {
    this.registry.disableModule(moduleId);
  }

  // Rendering coordination
  renderModules(context: ModuleContext): React.ReactNode[] {
    this.frameCount++;
    const currentTime = performance.now();
    const deltaTime = this.lastFrameTime > 0 ? currentTime - this.lastFrameTime : 16.67;
    this.lastFrameTime = currentTime;
    
    // Update global FPS tracking
    this.updateGlobalFps(deltaTime);
    
    const startTime = performance.now();
    const allElements: React.ReactNode[] = [];
    
    // Check for automatic module management
    this.performAutomaticModuleManagement();
    
    // Get modules sorted by priority
    const modules = this.registry.getModulesSortedByPriority();
    
    // Update all modules first
    for (const module of modules) {
      try {
        module.update(context);
      } catch (error) {
        this.handleModuleError(module.id, 'update', error);
      }
    }

    // Render modules with time budget management
    let remainingTimeBudget = this.config.maxRenderTime || 16.67;
    
    for (const module of modules) {
      if (remainingTimeBudget <= 0 && this.config.adaptivePerformance) {
        // Skip remaining modules if we're out of time budget
        this.logDebug(`Skipping module ${module.id} due to time budget`);
        continue;
      }

      try {
        const moduleStartTime = performance.now();
        const result = module.render(context);
        const moduleRenderTime = performance.now() - moduleStartTime;
        
        allElements.push(...result.elements);
        remainingTimeBudget -= moduleRenderTime;

        // Adaptive performance management
        if (this.config.adaptivePerformance) {
          this.adjustModulePerformance(module, moduleRenderTime, result);
        }

        this.logDebug(
          `Module ${module.id} rendered in ${moduleRenderTime.toFixed(2)}ms`,
          { impact: result.performanceImpact, elements: result.elements.length }
        );

      } catch (error) {
        this.handleModuleError(module.id, 'render', error);
      }
    }

    const totalRenderTime = performance.now() - startTime;
    this.logDebug(`Total module render time: ${totalRenderTime.toFixed(2)}ms`);

    // Emit frame rendered event
    this.eventBus.emit('frame:rendered', {
      moduleId: 'manager',
      timestamp: Date.now(),
      data: { renderTime: totalRenderTime, moduleCount: modules.length },
    });

    return allElements;
  }

  // Configuration management
  updateModuleConfig(moduleId: string, config: Partial<any>): void {
    const module = this.registry.getModule(moduleId);
    if (module) {
      module.updateConfig(config);
    }
  }

  setGlobalPerformanceMode(enabled: boolean): void {
    this.config.performanceMode = enabled;
    
    // Apply to all modules
    for (const module of this.registry.getAllModules()) {
      module.updateConfig({ performanceMode: enabled });
    }
    
    this.logDebug(`Global performance mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  setDebugMode(enabled: boolean): void {
    this.config.debugMode = enabled;
    
    // Apply to all modules
    for (const module of this.registry.getAllModules()) {
      module.updateConfig({ debugMode: enabled });
    }
  }

  // Event system
  getEventBus(): ModuleEventBus {
    return this.eventBus;
  }

  getAllModules(): GalaxyMapModule[] {
    return this.registry.getAllModules();
  }

  // Performance monitoring API
  getGlobalPerformanceMetrics(): {
    averageFps: number;
    frameCount: number;
    disabledModules: string[];
    performanceMode: boolean;
  } {
    return {
      averageFps: this.globalAverageFps,
      frameCount: this.frameCount,
      disabledModules: Array.from(this.disabledModulesForPerformance),
      performanceMode: this.config.performanceMode || false,
    };
  }

  // User notifications API
  getNotifications(): { type: string; message: string; moduleId?: string }[] {
    return [...this.userNotificationQueue];
  }

  clearNotifications(): void {
    this.userNotificationQueue = [];
  }

  dismissNotification(index: number): void {
    if (index >= 0 && index < this.userNotificationQueue.length) {
      this.userNotificationQueue.splice(index, 1);
    }
  }

  // Performance and diagnostics
  getPerformanceReport(): Record<string, any> {
    const modules = this.registry.getAllModules();
    const report: Record<string, any> = {
      totalModules: modules.length,
      enabledModules: modules.filter(m => m.config.enabled).length,
      frameCount: this.frameCount,
      modules: {},
    };

    for (const module of modules) {
      report.modules[module.id] = {
        name: module.name,
        category: module.category,
        enabled: module.config.enabled,
        metrics: module.getPerformanceMetrics(),
        dependencies: module.dependencies,
      };
    }

    return report;
  }

  validateSystem(): string[] {
    const errors: string[] = [];
    
    // Validate dependencies
    const depErrors = this.registry.validateDependencies();
    errors.push(...depErrors);
    
    // Check for module health
    for (const module of this.registry.getAllModules()) {
      const metrics = module.getPerformanceMetrics();
      
      if (metrics.averageFps < 20) {
        errors.push(`Module ${module.id} performance warning: FPS ${metrics.averageFps}`);
      }
      
      if (metrics.renderTime > 50) { // More than 3 frames worth of time
        errors.push(`Module ${module.id} performance warning: render time ${metrics.renderTime}ms`);
      }
    }
    
    return errors;
  }

  private adjustModulePerformance(
    module: GalaxyMapModule,
    renderTime: number,
    result: ModuleRenderResult
  ): void {
    const thresholds = this.config.performanceThresholds!;
    
    // Auto-enable performance mode for slow modules
    if (renderTime > thresholds.warningRenderTime && !module.config.performanceMode) {
      module.updateConfig({ performanceMode: true });
      this.logDebug(`Auto-enabled performance mode for ${module.id}`);
    }

    // Warn about consistently slow modules
    if (result.performanceImpact === 'high' && renderTime > thresholds.warningRenderTime) {
      this.eventBus.emit('module:performance-warning', {
        moduleId: module.id,
        timestamp: Date.now(),
        data: { renderTime, impact: result.performanceImpact },
      });
    }
  }

  private updateGlobalFps(deltaTime: number): void {
    const currentFps = 1000 / deltaTime;
    this.globalFpsHistory.push(currentFps);
    
    // Keep only last 60 frames for rolling average
    if (this.globalFpsHistory.length > 60) {
      this.globalFpsHistory.shift();
    }
    
    // Calculate average FPS
    this.globalAverageFps = this.globalFpsHistory.reduce((sum, fps) => sum + fps, 0) / this.globalFpsHistory.length;
  }

  private performAutomaticModuleManagement(): void {
    if (!this.config.adaptivePerformance) return;
    
    const thresholds = this.config.performanceThresholds!;
    const currentFps = this.globalAverageFps;
    
    // Auto-disable modules if FPS is critically low
    if (currentFps < thresholds.autoDisableFps) {
      this.autoDisableNonEssentialModules();
    }
    
    // Re-enable modules if performance recovers
    else if (currentFps > thresholds.performanceModeFps + 10 && this.disabledModulesForPerformance.size > 0) {
      this.autoReEnableModules();
    }
    
    // Enable global performance mode if FPS is low but not critical
    else if (currentFps < thresholds.performanceModeFps && !this.config.performanceMode) {
      this.setGlobalPerformanceMode(true);
      this.queueUserNotification('performance', `Performance mode enabled (FPS: ${Math.round(currentFps)})`);
    }
  }

  private autoDisableNonEssentialModules(): void {
    const modules = this.registry.getAllModules();
    const nonEssentialCategories = ['effects', 'ui'];
    
    for (const module of modules) {
      if (nonEssentialCategories.includes(module.category) && 
          module.config.enabled && 
          !this.disabledModulesForPerformance.has(module.id)) {
        
        this.disableModule(module.id);
        this.disabledModulesForPerformance.add(module.id);
        
        this.queueUserNotification('module-disabled', 
          `${module.name} disabled to improve performance (FPS: ${Math.round(this.globalAverageFps)})`, 
          module.id);
        
        this.logDebug(`Auto-disabled module ${module.id} due to low FPS (${Math.round(this.globalAverageFps)})`);
        
        // Only disable one module at a time to avoid sudden jumps
        break;
      }
    }
  }

  private autoReEnableModules(): void {
    const moduleIds = Array.from(this.disabledModulesForPerformance);
    
    if (moduleIds.length > 0) {
      const moduleId = moduleIds[0]; // Re-enable one at a time
      const module = this.registry.getModule(moduleId);
      
      if (module) {
        this.enableModule(moduleId);
        this.disabledModulesForPerformance.delete(moduleId);
        
        this.queueUserNotification('module-enabled', 
          `${module.name} re-enabled (performance recovered)`, 
          module.id);
        
        this.logDebug(`Auto-re-enabled module ${moduleId} due to recovered performance`);
      }
    }
  }

  private queueUserNotification(type: string, message: string, moduleId?: string): void {
    this.userNotificationQueue.push({ type, message, moduleId });
    
    // Emit event for UI to show notification
    this.eventBus.emit('module:performance-warning', {
      moduleId: moduleId || 'system',
      timestamp: Date.now(),
      data: { type, message },
    });
  }

  private handleModuleError(moduleId: string, operation: string, error: any): void {
    console.error(`[ModuleManager] Error in module ${moduleId} during ${operation}:`, error);
    
    this.eventBus.emit('module:error', {
      moduleId,
      timestamp: Date.now(),
      data: { operation, error: error.message },
    });

    // Consider disabling problematic modules
    const module = this.registry.getModule(moduleId);
    if (module && module.config.enabled) {
      const dependents = this.registry.getDependencyInfo(moduleId)?.requiredBy || [];
      if (dependents.length === 0) {
        this.logDebug(`Auto-disabling problematic module ${moduleId}`);
        this.disableModule(moduleId);
      }
    }
  }

  private createEmptyContext(): ModuleContext {
    return {
      viewport: {
        translateX: 0,
        translateY: 0,
        scale: 1,
        bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
      },
      screenDimensions: { width: 0, height: 0 },
      beacons: [],
      connections: [],
      patterns: [],
      starSystems: [],
      sectors: [],
      deltaTime: 0,
      frameCount: 0,
    };
  }

  private logDebug(message: string, data?: any): void {
    if (this.config.debugMode) {
      console.log(`[ModuleManager] ${message}`, data || '');
    }
  }
}