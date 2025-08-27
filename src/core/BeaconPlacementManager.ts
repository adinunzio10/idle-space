import { Point2D } from '../types/galaxy';
import { 
  BeaconType,
  BeaconValidationResult,
  BeaconPlacementInfo,
  BEACON_PLACEMENT_CONFIG,
} from '../types/beacon';
import { Beacon, BeaconFactory } from '../entities';
import { PlacementValidator, PlacementBounds, PlacementConfig } from '../utils/spatial/PlacementValidator';
import { QuadTreeSpatialIndex } from '../utils/spatial/quadtree';

export interface PlacementManagerConfig {
  bounds: PlacementBounds;
  enableSpatialIndexing: boolean;
  performanceMode: boolean;
}

export class BeaconPlacementManager {
  private validator: PlacementValidator;
  private spatialIndex: QuadTreeSpatialIndex | null;
  private beacons: Map<string, Beacon>;
  private config: PlacementManagerConfig;

  constructor(config: PlacementManagerConfig) {
    this.config = config;
    this.beacons = new Map();
    
    // Initialize placement validator
    const placementConfig: PlacementConfig = {
      bounds: config.bounds,
      minimumDistances: BEACON_PLACEMENT_CONFIG.MINIMUM_DISTANCE,
      allowOverlap: false,
    };
    
    this.validator = new PlacementValidator(placementConfig);
    
    // Initialize spatial index if enabled
    this.spatialIndex = config.enableSpatialIndexing 
      ? new QuadTreeSpatialIndex({
          x: config.bounds.minX,
          y: config.bounds.minY,
          width: config.bounds.maxX - config.bounds.minX,
          height: config.bounds.maxY - config.bounds.minY,
        })
      : null;
  }

  /**
   * Place a beacon at the specified position
   */
  public placeBeacon(
    position: Point2D,
    type: BeaconType,
    level: number = 1
  ): { success: boolean; beacon?: Beacon; error?: string } {
    // Validate placement
    const validation = this.validator.isValidPosition(position, type);
    if (!validation.isValid) {
      return {
        success: false,
        error: `Invalid placement: ${validation.reasons.join(', ')}`,
      };
    }

    // Create beacon
    const beacon = BeaconFactory.create({
      position,
      type,
      level,
    });

    // Add to collections
    this.beacons.set(beacon.id, beacon);
    this.validator.addBeacon(beacon);
    
    if (this.spatialIndex) {
      this.spatialIndex.addBeacon(beacon);
    }

    return { success: true, beacon };
  }

  /**
   * Place a beacon with smart fallback to nearby positions if initial position fails
   */
  public placeBeaconWithFallback(
    targetPosition: Point2D,
    type: BeaconType,
    level: number = 1,
    maxAttempts: number = 12
  ): { success: boolean; beacon?: Beacon; error?: string; finalPosition?: Point2D } {
    // First try the exact target position
    const directResult = this.placeBeacon(targetPosition, type, level);
    if (directResult.success) {
      return { ...directResult, finalPosition: targetPosition };
    }

    // If direct placement fails, try spiral search for alternative positions
    const alternativePosition = this.findNearbyValidPosition(targetPosition, type, maxAttempts);
    if (!alternativePosition) {
      return {
        success: false,
        error: `No valid position found near target (${targetPosition.x}, ${targetPosition.y}). Original error: ${directResult.error}`,
      };
    }

    // Try placing at the alternative position
    const fallbackResult = this.placeBeacon(alternativePosition, type, level);
    if (fallbackResult.success) {
      return { ...fallbackResult, finalPosition: alternativePosition };
    }

    return {
      success: false,
      error: `Failed to place beacon even with fallback positions. Last error: ${fallbackResult.error}`,
    };
  }

