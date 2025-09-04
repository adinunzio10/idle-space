import React from 'react';
import { BaseModule } from '../BaseModule';
import { ModuleContext, ModuleRenderResult, ModuleCategory } from '../types';
import { GalacticSector, ViewportState } from '../../../../types/galaxy';
import { 
  EntropyVisualizationComponent, 
  MultiSectorEntropyVisualization,
  generateEntropyRenderData,
  analyzeEntropyDistribution
} from '../../../../components/galaxy/EntropyVisualization';
import { 
  VisualDecayEffectsComponent,
  MultipleSectorDecayEffects,
  calculateDecayEffectLoad
} from '../../../../components/galaxy/VisualDecayEffects';
import { EntropySpreadManager } from '../../../entropy/EntropySpreadManager';

interface EntropyModuleConfig {
  maxEntropySectors: number;
  entropyThreshold: number;
  particleQuality: number;
  enableDecayEffects: boolean;
  enableParticleSystem: boolean;
  performanceThresholds: {
    targetFps: number;
    maxRenderTime: number;
  };
}

export class EntropyModule extends BaseModule {
  readonly id = 'entropy-effects';
  readonly name = 'Entropy Effects Module';
  readonly version = '1.0.0';
  readonly category: ModuleCategory = 'effects';
  readonly dependencies: string[] = []; // No dependencies for entropy effects

  private entropySpreadManager: EntropySpreadManager | null = null;
  private sectorMap: Map<string, GalacticSector> = new Map();
  private visibleEntropySectors: GalacticSector[] = [];
  private lastEntropyUpdate = 0;
  private performanceMetrics = {
    entropySectorCount: 0,
    decayEffectCount: 0,
    renderTime: 0,
    culledSectors: 0,
    particleCount: 0,
    effectLoad: 0,
  };

  private entropyConfig: EntropyModuleConfig = {
    maxEntropySectors: 50,
    entropyThreshold: 0.05,
    particleQuality: 0.8,
    enableDecayEffects: true,
    enableParticleSystem: true,
    performanceThresholds: {
      targetFps: 45, // Lower threshold for effects
      maxRenderTime: 20, // Allow slightly more time for complex effects
    },
  };

  protected async onInitialize(context: ModuleContext): Promise<void> {
    this.logDebug('Initializing entropy effects resources');
    this.logDebug('Context received:', {
      hasViewport: !!context.viewport,
      hasScreenDimensions: !!context.screenDimensions,
      beaconCount: context.beacons?.length || 0,
      sectorsType: typeof context.sectors,
      sectorsIsArray: Array.isArray(context.sectors),
      sectorsLength: context.sectors?.length || 'undefined',
      starSystemsLength: context.starSystems?.length || 'undefined',
    });
    
    // Initialize entropy spread manager with empty sectors initially
    this.entropySpreadManager = new EntropySpreadManager(
      [], // Start with empty sectors array
      {
        baseSpreadRate: 0.002,
        naturalDecayRate: 0.001,
        maxEntropy: 1.0,
      }
    );
    
    // Build initial sector map (only if sectors are available)
    if (context.sectors && Array.isArray(context.sectors) && context.sectors.length > 0) {
      this.rebuildSectorMap(context.sectors);
      this.updateVisibleEntropySectors(context);
    } else {
      this.logDebug('No sectors available during initialization - will initialize on first update');
    }

    this.logDebug('Configuration:', this.entropyConfig);
  }

  protected async onEnable(): Promise<void> {
    this.logDebug('Enabling entropy effects');
    // Entropy spread manager is always active - no enable/disable methods
  }

  protected async onDisable(): Promise<void> {
    this.logDebug('Disabling entropy effects');
    this.visibleEntropySectors = [];
    // Entropy spread manager is always active - no enable/disable methods
  }

  protected async onCleanup(): Promise<void> {
    this.logDebug('Cleaning up entropy resources');
    this.entropySpreadManager = null;
    this.sectorMap.clear();
    this.visibleEntropySectors = [];
  }

