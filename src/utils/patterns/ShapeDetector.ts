import { Beacon, PatternType } from '../../types/galaxy';
import { GeometryUtils } from './GeometryUtils';
import { GeometricTolerance, DEFAULT_TOLERANCE } from '../../types/geometry';
import {
  isTriangle,
  isSquare,
  isPentagon,
  isHexagon,
  distance,
  sortPointsClockwise,
} from './geometry';

/**
 * Enhanced shape detection algorithms with configurable tolerance and adaptive robustness.
 *
 * This class provides improved geometric pattern detection for beacon networks, featuring:
 * - Adaptive tolerance based on beacon density
 * - Side length validation for all shapes
 * - Enhanced angle tolerance checking
 * - Geometric integrity validation for imperfect placements
 *
 * @example
 * ```typescript
 * const detector = new ShapeDetector({ tolerance: { angle: 0.1 } });
 * const triangles = detector.detectTriangle(beacons, cycle);
 * ```
 */
export class ShapeDetector {
  private geometryUtils: GeometryUtils;
  private tolerance: GeometricTolerance;

  constructor(
    options: {
      tolerance?: Partial<GeometricTolerance>;
      geometryUtils?: GeometryUtils;
    } = {}
  ) {
    this.tolerance = { ...DEFAULT_TOLERANCE, ...options.tolerance };
    this.geometryUtils =
      options.geometryUtils || new GeometryUtils(this.tolerance);
  }

  /**
   * Detect and validate triangle formation with enhanced robustness.
   *
   * @param beacons - All beacons in the network
   * @param beaconIds - IDs of beacons forming potential triangle
   * @param adaptiveTolerance - Whether to adjust tolerance based on beacon density
   * @returns True if beacons form a valid triangle
   */
  detectTriangle(
    beacons: Beacon[],
    beaconIds: string[],
    adaptiveTolerance: boolean = true
  ): boolean {
    if (beaconIds.length !== 3) return false;

    const beaconMap = new Map(beacons.map(b => [b.id, b]));
    const points = beaconIds
      .map(id => beaconMap.get(id)?.position)
      .filter((p): p is NonNullable<typeof p> => p !== undefined);

    if (points.length !== 3) return false;

    // Basic triangle validation using existing function
    if (!isTriangle(points)) return false;

    // Enhanced validation with side length consistency
    if (
      !this.validateSideLengthConsistency(points, 'triangle', adaptiveTolerance)
    ) {
      return false;
    }

    // Enhanced angle validation
    return this.validateTriangleAngles(points, adaptiveTolerance);
  }

  /**
   * Detect and validate square formation with enhanced robustness.
   *
   * @param beacons - All beacons in the network
   * @param beaconIds - IDs of beacons forming potential square
   * @param adaptiveTolerance - Whether to adjust tolerance based on beacon density
   * @returns True if beacons form a valid square
   */
  detectSquare(
    beacons: Beacon[],
    beaconIds: string[],
    adaptiveTolerance: boolean = true
  ): boolean {
    if (beaconIds.length !== 4) return false;

    const beaconMap = new Map(beacons.map(b => [b.id, b]));
    const points = beaconIds
      .map(id => beaconMap.get(id)?.position)
      .filter((p): p is NonNullable<typeof p> => p !== undefined);

    if (points.length !== 4) return false;

    // Basic square validation using existing function
    const tolerance = adaptiveTolerance
      ? this.getAdaptiveTolerance(beacons)
      : 0.3;
    if (!isSquare(points, tolerance)) return false;

    // Enhanced validation with more sophisticated checks
    return this.validateSquareGeometry(points, adaptiveTolerance);
  }

  /**
   * Detect and validate pentagon formation with enhanced robustness.
   *
   * @param beacons - All beacons in the network
   * @param beaconIds - IDs of beacons forming potential pentagon
   * @param adaptiveTolerance - Whether to adjust tolerance based on beacon density
   * @returns True if beacons form a valid pentagon
   */
  detectPentagon(
    beacons: Beacon[],
    beaconIds: string[],
    adaptiveTolerance: boolean = true
  ): boolean {
    if (beaconIds.length !== 5) return false;

    const beaconMap = new Map(beacons.map(b => [b.id, b]));
    const points = beaconIds
      .map(id => beaconMap.get(id)?.position)
      .filter((p): p is NonNullable<typeof p> => p !== undefined);

    if (points.length !== 5) return false;

    // Basic pentagon validation using existing function
    const tolerance = adaptiveTolerance
      ? this.getAdaptiveTolerance(beacons)
      : 0.2;
    if (!isPentagon(points, tolerance)) return false;

    // Enhanced validation with side length consistency
    return this.validateSideLengthConsistency(
      points,
      'pentagon',
      adaptiveTolerance
    );
  }

  /**
   * Detect and validate hexagon formation with enhanced robustness.
   *
   * @param beacons - All beacons in the network
   * @param beaconIds - IDs of beacons forming potential hexagon
   * @param adaptiveTolerance - Whether to adjust tolerance based on beacon density
   * @returns True if beacons form a valid hexagon
   */
  detectHexagon(
    beacons: Beacon[],
    beaconIds: string[],
    adaptiveTolerance: boolean = true
  ): boolean {
    if (beaconIds.length !== 6) return false;

    const beaconMap = new Map(beacons.map(b => [b.id, b]));
    const points = beaconIds
      .map(id => beaconMap.get(id)?.position)
      .filter((p): p is NonNullable<typeof p> => p !== undefined);

    if (points.length !== 6) return false;

    // Basic hexagon validation using existing function
    const tolerance = adaptiveTolerance
      ? this.getAdaptiveTolerance(beacons)
      : 0.2;
    if (!isHexagon(points, tolerance)) return false;

    // Enhanced validation with side length consistency
    return this.validateSideLengthConsistency(
      points,
      'hexagon',
      adaptiveTolerance
    );
  }

