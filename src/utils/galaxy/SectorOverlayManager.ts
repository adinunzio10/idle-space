/**
 * SectorOverlayManager - Comprehensive Visual Galaxy Sector Overlay System
 * 
 * Core orchestration system that manages all visual overlays on the galaxy map,
 * including sector boundaries, state visualization, entropy effects, and resource indicators.
 * Provides centralized control, performance optimization, and smooth transitions.
 */

import { 
  GalacticSector, 
  StarSystem, 
  ViewportState, 
  SectorRenderInfo,
  ViewportBounds
} from '../../types/galaxy';

export interface OverlayConfiguration {
  /** Show sector boundary lines */
  showBoundaries: boolean;
  /** Show sector state overlays (healthy/dying/dead) */
  showSectorStates: boolean;
  /** Show entropy spreading effects */
  showEntropyEffects: boolean;
  /** Show harvestable resource indicators */
  showHarvestableResources: boolean;
  /** Performance and visual quality settings */
  quality: OverlayQualitySettings;
  /** Animation settings */
  animations: OverlayAnimationSettings;
}

export interface OverlayQualitySettings {
  /** Maximum number of sectors to render */
  maxSectors: number;
  /** Maximum number of entropy effects to render */
  maxEntropyEffects: number;
  /** Maximum number of harvest indicators */
  maxHarvestIndicators: number;
  /** Use LOD (Level of Detail) optimization */
  enableLOD: boolean;
  /** Enable viewport culling */
  enableViewportCulling: boolean;
  /** Particle system quality (0-1) */
  particleQuality: number;
}

export interface OverlayAnimationSettings {
  /** Enable smooth transitions */
  enableTransitions: boolean;
  /** Transition duration in milliseconds */
  transitionDuration: number;
  /** Enable pulsing effects */
  enablePulseEffects: boolean;
  /** Enable particle animations */
  enableParticleAnimations: boolean;
  /** Frame rate target for animations */
  targetFrameRate: number;
}

export interface SectorStateInfo {
  sector: GalacticSector;
  state: 'healthy' | 'dying' | 'dead';
  visualTreatment: {
    color: string;
    opacity: number;
    hasAnimation: boolean;
    animationType?: 'pulse' | 'static' | 'particle';
  };
  starSystemCount: number;
  resourceCount: number;
}

export interface OverlayRenderData {
  /** Visible sectors within viewport */
  visibleSectors: GalacticSector[];
  /** Sector render information map */
  sectorRenderInfo: Map<string, SectorRenderInfo>;
  /** Sector state information */
  sectorStates: Map<string, SectorStateInfo>;
  /** Star systems in viewport */
  visibleStarSystems: StarSystem[];
  /** Performance metrics */
  performance: {
    renderCount: number;
    culledCount: number;
    lodLevel: number;
    frameTime: number;
  };
}

export interface OverlayControls {
  /** Toggle boundary visibility */
  toggleBoundaries: () => void;
  /** Toggle sector state visualization */
  toggleSectorStates: () => void;
  /** Toggle entropy effects */
  toggleEntropyEffects: () => void;
  /** Toggle resource indicators */
  toggleHarvestableResources: () => void;
  /** Set overlay quality level */
  setQualityLevel: (level: 'low' | 'medium' | 'high') => void;
  /** Reset to default configuration */
  resetToDefaults: () => void;
}

/**
 * Default overlay configuration
 */
export const DEFAULT_OVERLAY_CONFIG: OverlayConfiguration = {
  showBoundaries: true,
  showSectorStates: true,
  showEntropyEffects: true,
  showHarvestableResources: true,
  quality: {
    maxSectors: 50,
    maxEntropyEffects: 30,
    maxHarvestIndicators: 25,
    enableLOD: true,
    enableViewportCulling: true,
    particleQuality: 0.8,
  },
  animations: {
    enableTransitions: true,
    transitionDuration: 500,
    enablePulseEffects: true,
    enableParticleAnimations: true,
    targetFrameRate: 60,
  },
};

/**
 * Quality presets for different performance levels
 */
export const QUALITY_PRESETS = {
  low: {
    maxSectors: 20,
    maxEntropyEffects: 10,
    maxHarvestIndicators: 10,
    enableLOD: true,
    enableViewportCulling: true,
    particleQuality: 0.3,
  },
  medium: {
    maxSectors: 35,
    maxEntropyEffects: 20,
    maxHarvestIndicators: 18,
    enableLOD: true,
    enableViewportCulling: true,
    particleQuality: 0.6,
  },
  high: {
    maxSectors: 60,
    maxEntropyEffects: 40,
    maxHarvestIndicators: 30,
    enableLOD: true,
    enableViewportCulling: true,
    particleQuality: 1.0,
  },
} as const;