  protected onUpdate(context: ModuleContext): void {
    const startTime = performance.now();
    
    // Early return if no sectors available
    if (!context.sectors || !Array.isArray(context.sectors)) {
      return;
    }
    
    // Check if sectors have been updated
    const sectorHash = this.generateSectorHash(context.sectors);
    if (sectorHash !== this.lastEntropyUpdate) {
      this.rebuildSectorMap(context.sectors);
      this.lastEntropyUpdate = sectorHash;
    }

    // Update entropy spreading logic
    if (this.entropySpreadManager && context.sectors) {
      this.entropySpreadManager.updateSectors(context.sectors);
    }

    // Update visible entropy sectors based on viewport
    this.updateVisibleEntropySectors(context);

    const endTime = performance.now();
    this.performanceMetrics.renderTime = endTime - startTime;

    // Auto-adjust performance settings based on frame rate
    this.adjustPerformanceSettings(context);

    // Log performance metrics periodically
    if (context.frameCount % 120 === 0 && this.config.debugMode) {
      const distribution = analyzeEntropyDistribution(context.sectors);
      this.logDebug('Performance metrics:', {
        ...this.performanceMetrics,
        fps: this.metrics.averageFps,
        distribution,
      });
    }
  }

  protected onRender(context: ModuleContext): ModuleRenderResult {
    if (!this.config.enabled) {
      return {
        elements: [],
        shouldContinueRendering: false,
        performanceImpact: 'low',
      };
    }

    const elements: React.ReactNode[] = [];
    const startTime = performance.now();

    try {
      // Performance check - reduce quality if FPS is low
      const effectiveParticleQuality = this.metrics.averageFps < this.entropyConfig.performanceThresholds.targetFps * 0.8
        ? this.entropyConfig.particleQuality * 0.5
        : this.entropyConfig.particleQuality;

      // Render entropy visualization
      if (this.visibleEntropySectors.length > 0) {
        elements.push(
          React.createElement(MultiSectorEntropyVisualization, {
            key: 'entropy-visualization',
            sectors: this.visibleEntropySectors,
            viewportState: context.viewport,
            entropyThreshold: this.entropyConfig.entropyThreshold,
            maxRenderCount: this.config.performanceMode ? 
              Math.floor(this.entropyConfig.maxEntropySectors * 0.6) : 
              this.entropyConfig.maxEntropySectors,
            enableParticleSystem: this.entropyConfig.enableParticleSystem && !this.config.performanceMode,
            particleQuality: effectiveParticleQuality,
          })
        );
      }

      // Render decay effects if enabled
      if (this.entropyConfig.enableDecayEffects && this.visibleEntropySectors.length > 0) {
        const highEntropySectors = this.visibleEntropySectors.filter(s => s.entropy > 0.6);
        
        if (highEntropySectors.length > 0) {
          elements.push(
            React.createElement(MultipleSectorDecayEffects, {
              key: 'decay-effects',
              sectors: highEntropySectors,
              sectorMap: this.sectorMap,
              viewportState: context.viewport,
              maxEffectSectors: this.config.performanceMode ? 8 : 15,
            })
          );
        }
      }

      // Update performance metrics
      this.performanceMetrics.entropySectorCount = this.visibleEntropySectors.length;
      this.performanceMetrics.decayEffectCount = this.visibleEntropySectors.filter(s => s.entropy > 0.6).length;

      // Calculate effect load
      const effectLoad = calculateDecayEffectLoad(this.visibleEntropySectors, context.viewport);
      this.performanceMetrics.effectLoad = effectLoad.totalEffectLoad;
      this.performanceMetrics.particleCount = effectLoad.activeParticleCount;

      const endTime = performance.now();
      this.performanceMetrics.renderTime = endTime - startTime;

      // Determine performance impact
      let performanceImpact: 'low' | 'medium' | 'high' = 'low';
      if (this.performanceMetrics.renderTime > 15) {
        performanceImpact = 'high';
      } else if (this.performanceMetrics.renderTime > 8) {
        performanceImpact = 'medium';
      }

      // Check if rendering took too long
      if (this.performanceMetrics.renderTime > this.entropyConfig.performanceThresholds.maxRenderTime) {
        console.warn('[EntropyModule] Render time exceeded threshold:', {
          renderTime: this.performanceMetrics.renderTime,
          threshold: this.entropyConfig.performanceThresholds.maxRenderTime,
          sectorCount: this.visibleEntropySectors.length,
        });
        
        // Automatically reduce quality
        this.adjustPerformanceSettings(context, 'reduce');
      }

      return {
        elements,
        shouldContinueRendering: true,
        performanceImpact,
      };

    } catch (error) {
      console.error('[EntropyModule] Error rendering entropy effects:', error);
      return {
        elements: [],
        shouldContinueRendering: true,
        performanceImpact: 'low',
      };
    }
  }

  private generateSectorHash(sectors: GalacticSector[]): number {
    // Handle undefined or empty sectors
    if (!sectors || !Array.isArray(sectors)) {
      return 0;
    }

    // Simple hash based on sector count and entropy values
    let hash = sectors.length;
    for (let i = 0; i < Math.min(sectors.length, 5); i++) {
      hash = hash * 31 + Math.floor(sectors[i]?.entropy * 100 || 0);
    }
    return hash;
  }

