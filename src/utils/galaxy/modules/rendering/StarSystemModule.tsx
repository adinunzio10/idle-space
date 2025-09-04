import React from 'react';
import { G } from 'react-native-svg';
import { RenderingModule } from '../RenderingModule';
import { ModuleContext } from '../types';
import { StarSystem, StarSystemRenderInfo } from '../../../../types/galaxy';
import { StarSystemComponent } from '../../../../components/galaxy/StarSystem';

export class StarSystemModule extends RenderingModule {
  readonly id = 'star-system-rendering';
  readonly name = 'Star System Rendering Module';
  readonly version = '1.0.0';
  readonly dependencies: string[] = []; // No dependencies

  // Module-specific configuration
  private maxVisibleStars = 100;
  private parallaxEnabled = true;
  private backgroundStarsEnabled = true;
  private performanceThresholds = {
    disableFps: 45,
    reducedDetailFps: 50,
    maxStarsLowPerf: 50,
  };

  // Cache for star system render info
  private starRenderInfoCache = new Map<string, StarSystemRenderInfo>();
  private lastCacheUpdate = 0;
  private cacheUpdateInterval = 100; // ms

  protected async initializeRenderingResources(context: ModuleContext): Promise<void> {
    console.log('[StarSystemModule] Initializing star system rendering');
    
    // Pre-calculate any static data if needed
    this.updateStarSystemRenderInfo(context);
    
    // Set performance mode based on initial star count
    if (context.starSystems.length > this.maxVisibleStars) {
      this.config.performanceMode = true;
      console.log('[StarSystemModule] Performance mode enabled due to high star count');
    }
  }

  protected async enableRendering(): Promise<void> {
    console.log('[StarSystemModule] Enabling star system rendering');
    this.starRenderInfoCache.clear();
  }

  protected async disableRendering(): Promise<void> {
    console.log('[StarSystemModule] Disabling star system rendering');
    this.starRenderInfoCache.clear();
  }

  protected async cleanupRenderingResources(): Promise<void> {
    console.log('[StarSystemModule] Cleaning up star system rendering resources');
    this.starRenderInfoCache.clear();
  }

  protected updateRenderingState(context: ModuleContext): void {
    // Update star render info cache periodically
    const now = Date.now();
    if (now - this.lastCacheUpdate > this.cacheUpdateInterval) {
      this.updateStarSystemRenderInfo(context);
      this.lastCacheUpdate = now;
    }

    // Adjust performance settings based on FPS
    if (this.metrics.averageFps < this.performanceThresholds.disableFps) {
      this.config.performanceMode = true;
      this.maxVisibleStars = this.performanceThresholds.maxStarsLowPerf;
    } else if (this.metrics.averageFps > this.performanceThresholds.reducedDetailFps + 10) {
      // Only re-enable if FPS is comfortably above threshold
      this.config.performanceMode = false;
      this.maxVisibleStars = 100;
    }
  }

  protected renderElements(context: ModuleContext): React.ReactNode[] {
    const { starSystems, viewport } = context;

    if (!starSystems || starSystems.length === 0) {
      return [];
    }

    // Get visible star systems with performance culling
    const visibleStars = this.getVisibleStarSystems(starSystems, viewport);
    
    // Limit stars based on performance mode
    const renderLimit = this.config.performanceMode 
      ? this.performanceThresholds.maxStarsLowPerf 
      : this.maxVisibleStars;
    
    const starsToRender = visibleStars.slice(0, renderLimit);

    const elements: React.ReactNode[] = [];

    // Render background stars first (lower z-index)
    if (this.backgroundStarsEnabled) {
      const backgroundStars = starsToRender.filter(star => star.type === 'background');
      elements.push(
        <G key="background-stars" opacity={this.config.performanceMode ? 0.3 : 0.5}>
          {backgroundStars.map(star => this.renderStarSystem(star, context))}
        </G>
      );
    }

    // Render main star systems
    const mainStars = starsToRender.filter(star => star.type !== 'background');
    elements.push(
      <G key="main-stars">
        {mainStars.map(star => this.renderStarSystem(star, context))}
      </G>
    );

    return elements;
  }

  private renderStarSystem(starSystem: StarSystem, context: ModuleContext): React.ReactNode {
    const renderInfo = this.starRenderInfoCache.get(starSystem.id);
    if (!renderInfo) {
      return null;
    }

    return (
      <StarSystemComponent
        key={starSystem.id}
        starSystem={starSystem}
        renderInfo={renderInfo}
        viewportState={context.viewport}
      />
    );
  }