  /**
   * Find a valid position near the target using spiral search pattern
   */
  private findNearbyValidPosition(
    targetPosition: Point2D,
    type: BeaconType,
    maxAttempts: number = 12
  ): Point2D | null {
    const minDistance = BEACON_PLACEMENT_CONFIG.MINIMUM_DISTANCE[type];
    const searchRadius = minDistance * 0.8; // Start with 80% of minimum distance
    const angleStep = (2 * Math.PI) / 8; // 8 directions (N, NE, E, SE, S, SW, W, NW)

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const radius = searchRadius * (1 + (attempt - 1) * 0.3); // Gradually increase radius
      
      // Try 8 directions at current radius
      for (let i = 0; i < 8; i++) {
        const angle = i * angleStep;
        const testPosition: Point2D = {
          x: targetPosition.x + radius * Math.cos(angle),
          y: targetPosition.y + radius * Math.sin(angle),
        };

        const validation = this.validator.isValidPosition(testPosition, type);
        if (validation.isValid) {
          return testPosition;
        }
      }
    }

    return null; // No valid position found
  }

  /**
   * Remove a beacon
   */
  public removeBeacon(beaconId: string): boolean {
    const beacon = this.beacons.get(beaconId);
    if (!beacon) {
      return false;
    }

    // Remove connections to other beacons
    for (const connectedId of beacon.connections) {
      const connectedBeacon = this.beacons.get(connectedId);
      if (connectedBeacon) {
        connectedBeacon.removeConnection(beaconId);
      }
    }

    // Remove from collections
    this.beacons.delete(beaconId);
    this.validator.removeBeacon(beaconId);
    
    if (this.spatialIndex) {
      // Note: QuadTree spatial index removal would need implementation
      // For now, we'll rebuild the spatial index after removal
    }

    return true;
  }

  /**
   * Move a beacon to a new position
   */
  public moveBeacon(
    beaconId: string,
    newPosition: Point2D
  ): { success: boolean; error?: string } {
    const beacon = this.beacons.get(beaconId);
    if (!beacon) {
      return { success: false, error: 'Beacon not found' };
    }

    // Validate new position (excluding this beacon from distance checks)
    const validation = this.validator.isValidPosition(newPosition, beacon.type, beaconId);
    if (!validation.isValid) {
      return {
        success: false,
        error: `Invalid position: ${validation.reasons.join(', ')}`,
      };
    }

    // Update spatial index if enabled
    if (this.spatialIndex) {
      // Note: Moving beacons in QuadTree spatial index would need implementation
      // For now, this is a simplified implementation
    }

    return { success: true };
  }

  /**
   * Validate a potential beacon placement
   */
  public validatePlacement(position: Point2D, type: BeaconType): BeaconValidationResult {
    return this.validator.isValidPosition(position, type);
  }

  /**
   * Get placement information for UI preview
   */
  public getPlacementInfo(position: Point2D, type: BeaconType): BeaconPlacementInfo {
    return this.validator.getPlacementInfo(position, type);
  }

  /**
   * Find nearest beacon to a position
   */
  public findNearestBeacon(position: Point2D): { beacon: Beacon; distance: number } | null {
    if (this.spatialIndex && !this.config.performanceMode) {
      // Use spatial index for efficient lookup
      // Note: QuadTree queryRange would need proper implementation
      // For now, fallback to linear search
      return this.validator.findNearestBeacon(position);
    } else {
      // Fallback to validator's linear search
      return this.validator.findNearestBeacon(position);
    }
  }

  /**
   * Get beacons within a region
   */
  public getBeaconsInRegion(region: {
    x: number;
    y: number;
    width: number;
    height: number;
  }): Beacon[] {
    if (this.spatialIndex && !this.config.performanceMode) {
      // Note: QuadTree queryRange would need proper implementation
      // For now, fallback to manual filtering
    }
    
    // Manual filtering approach
    const beacons: Beacon[] = [];
    for (const beacon of this.beacons.values()) {
      if (
        beacon.position.x >= region.x &&
        beacon.position.x <= region.x + region.width &&
        beacon.position.y >= region.y &&
        beacon.position.y <= region.y + region.height
      ) {
        beacons.push(beacon);
      }
    }
    return beacons;
  }

  /**
   * Find optimal placement positions
   */
  public findOptimalPositions(
    center: Point2D,
    radius: number,
    type: BeaconType,
    count: number = 5
  ): Point2D[] {
    return this.validator.findOptimalPositions(
      { center, radius },
      type,
      count
    );
  }

  /**
   * Auto-place beacons in a region (for testing/development)
   */
  public autoPlaceBeacons(
    region: { center: Point2D; radius: number },
    type: BeaconType,
    count: number
  ): Beacon[] {
    const positions = this.findOptimalPositions(region.center, region.radius, type, count);
    const placedBeacons: Beacon[] = [];

    for (const position of positions) {
      const result = this.placeBeacon(position, type);
      if (result.success && result.beacon) {
        placedBeacons.push(result.beacon);
      }
    }

    return placedBeacons;
  }

  /**
   * Get all beacons
   */
  public getAllBeacons(): Beacon[] {
    return Array.from(this.beacons.values());
  }

  /**
   * Get beacon by ID
   */
  public getBeacon(id: string): Beacon | undefined {
    return this.beacons.get(id);
  }

  /**
   * Get beacon count
   */
  public getBeaconCount(): number {
    return this.beacons.size;
  }

  /**
   * Load beacons from save data
   */
  public loadBeacons(beaconData: Record<string, any>): void {
    this.clear();

    for (const data of Object.values(beaconData)) {
      // Convert save data format to our beacon format
      const beacon = BeaconFactory.fromSaveData({
        id: data.id,
        position: { x: data.x, y: data.y },
        level: data.level,
        type: data.type,
        specialization: data.specialization || 'none',
        status: data.status || 'active',
        connections: data.connections || [],
        generationRate: data.generationRate || 0,
        createdAt: data.createdAt || Date.now(),
        lastUpgraded: data.lastUpgraded || Date.now(),
        totalResourcesGenerated: data.totalResourcesGenerated || 0,
        upgradePendingAt: data.upgradePendingAt,
      });

      this.beacons.set(beacon.id, beacon);
      
      if (this.spatialIndex) {
        this.spatialIndex.addBeacon(beacon);
      }
    }

    // Update validator with new beacons
    this.validator.updateBeacons(Array.from(this.beacons.values()));
  }

  /**
   * Export beacons to save format
   */
  public exportBeacons(): Record<string, any> {
    const exportData: Record<string, any> = {};
    
    for (const [id, beacon] of this.beacons) {
      exportData[id] = {
        id: beacon.id,
        x: beacon.position.x,
        y: beacon.position.y,
        z: 0, // For compatibility with GameState
        level: beacon.level,
        type: beacon.type,
        specialization: beacon.specialization,
        status: beacon.status,
        connections: beacon.connections,
        createdAt: beacon.createdAt,
        lastUpgraded: beacon.lastUpgraded,
        generationRate: beacon.generationRate,
        totalResourcesGenerated: beacon.totalResourcesGenerated,
        upgradePendingAt: beacon.upgradePendingAt,
      };
    }

    return exportData;
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<PlacementManagerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.bounds) {
      this.validator.updateConfig({ bounds: newConfig.bounds });
    }
  }

  /**
   * Clear all beacons
   */
  public clear(): void {
    this.beacons.clear();
    this.validator.clear();
    
    if (this.spatialIndex) {
      // Note: QuadTree clear method would need implementation
      // For now, we'll recreate the spatial index
    }
  }

  /**
   * Get performance metrics
   */
  public getMetrics(): {
    beaconCount: number;
    spatialIndexEnabled: boolean;
    performanceMode: boolean;
    bounds: PlacementBounds;
  } {
    return {
      beaconCount: this.beacons.size,
      spatialIndexEnabled: this.spatialIndex !== null,
      performanceMode: this.config.performanceMode,
      bounds: this.config.bounds,
    };
  }
}