/**
 * Main SectorOverlayManager class
 */
export class SectorOverlayManager {
  private config: OverlayConfiguration;
  private sectors: GalacticSector[] = [];
  private starSystems: StarSystem[] = [];
  private lastUpdateTime: number = 0;
  private lastViewportState: ViewportState | null = null;
  private renderDataCache: OverlayRenderData | null = null;
  private performanceMetrics = {
    averageFrameTime: 16.67,
    frameCount: 0,
    droppedFrames: 0,
  };

  constructor(config: Partial<OverlayConfiguration> = {}) {
    this.config = { ...DEFAULT_OVERLAY_CONFIG, ...config };
  }

  /**
   * Update sectors data
   */
  public updateSectors(sectors: GalacticSector[]): void {
    this.sectors = [...sectors];
    this.invalidateCache();
  }

  /**
   * Update star systems data
   */
  public updateStarSystems(starSystems: StarSystem[]): void {
    this.starSystems = [...starSystems];
    this.invalidateCache();
  }

  /**
   * Update configuration
   */
  public updateConfiguration(config: Partial<OverlayConfiguration>): void {
    const oldConfig = this.config;
    this.config = { ...this.config, ...config };
    
    // If configuration changed significantly, invalidate cache
    if (this.isSignificantConfigChange(oldConfig, this.config)) {
      this.invalidateCache();
    }
  }

  /**
   * Get current configuration
   */
  public getConfiguration(): OverlayConfiguration {
    return { ...this.config };
  }

  /**
   * Generate overlay render data for current viewport
   */
  public generateRenderData(viewportState: ViewportState): OverlayRenderData {
    const startTime = performance.now();

    // Check if we can use cached data
    if (this.canUseCachedRenderData(viewportState)) {
      return this.renderDataCache!;
    }

    // Calculate viewport bounds for culling
    const viewportBounds = this.calculateViewportBounds(viewportState);

    // Filter visible sectors
    const visibleSectors = this.config.quality.enableViewportCulling
      ? this.cullSectorsByViewport(this.sectors, viewportBounds)
      : this.sectors;

    // Apply performance limits
    const limitedSectors = visibleSectors.slice(0, this.config.quality.maxSectors);

    // Generate sector render info
    const sectorRenderInfo = this.generateSectorRenderInfo(limitedSectors, viewportState);

    // Generate sector state information
    const sectorStates = this.generateSectorStateInfo(limitedSectors);

    // Filter visible star systems
    const visibleStarSystems = this.config.quality.enableViewportCulling
      ? this.cullStarSystemsByViewport(this.starSystems, viewportBounds)
      : this.starSystems;

    // Calculate performance metrics
    const frameTime = performance.now() - startTime;
    this.updatePerformanceMetrics(frameTime);

    const renderData: OverlayRenderData = {
      visibleSectors: limitedSectors,
      sectorRenderInfo,
      sectorStates,
      visibleStarSystems: visibleStarSystems.slice(0, this.config.quality.maxHarvestIndicators),
      performance: {
        renderCount: limitedSectors.length,
        culledCount: this.sectors.length - limitedSectors.length,
        lodLevel: this.calculateLODLevel(viewportState),
        frameTime,
      },
    };

    // Cache the render data
    this.renderDataCache = renderData;
    this.lastViewportState = { ...viewportState };
    this.lastUpdateTime = Date.now();

    return renderData;
  }

  /**
   * Get overlay controls for UI interaction
   */
  public getControls(): OverlayControls {
    return {
      toggleBoundaries: () => {
        this.config.showBoundaries = !this.config.showBoundaries;
        this.invalidateCache();
      },
      toggleSectorStates: () => {
        this.config.showSectorStates = !this.config.showSectorStates;
        this.invalidateCache();
      },
      toggleEntropyEffects: () => {
        this.config.showEntropyEffects = !this.config.showEntropyEffects;
        this.invalidateCache();
      },
      toggleHarvestableResources: () => {
        this.config.showHarvestableResources = !this.config.showHarvestableResources;
        this.invalidateCache();
      },
      setQualityLevel: (level: 'low' | 'medium' | 'high') => {
        this.config.quality = { ...this.config.quality, ...QUALITY_PRESETS[level] };
        this.invalidateCache();
      },
      resetToDefaults: () => {
        this.config = { ...DEFAULT_OVERLAY_CONFIG };
        this.invalidateCache();
      },
    };
  }

