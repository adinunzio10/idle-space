import React from 'react';
import { BaseModule } from '../BaseModule';
import { ModuleContext, ModuleRenderResult, ModuleCategory } from '../types';
import { ViewportState, GalacticSector, StarSystem } from '../../../../types/galaxy';
import { PatternSuggestion, PatternSuggestionState } from '../../../../types/spatialHashing';
import { GalaxyOverlaySystem } from '../../../../components/galaxy/GalaxyOverlaySystem';
import { PatternSuggestionOverlay, usePatternSuggestionState } from '../../../../components/galaxy/PatternSuggestionOverlay';
import HarvestOverlay from '../../../../components/galaxy/HarvestOverlay';
import { OverlayConfiguration, DEFAULT_OVERLAY_CONFIG } from '../../SectorOverlayManager';

interface OverlayModuleConfig {
  maxOverlayElements: number;
  enablePatternSuggestions: boolean;
  enableHarvestOverlays: boolean;
  enableGalaxyOverlaySystem: boolean;
  patternSuggestionConfig: {
    maxSuggestions: number;
    displayMode: 'all' | 'best' | 'high-value' | 'near-cursor';
    enableAnimations: boolean;
  };
  harvestOverlayConfig: {
    maxHarvestIndicators: number;
    enableGlowEffects: boolean;
    enableResourceTracking: boolean;
  };
  performanceThresholds: {
    targetFps: number;
    maxRenderTime: number;
  };
}

export class OverlayModule extends BaseModule {
  readonly id = 'ui-overlays';
  readonly name = 'UI Overlay Module';
  readonly version = '1.0.0';
  readonly category: ModuleCategory = 'ui';
  readonly dependencies: string[] = []; // No dependencies for UI overlays

  private overlayConfiguration: OverlayConfiguration = DEFAULT_OVERLAY_CONFIG;
  private patternSuggestions: PatternSuggestion[] = [];
  private patternSuggestionState: PatternSuggestionState = {
    popupVisible: true,
    mapVisualizationsVisible: true,
    selectedSuggestion: null,
    hoveredSuggestion: null,
    dismissedSuggestions: new Set(),
    autoHideTimer: null,
    displayMode: 'all',
  };
  
  private visibleOverlays: {
    type: 'pattern-suggestions' | 'harvest-indicators' | 'galaxy-system';
    priority: number;
    renderCost: number;
  }[] = [];

  private performanceMetrics = {
    overlayCount: 0,
    patternSuggestionsCount: 0,
    harvestIndicatorsCount: 0,
    renderTime: 0,
    culledOverlays: 0,
    interactionEvents: 0,
  };

  private overlayConfig: OverlayModuleConfig = {
    maxOverlayElements: 100,
    enablePatternSuggestions: true,
    enableHarvestOverlays: true,
    enableGalaxyOverlaySystem: true,
    patternSuggestionConfig: {
      maxSuggestions: 15,
      displayMode: 'all',
      enableAnimations: true,
    },
    harvestOverlayConfig: {
      maxHarvestIndicators: 25,
      enableGlowEffects: true,
      enableResourceTracking: true,
    },
    performanceThresholds: {
      targetFps: 45, // Lower threshold for UI elements
      maxRenderTime: 12, // UI should be lightweight
    },
  };

  protected async onInitialize(context: ModuleContext): Promise<void> {
    this.logDebug('Initializing UI overlay resources');
    
    // Initialize overlay configuration based on screen size
    this.updateOverlayConfiguration(context);
    
    // Initialize pattern suggestion state
    this.initializePatternSuggestionState();

    this.logDebug('Configuration:', this.overlayConfig);
  }

  protected async onEnable(): Promise<void> {
    this.logDebug('Enabling UI overlays');
    this.patternSuggestionState.mapVisualizationsVisible = true;
  }

  protected async onDisable(): Promise<void> {
    this.logDebug('Disabling UI overlays');
    this.patternSuggestionState.mapVisualizationsVisible = false;
    this.visibleOverlays = [];
  }

