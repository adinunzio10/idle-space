import { Point2D } from '../../types/galaxy';
import {
  BeaconType,
  BeaconValidationResult,
  BeaconPlacementInfo,
  BEACON_PLACEMENT_CONFIG,
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
    const distanceResult = this.checkMinimumDistance(
      position,
      beaconType,
      excludeBeaconId
    );
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
      reasons.push(
        `X coordinate ${position.x} is outside bounds [${bounds.minX}, ${bounds.maxX}]`
      );
      outOfBounds.x = true;
    }

    if (position.y < bounds.minY || position.y > bounds.maxY) {
      reasons.push(
        `Y coordinate ${position.y} is outside bounds [${bounds.minY}, ${bounds.maxY}]`
      );
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
          reasons: [
            `Too close to beacon ${beacon.id} (${distance.toFixed(1)} < ${minDistance})`,
          ],
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
  public findNearestBeacon(
    position: Point2D,
    excludeBeaconId?: string
  ): {
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
  public getPlacementInfo(
    position: Point2D,
    beaconType: BeaconType
  ): BeaconPlacementInfo {
    const validation = this.isValidPosition(position, beaconType);
    const estimatedConnections = this.getEstimatedConnections(
      position,
      beaconType
    );
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
  private getEstimatedConnections(
    position: Point2D,
    beaconType: BeaconType
  ): string[] {
    const connections: string[] = [];
    const connectionRange =
      BEACON_PLACEMENT_CONFIG.MINIMUM_DISTANCE[beaconType] * 2; // Rough estimate

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
  private calculateTerritoryRadius(
    position: Point2D,
    beaconType: BeaconType
  ): number {
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
  public isSafePosition(
    position: Point2D,
    beaconType: BeaconType,
    safetyMargin: number = 20
  ): boolean {
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
      const angle = Math.random() * 2 * Math.PI;
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

  /**
   * Pattern-specific position validation with correction suggestions
   */
  public validatePatternPosition(
    position: Point2D,
    beaconType: BeaconType,
    patternType: 'triangle' | 'square' | 'pentagon' | 'hexagon'
  ): {
    isValid: boolean;
    correctedPosition?: Point2D;
    corrections: string[];
    confidence: number;
  } {
    const validation = this.isValidPosition(position, beaconType);
    const corrections: string[] = [];
    let correctedPosition: Point2D | undefined;
    let confidence = 1.0;

    if (!validation.isValid) {
      // Try to find a corrected position
      const correction = this.findCorrectedPosition(
        position,
        beaconType,
        patternType,
        validation
      );

      if (correction) {
        correctedPosition = correction.position;
        confidence = correction.confidence;
        corrections.push(...correction.reasons);
      } else {
        corrections.push('No valid correction found within acceptable range');
        confidence = 0;
      }
    }

    return {
      isValid: validation.isValid,
      correctedPosition,
      corrections,
      confidence,
    };
  }

  /**
   * Find a corrected position for invalid placements
   */
  public findCorrectedPosition(
    originalPosition: Point2D,
    beaconType: BeaconType,
    patternType: 'triangle' | 'square' | 'pentagon' | 'hexagon',
    validation: BeaconValidationResult
  ): { position: Point2D; confidence: number; reasons: string[] } | null {
    const minDistance = this.config.minimumDistances[beaconType];
    const maxCorrectionDistance = minDistance * 2; // Don't move too far from original
    const attempts = 24; // Try 24 directions around the original position

    const reasons: string[] = [];

    // Try different correction strategies based on the validation failure
    if (validation.minDistanceViolation) {
      const violatingBeacon = this.beacons.get(
        validation.minDistanceViolation.nearestBeacon
      );
      if (violatingBeacon) {
        const corrected = this.correctForMinDistanceViolation(
          originalPosition,
          violatingBeacon,
          beaconType,
          patternType
        );
        if (corrected) {
          return {
            position: corrected,
            confidence: 0.8,
            reasons: ['Moved to maintain minimum distance from nearby beacon'],
          };
        }
      }
    }

    if (validation.outOfBounds) {
      const corrected = this.correctForBoundsViolation(
        originalPosition,
        beaconType
      );
      if (corrected) {
        return {
          position: corrected,
          confidence: 0.7,
          reasons: ['Moved back within placement bounds'],
        };
      }
    }

    // General spiral search for valid position
    for (let i = 0; i < attempts; i++) {
      const angle = (i / attempts) * 2 * Math.PI;
      const radius = minDistance * 0.5 + (i / attempts) * maxCorrectionDistance;

      const candidatePosition = {
        x: originalPosition.x + radius * Math.cos(angle),
        y: originalPosition.y + radius * Math.sin(angle),
      };

      const candidateValidation = this.isValidPosition(
        candidatePosition,
        beaconType
      );
      if (candidateValidation.isValid) {
        const distance = this.calculateDistance(
          originalPosition,
          candidatePosition
        );
        const confidence = Math.max(0.3, 1 - distance / maxCorrectionDistance);

        return {
          position: candidatePosition,
          confidence,
          reasons: [
            `Found valid position ${distance.toFixed(1)} units away from original`,
          ],
        };
      }
    }

    return null;
  }

  /**
   * Correct position that violates minimum distance constraint
   */
  private correctForMinDistanceViolation(
    position: Point2D,
    violatingBeacon: Beacon,
    beaconType: BeaconType,
    patternType: 'triangle' | 'square' | 'pentagon' | 'hexagon'
  ): Point2D | null {
    const minDistance = this.config.minimumDistances[beaconType];
    const safeDistance = minDistance * 1.1; // Add 10% buffer

    // Calculate direction away from violating beacon
    const dx = position.x - violatingBeacon.position.x;
    const dy = position.y - violatingBeacon.position.y;
    const currentDistance = Math.sqrt(dx * dx + dy * dy);

    if (currentDistance === 0) {
      // Positions are identical, move in a pattern-appropriate direction
      const angle = this.getPatternPreferredAngle(patternType);
      return {
        x: position.x + safeDistance * Math.cos(angle),
        y: position.y + safeDistance * Math.sin(angle),
      };
    }

    // Normalize direction vector
    const normalizedDx = dx / currentDistance;
    const normalizedDy = dy / currentDistance;

    // Move to safe distance
    const correctedPosition = {
      x: violatingBeacon.position.x + normalizedDx * safeDistance,
      y: violatingBeacon.position.y + normalizedDy * safeDistance,
    };

    // Verify the correction doesn't create new violations
    const validation = this.isValidPosition(correctedPosition, beaconType);
    return validation.isValid ? correctedPosition : null;
  }

  /**
   * Correct position that's out of bounds
   */
  private correctForBoundsViolation(
    position: Point2D,
    beaconType: BeaconType
  ): Point2D | null {
    const { bounds } = this.config;
    const margin = 10; // Safety margin from boundaries

    const correctedPosition = {
      x: Math.max(
        bounds.minX + margin,
        Math.min(bounds.maxX - margin, position.x)
      ),
      y: Math.max(
        bounds.minY + margin,
        Math.min(bounds.maxY - margin, position.y)
      ),
    };

    const validation = this.isValidPosition(correctedPosition, beaconType);
    return validation.isValid ? correctedPosition : null;
  }

  /**
   * Get pattern-preferred angle for positioning corrections
   */
  private getPatternPreferredAngle(
    patternType: 'triangle' | 'square' | 'pentagon' | 'hexagon'
  ): number {
    switch (patternType) {
      case 'triangle':
        return Math.PI / 3; // 60 degrees
      case 'square':
        return Math.PI / 4; // 45 degrees
      case 'pentagon':
        return (2 * Math.PI) / 5; // 72 degrees
      case 'hexagon':
        return Math.PI / 3; // 60 degrees
      default:
        return Math.PI / 4;
    }
  }

  /**
   * Batch validate multiple pattern positions with corrections
   */
  public validatePatternPositions(
    positions: Point2D[],
    beaconType: BeaconType,
    patternType: 'triangle' | 'square' | 'pentagon' | 'hexagon'
  ): {
    validPositions: Point2D[];
    correctedPositions: {
      original: Point2D;
      corrected: Point2D;
      confidence: number;
    }[];
    invalidPositions: Point2D[];
    overallConfidence: number;
  } {
    const validPositions: Point2D[] = [];
    const correctedPositions: {
      original: Point2D;
      corrected: Point2D;
      confidence: number;
    }[] = [];
    const invalidPositions: Point2D[] = [];

    for (const position of positions) {
      const validation = this.validatePatternPosition(
        position,
        beaconType,
        patternType
      );

      if (validation.isValid) {
        validPositions.push(position);
      } else if (validation.correctedPosition) {
        correctedPositions.push({
          original: position,
          corrected: validation.correctedPosition,
          confidence: validation.confidence,
        });
      } else {
        invalidPositions.push(position);
      }
    }

    // Calculate overall confidence
    const totalPositions = positions.length;
    const validCount = validPositions.length;
    const correctedCount = correctedPositions.length;
    const averageCorrectionConfidence =
      correctedCount > 0
        ? correctedPositions.reduce((sum, c) => sum + c.confidence, 0) /
          correctedCount
        : 0;

    const overallConfidence =
      totalPositions > 0
        ? (validCount + correctedCount * averageCorrectionConfidence) /
          totalPositions
        : 0;

    return {
      validPositions,
      correctedPositions,
      invalidPositions,
      overallConfidence,
    };
  }

  /**
   * Suggest alternative positions for pattern completion
   */
  public suggestAlternativePositions(
    targetPosition: Point2D,
    beaconType: BeaconType,
    patternType: 'triangle' | 'square' | 'pentagon' | 'hexagon',
    maxAlternatives: number = 3
  ): { position: Point2D; score: number; reasoning: string }[] {
    const alternatives: {
      position: Point2D;
      score: number;
      reasoning: string;
    }[] = [];
    const searchRadius = this.config.minimumDistances[beaconType] * 3;
    const attempts = 50;

    for (
      let i = 0;
      i < attempts && alternatives.length < maxAlternatives;
      i++
    ) {
      const angle = (i / attempts) * 2 * Math.PI;
      const radius = searchRadius * 0.3 + Math.random() * (searchRadius * 0.7);

      const candidate = {
        x: targetPosition.x + radius * Math.cos(angle),
        y: targetPosition.y + radius * Math.sin(angle),
      };

      const validation = this.isValidPosition(candidate, beaconType);
      if (validation.isValid) {
        const distance = this.calculateDistance(targetPosition, candidate);
        const score = Math.max(0, 1 - distance / searchRadius);

        const nearestBeacon = this.findNearestBeacon(candidate);
        const connectionPotential = nearestBeacon
          ? Math.max(
              0,
              1 -
                nearestBeacon.distance /
                  (this.config.minimumDistances[beaconType] * 2)
            )
          : 0;

        const finalScore = score * 0.6 + connectionPotential * 0.4;

        alternatives.push({
          position: candidate,
          score: finalScore,
          reasoning: `Distance: ${distance.toFixed(1)}, Connection potential: ${(connectionPotential * 100).toFixed(0)}%`,
        });
      }
    }

    return alternatives.sort((a, b) => b.score - a.score);
  }
}
