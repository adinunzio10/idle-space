/**
 * GalaxyMapConfig - Configuration and Performance Management System
 * 
 * This class manages:
 * - Module activation/deactivation
 * - Rendering quality levels
 * - Performance thresholds and auto-optimization
 * - Debug modes for module isolation
 * - Object pool management and emergency cleanup
 */

import { poolManager } from '../performance/ObjectPool';

export type QualityLevel = 'low' | 'medium' | 'high' | 'ultra';
export type ModuleId = string;

export interface PerformanceThresholds {
  /** Target FPS for optimal experience */
  targetFps: number;
  /** FPS threshold below which to reduce quality */
  criticalFps: number;
  /** Maximum render time per frame in ms */
  maxFrameTime: number;
  /** Maximum number of visible beacons */
  maxVisibleBeacons: number;
  /** Beacon count threshold for clustering */
  clusteringThreshold: number;
  /** Object pool utilization threshold for emergency cleanup */
  poolUtilizationThreshold: number;
}

export interface QualitySettings {
  /** Maximum visible beacons at this quality level */
  maxBeacons: number;
  /** Enable animations and effects */
  enableAnimations: boolean;
  /** Enable glow effects */
  enableGlowEffects: boolean;
  /** Enable clustering system */
  enableClustering: boolean;
  /** Enable spatial culling */
  enableSpatialCulling: boolean;
  /** Enable LOD system */
  enableLOD: boolean;
  /** Frame skip interval during performance degradation (0 = no skipping) */
  frameSkipInterval: number;
  /** Rendering update throttle in ms */
  renderingThrottle: number;
}

export interface ModuleConfig {
  /** Whether the module is enabled */
  enabled: boolean;
  /** Priority level for resource allocation */
  priority: number;
  /** Performance mode - reduces rendering quality */
  performanceMode: boolean;
  /** Debug mode - enables extra logging and metrics */
  debugMode: boolean;
}

export interface GalaxyMapConfigState {
  /** Current rendering quality level */
  qualityLevel: QualityLevel;
  /** Performance mode - automatically reduces quality */
  performanceMode: boolean;
  /** Debug mode for all modules */
  globalDebugMode: boolean;
  /** Module-specific configurations */
  modules: Record<ModuleId, ModuleConfig>;
  /** Performance thresholds */
  thresholds: PerformanceThresholds;
  /** Quality-specific settings */
  qualitySettings: Record<QualityLevel, QualitySettings>;
  /** Auto-optimization enabled */
  autoOptimization: boolean;
  /** Frame skipping enabled during performance issues */
  frameSkippingEnabled: boolean;
  /** Emergency object pool cleanup enabled */
  emergencyCleanupEnabled: boolean;
  /** Quality lock prevents auto-optimization from changing quality */
  qualityLocked: boolean;
  /** Timestamp when quality was last manually set */
  lastManualQualityChange: number;
}

export class GalaxyMapConfig {
  private state: GalaxyMapConfigState;
  private listeners: Set<(config: GalaxyMapConfigState) => void> = new Set();
  private performanceHistory: number[] = [];
  private lastPerformanceCheck = Date.now();
  private frameCount = 0;
  private skippedFrames = 0;

  constructor(initialConfig?: Partial<GalaxyMapConfigState>) {
    this.state = {
      qualityLevel: 'high',
      performanceMode: false,
      globalDebugMode: false,
      modules: {},
      thresholds: {
        targetFps: 60,
        criticalFps: 45,
        maxFrameTime: 16.67,
        maxVisibleBeacons: 500,
        clusteringThreshold: 100,
        poolUtilizationThreshold: 0.8,
      },
      qualitySettings: {
        ultra: {
          maxBeacons: 1000,
          enableAnimations: true,
          enableGlowEffects: true,
          enableClustering: true,
          enableSpatialCulling: true,
          enableLOD: true,
          frameSkipInterval: 0,
          renderingThrottle: 0,
        },
        high: {
          maxBeacons: 500,
          enableAnimations: true,
          enableGlowEffects: true,
          enableClustering: true,
          enableSpatialCulling: true,
          enableLOD: true,
          frameSkipInterval: 0,
          renderingThrottle: 0,
        },
        medium: {
          maxBeacons: 250,
          enableAnimations: false,
          enableGlowEffects: false,
          enableClustering: true,
          enableSpatialCulling: true,
          enableLOD: true,
          frameSkipInterval: 0,
          renderingThrottle: 16,
        },
        low: {
          maxBeacons: 100,
          enableAnimations: false,
          enableGlowEffects: false,
          enableClustering: true,
          enableSpatialCulling: true,
          enableLOD: true,
          frameSkipInterval: 2, // Skip every 2nd frame
          renderingThrottle: 33, // ~30fps
        },
      },
      autoOptimization: true,
      frameSkippingEnabled: true,
      emergencyCleanupEnabled: true,
      qualityLocked: false,
      lastManualQualityChange: 0,
      ...initialConfig,
    };
  }

