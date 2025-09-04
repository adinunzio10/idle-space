import React from 'react';
import { RenderingModule } from '../RenderingModule';
import { ModuleContext, ModuleRenderResult } from '../types';
import { Connection, Beacon, ConnectionRenderInfo } from '../../../../types/galaxy';
import { ConnectionRenderer } from '../../../../components/galaxy/ConnectionRenderer';

export class ConnectionRenderingModule extends RenderingModule {
  readonly id = 'connection-rendering';
  readonly name = 'Connection Rendering';
  readonly version = '1.0.0';
  readonly dependencies = ['beacon-rendering']; // Connections need beacons to be rendered

  // Connection-specific rendering configuration
  private maxVisibleConnections = 150;
  private animationEnabled = true;
  private flowEffectsEnabled = true;

  protected async initializeRenderingResources(context: ModuleContext): Promise<void> {
    this.logDebug('Initializing connection rendering resources');
    
    this.enableLOD();
    this.enableCulling();
  }

  protected async enableRendering(): Promise<void> {
    this.logDebug('Enabling connection rendering');
  }

  protected async disableRendering(): Promise<void> {
    this.logDebug('Disabling connection rendering');
  }

  protected async cleanupRenderingResources(): Promise<void> {
    this.logDebug('Cleaning up connection rendering resources');
  }

  protected updateRenderingState(context: ModuleContext): void {
    // Adjust rendering settings based on connection count and performance
    const connectionCount = context.connections.length;
    
    if (this.config.performanceMode || connectionCount > 200) {
      this.animationEnabled = false;
      this.flowEffectsEnabled = false;
      this.maxVisibleConnections = Math.floor(this.maxVisibleConnections * 0.6);
    } else if (connectionCount < 50) {
      this.animationEnabled = true;
      this.flowEffectsEnabled = true;
    }
  }

  protected renderElements(context: ModuleContext): React.ReactNode[] {
    const elements: React.ReactNode[] = [];
    
    // Get visible connections based on viewport
    const visibleConnections = this.getVisibleConnections(context);
    
    // Limit number of rendered connections for performance
    const connectionsToRender = visibleConnections.slice(0, this.maxVisibleConnections);

    for (const connection of connectionsToRender) {
      const sourceBeacon = this.findBeacon(connection.sourceId, context.beacons);
      const targetBeacon = this.findBeacon(connection.targetId, context.beacons);
      
      if (!sourceBeacon || !targetBeacon) continue;

      const renderInfo = this.calculateConnectionRenderInfo(connection, sourceBeacon, targetBeacon, context);
      
      if (renderInfo.shouldRender) {
        elements.push(
          <ConnectionRenderer
            key={`connection-${connection.id}`}
            connection={connection}
            sourceBeacon={sourceBeacon}
            targetBeacon={targetBeacon}
            renderInfo={renderInfo}
            viewportState={context.viewport}
          />
        );
      }
    }

    return elements;
  }

  protected calculatePerformanceImpact(context: ModuleContext, elementCount: number): 'low' | 'medium' | 'high' {
    const connectionCount = context.connections.length;
    const visibleCount = elementCount;
    
    if (visibleCount > 100 || connectionCount > 200) return 'high';
    if (visibleCount > 30 || connectionCount > 100) return 'medium';
    return 'low';
  }

  private getVisibleConnections(context: ModuleContext): Connection[] {
    return context.connections.filter(connection => {
      const sourceBeacon = this.findBeacon(connection.sourceId, context.beacons);
      const targetBeacon = this.findBeacon(connection.targetId, context.beacons);
      
      if (!sourceBeacon || !targetBeacon) return false;
      
      // Check if either endpoint is visible (connections extending off-screen should still be rendered)
      const sourceVisible = this.isElementVisible(sourceBeacon.position, 20, context.viewport);
      const targetVisible = this.isElementVisible(targetBeacon.position, 20, context.viewport);
      
      return sourceVisible || targetVisible;
    });
  }

  private findBeacon(beaconId: string, beacons: Beacon[]): Beacon | null {
    return beacons.find(beacon => beacon.id === beaconId) || null;
  }

  private calculateConnectionRenderInfo(
    connection: Connection,
    sourceBeacon: Beacon,
    targetBeacon: Beacon,
    context: ModuleContext
  ): ConnectionRenderInfo {
    const distance = Math.sqrt(
      Math.pow(targetBeacon.position.x - sourceBeacon.position.x, 2) +
      Math.pow(targetBeacon.position.y - sourceBeacon.position.y, 2)
    );

    // Calculate base render settings
    const shouldRender = true; // Already filtered by visibility
    const lodLevel = Math.min(
      this.getLODLevel(sourceBeacon.position, context.viewport),
      this.getLODLevel(targetBeacon.position, context.viewport)
    );

    // Scale line width based on connection strength and zoom
    const baseLineWidth = connection.strength * 2;
    const scaledLineWidth = Math.max(1, baseLineWidth * context.viewport.scale);
    const lineWidth = Math.min(8, scaledLineWidth);

    // Calculate opacity based on distance and zoom
    const maxDistance = 500;
    const distanceOpacity = Math.max(0.3, 1 - (distance / maxDistance));
    const zoomOpacity = Math.min(1, context.viewport.scale);
    const opacity = distanceOpacity * zoomOpacity * (connection.isActive ? 1 : 0.5);

    // Animation and effects based on performance and LOD
    const showAnimation = this.animationEnabled && 
                         lodLevel >= 2 && 
                         !this.config.performanceMode &&
                         connection.isActive;
                         
    const showFlow = this.flowEffectsEnabled && 
                     lodLevel >= 1 && 
                     !this.config.performanceMode &&
                     connection.isActive;

    // Pattern connection detection
    const isPatternConnection = connection.patterns && connection.patterns.length > 0;
    const patternColor = isPatternConnection ? this.getPatternColor(connection.patterns[0]) : undefined;

    return {
      shouldRender,
      lineWidth,
      opacity: Math.max(0.1, Math.min(1, opacity)),
      showAnimation,
      showFlow,
      isPatternConnection,
      patternColor,
    };
  }

  private getPatternColor(patternType: string): string {
    const patternColors: Record<string, string> = {
      triangle: '#10B981', // emerald-500
      square: '#3B82F6',    // blue-500
      pentagon: '#8B5CF6',  // violet-500
      hexagon: '#F59E0B',   // amber-500
    };
    
    return patternColors[patternType] || '#6B7280'; // gray-500 fallback
  }

  // Configuration methods
  setMaxVisibleConnections(max: number): void {
    this.maxVisibleConnections = Math.max(10, max);
    this.logDebug(`Max visible connections set to ${this.maxVisibleConnections}`);
  }

  enableAnimations(): void {
    this.animationEnabled = true;
    this.logDebug('Connection animations enabled');
  }

  disableAnimations(): void {
    this.animationEnabled = false;
    this.logDebug('Connection animations disabled');
  }

  enableFlowEffects(): void {
    this.flowEffectsEnabled = true;
    this.logDebug('Connection flow effects enabled');
  }

  disableFlowEffects(): void {
    this.flowEffectsEnabled = false;
    this.logDebug('Connection flow effects disabled');
  }
}