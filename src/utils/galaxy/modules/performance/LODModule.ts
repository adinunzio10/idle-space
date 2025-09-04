import { PerformanceModule, PerformanceStrategy } from '../PerformanceModule';
import { ModuleContext } from '../types';
import { Beacon, LODRenderInfo } from '../../../../types/galaxy';

export interface LODConfiguration {
  enabledForBeacons: boolean;
  enabledForConnections: boolean;
  enabledForEnvironment: boolean;
  adaptiveThresholds: boolean;
  thresholds: {
    simplified: number;   // Distance beyond which simplified rendering is used
    minimal: number;      // Distance beyond which minimal rendering is used
    hidden: number;       // Distance beyond which elements are hidden
  };
}

export class LODModule extends PerformanceModule {
  readonly id = 'lod-management';
  readonly name = 'Level of Detail Management';
  readonly version = '1.0.0';

  private lodConfig: LODConfiguration = {
    enabledForBeacons: true,
    enabledForConnections: true,
    enabledForEnvironment: true,
    adaptiveThresholds: true,
    thresholds: {
      simplified: 300,
      minimal: 600,
      hidden: 1000,
    },
  };

  protected async initializePerformanceSystem(context: ModuleContext): Promise<void> {
    this.logDebug('Initializing LOD management system');
  }

  protected async enablePerformanceMonitoring(): Promise<void> {
    this.logDebug('Enabling LOD performance monitoring');
  }

  protected async disablePerformanceMonitoring(): Promise<void> {
    this.logDebug('Disabling LOD performance monitoring');
  }

  protected async cleanupPerformanceSystem(): Promise<void> {
    this.logDebug('Cleaning up LOD management system');
  }

  protected updateDataStructures(context: ModuleContext): void {
    // Adapt LOD thresholds based on current performance
    if (this.lodConfig.adaptiveThresholds) {
      this.adaptLODThresholds(context);
    }
  }

  protected registerPerformanceStrategies(): void {
    // Aggressive LOD strategy for low performance
    this.registerStrategy({
      name: 'aggressive-lod',
      description: 'Use aggressive LOD thresholds for better performance',
      apply: (context: ModuleContext) => {
        this.lodConfig.thresholds.simplified = 200;
        this.lodConfig.thresholds.minimal = 400;
        this.lodConfig.thresholds.hidden = 600;
      },
      revert: (context: ModuleContext) => {
        this.lodConfig.thresholds.simplified = 300;
        this.lodConfig.thresholds.minimal = 600;
        this.lodConfig.thresholds.hidden = 1000;
      },
      isApplicable: (context: ModuleContext) => {
        return this.metrics.averageFps < 30;
      },
    });

    // Conservative LOD strategy for high performance
    this.registerStrategy({
      name: 'conservative-lod',
      description: 'Use conservative LOD thresholds for better quality',
      apply: (context: ModuleContext) => {
        this.lodConfig.thresholds.simplified = 400;
        this.lodConfig.thresholds.minimal = 800;
        this.lodConfig.thresholds.hidden = 1200;
      },
      revert: (context: ModuleContext) => {
        this.lodConfig.thresholds.simplified = 300;
        this.lodConfig.thresholds.minimal = 600;
        this.lodConfig.thresholds.hidden = 1000;
      },
      isApplicable: (context: ModuleContext) => {
        return this.metrics.averageFps > 55;
      },
    });
  }

  // LOD calculation methods
  calculateBeaconLOD(beacon: Beacon, context: ModuleContext): LODRenderInfo {
    if (!this.lodConfig.enabledForBeacons) {
      return {
        level: 3,
        renderMode: 'full',
        size: 20,
        showAnimations: true,
        showEffects: true,
      };
    }

    const distance = this.calculateDistanceFromViewportCenter(beacon.position, context);
    const scale = context.viewport.scale;
    
    // Adjust thresholds based on zoom level
    const scaledThresholds = {
      simplified: this.lodConfig.thresholds.simplified / scale,
      minimal: this.lodConfig.thresholds.minimal / scale,
      hidden: this.lodConfig.thresholds.hidden / scale,
    };

    if (distance > scaledThresholds.hidden) {
      return {
        level: 0,
        renderMode: 'clustered',
        size: 4,
        showAnimations: false,
        showEffects: false,
      };
    } else if (distance > scaledThresholds.minimal) {
      return {
        level: 1,
        renderMode: 'simplified',
        size: 8,
        showAnimations: false,
        showEffects: false,
      };
    } else if (distance > scaledThresholds.simplified) {
      return {
        level: 2,
        renderMode: 'standard',
        size: 12,
        showAnimations: false,
        showEffects: false,
      };
    } else {
      return {
        level: 3,
        renderMode: 'full',
        size: Math.min(24, 16 * scale),
        showAnimations: !this.config.performanceMode,
        showEffects: !this.config.performanceMode && scale > 1.5,
      };
    }
  }

  shouldRenderElement(position: { x: number; y: number }, context: ModuleContext): boolean {
    const distance = this.calculateDistanceFromViewportCenter(position, context);
    const scale = context.viewport.scale;
    const hiddenThreshold = this.lodConfig.thresholds.hidden / scale;
    
    return distance <= hiddenThreshold;
  }

  private calculateDistanceFromViewportCenter(
    position: { x: number; y: number },
    context: ModuleContext
  ): number {
    const centerX = (context.viewport.bounds.minX + context.viewport.bounds.maxX) / 2;
    const centerY = (context.viewport.bounds.minY + context.viewport.bounds.maxY) / 2;
    
    return Math.sqrt(
      Math.pow(position.x - centerX, 2) + Math.pow(position.y - centerY, 2)
    );
  }

  private adaptLODThresholds(context: ModuleContext): void {
    // Adjust thresholds based on element count and performance
    const totalElements = context.beacons.length + context.connections.length + context.starSystems.length;
    const currentFps = this.metrics.averageFps;

    if (totalElements > 500 && currentFps < 45) {
      // Reduce thresholds for better performance
      this.lodConfig.thresholds.simplified *= 0.9;
      this.lodConfig.thresholds.minimal *= 0.9;
      this.lodConfig.thresholds.hidden *= 0.9;
    } else if (totalElements < 100 && currentFps > 55) {
      // Increase thresholds for better quality
      this.lodConfig.thresholds.simplified = Math.min(400, this.lodConfig.thresholds.simplified * 1.1);
      this.lodConfig.thresholds.minimal = Math.min(800, this.lodConfig.thresholds.minimal * 1.1);
      this.lodConfig.thresholds.hidden = Math.min(1200, this.lodConfig.thresholds.hidden * 1.1);
    }
  }

  // Configuration methods
  setLODThresholds(simplified: number, minimal: number, hidden: number): void {
    this.lodConfig.thresholds = { simplified, minimal, hidden };
    this.logDebug('LOD thresholds updated', this.lodConfig.thresholds);
  }

  enableAdaptiveThresholds(): void {
    this.lodConfig.adaptiveThresholds = true;
    this.logDebug('Adaptive LOD thresholds enabled');
  }

  disableAdaptiveThresholds(): void {
    this.lodConfig.adaptiveThresholds = false;
    this.logDebug('Adaptive LOD thresholds disabled');
  }

  getLODConfiguration(): LODConfiguration {
    return { ...this.lodConfig };
  }
}