  /**
   * Get current configuration state
   */
  getState(): GalaxyMapConfigState {
    return { ...this.state };
  }

  /**
   * Get current quality settings
   */
  getCurrentQualitySettings(): QualitySettings {
    return this.state.qualitySettings[this.state.qualityLevel];
  }

  /**
   * Update quality level
   */
  setQualityLevel(level: QualityLevel, reason?: string): void {
    if (this.state.qualityLevel !== level) {
      const isManual = reason === 'manual' || reason?.includes('manual');
      console.log(`[GalaxyMapConfig] Quality level changed: ${this.state.qualityLevel} -> ${level}${reason ? ` (${reason})` : ''}`);
      
      this.state.qualityLevel = level;
      
      // Lock quality and disable auto-optimization temporarily when manually set
      if (isManual) {
        this.state.qualityLocked = true;
        this.state.lastManualQualityChange = Date.now();
        console.log('[GalaxyMapConfig] Quality locked due to manual change - auto-optimization disabled for 30s');
      }
      
      // Auto-enable performance mode for low quality
      if (level === 'low' && !this.state.performanceMode) {
        this.state.performanceMode = true;
      }
      
      this.notifyListeners();
    }
  }

  /**
   * Enable/disable module
   */
  setModuleEnabled(moduleId: ModuleId, enabled: boolean): void {
    if (!this.state.modules[moduleId]) {
      this.state.modules[moduleId] = {
        enabled,
        priority: 1,
        performanceMode: this.state.performanceMode,
        debugMode: this.state.globalDebugMode,
      };
    } else {
      this.state.modules[moduleId].enabled = enabled;
    }
    
    console.log(`[GalaxyMapConfig] Module ${moduleId} ${enabled ? 'enabled' : 'disabled'}`);
    this.notifyListeners();
  }

  /**
   * Update module configuration
   */
  updateModuleConfig(moduleId: ModuleId, config: Partial<ModuleConfig>): void {
    if (!this.state.modules[moduleId]) {
      this.state.modules[moduleId] = {
        enabled: true,
        priority: 1,
        performanceMode: this.state.performanceMode,
        debugMode: this.state.globalDebugMode,
      };
    }
    
    Object.assign(this.state.modules[moduleId], config);
    this.notifyListeners();
  }

  /**
   * Get module configuration
   */
  getModuleConfig(moduleId: ModuleId): ModuleConfig {
    return this.state.modules[moduleId] || {
      enabled: true,
      priority: 1,
      performanceMode: this.state.performanceMode,
      debugMode: this.state.globalDebugMode,
    };
  }

  /**
   * Update performance thresholds
   */
  updateThresholds(thresholds: Partial<PerformanceThresholds>): void {
    Object.assign(this.state.thresholds, thresholds);
    this.notifyListeners();
  }

  /**
   * Report performance metrics for auto-optimization
   */
  reportPerformance(fps: number, frameTime: number): void {
    this.frameCount++;
    this.performanceHistory.push(fps);
    
    // Keep only last 60 frames of history
    if (this.performanceHistory.length > 60) {
      this.performanceHistory.shift();
    }

    const now = Date.now();
    const timeSinceCheck = now - this.lastPerformanceCheck;
    
    // Check performance every second
    if (timeSinceCheck > 1000 && this.state.autoOptimization) {
      this.checkAndOptimizePerformance();
      this.lastPerformanceCheck = now;
    }

    // Emergency object pool cleanup if utilization is too high
    if (this.state.emergencyCleanupEnabled) {
      this.checkPoolUtilization();
    }
  }

  /**
   * Check if current frame should be skipped for performance
   */
  shouldSkipFrame(): boolean {
    if (!this.state.frameSkippingEnabled) return false;
    
    const qualitySettings = this.getCurrentQualitySettings();
    const skipInterval = qualitySettings.frameSkipInterval;
    
    if (skipInterval > 0) {
      const shouldSkip = this.frameCount % (skipInterval + 1) !== 0;
      if (shouldSkip) {
        this.skippedFrames++;
      }
      return shouldSkip;
    }
    
    return false;
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    const avgFps = this.performanceHistory.length > 0 
      ? this.performanceHistory.reduce((sum, fps) => sum + fps, 0) / this.performanceHistory.length
      : 60;
    
    const poolStats = poolManager.getStats();
    
    return {
      averageFps: Math.round(avgFps * 100) / 100,
      frameCount: this.frameCount,
      skippedFrames: this.skippedFrames,
      skipRatio: this.frameCount > 0 ? this.skippedFrames / this.frameCount : 0,
      currentQuality: this.state.qualityLevel,
      performanceMode: this.state.performanceMode,
      poolStats,
      enabledModules: Object.entries(this.state.modules)
        .filter(([_, config]) => config.enabled)
        .map(([id]) => id),
      disabledModules: Object.entries(this.state.modules)
        .filter(([_, config]) => !config.enabled)
        .map(([id]) => id),
    };
  }

