import React from 'react';
import { G } from 'react-native-svg';
import { RenderingModule } from '../RenderingModule';
import { ModuleContext, ModuleRenderResult } from '../types';
import { StarSystem, GalacticSector, StarSystemState } from '../../../../types/galaxy';
import { GalacticEnvironmentRenderer } from '../../../../components/galaxy/GalacticEnvironmentRenderer';

export class EnvironmentRenderingModule extends RenderingModule {
  readonly id = 'environment-rendering';
  readonly name = 'Environment Rendering';
  readonly version = '1.0.0';

  // Environment-specific configuration
  private starSystemsEnabled = true;
  private sectorsEnabled = true;
  private entropyVisualizationEnabled = true;
  private decayEffectsEnabled = true;
  private harvestOverlayEnabled = true;
  private maxVisibleStarSystems = 100;

  protected async initializeRenderingResources(context: ModuleContext): Promise<void> {
    this.logDebug('Initializing environment rendering resources');
    
    this.enableLOD();
    this.enableCulling();
  }

  protected async enableRendering(): Promise<void> {
    this.logDebug('Enabling environment rendering');
  }

  protected async disableRendering(): Promise<void> {
    this.logDebug('Disabling environment rendering');
  }

  protected async cleanupRenderingResources(): Promise<void> {
    this.logDebug('Cleaning up environment rendering resources');
  }

  protected updateRenderingState(context: ModuleContext): void {
    // Adjust rendering settings based on star system count and performance
    const starSystemCount = context.starSystems.length;
    const sectorCount = context.sectors.length;
    
    if (this.config.performanceMode || starSystemCount > 200) {
      this.decayEffectsEnabled = false;
      this.harvestOverlayEnabled = false;
      this.maxVisibleStarSystems = 50;
    } else if (starSystemCount < 50) {
      this.decayEffectsEnabled = true;
      this.harvestOverlayEnabled = true;
      this.maxVisibleStarSystems = 100;
    }

    // Disable heavy effects if there are too many sectors
    if (sectorCount > 50) {
      this.entropyVisualizationEnabled = false;
    }
  }

  protected renderElements(context: ModuleContext): React.ReactNode[] {
    const elements: React.ReactNode[] = [];
    
    // Only render if we have star systems and sectors
    if (context.starSystems.length === 0 || context.sectors.length === 0) {
      return elements;
    }

    // Filter visible star systems and sectors
    const visibleStarSystems = this.getVisibleStarSystems(context);
    const visibleSectors = this.getVisibleSectors(context);

    if (visibleStarSystems.length > 0 || visibleSectors.length > 0) {
      elements.push(
        <G key="galactic-environment">
          <GalacticEnvironmentRenderer
            viewportState={context.viewport}
            externalStarSystems={visibleStarSystems.slice(0, this.maxVisibleStarSystems)}
            externalSectors={visibleSectors}
            config={{
              enableStarSystems: this.starSystemsEnabled,
              enableSectorBoundaries: this.sectorsEnabled,
              enableEntropyVisualization: this.entropyVisualizationEnabled,
              enableDecayEffects: this.decayEffectsEnabled,
              enableHarvestOverlay: this.harvestOverlayEnabled,
              enableEntropySpread: false, // Disabled in modular mode to prevent conflicts
              performance: {
                maxStarSystems: this.maxVisibleStarSystems,
                maxSectors: 50,
                maxDecayEffects: 20,
                maxHarvestOverlays: 10,
              },
            }}
          />
        </G>
      );
    }

    return elements;
  }

  protected calculatePerformanceImpact(context: ModuleContext, elementCount: number): 'low' | 'medium' | 'high' {
    const starSystemCount = context.starSystems.length;
    const sectorCount = context.sectors.length;
    
    // Environment rendering can be expensive due to complex visuals
    if (starSystemCount > 150 || sectorCount > 30) return 'high';
    if (starSystemCount > 75 || sectorCount > 15) return 'medium';
    return 'low';
  }

  private getVisibleStarSystems(context: ModuleContext): StarSystem[] {
    if (!this.starSystemsEnabled) return [];
    
    return context.starSystems.filter(starSystem => {
      // Use a larger radius for star systems since they can be quite large visually
      const visualRadius = starSystem.radius * 2;
      return this.isElementVisible(starSystem.position, visualRadius, context.viewport);
    });
  }

  private getVisibleSectors(context: ModuleContext): GalacticSector[] {
    if (!this.sectorsEnabled) return [];
    
    return context.sectors.filter(sector => {
      // Check if sector bounds intersect with viewport
      const viewport = context.viewport.bounds;
      return !(
        sector.bounds.maxX < viewport.minX ||
        sector.bounds.minX > viewport.maxX ||
        sector.bounds.maxY < viewport.minY ||
        sector.bounds.minY > viewport.maxY
      );
    });
  }

  // Configuration methods
  enableStarSystems(): void {
    this.starSystemsEnabled = true;
    this.logDebug('Star systems enabled');
  }

  disableStarSystems(): void {
    this.starSystemsEnabled = false;
    this.logDebug('Star systems disabled');
  }

  enableSectors(): void {
    this.sectorsEnabled = true;
    this.logDebug('Sector boundaries enabled');
  }

  disableSectors(): void {
    this.sectorsEnabled = false;
    this.logDebug('Sector boundaries disabled');
  }

  enableEntropyVisualization(): void {
    this.entropyVisualizationEnabled = true;
    this.logDebug('Entropy visualization enabled');
  }

  disableEntropyVisualization(): void {
    this.entropyVisualizationEnabled = false;
    this.logDebug('Entropy visualization disabled');
  }

  enableDecayEffects(): void {
    this.decayEffectsEnabled = true;
    this.logDebug('Decay effects enabled');
  }

  disableDecayEffects(): void {
    this.decayEffectsEnabled = false;
    this.logDebug('Decay effects disabled');
  }

  enableHarvestOverlay(): void {
    this.harvestOverlayEnabled = true;
    this.logDebug('Harvest overlay enabled');
  }

  disableHarvestOverlay(): void {
    this.harvestOverlayEnabled = false;
    this.logDebug('Harvest overlay disabled');
  }

  setMaxVisibleStarSystems(max: number): void {
    this.maxVisibleStarSystems = Math.max(10, max);
    this.logDebug(`Max visible star systems set to ${this.maxVisibleStarSystems}`);
  }

  // Performance optimization methods
  setPerformanceProfile(profile: 'minimal' | 'balanced' | 'full'): void {
    switch (profile) {
      case 'minimal':
        this.starSystemsEnabled = false;
        this.sectorsEnabled = false;
        this.entropyVisualizationEnabled = false;
        this.decayEffectsEnabled = false;
        this.harvestOverlayEnabled = false;
        break;
        
      case 'balanced':
        this.starSystemsEnabled = true;
        this.sectorsEnabled = true;
        this.entropyVisualizationEnabled = false;
        this.decayEffectsEnabled = false;
        this.harvestOverlayEnabled = true;
        break;
        
      case 'full':
        this.starSystemsEnabled = true;
        this.sectorsEnabled = true;
        this.entropyVisualizationEnabled = true;
        this.decayEffectsEnabled = true;
        this.harvestOverlayEnabled = true;
        break;
    }
    
    this.logDebug(`Environment performance profile set to: ${profile}`);
  }
}