  /**
   * Calculate adaptive tolerance based on beacon network density.
   *
   * @param beacons - All beacons in the network
   * @returns Adaptive tolerance value
   */
  private getAdaptiveTolerance(beacons: Beacon[]): number {
    if (beacons.length < 3) return 0.35; // High tolerance for sparse networks

    // Calculate average distance between beacons
    let totalDistance = 0;
    let pairCount = 0;

    for (let i = 0; i < Math.min(beacons.length, 20); i++) {
      // Sample first 20 beacons for performance
      for (let j = i + 1; j < Math.min(beacons.length, 20); j++) {
        totalDistance += distance(beacons[i].position, beacons[j].position);
        pairCount++;
      }
    }

    const avgDistance = totalDistance / pairCount;

    // Adaptive tolerance: higher for sparse networks, lower for dense networks
    if (avgDistance > 200) return 0.4; // Very sparse
    if (avgDistance > 100) return 0.3; // Sparse
    if (avgDistance > 50) return 0.2; // Normal
    return 0.15; // Dense network - stricter validation
  }

  /**
   * Validate side length consistency for geometric shapes.
   *
   * @param points - Points forming the shape
   * @param shapeType - Type of shape being validated
   * @param adaptiveTolerance - Whether to use adaptive tolerance
   * @returns True if side lengths are sufficiently consistent
   */
  private validateSideLengthConsistency(
    points: { x: number; y: number }[],
    shapeType: PatternType,
    adaptiveTolerance: boolean
  ): boolean {
    const sortedPoints = sortPointsClockwise(points);
    const sideLengths = [];

    // Calculate all side lengths
    for (let i = 0; i < sortedPoints.length; i++) {
      const nextIndex = (i + 1) % sortedPoints.length;
      sideLengths.push(distance(sortedPoints[i], sortedPoints[nextIndex]));
    }

    // For triangles, allow more variation in side lengths
    if (shapeType === 'triangle') {
      const minSide = Math.min(...sideLengths);
      const maxSide = Math.max(...sideLengths);
      const ratio = maxSide / minSide;
      return ratio < 3.0; // Allow reasonable variation
    }

    // For regular polygons, enforce stricter side length consistency
    const avgLength =
      sideLengths.reduce((sum, len) => sum + len, 0) / sideLengths.length;
    const tolerance = adaptiveTolerance ? this.getAdaptiveTolerance([]) : 0.25;

    return sideLengths.every(length => {
      const deviation = Math.abs(length - avgLength) / avgLength;
      return deviation <= tolerance;
    });
  }

  /**
   * Validate triangle angles for geometric integrity.
   *
   * @param points - Triangle vertices
   * @param adaptiveTolerance - Whether to use adaptive tolerance
   * @returns True if angles form a valid triangle
   */
  private validateTriangleAngles(
    points: { x: number; y: number }[],
    adaptiveTolerance: boolean
  ): boolean {
    const [p1, p2, p3] = points;

    // Calculate all three angles
    const angle1 = this.geometryUtils.angleBetweenPoints(p2, p1, p3);
    const angle2 = this.geometryUtils.angleBetweenPoints(p1, p2, p3);
    const angle3 = this.geometryUtils.angleBetweenPoints(p1, p3, p2);

    const angleSum = angle1 + angle2 + angle3;
    const expectedSum = Math.PI;

    const tolerance = adaptiveTolerance
      ? this.tolerance.angle * 2
      : this.tolerance.angle;

    // Validate angle sum equals π (within tolerance)
    return Math.abs(angleSum - expectedSum) <= tolerance;
  }

  /**
   * Validate square geometry with enhanced checks.
   *
   * @param points - Square vertices
   * @param adaptiveTolerance - Whether to use adaptive tolerance
   * @returns True if geometry forms a valid square
   */
  private validateSquareGeometry(
    points: { x: number; y: number }[],
    adaptiveTolerance: boolean
  ): boolean {
    const sortedPoints = sortPointsClockwise(points);

    // Check diagonal lengths (should be equal and √2 times side length)
    const diagonal1 = distance(sortedPoints[0], sortedPoints[2]);
    const diagonal2 = distance(sortedPoints[1], sortedPoints[3]);
    const side = distance(sortedPoints[0], sortedPoints[1]);

    const expectedDiagonal = side * Math.sqrt(2);
    const tolerance = adaptiveTolerance ? this.getAdaptiveTolerance([]) : 0.35;

    const diagonal1Error =
      Math.abs(diagonal1 - expectedDiagonal) / expectedDiagonal;
    const diagonal2Error =
      Math.abs(diagonal2 - expectedDiagonal) / expectedDiagonal;
    const diagonalDifference =
      Math.abs(diagonal1 - diagonal2) / Math.max(diagonal1, diagonal2);

    return (
      diagonal1Error <= tolerance &&
      diagonal2Error <= tolerance &&
      diagonalDifference <= tolerance
    );
  }

  /**
   * Update tolerance settings for the detector.
   *
   * @param newTolerance - New tolerance settings
   */
  updateTolerance(newTolerance: Partial<GeometricTolerance>): void {
    this.tolerance = { ...this.tolerance, ...newTolerance };
    this.geometryUtils.setTolerance(this.tolerance);
  }

  /**
   * Get current tolerance settings.
   *
   * @returns Current tolerance configuration
   */
  getTolerance(): GeometricTolerance {
    return { ...this.tolerance };
  }
}
