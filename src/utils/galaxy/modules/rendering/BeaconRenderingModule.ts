import React from 'react';
import { RenderingModule } from '../RenderingModule';
import { ModuleContext, ModuleRenderResult } from '../types';
import { Beacon, ViewportState, BeaconCluster } from '../../../../types/galaxy';
import BeaconRenderer from '../../../../components/galaxy/BeaconRenderer';
import BeaconClusterRenderer from '../../../../components/galaxy/BeaconCluster';
import { hierarchicalCluster, isPointInCluster } from '../../../rendering/clustering';
import { shouldEnableClustering } from '../../../rendering/lod';
import { SpatialIndex } from '../../../spatial/indexing';
import { createWorkletSafeClone } from '../../../performance/WorkletDataIsolation';

interface BeaconModuleConfig {
  maxVisibleBeacons: number;
  clusteringThreshold: number;
  lodDistance: number;
  enableClustering: boolean;
  enableLOD: boolean;
  performanceThresholds: {
    targetFps: number;
    maxRenderTime: number;
  };
}

export class BeaconRenderingModule extends RenderingModule {
  readonly id = 'beacon-rendering';
  readonly name = 'Beacon Rendering Module';
  readonly version = '1.0.0';
  readonly dependencies: string[] = []; // No dependencies for core beacon rendering

  private spatialIndex: SpatialIndex | null = null;
  private visibleBeacons: Beacon[] = [];
  private beaconClusters: BeaconCluster[] = [];
  private lastBeaconUpdate = 0;
  private performanceMetrics = {
    beaconCount: 0,
    clusterCount: 0,
    renderTime: 0,
    culledBeacons: 0,
  };

  private beaconConfig: BeaconModuleConfig = {
    maxVisibleBeacons: 500,
    clusteringThreshold: 100,
    lodDistance: 1.0,
    enableClustering: true,
    enableLOD: true,
    performanceThresholds: {
      targetFps: 60,
      maxRenderTime: 16.67, // Target 60fps = 16.67ms per frame
    },
  };

  protected async initializeRenderingResources(context: ModuleContext): Promise<void> {
    console.log('[BeaconRenderingModule] Initializing rendering resources');
    
    // Initialize spatial index for efficient beacon queries
    this.spatialIndex = new SpatialIndex();
    
    // Initial beacon processing
    if (context.beacons.length > 0) {
      this.spatialIndex.rebuild(context.beacons);
      this.updateVisibleBeacons(context);
    }

    // Log configuration
    console.log('[BeaconRenderingModule] Configuration:', this.beaconConfig);
  }

  protected async enableRendering(): Promise<void> {
    console.log('[BeaconRenderingModule] Enabling beacon rendering');
    this.enableLOD();
    this.enableCulling();
  }

  protected async disableRendering(): Promise<void> {
    console.log('[BeaconRenderingModule] Disabling beacon rendering');
    this.visibleBeacons = [];
    this.beaconClusters = [];
  }

  protected async cleanupRenderingResources(): Promise<void> {
    console.log('[BeaconRenderingModule] Cleaning up resources');
    this.spatialIndex = null;
    this.visibleBeacons = [];
    this.beaconClusters = [];
  }

  protected updateRenderingState(context: ModuleContext): void {
    const startTime = performance.now();
    
    // Check if beacons have been updated
    const beaconHash = this.generateBeaconHash(context.beacons);
    if (beaconHash !== this.lastBeaconUpdate || this.shouldUpdateSpatialIndex(context)) {
      this.rebuildSpatialIndex(context.beacons);
      this.lastBeaconUpdate = beaconHash;
    }

    // Update visible beacons based on viewport
    this.updateVisibleBeacons(context);

    // Update clustering if needed
    if (this.beaconConfig.enableClustering) {
      this.updateClustering(context);
    }

    const endTime = performance.now();
    this.performanceMetrics.renderTime = endTime - startTime;

    // Log performance every 60 frames for debugging
    if (context.frameCount % 60 === 0 && this.config.debugMode) {
      console.log('[BeaconRenderingModule] Performance metrics:', {
        ...this.performanceMetrics,
        fps: this.metrics.averageFps,
        frameTime: endTime - startTime,
      });
    }
  }

