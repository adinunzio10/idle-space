import React from 'react';
import { G } from 'react-native-svg';
import { RenderingModule } from '../RenderingModule';
import { ModuleContext } from '../types';
import { GalacticSector, SectorRenderInfo } from '../../../../types/galaxy';
import { 
  MultipleSectorBoundary, 
  generateSectorBoundaryRenderData 
} from '../../../../components/galaxy/SectorBoundary';

export class SectorModule extends RenderingModule {
  readonly id = 'sector-rendering';
  readonly name = 'Sector Rendering Module';
  readonly version = '1.0.0';
  readonly dependencies: string[] = []; // No dependencies

  // Module-specific configuration
  private maxVisibleSectors = 50;
  private hexagonalGridEnabled = true;
  private entropyTintingEnabled = true;
  private transitionsEnabled = true;
  private performanceThresholds = {
    disableFps: 45,
    reducedDetailFps: 50,
    maxSectorsLowPerf: 25,
    disableHexGridFps: 40,
  };

  // Cache for sector render info
  private sectorRenderInfoCache = new Map<string, SectorRenderInfo>();
  private lastCacheUpdate = 0;
  private cacheUpdateInterval = 150; // ms

  // Grid configuration
  private gridConfig = {
    type: 'both' as 'voronoi' | 'hexagonal' | 'both',
    showHexagonalGrid: true,
  };

  protected async initializeRenderingResources(context: ModuleContext): Promise<void> {
    console.log('[SectorModule] Initializing sector rendering');
    
    // Pre-calculate sector render info
    this.updateSectorRenderInfo(context);
    
    // Set performance mode based on initial sector count
    if (context.sectors.length > this.maxVisibleSectors) {
      this.config.performanceMode = true;
      console.log('[SectorModule] Performance mode enabled due to high sector count');
    }
  }

  protected async enableRendering(): Promise<void> {
    console.log('[SectorModule] Enabling sector rendering');
    this.sectorRenderInfoCache.clear();
  }

  protected async disableRendering(): Promise<void> {
    console.log('[SectorModule] Disabling sector rendering');
    this.sectorRenderInfoCache.clear();
  }

  protected async cleanupRenderingResources(): Promise<void> {
    console.log('[SectorModule] Cleaning up sector rendering resources');
    this.sectorRenderInfoCache.clear();
  }

  protected updateRenderingState(context: ModuleContext): void {
    // Update sector render info cache periodically
    const now = Date.now();
    if (now - this.lastCacheUpdate > this.cacheUpdateInterval) {
      this.updateSectorRenderInfo(context);
      this.lastCacheUpdate = now;
    }

    // Adjust performance settings based on FPS
    if (this.metrics.averageFps < this.performanceThresholds.disableFps) {
      this.config.performanceMode = true;
      this.maxVisibleSectors = this.performanceThresholds.maxSectorsLowPerf;
      this.transitionsEnabled = false;
    } else if (this.metrics.averageFps > this.performanceThresholds.reducedDetailFps + 10) {
      // Only re-enable if FPS is comfortably above threshold
      this.config.performanceMode = false;
      this.maxVisibleSectors = 50;
      this.transitionsEnabled = true;
    }

    // Disable hexagonal grid at very low FPS
    if (this.metrics.averageFps < this.performanceThresholds.disableHexGridFps) {
      this.gridConfig.showHexagonalGrid = false;
    } else if (this.metrics.averageFps > this.performanceThresholds.disableHexGridFps + 10) {
      this.gridConfig.showHexagonalGrid = this.hexagonalGridEnabled;
    }
  }

  protected renderElements(context: ModuleContext): React.ReactNode[] {
    const { sectors, viewport } = context;

    if (!sectors || sectors.length === 0) {
      return [];
    }

    // Get visible sectors with performance culling
    const visibleSectors = this.getVisibleSectors(sectors, viewport);
    
    // Limit sectors based on performance mode
    const renderLimit = this.config.performanceMode 
      ? this.performanceThresholds.maxSectorsLowPerf 
      : this.maxVisibleSectors;
    
    const sectorsToRender = visibleSectors.slice(0, renderLimit);

    const elements: React.ReactNode[] = [];

    // Only render if we have sectors and render info
    if (sectorsToRender.length > 0 && this.sectorRenderInfoCache.size > 0) {
      elements.push(
        <G key="sector-boundaries">
          <MultipleSectorBoundary
            sectors={sectorsToRender}
            renderInfoMap={this.sectorRenderInfoCache}
            viewportState={viewport}
            showEntropyTinting={this.entropyTintingEnabled}
            maxRenderedSectors={renderLimit}
            enableTransitions={this.transitionsEnabled && !this.config.performanceMode}
            gridType={this.gridConfig.type}
            performanceMode={this.config.performanceMode}
            showHexagonalGrid={this.gridConfig.showHexagonalGrid}
          />
        </G>
      );
    }

    return elements;
  }

