import { Point2D, Beacon } from '../../types/galaxy';
import {
  Triangle,
  Edge,
  TriangulationMesh,
  DelaunayResult,
  TriangulationOptions,
  TriangulationPoint,
  EdgeFlip,
  CircumcircleTest,
  DEFAULT_TRIANGULATION_OPTIONS,
  createEdgeKey,
  createPointKey,
  pointsEqual,
} from '../../types/triangulation';
import { GeometryUtils } from './GeometryUtils';

/**
 * High-performance Delaunay triangulation engine using Bowyer-Watson algorithm.
 *
 * Provides O(n log n) triangulation construction and efficient neighbor queries
 * for pattern detection optimization.
 *
 * @example
 * ```typescript
 * const engine = new TriangulationEngine();
 * const result = engine.triangulate(beacons);
 * const neighbors = result.neighborMap.get(beaconId);
 * ```
 */
export class TriangulationEngine {
  private geometryUtils: GeometryUtils;
  private options: TriangulationOptions;
  private triangleIdCounter: number = 0;

  constructor(options: Partial<TriangulationOptions> = {}) {
    this.options = { ...DEFAULT_TRIANGULATION_OPTIONS, ...options };
    this.geometryUtils = new GeometryUtils();
  }

  /**
   * Perform Delaunay triangulation on a set of beacons.
   *
   * @param beacons - Array of beacons to triangulate
   * @returns Complete triangulation result with neighbor mapping
   */
  triangulate(beacons: Beacon[]): DelaunayResult {
    const startTime = performance.now();

    if (beacons.length < 3) {
      return this.createEmptyResult(startTime);
    }

    // Limit points for performance
    const points = beacons
      .slice(0, this.options.maxPoints)
      .map((beacon, index) => ({
        x: beacon.position.x,
        y: beacon.position.y,
        beaconId: beacon.id,
        index,
      }));

    // Build triangulation using Bowyer-Watson algorithm
    const mesh = this.buildTriangulation(points);

    // Create neighbor mapping
    const neighborMap = this.buildNeighborMap(mesh, beacons);

    const endTime = performance.now();

    return {
      mesh,
      neighborMap,
      metrics: {
        triangleCount: mesh.triangles.size,
        edgeCount: mesh.edges.size,
        constructionTimeMs: endTime - startTime,
      },
    };
  }

  /**
   * Build Delaunay triangulation using Bowyer-Watson algorithm.
   *
   * @param points - Points to triangulate
   * @returns Complete triangulation mesh
   */
  private buildTriangulation(points: TriangulationPoint[]): TriangulationMesh {
    // Initialize mesh
    const mesh: TriangulationMesh = {
      triangles: new Map(),
      edges: new Map(),
      pointToTriangles: new Map(),
      bounds: this.calculateBounds(points),
    };

    // Create super-triangle that contains all points
    const superTriangle = this.createSuperTriangle(mesh.bounds);
    this.addTriangle(mesh, superTriangle);

    // Add points one by one using Bowyer-Watson algorithm
    for (const point of points) {
      this.insertPoint(mesh, point);
    }

    // Remove super-triangle if requested
    if (this.options.removeSuperTriangle) {
      this.removeSuperTriangle(mesh, superTriangle);
    }

    return mesh;
  }

  /**
   * Insert a point into the triangulation using Bowyer-Watson algorithm.
   *
   * @param mesh - Current triangulation mesh
   * @param point - Point to insert
   */
  private insertPoint(
    mesh: TriangulationMesh,
    point: TriangulationPoint
  ): void {
    // Find triangles whose circumcircle contains the point
    const badTriangles: Triangle[] = [];

    for (const triangle of mesh.triangles.values()) {
      const test = this.circumcircleTest(triangle, point);
      if (test.isInside) {
        badTriangles.push(triangle);
      }
    }

    if (badTriangles.length === 0) {
      return; // Point is outside all triangles (shouldn't happen with super-triangle)
    }

    // Find the polygon boundary formed by bad triangles
    const polygon = this.findPolygonBoundary(badTriangles);

    // Remove bad triangles
    for (const triangle of badTriangles) {
      this.removeTriangle(mesh, triangle);
    }

    // Create new triangles by connecting point to polygon vertices
    for (let i = 0; i < polygon.length; i++) {
      const p1 = polygon[i];
      const p2 = polygon[(i + 1) % polygon.length];

      const newTriangle = this.createTriangle([point, p1, p2]);
      this.addTriangle(mesh, newTriangle);
    }
  }