  private rebuildSectorMap(sectors: GalacticSector[]): void {
    this.sectorMap.clear();
    if (sectors && Array.isArray(sectors)) {
      sectors.forEach(sector => {
        this.sectorMap.set(sector.id, sector);
      });
    }
  }

  private updateVisibleEntropySectors(context: ModuleContext): void {
    // Early return if no sectors available
    if (!context.sectors || !Array.isArray(context.sectors)) {
      this.visibleEntropySectors = [];
      return;
    }

    // Filter sectors by entropy threshold
    const entropySectors = context.sectors.filter(s => s.entropy >= this.entropyConfig.entropyThreshold);
    
    // Viewport culling
    const viewportBounds = {
      minX: -context.viewport.translateX / context.viewport.scale - 100,
      maxX: (-context.viewport.translateX + context.screenDimensions.width) / context.viewport.scale + 100,
      minY: -context.viewport.translateY / context.viewport.scale - 100,
      maxY: (-context.viewport.translateY + context.screenDimensions.height) / context.viewport.scale + 100,
    };

    const visibleSectors = entropySectors.filter(sector => {
      return sector.bounds.minX < viewportBounds.maxX &&
             sector.bounds.maxX > viewportBounds.minX &&
             sector.bounds.minY < viewportBounds.maxY &&
             sector.bounds.maxY > viewportBounds.minY;
    });

    // Sort by entropy level (higher entropy = higher priority)
    visibleSectors.sort((a, b) => b.entropy - a.entropy);

    // Apply performance limits
    const maxSectors = this.config.performanceMode ? 
      Math.floor(this.entropyConfig.maxEntropySectors * 0.5) : 
      this.entropyConfig.maxEntropySectors;

    this.visibleEntropySectors = visibleSectors.slice(0, maxSectors);
    this.performanceMetrics.culledSectors = visibleSectors.length - this.visibleEntropySectors.length;

    if (this.config.debugMode && this.performanceMetrics.culledSectors > 0) {
      this.logDebug(`Culled ${this.performanceMetrics.culledSectors} entropy sectors for performance`);
    }
  }

  private adjustPerformanceSettings(context: ModuleContext, action?: 'reduce' | 'increase'): void {
    const currentFps = this.metrics.averageFps;
    const targetFps = this.entropyConfig.performanceThresholds.targetFps;

    if (action === 'reduce' || (currentFps < targetFps * 0.8 && !action)) {
      // Reduce performance settings
      this.entropyConfig.maxEntropySectors = Math.max(20, this.entropyConfig.maxEntropySectors * 0.8);
      this.entropyConfig.particleQuality = Math.max(0.3, this.entropyConfig.particleQuality * 0.9);
      this.entropyConfig.entropyThreshold = Math.min(0.2, this.entropyConfig.entropyThreshold * 1.1);
      
      if (!this.config.performanceMode) {
        this.logDebug('Automatically reducing entropy performance settings');
        this.updateConfig({ performanceMode: true });
      }
    } else if (action === 'increase' || (currentFps > targetFps * 1.1 && this.config.performanceMode)) {
      // Increase performance settings when performance recovers
      this.entropyConfig.maxEntropySectors = Math.min(100, this.entropyConfig.maxEntropySectors * 1.1);
      this.entropyConfig.particleQuality = Math.min(1.0, this.entropyConfig.particleQuality * 1.05);
      this.entropyConfig.entropyThreshold = Math.max(0.05, this.entropyConfig.entropyThreshold * 0.95);
      
      if (this.config.performanceMode && currentFps > targetFps * 1.2) {
        this.logDebug('Performance recovered, increasing entropy settings');
        this.updateConfig({ performanceMode: false });
      }
    }
  }

  // Public API for configuration
  public updateEntropyConfig(newConfig: Partial<EntropyModuleConfig>): void {
    this.entropyConfig = { ...this.entropyConfig, ...newConfig };
    this.logDebug('Updated configuration:', this.entropyConfig);
  }

  public getEntropyMetrics() {
    return {
      ...this.performanceMetrics,
      config: this.entropyConfig,
      entropySpreadStats: this.entropySpreadManager ? { 
        activeSectors: this.visibleEntropySectors.length,
        totalEntropy: this.visibleEntropySectors.reduce((sum, s) => sum + s.entropy, 0)
      } : null,
    };
  }

  public getEntropyData() {
    return generateEntropyRenderData(this.visibleEntropySectors, {
      translateX: 0,
      translateY: 0,
      scale: 1,
      bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
    });
  }
}