import { Point2D } from './galaxy';

/**
 * Represents a triangle in Delaunay triangulation
 */
export interface Triangle {
  /** Unique identifier for the triangle */
  id: string;
  /** Three vertices of the triangle */
  vertices: [Point2D, Point2D, Point2D];
  /** Center of circumcircle */
  circumcenter: Point2D;
  /** Radius of circumcircle */
  circumradius: number;
  /** Adjacent triangle IDs (one per edge) */
  neighbors: [string | null, string | null, string | null];
  /** Whether this is a super-triangle (used for initialization) */
  isSuperTriangle?: boolean;
}

/**
 * Represents an edge between two points
 */
export interface Edge {
  /** Starting point of the edge */
  start: Point2D;
  /** Ending point of the edge */
  end: Point2D;
  /** Triangles adjacent to this edge */
  triangles: [string, string | null];
  /** Whether this edge is on the convex hull */
  isHull: boolean;
}

/**
 * Complete triangulation mesh with adjacency information
 */
export interface TriangulationMesh {
  /** All triangles in the mesh */
  triangles: Map<string, Triangle>;
  /** All edges in the mesh */
  edges: Map<string, Edge>;
  /** Point to triangles mapping for fast lookup */
  pointToTriangles: Map<string, string[]>;
  /** Bounding box of all points */
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
}

/**
 * Result of Delaunay triangulation operation
 */
export interface DelaunayResult {
  /** The triangulation mesh */
  mesh: TriangulationMesh;
  /** Neighbor mapping for efficient pattern detection */
  neighborMap: Map<string, Set<string>>;
  /** Performance metrics */
  metrics: {
    triangleCount: number;
    edgeCount: number;
    constructionTimeMs: number;
  };
}

/**
 * Configuration options for triangulation
 */
export interface TriangulationOptions {
  /** Tolerance for geometric calculations */
  tolerance: number;
  /** Whether to remove super-triangle after construction */
  removeSuperTriangle: boolean;
  /** Maximum number of points to triangulate */
  maxPoints: number;
  /** Whether to validate Delaunay property */
  validateDelaunay: boolean;
}

/**
 * Point with additional data for triangulation
 */
export interface TriangulationPoint extends Point2D {
  /** Original beacon ID */
  beaconId?: string;
  /** Index in the point array */
  index: number;
}

/**
 * Edge flip operation for maintaining Delaunay property
 */
export interface EdgeFlip {
  /** Edge being flipped */
  edge: Edge;
  /** Original triangles before flip */
  oldTriangles: [Triangle, Triangle];
  /** New triangles after flip */
  newTriangles: [Triangle, Triangle];
}

/**
 * Circumcircle test result
 */
export interface CircumcircleTest {
  /** Whether point is inside circumcircle */
  isInside: boolean;
  /** Distance from point to circumcenter */
  distance: number;
  /** Circumradius of the triangle */
  radius: number;
}

/**
 * Default triangulation options
 */
export const DEFAULT_TRIANGULATION_OPTIONS: TriangulationOptions = {
  tolerance: 1e-10,
  removeSuperTriangle: true,
  maxPoints: 2000,
  validateDelaunay: false, // Disable for performance in production
};

/**
 * Helper function to create edge key from two points
 */
export function createEdgeKey(p1: Point2D, p2: Point2D): string {
  // Ensure consistent ordering for undirected edges
  if (p1.x < p2.x || (p1.x === p2.x && p1.y < p2.y)) {
    return `${p1.x},${p1.y}|${p2.x},${p2.y}`;
  } else {
    return `${p2.x},${p2.y}|${p1.x},${p1.y}`;
  }
}

/**
 * Helper function to create point key
 */
export function createPointKey(p: Point2D): string {
  return `${p.x},${p.y}`;
}

/**
 * Helper function to check if two points are equal within tolerance
 */
export function pointsEqual(p1: Point2D, p2: Point2D, tolerance: number = 1e-10): boolean {
  return Math.abs(p1.x - p2.x) < tolerance && Math.abs(p1.y - p2.y) < tolerance;
}