  protected async onCleanup(): Promise<void> {
    this.logDebug('Cleaning up overlay resources');
    this.patternSuggestions = [];
    this.visibleOverlays = [];
    if (this.patternSuggestionState.autoHideTimer) {
      clearTimeout(this.patternSuggestionState.autoHideTimer);
    }
  }

  protected onUpdate(context: ModuleContext): void {
    const startTime = performance.now();
    
    // Update overlay configuration based on performance
    if (context.frameCount % 60 === 0) { // Update every second at 60fps
      this.updateOverlayConfiguration(context);
    }

    // Generate pattern suggestions (mock for now - would integrate with actual pattern detection)
    this.updatePatternSuggestions(context);

    // Update visible overlays based on viewport
    this.updateVisibleOverlays(context);

    // Auto-adjust performance settings
    this.adjustPerformanceSettings(context);

    const endTime = performance.now();
    this.performanceMetrics.renderTime = endTime - startTime;

    // Log performance metrics periodically
    if (context.frameCount % 120 === 0 && this.config.debugMode) {
      this.logDebug('Performance metrics:', {
        ...this.performanceMetrics,
        fps: this.metrics.averageFps,
        overlayConfig: this.overlayConfig,
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
      // Performance-based overlay culling
      const allowedOverlays = this.prioritizeOverlays();

      // Render Galaxy Overlay System (comprehensive overlay management)
      if (this.overlayConfig.enableGalaxyOverlaySystem && allowedOverlays.includes('galaxy-system')) {
        elements.push(
          React.createElement(GalaxyOverlaySystem, {
            key: 'galaxy-overlay-system',
            sectors: context.sectors || [],
            starSystems: context.starSystems || [],
            viewportState: context.viewport,
            initialConfig: this.overlayConfiguration,
            enablePerformanceAdaptation: !this.config.performanceMode,
            showControls: false, // Disable controls in modular system
            enableTransitions: !this.config.performanceMode,
            testingMode: this.config.debugMode,
            onPerformanceUpdate: this.handlePerformanceUpdate.bind(this),
            onConfigurationChange: this.handleConfigurationChange.bind(this),
            onResourceHarvest: this.handleResourceHarvest.bind(this),
          })
        );
      }

      // Render Pattern Suggestions
      if (this.overlayConfig.enablePatternSuggestions && 
          allowedOverlays.includes('pattern-suggestions') && 
          this.patternSuggestions.length > 0) {
        elements.push(
          React.createElement(PatternSuggestionOverlay, {
            key: 'pattern-suggestions',
            suggestions: this.patternSuggestions.slice(0, this.overlayConfig.patternSuggestionConfig.maxSuggestions),
            beacons: context.beacons,
            viewportState: context.viewport,
            suggestionState: this.patternSuggestionState,
            showGhostBeacons: !this.config.performanceMode,
            showPatternPreviews: !this.config.performanceMode,
            enableAnimations: this.overlayConfig.patternSuggestionConfig.enableAnimations && !this.config.performanceMode,
            onSuggestionInteraction: this.handleSuggestionInteraction.bind(this),
          })
        );
      }

      // Render Harvest Overlays for individual star systems
      if (this.overlayConfig.enableHarvestOverlays && allowedOverlays.includes('harvest-indicators')) {
        const visibleStarSystems = this.getVisibleStarSystems(context);
        const maxHarvest = Math.min(
          this.overlayConfig.harvestOverlayConfig.maxHarvestIndicators,
          this.config.performanceMode ? 10 : 25
        );

        visibleStarSystems.slice(0, maxHarvest).forEach((starSystem, index) => {
          if (this.shouldShowHarvestOverlay(starSystem)) {
            elements.push(
              React.createElement(HarvestOverlay, {
                key: `harvest-${starSystem.id}`,
                starSystem: starSystem,
                viewportState: context.viewport,
                isOverlayActive: context.viewport.scale > 0.5,
                showResourceValues: !this.config.performanceMode,
                enableGlowEffects: this.overlayConfig.harvestOverlayConfig.enableGlowEffects && !this.config.performanceMode,
                enableAnimations: !this.config.performanceMode,
                onHarvest: this.handleResourceHarvestTwoParam.bind(this),
              })
            );
          }
        });
      }

      // Update performance metrics
      this.performanceMetrics.overlayCount = elements.length;
      this.performanceMetrics.patternSuggestionsCount = this.patternSuggestions.length;
      
      const endTime = performance.now();
      this.performanceMetrics.renderTime = endTime - startTime;

      // Determine performance impact
      let performanceImpact: 'low' | 'medium' | 'high' = 'low';
      if (this.performanceMetrics.renderTime > 10) {
        performanceImpact = 'high';
      } else if (this.performanceMetrics.renderTime > 5) {
        performanceImpact = 'medium';
      }

      // Check if rendering took too long
      if (this.performanceMetrics.renderTime > this.overlayConfig.performanceThresholds.maxRenderTime) {
        console.warn('[OverlayModule] Render time exceeded threshold:', {
          renderTime: this.performanceMetrics.renderTime,
          threshold: this.overlayConfig.performanceThresholds.maxRenderTime,
          overlayCount: elements.length,
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
      console.error('[OverlayModule] Error rendering UI overlays:', error);
      return {
        elements: [],
        shouldContinueRendering: true,
        performanceImpact: 'low',
      };
    }
  }

  private initializePatternSuggestionState(): void {
    this.patternSuggestionState = {
      popupVisible: true,
      mapVisualizationsVisible: true,
      selectedSuggestion: null,
      hoveredSuggestion: null,
      dismissedSuggestions: new Set(),
      autoHideTimer: null,
      displayMode: this.overlayConfig.patternSuggestionConfig.displayMode,
    };
  }

  private updateOverlayConfiguration(context: ModuleContext): void {
    // Adapt overlay configuration based on screen size and performance
    const screenArea = context.screenDimensions.width * context.screenDimensions.height;
    const isLargeScreen = screenArea > 800 * 600;
    
    this.overlayConfiguration = {
      ...this.overlayConfiguration,
      quality: {
        ...this.overlayConfiguration.quality,
        maxSectors: isLargeScreen ? 50 : 30,
        maxEntropyEffects: isLargeScreen ? 25 : 15,
        maxHarvestIndicators: isLargeScreen ? 30 : 20,
        particleQuality: this.config.performanceMode ? 0.5 : 0.8,
      },
      animations: {
        ...this.overlayConfiguration.animations,
        enableTransitions: !this.config.performanceMode,
        enablePulseEffects: !this.config.performanceMode,
        enableParticleAnimations: !this.config.performanceMode && isLargeScreen,
      },
    };
  }

  private updatePatternSuggestions(context: ModuleContext): void {
    // Early return if no beacons available
    if (!context.beacons || !Array.isArray(context.beacons) || context.beacons.length < 2 || this.config.performanceMode) {
      this.patternSuggestions = [];
      return;
    }

    // Generate mock suggestions for demonstration
    const mockSuggestions: PatternSuggestion[] = [];
    const maxSuggestions = Math.min(this.overlayConfig.patternSuggestionConfig.maxSuggestions, 5);

    for (let i = 0; i < maxSuggestions && i < context.beacons.length - 1; i++) {
      const beacon = context.beacons[i];
      if (!beacon) continue;

      mockSuggestions.push({
        id: `suggestion-${i}`,
        type: 'triangle' as any,
        suggestedPosition: {
          x: beacon.position.x + 100 + Math.random() * 50,
          y: beacon.position.y + 100 + Math.random() * 50,
        },
        requiredBeacons: [beacon.id],
        potentialBonus: 1.5 + Math.random() * 2,
        completionPercentage: Math.random() * 0.8 + 0.2,
        priority: Math.random(),
      });
    }

    this.patternSuggestions = mockSuggestions;
  }

  private updateVisibleOverlays(context: ModuleContext): void {
    this.visibleOverlays = [];

    // Add galaxy system overlay (highest priority, lowest cost)
    if (this.overlayConfig.enableGalaxyOverlaySystem) {
      this.visibleOverlays.push({
        type: 'galaxy-system',
        priority: 10,
        renderCost: 3,
      });
    }

    // Add pattern suggestions (medium priority, medium cost)
    if (this.overlayConfig.enablePatternSuggestions && this.patternSuggestions.length > 0) {
      this.visibleOverlays.push({
        type: 'pattern-suggestions',
        priority: 7,
        renderCost: 5,
      });
    }

    // Add harvest indicators (lower priority, variable cost)
    if (this.overlayConfig.enableHarvestOverlays) {
      const visibleStarSystems = this.getVisibleStarSystems(context);
      const harvestCost = Math.min(visibleStarSystems.length * 0.2, 8);
      
      this.visibleOverlays.push({
        type: 'harvest-indicators',
        priority: 5,
        renderCost: harvestCost,
      });
    }
  }

  private prioritizeOverlays(): string[] {
    // Calculate total render cost
    const totalCost = this.visibleOverlays.reduce((sum, overlay) => sum + overlay.renderCost, 0);
    const maxCost = this.config.performanceMode ? 8 : 15;

    if (totalCost <= maxCost) {
      return this.visibleOverlays.map(o => o.type);
    }

    // Sort by priority and fit within budget
    const sorted = [...this.visibleOverlays].sort((a, b) => b.priority - a.priority);
    const allowed: string[] = [];
    let currentCost = 0;

    for (const overlay of sorted) {
      if (currentCost + overlay.renderCost <= maxCost) {
        allowed.push(overlay.type);
        currentCost += overlay.renderCost;
      }
    }

    this.performanceMetrics.culledOverlays = this.visibleOverlays.length - allowed.length;
    return allowed;
  }

  private getVisibleStarSystems(context: ModuleContext): StarSystem[] {
    // Early return if no star systems available
    if (!context.starSystems || !Array.isArray(context.starSystems)) {
      return [];
    }

    // Filter star systems based on viewport bounds
    const viewportBounds = {
      minX: -context.viewport.translateX / context.viewport.scale - 100,
      maxX: (-context.viewport.translateX + context.screenDimensions.width) / context.viewport.scale + 100,
      minY: -context.viewport.translateY / context.viewport.scale - 100,
      maxY: (-context.viewport.translateY + context.screenDimensions.height) / context.viewport.scale + 100,
    };

    return context.starSystems.filter(starSystem => {
      return starSystem.position.x >= viewportBounds.minX &&
             starSystem.position.x <= viewportBounds.maxX &&
             starSystem.position.y >= viewportBounds.minY &&
             starSystem.position.y <= viewportBounds.maxY;
    });
  }

  private shouldShowHarvestOverlay(starSystem: StarSystem): boolean {
    // Only show harvest overlay if there are harvestable resources
    return !!(starSystem.resources?.stellarEssence && starSystem.resources.stellarEssence > 0) ||
           !!(starSystem.resources?.voidFragments && starSystem.resources.voidFragments > 0);
  }

  private adjustPerformanceSettings(context: ModuleContext, action?: 'reduce' | 'increase'): void {
    const currentFps = this.metrics.averageFps;
    const targetFps = this.overlayConfig.performanceThresholds.targetFps;

    if (action === 'reduce' || (currentFps < targetFps * 0.8 && !action)) {
      // Reduce performance settings
      this.overlayConfig.maxOverlayElements = Math.max(20, this.overlayConfig.maxOverlayElements * 0.8);
      this.overlayConfig.patternSuggestionConfig.maxSuggestions = Math.max(3, this.overlayConfig.patternSuggestionConfig.maxSuggestions * 0.7);
      this.overlayConfig.harvestOverlayConfig.maxHarvestIndicators = Math.max(5, this.overlayConfig.harvestOverlayConfig.maxHarvestIndicators * 0.8);
      
      if (!this.config.performanceMode) {
        this.logDebug('Automatically reducing overlay performance settings');
        this.updateConfig({ performanceMode: true });
      }
    } else if (action === 'increase' || (currentFps > targetFps * 1.1 && this.config.performanceMode)) {
      // Increase performance settings when performance recovers
      this.overlayConfig.maxOverlayElements = Math.min(150, this.overlayConfig.maxOverlayElements * 1.1);
      this.overlayConfig.patternSuggestionConfig.maxSuggestions = Math.min(15, this.overlayConfig.patternSuggestionConfig.maxSuggestions * 1.1);
      this.overlayConfig.harvestOverlayConfig.maxHarvestIndicators = Math.min(30, this.overlayConfig.harvestOverlayConfig.maxHarvestIndicators * 1.1);
      
      if (this.config.performanceMode && currentFps > targetFps * 1.2) {
        this.logDebug('Performance recovered, increasing overlay settings');
        this.updateConfig({ performanceMode: false });
      }
    }
  }

  private handlePerformanceUpdate(metrics: any): void {
    if (this.config.debugMode) {
      this.logDebug('Galaxy overlay system performance update:', metrics);
    }
  }

  private handleConfigurationChange(config: OverlayConfiguration): void {
    this.overlayConfiguration = config;
    if (this.config.debugMode) {
      this.logDebug('Galaxy overlay configuration changed');
    }
  }

  private handleResourceHarvest(starSystem: StarSystem, resourceType: 'stellarEssence' | 'voidFragments', amount?: number): void {
    this.performanceMetrics.interactionEvents++;
    if (this.config.debugMode) {
      this.logDebug(`Resource harvested from ${starSystem.id}: ${amount || 'unknown'} ${resourceType}`);
    }
  }

  // Overload for 2-parameter version
  private handleResourceHarvestTwoParam(starSystem: StarSystem, resourceType: 'stellarEssence' | 'voidFragments'): void {
    const amount = resourceType === 'stellarEssence' 
      ? starSystem.resources?.stellarEssence || 0
      : starSystem.resources?.voidFragments || 0;
    this.handleResourceHarvest(starSystem, resourceType, amount);
  }

  private handleSuggestionInteraction(event: any): void {
    this.performanceMetrics.interactionEvents++;
    
    switch (event.type) {
      case 'select':
        this.patternSuggestionState.selectedSuggestion = event.suggestion;
        break;
      case 'hover':
        this.patternSuggestionState.hoveredSuggestion = event.suggestion;
        break;
      case 'dismiss':
        this.patternSuggestionState.dismissedSuggestions.add(event.suggestion.id);
        break;
    }

    if (this.config.debugMode) {
      this.logDebug('Pattern suggestion interaction:', event.type, event.suggestion.id);
    }
  }

  // Public API for configuration
  public updateOverlayConfig(newConfig: Partial<OverlayModuleConfig>): void {
    this.overlayConfig = { ...this.overlayConfig, ...newConfig };
    this.logDebug('Updated configuration:', this.overlayConfig);
  }

  public getOverlayMetrics() {
    return {
      ...this.performanceMetrics,
      config: this.overlayConfig,
      patternSuggestionState: this.patternSuggestionState,
      overlayConfiguration: this.overlayConfiguration,
    };
  }

  public dismissPatternSuggestion(suggestionId: string): void {
    this.patternSuggestionState.dismissedSuggestions.add(suggestionId);
  }

  public selectPatternSuggestion(suggestion: PatternSuggestion | null): void {
    this.patternSuggestionState.selectedSuggestion = suggestion;
  }

  public setPatternSuggestionDisplayMode(mode: OverlayModuleConfig['patternSuggestionConfig']['displayMode']): void {
    this.overlayConfig.patternSuggestionConfig.displayMode = mode;
    this.patternSuggestionState.displayMode = mode;
  }
}