  private getVisibleStarSystems(starSystems: StarSystem[], viewport: any): StarSystem[] {
    if (!this.cullingEnabled) {
      return starSystems;
    }

    // Calculate viewport bounds with margin for smooth transitions
    const margin = 100; // Galaxy units
    const bounds = {
      minX: viewport.bounds.minX - margin,
      maxX: viewport.bounds.maxX + margin,
      minY: viewport.bounds.minY - margin,
      maxY: viewport.bounds.maxY + margin,
    };

    return starSystems.filter(star => {
      return (
        star.position.x >= bounds.minX &&
        star.position.x <= bounds.maxX &&
        star.position.y >= bounds.minY &&
        star.position.y <= bounds.maxY
      );
    });
  }

  private updateStarSystemRenderInfo(context: ModuleContext): void {
    const { starSystems, viewport } = context;

    starSystems.forEach(starSystem => {
      const renderInfo = this.calculateStarSystemRenderInfo(starSystem, viewport);
      this.starRenderInfoCache.set(starSystem.id, renderInfo);
    });
  }

  private calculateStarSystemRenderInfo(starSystem: StarSystem, viewport: any): StarSystemRenderInfo {
    // Calculate LOD level based on zoom and distance
    const lodLevel = this.getLODLevel(starSystem.position, viewport);
    
    // Calculate opacity based on zoom and state
    let opacity = 1.0;
    if (viewport.scale < 0.5) {
      opacity = 0.3; // Dim at low zoom
    } else if (starSystem.state === 'dead') {
      opacity = 0.2; // Very dim for dead stars
    } else if (starSystem.state === 'dying') {
      opacity = 0.7; // Slightly dimmed for dying stars
    }

    // Adjust opacity for background stars
    if (starSystem.type === 'background') {
      opacity *= 0.4;
    }

    // Calculate screen size for the star
    const baseSize = starSystem.radius || 1;
    const screenSize = Math.max(1, baseSize * viewport.scale * 0.1);

    // Determine if should render
    const shouldRender = opacity > 0.05 && screenSize > 0.5;

    // Show animations only at higher LOD levels and when not in performance mode
    const showAnimation = !this.config.performanceMode && 
                          lodLevel >= 2 && 
                          (starSystem.state === 'dying' || starSystem.state === 'healthy');

    return {
      lodLevel,
      opacity,
      screenSize: Math.min(20, screenSize), // Cap max size
      shouldRender,
      showAnimation,
      parallaxOffset: this.parallaxEnabled ? this.calculateParallaxOffset(starSystem, viewport) : { x: 0, y: 0 },
    };
  }

  private calculateParallaxOffset(starSystem: StarSystem, viewport: any): { x: number; y: number } {
    if (!this.parallaxEnabled || starSystem.type !== 'background') {
      return { x: 0, y: 0 };
    }

    // Background stars move slower than foreground (parallax effect)
    const parallaxFactor = 0.3;
    return {
      x: -viewport.translateX * parallaxFactor,
      y: -viewport.translateY * parallaxFactor,
    };
  }

  // Performance monitoring specific to star systems
  protected calculatePerformanceImpact(context: ModuleContext, elementCount: number): 'low' | 'medium' | 'high' {
    const starCount = context.starSystems.length;
    const visibleStars = elementCount;

    // Consider both total stars and visible stars
    if (starCount > 200 || visibleStars > 50) return 'high';
    if (starCount > 100 || visibleStars > 25) return 'medium';
    return 'low';
  }

  // Public methods for external configuration
  public setMaxVisibleStars(count: number): void {
    this.maxVisibleStars = Math.max(10, Math.min(200, count));
  }

  public enableParallax(): void {
    this.parallaxEnabled = true;
  }

  public disableParallax(): void {
    this.parallaxEnabled = false;
  }

  public enableBackgroundStars(): void {
    this.backgroundStarsEnabled = true;
  }

  public disableBackgroundStars(): void {
    this.backgroundStarsEnabled = false;
  }

  public getStarSystemStats(): { total: number; visible: number; backgroundStars: number } {
    return {
      total: this.starRenderInfoCache.size,
      visible: Array.from(this.starRenderInfoCache.values()).filter(info => info.shouldRender).length,
      backgroundStars: Array.from(this.starRenderInfoCache.entries())
        .filter(([id, info]) => info.shouldRender && id.includes('background')).length,
    };
  }
}