  /**
   * Get performance statistics
   */
  public getPerformanceStats(): {
    averageFrameTime: number;
    frameRate: number;
    droppedFrames: number;
    cacheHitRate: number;
  } {
    return {
      averageFrameTime: this.performanceMetrics.averageFrameTime,
      frameRate: 1000 / this.performanceMetrics.averageFrameTime,
      droppedFrames: this.performanceMetrics.droppedFrames,
      cacheHitRate: this.calculateCacheHitRate(),
    };
  }

  /**
   * Calculate viewport bounds from viewport state
   */
  private calculateViewportBounds(viewportState: ViewportState): ViewportBounds {
    const scale = viewportState.scale;
    const halfWidth = 400 / scale; // Assuming 800px screen width
    const halfHeight = 300 / scale; // Assuming 600px screen height

    const centerX = -viewportState.translateX / scale;
    const centerY = -viewportState.translateY / scale;

    return {
      minX: centerX - halfWidth,
      maxX: centerX + halfWidth,
      minY: centerY - halfHeight,
      maxY: centerY + halfHeight,
    };
  }

  /**
   * Cull sectors outside viewport bounds
   */
  private cullSectorsByViewport(sectors: GalacticSector[], bounds: ViewportBounds): GalacticSector[] {
    return sectors.filter(sector => {
      return sector.bounds.minX < bounds.maxX &&
             sector.bounds.maxX > bounds.minX &&
             sector.bounds.minY < bounds.maxY &&
             sector.bounds.maxY > bounds.minY;
    });
  }

  /**
   * Cull star systems outside viewport bounds
   */
  private cullStarSystemsByViewport(starSystems: StarSystem[], bounds: ViewportBounds): StarSystem[] {
    return starSystems.filter(star => {
      return star.position.x >= bounds.minX &&
             star.position.x <= bounds.maxX &&
             star.position.y >= bounds.minY &&
             star.position.y <= bounds.maxY;
    });
  }

  /**
   * Generate sector render information
   */
  private generateSectorRenderInfo(sectors: GalacticSector[], viewportState: ViewportState): Map<string, SectorRenderInfo> {
    const renderInfo = new Map<string, SectorRenderInfo>();

    sectors.forEach(sector => {
      const shouldRender = true; // Already culled
      const shouldShowBoundary = this.config.showBoundaries && viewportState.scale > 0.3;
      const boundaryOpacity = Math.max(0, Math.min(0.8, (viewportState.scale - 0.3) * 2));
      
      // Calculate entropy color and opacity
      const entropyColor = this.getEntropyColor(sector.entropy);
      const entropyOpacity = this.config.showEntropyEffects 
        ? Math.min(0.25, sector.entropy * 0.3) 
        : 0;

      renderInfo.set(sector.id, {
        shouldRender,
        shouldShowBoundary,
        boundaryOpacity,
        entropyColor,
        entropyOpacity,
        lodLevel: viewportState.scale > 1.0 ? 3 : viewportState.scale > 0.5 ? 2 : 1,
        showLabels: viewportState.scale > 0.8,
        showDetails: viewportState.scale > 1.2,
      });
    });

    return renderInfo;
  }

  /**
   * Generate sector state information
   */
  private generateSectorStateInfo(sectors: GalacticSector[]): Map<string, SectorStateInfo> {
    const stateInfo = new Map<string, SectorStateInfo>();

    sectors.forEach(sector => {
      // Determine sector state based on entropy and star systems
      let state: 'healthy' | 'dying' | 'dead';
      if (sector.entropy < 0.3) {
        state = 'healthy';
      } else if (sector.entropy < 0.7) {
        state = 'dying';
      } else {
        state = 'dead';
      }

      // Get visual treatment for this state
      const visualTreatment = this.getSectorStateVisualTreatment(state, sector.entropy);

      // Count star systems and resources in this sector
      const sectorStarSystems = this.starSystems.filter(star => 
        this.isPointInSector(star.position, sector)
      );
      
      const resourceCount = sectorStarSystems.reduce((count, star) => {
        return count + (star.resources?.stellarEssence || 0) + (star.resources?.voidFragments || 0);
      }, 0);

      stateInfo.set(sector.id, {
        sector,
        state,
        visualTreatment,
        starSystemCount: sectorStarSystems.length,
        resourceCount,
      });
    });

    return stateInfo;
  }