  protected renderElements(context: ModuleContext): React.ReactNode[] {
    if (!this.config.enabled) return [];

    const elements: React.ReactNode[] = [];
    const startTime = performance.now();

    try {
      // Performance check - skip rendering if we're behind
      if (this.metrics.averageFps < this.beaconConfig.performanceThresholds.targetFps * 0.75) {
        // Reduce rendering quality when performance is poor
        this.adjustPerformanceSettings('reduce');
      }

      // Render clusters first (they're larger and should be behind individual beacons)
      if (this.beaconConfig.enableClustering) {
        this.beaconClusters.forEach(cluster => {
          // Clone cluster data to prevent worklet mutation warnings
          const clonedCluster = createWorkletSafeClone(cluster);
          
          elements.push(
            React.createElement(BeaconClusterRenderer, {
              key: `cluster-${cluster.id}`,
              cluster: clonedCluster,
              viewportState: context.viewport,
              onPress: this.handleClusterPress.bind(this),
            })
          );
        });
        this.performanceMetrics.clusterCount = this.beaconClusters.length;
      }

      // Render individual visible beacons
      this.visibleBeacons.forEach(beacon => {
        const lodLevel = this.getLODLevel(beacon.position, context.viewport);
        
        // Skip rendering very low LOD beacons to save performance
        if (lodLevel < 1 && this.config.performanceMode) return;

        // Clone beacon data to prevent worklet mutation warnings
        const clonedBeacon = createWorkletSafeClone(beacon);

        elements.push(
          React.createElement(BeaconRenderer, {
            key: `beacon-${beacon.id}`,
            beacon: clonedBeacon,
            lodInfo: {
              level: lodLevel,
              renderMode: lodLevel >= 2 ? 'full' as const : 'standard' as const,
              size: this.calculateBeaconSize(lodLevel, context.viewport.scale),
              showAnimations: !this.config.performanceMode && lodLevel >= 2,
              showEffects: !this.config.performanceMode && lodLevel >= 1,
            },
            viewportState: context.viewport,
          })
        );
      });

      this.performanceMetrics.beaconCount = this.visibleBeacons.length;

      const endTime = performance.now();
      this.performanceMetrics.renderTime = endTime - startTime;

      // Check if rendering took too long
      if (this.performanceMetrics.renderTime > this.beaconConfig.performanceThresholds.maxRenderTime) {
        console.warn('[BeaconRenderingModule] Render time exceeded threshold:', {
          renderTime: this.performanceMetrics.renderTime,
          threshold: this.beaconConfig.performanceThresholds.maxRenderTime,
          beaconCount: this.visibleBeacons.length,
        });
        
        // Automatically reduce quality
        this.adjustPerformanceSettings('reduce');
      }

    } catch (error) {
      console.error('[BeaconRenderingModule] Error rendering beacons:', error);
      // Return empty array to prevent crashes
      return [];
    }

    return elements;
  }

  private generateBeaconHash(beacons: Beacon[]): number {
    // Simple hash based on beacon count and some beacon IDs
    let hash = beacons.length;
    for (let i = 0; i < Math.min(beacons.length, 5); i++) {
      hash = hash * 31 + (beacons[i]?.id?.length || 0);
    }
    return hash;
  }

  private shouldUpdateSpatialIndex(context: ModuleContext): boolean {
    // Update spatial index periodically or when viewport changes significantly
    const timeSinceUpdate = context.frameCount - this.lastBeaconUpdate;
    return timeSinceUpdate > 30; // Update every 30 frames (~0.5 seconds at 60fps)
  }

  private rebuildSpatialIndex(beacons: Beacon[]): void {
    if (this.spatialIndex) {
      this.spatialIndex.rebuild(beacons);
    }
  }

  private updateVisibleBeacons(context: ModuleContext): void {
    if (!this.spatialIndex) {
      // Fallback to basic distance culling if no spatial index
      this.visibleBeacons = this.performBasicCulling(context.beacons, context.viewport);
      return;
    }

    // FIXED: Debug viewport bounds to verify they're correct
    if (this.config.debugMode && context.frameCount % 120 === 0) {
      console.log(`[BeaconRenderingModule] Viewport bounds: minX=${context.viewport.bounds.minX.toFixed(1)}, maxX=${context.viewport.bounds.maxX.toFixed(1)}, minY=${context.viewport.bounds.minY.toFixed(1)}, maxY=${context.viewport.bounds.maxY.toFixed(1)}`);
    }

    // Query spatial index for visible beacons
    const visibleBeacons = this.spatialIndex.queryBounds(context.viewport.bounds);
    
    // FIXED: Add buffer zone around viewport for smoother experience
    const bufferZone = 50; // pixels in galaxy coordinates
    const bufferedBounds = {
      minX: context.viewport.bounds.minX - bufferZone,
      maxX: context.viewport.bounds.maxX + bufferZone,
      minY: context.viewport.bounds.minY - bufferZone,
      maxY: context.viewport.bounds.maxY + bufferZone,
    };
    
    const bufferedVisibleBeacons = this.spatialIndex.queryBounds(bufferedBounds);
    
    // Apply performance limits
    const maxBeacons = this.config.performanceMode ? 
      Math.floor(this.beaconConfig.maxVisibleBeacons * 0.5) : 
      this.beaconConfig.maxVisibleBeacons;

    this.visibleBeacons = bufferedVisibleBeacons.slice(0, maxBeacons);
    this.performanceMetrics.culledBeacons = context.beacons.length - this.visibleBeacons.length;

    if (this.config.debugMode && (context.frameCount % 60 === 0 || bufferedVisibleBeacons.length > maxBeacons)) {
      console.log(`[BeaconRenderingModule] Spatial culling: Total=${context.beacons.length}, InBounds=${bufferedVisibleBeacons.length}, Rendered=${this.visibleBeacons.length}, Culled=${this.performanceMetrics.culledBeacons}`);
    }
  }

