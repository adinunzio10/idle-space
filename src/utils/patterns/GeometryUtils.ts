import { Point2D } from '../../types/galaxy';
import {
  Vector2D,
  LineSegment,
  Line,
  Polygon,
  Circle,
  BoundingBox,
  IntersectionResult,
  Triangle,
  PointInPolygonResult,
  GeometricTolerance,
  DEFAULT_TOLERANCE,
  ConvexHullAlgorithm,
  Orientation,
} from '../../types/geometry';

/**
 * Comprehensive computational geometry utility class for 2D operations.
 * 
 * This class provides a complete suite of 2D geometric operations including:
 * - Vector mathematics (dot product, cross product, normalization)
 * - Distance and angle calculations with configurable tolerance
 * - Polygon validation and analysis (convexity, area, centroid)
 * - Advanced algorithms (convex hull, line intersection, point-in-polygon)
 * - Performance-optimized operations for real-time pattern detection
 * 
 * @example
 * ```typescript
 * const geometry = new GeometryUtils();
 * const distance = geometry.distance(point1, point2);
 * const isConvex = geometry.isConvexPolygon(vertices);
 * const hull = geometry.convexHull(points);
 * ```
 */
export class GeometryUtils {
  private tolerance: GeometricTolerance;

  /**
   * Initialize GeometryUtils with optional custom tolerance settings.
   * 
   * @param tolerance - Custom tolerance values for geometric comparisons
   */
  constructor(tolerance: Partial<GeometricTolerance> = {}) {
    this.tolerance = { ...DEFAULT_TOLERANCE, ...tolerance };
  }

  // ============================================================================
  // CORE VECTOR OPERATIONS
  // ============================================================================

  /**
   * Create a vector from two points.
   * 
   * @param from - Starting point
   * @param to - Ending point
   * @returns Vector pointing from 'from' to 'to'
   * 
   * @example
   * ```typescript
   * const vector = geometry.createVector({x: 0, y: 0}, {x: 3, y: 4});
   * // Returns {x: 3, y: 4}
   * ```
   */
  createVector(from: Point2D, to: Point2D): Vector2D {
    return {
      x: to.x - from.x,
      y: to.y - from.y,
    };
  }

  /**
   * Add two vectors
   */
  addVectors(v1: Vector2D, v2: Vector2D): Vector2D {
    return {
      x: v1.x + v2.x,
      y: v1.y + v2.y,
    };
  }

  /**
   * Subtract two vectors (v1 - v2)
   */
  subtractVectors(v1: Vector2D, v2: Vector2D): Vector2D {
    return {
      x: v1.x - v2.x,
      y: v1.y - v2.y,
    };
  }

  /**
   * Multiply vector by scalar
   */
  multiplyVector(v: Vector2D, scalar: number): Vector2D {
    return {
      x: v.x * scalar,
      y: v.y * scalar,
    };
  }

  /**
   * Calculate dot product of two vectors
   */
  dotProduct(v1: Vector2D, v2: Vector2D): number {
    return v1.x * v2.x + v1.y * v2.y;
  }

  /**
   * Calculate cross product of two vectors (returns scalar in 2D)
   */
  crossProduct(v1: Vector2D, v2: Vector2D): number {
    return v1.x * v2.y - v1.y * v2.x;
  }

  /**
   * Calculate magnitude (length) of a vector
   */
  magnitude(v: Vector2D): number {
    return Math.sqrt(v.x * v.x + v.y * v.y);
  }

  /**
   * Calculate squared magnitude (avoids sqrt for performance)
   */
  magnitudeSquared(v: Vector2D): number {
    return v.x * v.x + v.y * v.y;
  }

  /**
   * Normalize a vector to unit length
   */
  normalize(v: Vector2D): Vector2D {
    const mag = this.magnitude(v);
    if (mag < this.tolerance.distance) {
      return { x: 0, y: 0 };
    }
    return {
      x: v.x / mag,
      y: v.y / mag,
    };
  }