  /**
   * Create a super-triangle that contains all points.
   *
   * @param bounds - Bounding box of all points
   * @returns Super-triangle
   */
  private createSuperTriangle(bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  }): Triangle {
    const dx = bounds.maxX - bounds.minX;
    const dy = bounds.maxY - bounds.minY;
    const deltaMax = Math.max(dx, dy);
    const midX = (bounds.minX + bounds.maxX) / 2;
    const midY = (bounds.minY + bounds.maxY) / 2;

    // Create triangle large enough to contain all points
    const margin = deltaMax * 2;
    const vertices: [Point2D, Point2D, Point2D] = [
      { x: midX - margin, y: midY - margin },
      { x: midX + margin, y: midY - margin },
      { x: midX, y: midY + margin },
    ];

    return this.createTriangle(vertices, true);
  }

  /**
   * Create a triangle from three vertices.
   *
   * @param vertices - Three vertices of the triangle
   * @param isSuperTriangle - Whether this is a super-triangle
   * @returns New triangle
   */
  private createTriangle(
    vertices: [Point2D, Point2D, Point2D],
    isSuperTriangle: boolean = false
  ): Triangle {
    const circumcircle = this.calculateCircumcircle(vertices);

    return {
      id: `tri_${this.triangleIdCounter++}`,
      vertices,
      circumcenter: circumcircle.center,
      circumradius: circumcircle.radius,
      neighbors: [null, null, null],
      isSuperTriangle,
    };
  }

  /**
   * Calculate circumcircle of a triangle.
   *
   * @param vertices - Triangle vertices
   * @returns Circumcircle center and radius
   */
  private calculateCircumcircle(vertices: [Point2D, Point2D, Point2D]): {
    center: Point2D;
    radius: number;
  } {
    const [p1, p2, p3] = vertices;

    const ax = p1.x,
      ay = p1.y;
    const bx = p2.x,
      by = p2.y;
    const cx = p3.x,
      cy = p3.y;

    const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));

    if (Math.abs(d) < this.options.tolerance) {
      // Degenerate triangle, return centroid
      const center = {
        x: (ax + bx + cx) / 3,
        y: (ay + by + cy) / 3,
      };
      const radius = Math.max(
        this.geometryUtils.distance(center, p1),
        this.geometryUtils.distance(center, p2),
        this.geometryUtils.distance(center, p3)
      );
      return { center, radius };
    }

    const ux =
      ((ax * ax + ay * ay) * (by - cy) +
        (bx * bx + by * by) * (cy - ay) +
        (cx * cx + cy * cy) * (ay - by)) /
      d;
    const uy =
      ((ax * ax + ay * ay) * (cx - bx) +
        (bx * bx + by * by) * (ax - cx) +
        (cx * cx + cy * cy) * (bx - ax)) /
      d;

    const center = { x: ux, y: uy };
    const radius = this.geometryUtils.distance(center, p1);

    return { center, radius };
  }

  /**
   * Test if a point is inside a triangle's circumcircle.
   *
   * @param triangle - Triangle to test
   * @param point - Point to test
   * @returns Circumcircle test result
   */
  private circumcircleTest(
    triangle: Triangle,
    point: Point2D
  ): CircumcircleTest {
    const distance = this.geometryUtils.distance(triangle.circumcenter, point);
    const isInside = distance <= triangle.circumradius + this.options.tolerance;

    return {
      isInside,
      distance,
      radius: triangle.circumradius,
    };
  }

  /**
   * Find polygon boundary formed by bad triangles.
   *
   * @param badTriangles - Triangles to remove
   * @returns Polygon vertices in order
   */
  private findPolygonBoundary(badTriangles: Triangle[]): Point2D[] {
    // Collect all edges from bad triangles
    const edgeCount = new Map<string, number>();
    const edgeVertices = new Map<string, [Point2D, Point2D]>();

    for (const triangle of badTriangles) {
      const edges = [
        [triangle.vertices[0], triangle.vertices[1]],
        [triangle.vertices[1], triangle.vertices[2]],
        [triangle.vertices[2], triangle.vertices[0]],
      ] as [Point2D, Point2D][];

      for (const [p1, p2] of edges) {
        const key = createEdgeKey(p1, p2);
        edgeCount.set(key, (edgeCount.get(key) || 0) + 1);
        edgeVertices.set(key, [p1, p2]);
      }
    }

    // Boundary edges appear exactly once
    const boundaryEdges: [Point2D, Point2D][] = [];
    for (const [key, count] of edgeCount) {
      if (count === 1) {
        boundaryEdges.push(edgeVertices.get(key)!);
      }
    }

    // Order boundary edges to form polygon
    return this.orderPolygonVertices(boundaryEdges);
  }

  /**
   * Order polygon vertices from boundary edges.
   *
   * @param edges - Boundary edges
   * @returns Ordered polygon vertices
   */
  private orderPolygonVertices(edges: [Point2D, Point2D][]): Point2D[] {
    if (edges.length === 0) return [];

    const polygon: Point2D[] = [];
    const remainingEdges = [...edges];

    // Start with first edge
    let currentEdge = remainingEdges.shift()!;
    polygon.push(currentEdge[0], currentEdge[1]);

    // Connect remaining edges
    while (remainingEdges.length > 0) {
      const lastPoint = polygon[polygon.length - 1];

      for (let i = 0; i < remainingEdges.length; i++) {
        const edge = remainingEdges[i];

        if (pointsEqual(edge[0], lastPoint, this.options.tolerance)) {
          polygon.push(edge[1]);
          remainingEdges.splice(i, 1);
          break;
        } else if (pointsEqual(edge[1], lastPoint, this.options.tolerance)) {
          polygon.push(edge[0]);
          remainingEdges.splice(i, 1);
          break;
        }
      }

      // Prevent infinite loop
      if (remainingEdges.length > 0 && polygon.length > edges.length * 2) {
        break;
      }
    }

    // Remove duplicate last point if it equals first
    if (
      polygon.length > 2 &&
      pointsEqual(
        polygon[0],
        polygon[polygon.length - 1],
        this.options.tolerance
      )
    ) {
      polygon.pop();
    }

    return polygon;
  }

  /**
   * Add triangle to mesh with proper indexing.
   *
   * @param mesh - Triangulation mesh
   * @param triangle - Triangle to add
   */
  private addTriangle(mesh: TriangulationMesh, triangle: Triangle): void {
    mesh.triangles.set(triangle.id, triangle);

    // Add to point-to-triangles mapping
    for (const vertex of triangle.vertices) {
      const key = createPointKey(vertex);
      if (!mesh.pointToTriangles.has(key)) {
        mesh.pointToTriangles.set(key, []);
      }
      mesh.pointToTriangles.get(key)!.push(triangle.id);
    }

    // Add edges
    const edges = [
      [triangle.vertices[0], triangle.vertices[1]],
      [triangle.vertices[1], triangle.vertices[2]],
      [triangle.vertices[2], triangle.vertices[0]],
    ] as [Point2D, Point2D][];

    for (const [p1, p2] of edges) {
      const key = createEdgeKey(p1, p2);
      if (!mesh.edges.has(key)) {
        mesh.edges.set(key, {
          start: p1,
          end: p2,
          triangles: [triangle.id, null],
          isHull: true,
        });
      } else {
        const edge = mesh.edges.get(key)!;
        edge.triangles[1] = triangle.id;
        edge.isHull = false;
      }
    }
  }

  /**
   * Remove triangle from mesh.
   *
   * @param mesh - Triangulation mesh
   * @param triangle - Triangle to remove
   */
  private removeTriangle(mesh: TriangulationMesh, triangle: Triangle): void {
    mesh.triangles.delete(triangle.id);

    // Remove from point-to-triangles mapping
    for (const vertex of triangle.vertices) {
      const key = createPointKey(vertex);
      const triangleIds = mesh.pointToTriangles.get(key);
      if (triangleIds) {
        const index = triangleIds.indexOf(triangle.id);
        if (index !== -1) {
          triangleIds.splice(index, 1);
        }
        if (triangleIds.length === 0) {
          mesh.pointToTriangles.delete(key);
        }
      }
    }

    // Update edges
    const edges = [
      [triangle.vertices[0], triangle.vertices[1]],
      [triangle.vertices[1], triangle.vertices[2]],
      [triangle.vertices[2], triangle.vertices[0]],
    ] as [Point2D, Point2D][];

    for (const [p1, p2] of edges) {
      const key = createEdgeKey(p1, p2);
      const edge = mesh.edges.get(key);
      if (edge) {
        if (edge.triangles[0] === triangle.id) {
          edge.triangles[0] = edge.triangles[1] || '';
          edge.triangles[1] = null;
        } else if (edge.triangles[1] === triangle.id) {
          edge.triangles[1] = null;
        }

        edge.isHull = edge.triangles[1] === null;

        if (!edge.triangles[0] || edge.triangles[0] === '') {
          mesh.edges.delete(key);
        }
      }
    }
  }

  /**
   * Remove super-triangle and its associated structures.
   *
   * @param mesh - Triangulation mesh
   * @param superTriangle - Super-triangle to remove
   */
  private removeSuperTriangle(
    mesh: TriangulationMesh,
    superTriangle: Triangle
  ): void {
    const trianglesToRemove: Triangle[] = [];

    // Find all triangles that share vertices with super-triangle
    for (const triangle of mesh.triangles.values()) {
      if (
        triangle.isSuperTriangle ||
        this.sharesSuperTriangleVertex(triangle, superTriangle)
      ) {
        trianglesToRemove.push(triangle);
      }
    }

    // Remove triangles
    for (const triangle of trianglesToRemove) {
      this.removeTriangle(mesh, triangle);
    }
  }

  /**
   * Check if triangle shares vertices with super-triangle.
   *
   * @param triangle - Triangle to check
   * @param superTriangle - Super-triangle
   * @returns True if shares vertices
   */
  private sharesSuperTriangleVertex(
    triangle: Triangle,
    superTriangle: Triangle
  ): boolean {
    for (const vertex of triangle.vertices) {
      for (const superVertex of superTriangle.vertices) {
        if (pointsEqual(vertex, superVertex, this.options.tolerance)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Build neighbor mapping from triangulation mesh.
   *
   * @param mesh - Triangulation mesh
   * @param beacons - Original beacon array for ID mapping
   * @returns Neighbor mapping for pattern detection
   */
  private buildNeighborMap(
    mesh: TriangulationMesh,
    beacons?: Beacon[]
  ): Map<string, Set<string>> {
    const neighborMap = new Map<string, Set<string>>();

    // Create point-to-beacon mapping
    const pointToBeaconMap = new Map<string, string>();
    if (beacons) {
      for (const beacon of beacons) {
        const key = createPointKey(beacon.position);
        pointToBeaconMap.set(key, beacon.id);
      }
    }

    for (const edge of mesh.edges.values()) {
      // Extract beacon IDs from edge vertices
      const beaconIds = this.extractBeaconIds(edge, pointToBeaconMap);
      if (beaconIds.length === 2) {
        const [id1, id2] = beaconIds;

        if (!neighborMap.has(id1)) {
          neighborMap.set(id1, new Set());
        }
        if (!neighborMap.has(id2)) {
          neighborMap.set(id2, new Set());
        }

        neighborMap.get(id1)!.add(id2);
        neighborMap.get(id2)!.add(id1);
      }
    }

    return neighborMap;
  }

  /**
   * Extract beacon IDs from edge vertices using point-to-beacon mapping.
   *
   * @param edge - Edge to extract from
   * @param pointToBeaconMap - Mapping from points to beacon IDs
   * @returns Array of beacon IDs
   */
  private extractBeaconIds(
    edge: Edge,
    pointToBeaconMap?: Map<string, string>
  ): string[] {
    if (!pointToBeaconMap) return [];

    const beaconIds: string[] = [];
    const startKey = createPointKey(edge.start);
    const endKey = createPointKey(edge.end);

    const startBeaconId = pointToBeaconMap.get(startKey);
    const endBeaconId = pointToBeaconMap.get(endKey);

    if (startBeaconId) beaconIds.push(startBeaconId);
    if (endBeaconId) beaconIds.push(endBeaconId);

    return beaconIds;
  }

  /**
   * Calculate bounding box of points.
   *
   * @param points - Points to bound
   * @returns Bounding box
   */
  private calculateBounds(points: TriangulationPoint[]): {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  } {
    if (points.length === 0) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    }

    let minX = points[0].x,
      maxX = points[0].x;
    let minY = points[0].y,
      maxY = points[0].y;

    for (const point of points) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }

    return { minX, maxX, minY, maxY };
  }

  /**
   * Create empty result for degenerate cases.
   *
   * @param startTime - Start time for metrics
   * @returns Empty triangulation result
   */
  private createEmptyResult(startTime: number): DelaunayResult {
    return {
      mesh: {
        triangles: new Map(),
        edges: new Map(),
        pointToTriangles: new Map(),
        bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
      },
      neighborMap: new Map(),
      metrics: {
        triangleCount: 0,
        edgeCount: 0,
        constructionTimeMs: performance.now() - startTime,
      },
    };
  }

  /**
   * Update triangulation options.
   *
   * @param options - New options
   */
  updateOptions(options: Partial<TriangulationOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Get current triangulation options.
   *
   * @returns Current options
   */
  getOptions(): TriangulationOptions {
    return { ...this.options };
  }
}
