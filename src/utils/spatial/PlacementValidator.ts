import { Point2D } from '../../types/galaxy';
import { 
  BeaconType, 
  BeaconValidationResult, 
  BeaconPlacementInfo,
  BEACON_PLACEMENT_CONFIG 
} from '../../types/beacon';
import { Beacon } from '../../entities/Beacon';

export interface PlacementBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface PlacementConfig {
  bounds: PlacementBounds;
  minimumDistances: Record<BeaconType, number>;
  allowOverlap: boolean;
}

export class PlacementValidator {
  private config: PlacementConfig;
  private beacons: Map<string, Beacon>;

  constructor(config: PlacementConfig) {
    this.config = config;
    this.beacons = new Map();
  }

  /**
   * Update the beacon collection for validation
   */
  public updateBeacons(beacons: Record<string, Beacon> | Beacon[]): void {
    this.beacons.clear();
    
    if (Array.isArray(beacons)) {
      beacons.forEach(beacon => {
        this.beacons.set(beacon.id, beacon);
      });
    } else {
      Object.values(beacons).forEach(beacon => {
        this.beacons.set(beacon.id, beacon);
      });
    }
  }

  /**
   * Add a single beacon to the collection
   */
  public addBeacon(beacon: Beacon): void {
    this.beacons.set(beacon.id, beacon);
  }

  /**
   * Remove a beacon from the collection
   */
  public removeBeacon(beaconId: string): void {
    this.beacons.delete(beaconId);
  }

  /**
   * Validate if a position is valid for placing a beacon
   */
  public isValidPosition(
    position: Point2D, 
    beaconType: BeaconType, 
    excludeBeaconId?: string
  ): BeaconValidationResult {
    const reasons: string[] = [];

    // Check bounds
    const boundsResult = this.checkBounds(position);
    if (!boundsResult.isValid) {
      reasons.push(...boundsResult.reasons);
    }

    // Check distance constraints
    const distanceResult = this.checkMinimumDistance(position, beaconType, excludeBeaconId);
    if (!distanceResult.isValid) {
      reasons.push(...distanceResult.reasons);
    }

    return {
      isValid: reasons.length === 0,
      reasons,
      minDistanceViolation: distanceResult.minDistanceViolation,
      outOfBounds: boundsResult.outOfBounds,
    };
  }

  /**
   * Check if position is within bounds
   */
  public checkBounds(position: Point2D): BeaconValidationResult {
    const { bounds } = this.config;
    const reasons: string[] = [];
    const outOfBounds = { x: false, y: false };

    if (position.x < bounds.minX || position.x > bounds.maxX) {
      reasons.push(`X coordinate ${position.x} is outside bounds [${bounds.minX}, ${bounds.maxX}]`);
      outOfBounds.x = true;
    }

    if (position.y < bounds.minY || position.y > bounds.maxY) {
      reasons.push(`Y coordinate ${position.y} is outside bounds [${bounds.minY}, ${bounds.maxY}]`);
      outOfBounds.y = true;
    }

    return {
      isValid: reasons.length === 0,
      reasons,
      outOfBounds: outOfBounds.x || outOfBounds.y ? outOfBounds : undefined,
    };
  }

  /**
   * Check minimum distance constraints
   */
  public checkMinimumDistance(
    position: Point2D,
    beaconType: BeaconType,
    excludeBeaconId?: string
  ): BeaconValidationResult {
    if (this.config.allowOverlap) {
      return { isValid: true, reasons: [] };
    }

    const minDistance = this.config.minimumDistances[beaconType];
    let closestBeacon: { beacon: Beacon; distance: number } | null = null;

    for (const beacon of this.beacons.values()) {
      if (excludeBeaconId && beacon.id === excludeBeaconId) {
        continue;
      }

      const distance = this.calculateDistance(position, beacon.position);
      
      if (!closestBeacon || distance < closestBeacon.distance) {
        closestBeacon = { beacon, distance };
      }

      if (distance < minDistance) {
        return {
          isValid: false,
          reasons: [`Too close to beacon ${beacon.id} (${distance.toFixed(1)} < ${minDistance})`],
          minDistanceViolation: {
            nearestBeacon: beacon.id,
            distance,
            minimumRequired: minDistance,
          },
        };
      }
    }

    return { isValid: true, reasons: [] };
  }