  private performBasicCulling(beacons: Beacon[], viewport: ViewportState): Beacon[] {
    // Basic distance-based culling when spatial index fails
    const visibleDistance = Math.max(viewport.bounds.maxX - viewport.bounds.minX, viewport.bounds.maxY - viewport.bounds.minY) * 0.6;
    const centerX = (viewport.bounds.minX + viewport.bounds.maxX) / 2;
    const centerY = (viewport.bounds.minY + viewport.bounds.maxY) / 2;
    
    return beacons.filter(beacon => {
      const dx = beacon.position.x - centerX;
      const dy = beacon.position.y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      return distance <= visibleDistance;
    });
  }

  private updateClustering(context: ModuleContext): void {
    const shouldCluster = shouldEnableClustering(
      this.visibleBeacons,
      context.viewport.scale,
      context.viewport
    );

    // FIXED: Apply clustering logic more effectively
    const enableClustering = this.beaconConfig.enableClustering && 
      (shouldCluster || this.visibleBeacons.length > this.beaconConfig.clusteringThreshold);

    if (this.config.debugMode && context.frameCount % 60 === 0) {
      console.log(`[BeaconRenderingModule] Clustering check: shouldCluster=${shouldCluster}, visibleBeacons=${this.visibleBeacons.length}, threshold=${this.beaconConfig.clusteringThreshold}, enableClustering=${enableClustering}, zoom=${context.viewport.scale.toFixed(2)}`);
    }

    if (enableClustering) {
      try {
        const clusterResult = hierarchicalCluster(this.visibleBeacons, context.viewport.scale);
        this.beaconClusters = clusterResult.clusters;
        
        // Remove clustered beacons from individual rendering
        this.visibleBeacons = clusterResult.remainingBeacons;
        
        if (this.config.debugMode && context.frameCount % 60 === 0) {
          console.log(`[BeaconRenderingModule] Clustering result: ${clusterResult.clusters.length} clusters, ${clusterResult.remainingBeacons.length} individual beacons`);
        }
      } catch (error) {
        console.error('[BeaconRenderingModule] Clustering failed:', error);
        this.beaconClusters = [];
      }
    } else {
      this.beaconClusters = [];
    }
  }

  private calculateBeaconSize(lodLevel: number, scale: number): number {
    const baseSize = 12;
    const scaleFactor = Math.max(0.5, Math.min(2.0, scale));
    const lodFactor = lodLevel >= 2 ? 1.2 : lodLevel >= 1 ? 1.0 : 0.8;
    
    return baseSize * scaleFactor * lodFactor;
  }

  private adjustPerformanceSettings(action: 'reduce' | 'increase'): void {
    if (action === 'reduce') {
      this.beaconConfig.maxVisibleBeacons = Math.max(50, this.beaconConfig.maxVisibleBeacons * 0.8);
      this.beaconConfig.clusteringThreshold = Math.max(20, this.beaconConfig.clusteringThreshold * 0.8);
      
      if (!this.config.performanceMode) {
        console.log('[BeaconRenderingModule] Automatically reducing performance settings');
        this.updateConfig({ performanceMode: true });
      }
    } else if (action === 'increase' && this.metrics.averageFps > 55) {
      this.beaconConfig.maxVisibleBeacons = Math.min(1000, this.beaconConfig.maxVisibleBeacons * 1.2);
      this.beaconConfig.clusteringThreshold = Math.min(200, this.beaconConfig.clusteringThreshold * 1.2);
      
      if (this.config.performanceMode) {
        console.log('[BeaconRenderingModule] Performance recovered, increasing settings');
        this.updateConfig({ performanceMode: false });
      }
    }
  }

  private handleClusterPress(cluster: BeaconCluster): void {
    // For now, select the first beacon in the cluster
    if (cluster.beacons.length > 0 && this.onBeaconSelect) {
      this.onBeaconSelect(cluster.beacons[0]);
    }
  }

  // Public API for configuration
  public updateBeaconConfig(newConfig: Partial<BeaconModuleConfig>): void {
    this.beaconConfig = { ...this.beaconConfig, ...newConfig };
    console.log('[BeaconRenderingModule] Updated configuration:', this.beaconConfig);
  }

  public getBeaconMetrics() {
    return {
      ...this.performanceMetrics,
      config: this.beaconConfig,
      spatialIndexStats: this.spatialIndex?.getStats() || null,
    };
  }

  // Event handlers (can be set by parent)
  public onBeaconSelect?: (beacon: Beacon) => void;
}