  /**
   * Get visual treatment for sector state
   */
  private getSectorStateVisualTreatment(state: 'healthy' | 'dying' | 'dead', entropy: number): {
    color: string;
    opacity: number;
    hasAnimation: boolean;
    animationType?: 'pulse' | 'static' | 'particle';
  } {
    switch (state) {
      case 'healthy':
        return {
          color: '#3B82F6', // Blue tint
          opacity: 0.1,
          hasAnimation: false,
          animationType: 'static',
        };
      case 'dying':
        return {
          color: entropy > 0.5 ? '#EF4444' : '#F59E0B', // Orange to red gradient
          opacity: 0.2,
          hasAnimation: this.config.animations.enablePulseEffects,
          animationType: 'pulse',
        };
      case 'dead':
        return {
          color: '#1F2937', // Dark purple/black
          opacity: 0.3,
          hasAnimation: this.config.animations.enableParticleAnimations,
          animationType: 'particle',
        };
    }
  }

  /**
   * Calculate LOD level based on viewport state
   */
  private calculateLODLevel(viewportState: ViewportState): number {
    if (!this.config.quality.enableLOD) return 3; // Highest quality

    const scale = viewportState.scale;
    if (scale < 0.5) return 0; // Lowest quality
    if (scale < 1.0) return 1;
    if (scale < 2.0) return 2;
    return 3; // Highest quality
  }

  /**
   * Get entropy color based on entropy level
   */
  private getEntropyColor(entropy: number): string {
    // Blue (low) to Red (high) interpolation
    const r = Math.floor(255 * entropy);
    const g = Math.floor(100 * (1 - Math.abs(entropy - 0.5) * 2));
    const b = Math.floor(255 * (1 - entropy));
    
    return `rgb(${r}, ${g}, ${b})`;
  }

  /**
   * Check if point is within sector bounds
   */
  private isPointInSector(point: { x: number; y: number }, sector: GalacticSector): boolean {
    // Simple bounding box check for performance
    // In a full implementation, this would use point-in-polygon
    return point.x >= sector.bounds.minX &&
           point.x <= sector.bounds.maxX &&
           point.y >= sector.bounds.minY &&
           point.y <= sector.bounds.maxY;
  }

  /**
   * Check if cached render data can be used
   */
  private canUseCachedRenderData(viewportState: ViewportState): boolean {
    if (!this.renderDataCache || !this.lastViewportState) return false;

    const now = Date.now();
    const cacheAge = now - this.lastUpdateTime;
    
    // Cache expires after 100ms
    if (cacheAge > 100) return false;

    // Check if viewport changed significantly
    const last = this.lastViewportState;
    const scaleChange = Math.abs(viewportState.scale - last.scale) / last.scale;
    const translateChangeX = Math.abs(viewportState.translateX - last.translateX);
    const translateChangeY = Math.abs(viewportState.translateY - last.translateY);
    
    // Use cache if changes are small
    return scaleChange < 0.05 && translateChangeX < 20 && translateChangeY < 20;
  }

  /**
   * Check if configuration change is significant enough to invalidate cache
   */
  private isSignificantConfigChange(oldConfig: OverlayConfiguration, newConfig: OverlayConfiguration): boolean {
    return oldConfig.showBoundaries !== newConfig.showBoundaries ||
           oldConfig.showSectorStates !== newConfig.showSectorStates ||
           oldConfig.showEntropyEffects !== newConfig.showEntropyEffects ||
           oldConfig.showHarvestableResources !== newConfig.showHarvestableResources ||
           oldConfig.quality.maxSectors !== newConfig.quality.maxSectors;
  }

  /**
   * Invalidate cached render data
   */
  private invalidateCache(): void {
    this.renderDataCache = null;
    this.lastViewportState = null;
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(frameTime: number): void {
    this.performanceMetrics.frameCount++;
    this.performanceMetrics.averageFrameTime = 
      (this.performanceMetrics.averageFrameTime * 0.9) + (frameTime * 0.1);
    
    if (frameTime > 33) { // > 30fps threshold
      this.performanceMetrics.droppedFrames++;
    }
  }

  /**
   * Calculate cache hit rate
   */
  private calculateCacheHitRate(): number {
    // Simple estimate based on cache usage
    return this.renderDataCache ? 0.7 : 0.0;
  }

  /**
   * Cleanup resources
   */
  public dispose(): void {
    this.renderDataCache = null;
    this.lastViewportState = null;
    this.sectors = [];
    this.starSystems = [];
  }
}

/**
 * Create a default sector overlay manager
 */
export function createSectorOverlayManager(config?: Partial<OverlayConfiguration>): SectorOverlayManager {
  return new SectorOverlayManager(config);
}