  /**
   * Force emergency object pool cleanup
   */
  emergencyPoolCleanup(): void {
    console.warn('[GalaxyMapConfig] Executing emergency object pool cleanup');
    poolManager.clearAll();
    
    // Re-initialize with smaller pools
    poolManager.initialize();
    
    // Force performance mode
    if (!this.state.performanceMode) {
      this.state.performanceMode = true;
      this.setQualityLevel('low', 'emergency cleanup');
    }
  }

  /**
   * Reset to defaults with emergency mode
   */
  emergencyReset(): void {
    console.warn('[GalaxyMapConfig] Emergency reset triggered');
    
    // Disable all non-critical modules
    Object.keys(this.state.modules).forEach(moduleId => {
      if (!['beacon-rendering', 'gesture'].includes(moduleId)) {
        this.setModuleEnabled(moduleId, false);
      }
    });
    
    // Set to lowest quality
    this.setQualityLevel('low', 'emergency reset');
    this.state.performanceMode = true;
    
    // Clear object pools
    this.emergencyPoolCleanup();
  }

  /**
   * Subscribe to configuration changes
   */
  subscribe(listener: (config: GalaxyMapConfigState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Export current configuration for persistence
   */
  exportConfig(): object {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Import configuration from saved state
   */
  importConfig(config: any): void {
    try {
      Object.assign(this.state, config);
      this.notifyListeners();
      console.log('[GalaxyMapConfig] Configuration imported successfully');
    } catch (error) {
      console.error('[GalaxyMapConfig] Failed to import configuration:', error);
    }
  }

  private checkAndOptimizePerformance(): void {
    // Skip if quality is locked or not enough data
    if (this.performanceHistory.length < 60) return; // Need 60 frames of data (1 second)
    
    // Check if quality is locked due to recent manual change (30 second timeout)
    const timeSinceManualChange = Date.now() - this.state.lastManualQualityChange;
    if (this.state.qualityLocked && timeSinceManualChange < 30000) {
      return; // Skip auto-optimization for 30 seconds after manual change
    } else if (this.state.qualityLocked && timeSinceManualChange >= 30000) {
      // Unlock quality after 30 seconds
      this.state.qualityLocked = false;
      console.log('[GalaxyMapConfig] Quality unlocked - auto-optimization re-enabled');
    }
    
    if (!this.state.autoOptimization) return;
    
    const avgFps = this.performanceHistory.reduce((sum, fps) => sum + fps, 0) / this.performanceHistory.length;
    const { targetFps, criticalFps } = this.state.thresholds;
    
    // Performance is critically low - be aggressive about reducing quality
    if (avgFps < criticalFps && this.state.qualityLevel !== 'low') {
      const newLevel = avgFps < criticalFps * 0.7 ? 'low' : 
                       avgFps < criticalFps * 0.8 ? 'medium' : 'high';
      this.setQualityLevel(newLevel, `auto: low FPS ${Math.round(avgFps)}`);
    }
    // Performance is very good, can increase quality - be more conservative
    else if (avgFps >= targetFps * 0.98 && this.state.qualityLevel !== 'ultra') {
      // Only upgrade if FPS has been consistently good for the entire sample
      const minFps = Math.min(...this.performanceHistory);
      if (minFps >= targetFps * 0.95) { // Minimum FPS also good
        const newLevel = this.state.qualityLevel === 'low' ? 'medium' :
                         this.state.qualityLevel === 'medium' ? 'high' : 'ultra';
        this.setQualityLevel(newLevel, `auto: sustained FPS ${Math.round(avgFps)}`);
      }
    }
  }

  private checkPoolUtilization(): void {
    const poolStats = poolManager.getStats();
    let highUtilization = false;
    
    Object.values(poolStats).forEach((stats: any) => {
      if (stats.utilizationRate > this.state.thresholds.poolUtilizationThreshold) {
        highUtilization = true;
      }
    });
    
    if (highUtilization) {
      console.warn('[GalaxyMapConfig] High object pool utilization detected, triggering cleanup');
      this.emergencyPoolCleanup();
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.state);
      } catch (error) {
        console.error('[GalaxyMapConfig] Error in configuration listener:', error);
      }
    });
  }
}

// Create singleton instance
export const galaxyMapConfig = new GalaxyMapConfig();

// Debug utilities
if (typeof window !== 'undefined') {
  (window as any).galaxyMapConfig = galaxyMapConfig;
}