  private getVisibleSectors(sectors: GalacticSector[], viewport: any): GalacticSector[] {
    if (!this.cullingEnabled) {
      return sectors;
    }

    // Calculate viewport bounds with margin for smooth transitions
    const margin = 150; // Galaxy units - larger margin for sectors
    const bounds = {
      minX: viewport.bounds.minX - margin,
      maxX: viewport.bounds.maxX + margin,
      minY: viewport.bounds.minY - margin,
      maxY: viewport.bounds.maxY + margin,
    };

    return sectors.filter(sector => {
      // Use sector bounds for more accurate culling
      return !(
        sector.bounds.maxX < bounds.minX ||
        sector.bounds.minX > bounds.maxX ||
        sector.bounds.maxY < bounds.minY ||
        sector.bounds.minY > bounds.maxY
      );
    });
  }

  private updateSectorRenderInfo(context: ModuleContext): void {
    const { sectors, viewport } = context;

    sectors.forEach(sector => {
      const renderInfo = this.calculateSectorRenderInfo(sector, viewport);
      this.sectorRenderInfoCache.set(sector.id, renderInfo);
    });
  }

  private calculateSectorRenderInfo(sector: GalacticSector, viewport: any): SectorRenderInfo {
    // Calculate LOD level based on zoom and distance
    const lodLevel = this.getLODLevel(sector.center, viewport);
    
    // Calculate boundary visibility based on zoom
    const minZoomForBoundaries = 0.3;
    const shouldShowBoundary = viewport.scale >= minZoomForBoundaries;
    
    // Calculate boundary opacity based on zoom
    let boundaryOpacity = 1.0;
    if (viewport.scale < 0.5) {
      boundaryOpacity = Math.max(0.1, (viewport.scale - 0.3) / 0.2);
    }

    // Calculate entropy visualization
    let entropyOpacity = 0;
    let entropyColor = '#6B7280'; // Default gray
    
    if (this.entropyTintingEnabled && sector.entropyLevel !== undefined) {
      entropyOpacity = Math.min(0.3, sector.entropyLevel * 0.5);
      
      // Color based on entropy level
      if (sector.entropyLevel > 0.7) {
        entropyColor = '#EF4444'; // High entropy - red
      } else if (sector.entropyLevel > 0.4) {
        entropyColor = '#F59E0B'; // Medium entropy - orange
      } else if (sector.entropyLevel > 0.1) {
        entropyColor = '#10B981'; // Low entropy - green
      }
    }

    // Determine if should render at all
    const shouldRender = shouldShowBoundary && boundaryOpacity > 0.05;

    return {
      lodLevel,
      shouldRender,
      shouldShowBoundary,
      boundaryOpacity: this.config.performanceMode ? boundaryOpacity * 0.7 : boundaryOpacity,
      entropyOpacity: this.config.performanceMode ? 0 : entropyOpacity,
      entropyColor,
      showLabels: lodLevel >= 2 && !this.config.performanceMode,
      showDetails: lodLevel >= 3 && !this.config.performanceMode,
    };
  }

  // Performance monitoring specific to sectors
  protected calculatePerformanceImpact(context: ModuleContext, elementCount: number): 'low' | 'medium' | 'high' {
    const sectorCount = context.sectors.length;
    const visibleSectors = Array.from(this.sectorRenderInfoCache.values())
      .filter(info => info.shouldRender).length;

    // Consider both total sectors and visible sectors
    if (sectorCount > 100 || visibleSectors > 35) return 'high';
    if (sectorCount > 50 || visibleSectors > 20) return 'medium';
    return 'low';
  }

  // Public methods for external configuration
  public setMaxVisibleSectors(count: number): void {
    this.maxVisibleSectors = Math.max(10, Math.min(100, count));
  }

  public enableHexagonalGrid(): void {
    this.hexagonalGridEnabled = true;
    this.gridConfig.showHexagonalGrid = true;
    this.gridConfig.type = this.gridConfig.type === 'voronoi' ? 'both' : this.gridConfig.type;
  }

  public disableHexagonalGrid(): void {
    this.hexagonalGridEnabled = false;
    this.gridConfig.showHexagonalGrid = false;
    this.gridConfig.type = 'voronoi';
  }

  public enableEntropyTinting(): void {
    this.entropyTintingEnabled = true;
    this.sectorRenderInfoCache.clear(); // Force recalculation
  }

  public disableEntropyTinting(): void {
    this.entropyTintingEnabled = false;
    this.sectorRenderInfoCache.clear(); // Force recalculation
  }

  public setGridType(type: 'voronoi' | 'hexagonal' | 'both'): void {
    this.gridConfig.type = type;
    
    // Adjust hexagonal grid visibility based on type
    if (type === 'voronoi') {
      this.gridConfig.showHexagonalGrid = false;
    } else if (type === 'hexagonal' || type === 'both') {
      this.gridConfig.showHexagonalGrid = this.hexagonalGridEnabled;
    }
  }

  public getSectorStats(): { 
    total: number; 
    visible: number; 
    withBoundaries: number; 
    withEntropy: number 
  } {
    const allInfo = Array.from(this.sectorRenderInfoCache.values());
    
    return {
      total: this.sectorRenderInfoCache.size,
      visible: allInfo.filter(info => info.shouldRender).length,
      withBoundaries: allInfo.filter(info => info.shouldShowBoundary).length,
      withEntropy: allInfo.filter(info => info.entropyOpacity > 0).length,
    };
  }

  public getBoundaryRenderData(context: ModuleContext) {
    return generateSectorBoundaryRenderData(
      context.sectors,
      context.viewport,
      this.sectorRenderInfoCache
    );
  }
}