  /**
   * Get overlapping beacons at a position (within minimum distance)
   */
  public getOverlappingBeacons(
    position: Point2D,
    beaconType: BeaconType,
    excludeBeaconId?: string
  ): Beacon[] {
    const minDistance = this.config.minimumDistances[beaconType];
    const overlapping: Beacon[] = [];

    for (const beacon of this.beacons.values()) {
      if (excludeBeaconId && beacon.id === excludeBeaconId) {
        continue;
      }

      const distance = this.calculateDistance(position, beacon.position);
      if (distance < minDistance) {
        overlapping.push(beacon);
      }
    }

    return overlapping;
  }

  /**
   * Find the nearest beacon to a position
   */
  public findNearestBeacon(position: Point2D, excludeBeaconId?: string): {
    beacon: Beacon;
    distance: number;
  } | null {
    let nearest: { beacon: Beacon; distance: number } | null = null;

    for (const beacon of this.beacons.values()) {
      if (excludeBeaconId && beacon.id === excludeBeaconId) {
        continue;
      }

      const distance = this.calculateDistance(position, beacon.position);
      if (!nearest || distance < nearest.distance) {
        nearest = { beacon, distance };
      }
    }

    return nearest;
  }

  /**
   * Get placement info including potential connections
   */
  public getPlacementInfo(position: Point2D, beaconType: BeaconType): BeaconPlacementInfo {
    const validation = this.isValidPosition(position, beaconType);
    const estimatedConnections = this.getEstimatedConnections(position, beaconType);
    const territoryRadius = this.calculateTerritoryRadius(position, beaconType);

    return {
      position,
      type: beaconType,
      isValid: validation.isValid,
      validationReasons: validation.reasons,
      estimatedConnections,
      territoryRadius,
    };
  }

  /**
   * Get estimated connections for a beacon at position
   */
  private getEstimatedConnections(position: Point2D, beaconType: BeaconType): string[] {
    const connections: string[] = [];
    const connectionRange = BEACON_PLACEMENT_CONFIG.MINIMUM_DISTANCE[beaconType] * 2; // Rough estimate
    
    for (const beacon of this.beacons.values()) {
      const distance = this.calculateDistance(position, beacon.position);
      if (distance <= connectionRange) {
        connections.push(beacon.id);
      }
    }

    return connections;
  }

  /**
   * Calculate territory radius for a beacon type
   */
  private calculateTerritoryRadius(position: Point2D, beaconType: BeaconType): number {
    const minDistance = this.config.minimumDistances[beaconType];
    return minDistance * BEACON_PLACEMENT_CONFIG.TERRITORY_RADIUS_MULTIPLIER;
  }

  /**
   * Calculate Euclidean distance between two points
   */
  private calculateDistance(point1: Point2D, point2: Point2D): number {
    const dx = point1.x - point2.x;
    const dy = point1.y - point2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Check if a position is safe (far from boundaries and other beacons)
   */
  public isSafePosition(position: Point2D, beaconType: BeaconType, safetyMargin: number = 20): boolean {
    const { bounds } = this.config;
    const minDistance = this.config.minimumDistances[beaconType];

    // Check safe distance from boundaries
    if (
      position.x < bounds.minX + safetyMargin ||
      position.x > bounds.maxX - safetyMargin ||
      position.y < bounds.minY + safetyMargin ||
      position.y > bounds.maxY - safetyMargin
    ) {
      return false;
    }

    // Check safe distance from other beacons
    for (const beacon of this.beacons.values()) {
      const distance = this.calculateDistance(position, beacon.position);
      if (distance < minDistance + safetyMargin) {
        return false;
      }
    }

    return true;
  }

  /**
   * Find optimal placement positions in a region
   */
  public findOptimalPositions(
    region: { center: Point2D; radius: number },
    beaconType: BeaconType,
    maxPositions: number = 5
  ): Point2D[] {
    const positions: Point2D[] = [];
    const attempts = 100; // Max attempts to find positions
    let attempt = 0;

    while (positions.length < maxPositions && attempt < attempts) {
      const angle = (Math.random() * 2 * Math.PI);
      const distance = Math.random() * region.radius;
      
      const position: Point2D = {
        x: region.center.x + distance * Math.cos(angle),
        y: region.center.y + distance * Math.sin(angle),
      };

      if (this.isSafePosition(position, beaconType)) {
        positions.push(position);
      }
      
      attempt++;
    }

    return positions;
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<PlacementConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  public getConfig(): PlacementConfig {
    return { ...this.config };
  }

  /**
   * Get beacon count
   */
  public getBeaconCount(): number {
    return this.beacons.size;
  }

  /**
   * Clear all beacons
   */
  public clear(): void {
    this.beacons.clear();
  }
}