  /**
   * Rotate vector by angle (radians)
   */
  rotateVector(v: Vector2D, angle: number): Vector2D {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      x: v.x * cos - v.y * sin,
      y: v.x * sin + v.y * cos,
    };
  }

  // ============================================================================
  // DISTANCE AND ANGLE CALCULATIONS
  // ============================================================================

  /**
   * Calculate distance between two points
   */
  distance(p1: Point2D, p2: Point2D): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Calculate squared distance (avoids sqrt for performance)
   */
  distanceSquared(p1: Point2D, p2: Point2D): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return dx * dx + dy * dy;
  }

  /**
   * Calculate angle between three points (angle at middle point)
   */
  angleBetweenPoints(p1: Point2D, center: Point2D, p2: Point2D): number {
    const v1 = this.createVector(center, p1);
    const v2 = this.createVector(center, p2);
    
    const dot = this.dotProduct(v1, v2);
    const mag1 = this.magnitude(v1);
    const mag2 = this.magnitude(v2);
    
    if (mag1 < this.tolerance.distance || mag2 < this.tolerance.distance) {
      return 0;
    }
    
    const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
    return Math.acos(cosAngle);
  }

  /**
   * Calculate angle between two vectors
   */
  angleBetweenVectors(v1: Vector2D, v2: Vector2D): number {
    const dot = this.dotProduct(v1, v2);
    const mag1 = this.magnitude(v1);
    const mag2 = this.magnitude(v2);
    
    if (mag1 < this.tolerance.distance || mag2 < this.tolerance.distance) {
      return 0;
    }
    
    const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
    return Math.acos(cosAngle);
  }

  /**
   * Get signed angle from vector v1 to v2 (-π to π)
   */
  signedAngle(v1: Vector2D, v2: Vector2D): number {
    return Math.atan2(this.crossProduct(v1, v2), this.dotProduct(v1, v2));
  }

  // ============================================================================
  // GEOMETRIC ORIENTATION AND VALIDATION
  // ============================================================================

  /**
   * Determine orientation of three points
   */
  orientation(p1: Point2D, p2: Point2D, p3: Point2D): Orientation {
    const val = (p2.y - p1.y) * (p3.x - p2.x) - (p2.x - p1.x) * (p3.y - p2.y);
    
    if (Math.abs(val) < this.tolerance.position) {
      return 'collinear';
    }
    
    return val > 0 ? 'clockwise' : 'counterclockwise';
  }

  /**
   * Check if points are collinear
   */
  areCollinear(p1: Point2D, p2: Point2D, p3: Point2D): boolean {
    return this.orientation(p1, p2, p3) === 'collinear';
  }

  /**
   * Check if two points are approximately equal
   */
  pointsEqual(p1: Point2D, p2: Point2D): boolean {
    return Math.abs(p1.x - p2.x) < this.tolerance.position &&
           Math.abs(p1.y - p2.y) < this.tolerance.position;
  }

  /**
   * Check if two angles are approximately equal
   */
  anglesEqual(a1: number, a2: number): boolean {
    const diff = Math.abs(a1 - a2);
    return diff < this.tolerance.angle || Math.abs(diff - 2 * Math.PI) < this.tolerance.angle;
  }

  // ============================================================================
  // POLYGON OPERATIONS
  // ============================================================================

  /**
   * Calculate centroid of a polygon
   */
  polygonCentroid(vertices: Point2D[]): Point2D {
    if (vertices.length === 0) {
      return { x: 0, y: 0 };
    }
    
    const sum = vertices.reduce(
      (acc, vertex) => ({
        x: acc.x + vertex.x,
        y: acc.y + vertex.y,
      }),
      { x: 0, y: 0 }
    );
    
    return {
      x: sum.x / vertices.length,
      y: sum.y / vertices.length,
    };
  }

  /**
   * Calculate polygon area using shoelace formula
   */
  polygonArea(vertices: Point2D[]): number {
    if (vertices.length < 3) return 0;
    
    let area = 0;
    const n = vertices.length;
    
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += vertices[i].x * vertices[j].y;
      area -= vertices[j].x * vertices[i].y;
    }
    
    return Math.abs(area) / 2;
  }

  /**
   * Check if polygon is convex
   */
  isConvexPolygon(vertices: Point2D[]): boolean {
    if (vertices.length < 3) return false;
    
    let isPositive: boolean | null = null;
    const n = vertices.length;
    
    for (let i = 0; i < n; i++) {
      const p1 = vertices[i];
      const p2 = vertices[(i + 1) % n];
      const p3 = vertices[(i + 2) % n];
      
      const orientation = this.orientation(p1, p2, p3);
      if (orientation === 'collinear') continue;
      
      const currentIsPositive = orientation === 'clockwise';
      
      if (isPositive === null) {
        isPositive = currentIsPositive;
      } else if (isPositive !== currentIsPositive) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Sort points in clockwise order around their centroid
   */
  sortPointsClockwise(points: Point2D[]): Point2D[] {
    if (points.length <= 2) return [...points];
    
    const center = this.polygonCentroid(points);
    
    return [...points].sort((a, b) => {
      const angleA = Math.atan2(a.y - center.y, a.x - center.x);
      const angleB = Math.atan2(b.y - center.y, b.x - center.x);
      return angleA - angleB;
    });
  }

  // ============================================================================
  // PLACEHOLDER METHODS (TO BE IMPLEMENTED IN SUBSEQUENT TASKS)
  // ============================================================================

  /**
   * Test if point is inside polygon using ray casting algorithm
   */
  pointInPolygon(point: Point2D, polygon: Point2D[]): PointInPolygonResult {
    if (polygon.length < 3) {
      return { isInside: false };
    }

    let inside = false;
    let onBoundary = false;
    let minDistance = Infinity;

    const { x, y } = point;
    const n = polygon.length;

    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = polygon[i].x;
      const yi = polygon[i].y;
      const xj = polygon[j].x;
      const yj = polygon[j].y;

      // Check if point is on edge
      const edgeDistance = this.distanceToLineSegment(point, { start: polygon[j], end: polygon[i] });
      minDistance = Math.min(minDistance, edgeDistance);

      if (edgeDistance < this.tolerance.position) {
        onBoundary = true;
      }

      // Ray casting algorithm
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }

    return {
      isInside: inside,
      isOnBoundary: onBoundary,
      distance: minDistance,
    };
  }

  /**
   * Find intersection of two line segments
   */
  lineIntersection(line1: LineSegment, line2: LineSegment): IntersectionResult {
    const { start: p1, end: q1 } = line1;
    const { start: p2, end: q2 } = line2;

    const d1 = this.createVector(p1, q1);
    const d2 = this.createVector(p2, q2);
    const d3 = this.createVector(p2, p1);

    const cross12 = this.crossProduct(d1, d2);
    const cross32 = this.crossProduct(d3, d2);

    // Lines are parallel
    if (Math.abs(cross12) < this.tolerance.position) {
      // Check if collinear
      const cross13 = this.crossProduct(d1, d3);
      if (Math.abs(cross13) < this.tolerance.position) {
        return {
          intersects: true,
          isCollinear: true,
          isParallel: true,
        };
      }
      return {
        intersects: false,
        isParallel: true,
      };
    }

    // Calculate intersection parameters
    const t1 = cross32 / cross12;
    const t2 = this.crossProduct(d3, d1) / cross12;

    // Check if intersection is within both line segments
    const intersects = t1 >= 0 && t1 <= 1 && t2 >= 0 && t2 <= 1;

    let point: Point2D | undefined;
    if (intersects || Math.abs(t1) < this.tolerance.position || Math.abs(t1 - 1) < this.tolerance.position) {
      point = {
        x: p1.x + t1 * d1.x,
        y: p1.y + t1 * d1.y,
      };
    }

    return {
      intersects,
      point,
      isCollinear: false,
      isParallel: false,
    };
  }

  /**
   * Compute convex hull of points using Graham scan algorithm
   */
  convexHull(points: Point2D[], algorithm: ConvexHullAlgorithm = 'graham'): Point2D[] {
    if (points.length <= 3) return [...points];

    switch (algorithm) {
      case 'graham':
        return this.grahamScan(points);
      default:
        return this.grahamScan(points);
    }
  }

  /**
   * Graham scan algorithm for convex hull
   */
  private grahamScan(points: Point2D[]): Point2D[] {
    if (points.length <= 1) return [...points];

    // Find bottom-most point (or leftmost in case of tie)
    let bottom = 0;
    for (let i = 1; i < points.length; i++) {
      if (points[i].y < points[bottom].y || 
          (points[i].y === points[bottom].y && points[i].x < points[bottom].x)) {
        bottom = i;
      }
    }

    // Swap bottom point to first position
    [points[0], points[bottom]] = [points[bottom], points[0]];
    const bottomPoint = points[0];

    // Sort points by polar angle with respect to bottom point
    const polarSorted = points.slice(1).map(p => ({
      point: p,
      angle: Math.atan2(p.y - bottomPoint.y, p.x - bottomPoint.x),
      distSq: this.distanceSquared(bottomPoint, p),
    }));

    polarSorted.sort((a, b) => {
      if (Math.abs(a.angle - b.angle) < this.tolerance.angle) {
        return a.distSq - b.distSq;
      }
      return a.angle - b.angle;
    });

    // Build convex hull
    const hull: Point2D[] = [bottomPoint];
    
    for (const item of polarSorted) {
      // Remove points that create clockwise turn
      while (hull.length >= 2) {
        const orientation = this.orientation(
          hull[hull.length - 2],
          hull[hull.length - 1],
          item.point
        );
        if (orientation === 'counterclockwise') break;
        hull.pop();
      }
      hull.push(item.point);
    }

    return hull;
  }

  /**
   * Calculate minimum bounding box of points
   */
  boundingBox(points: Point2D[]): BoundingBox {
    if (points.length === 0) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    }

    let minX = points[0].x;
    let maxX = points[0].x;
    let minY = points[0].y;
    let maxY = points[0].y;

    for (let i = 1; i < points.length; i++) {
      const { x, y } = points[i];
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }

    return { minX, maxX, minY, maxY };
  }

  /**
   * Calculate distance from point to line segment
   */
  distanceToLineSegment(point: Point2D, segment: LineSegment): number {
    const { start, end } = segment;
    const segmentVector = this.createVector(start, end);
    const pointVector = this.createVector(start, point);
    
    const segmentLengthSq = this.magnitudeSquared(segmentVector);
    
    // Degenerate segment (start == end)
    if (segmentLengthSq < this.tolerance.distance) {
      return this.distance(point, start);
    }
    
    // Project point onto line segment
    const t = Math.max(0, Math.min(1, this.dotProduct(pointVector, segmentVector) / segmentLengthSq));
    
    const projection: Point2D = {
      x: start.x + t * segmentVector.x,
      y: start.y + t * segmentVector.y,
    };
    
    return this.distance(point, projection);
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Get current tolerance settings
   */
  getTolerance(): GeometricTolerance {
    return { ...this.tolerance };
  }

  /**
   * Update tolerance settings
   */
  setTolerance(tolerance: Partial<GeometricTolerance>): void {
    this.tolerance = { ...this.tolerance, ...tolerance };
  }
}