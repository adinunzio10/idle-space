import { Point2D } from './galaxy';

/**
 * 2D Vector with additional mathematical operations
 */
export interface Vector2D extends Point2D {
  x: number;
  y: number;
}

/**
 * Line segment defined by two points
 */
export interface LineSegment {
  start: Point2D;
  end: Point2D;
}

/**
 * Line in ax + by + c = 0 form
 */
export interface Line {
  a: number;
  b: number;
  c: number;
}

/**
 * Polygon defined by ordered vertices
 */
export interface Polygon {
  vertices: Point2D[];
  isConvex?: boolean;
  isClockwise?: boolean;
  area?: number;
}

/**
 * Circle geometry
 */
export interface Circle {
  center: Point2D;
  radius: number;
}

/**
 * Axis-aligned bounding box
 */
export interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Result of line intersection calculation
 */
export interface IntersectionResult {
  intersects: boolean;
  point?: Point2D;
  isCollinear?: boolean;
  isParallel?: boolean;
}

/**
 * Triangle with additional geometric properties
 */
export interface Triangle {
  vertices: [Point2D, Point2D, Point2D];
  area?: number;
  centroid?: Point2D;
  circumcenter?: Point2D;
  circumradius?: number;
}

/**
 * Result of point-in-polygon test
 */
export interface PointInPolygonResult {
  isInside: boolean;
  isOnBoundary?: boolean;
  distance?: number;
}

/**
 * Geometric tolerance settings
 */
export interface GeometricTolerance {
  position: number; // Tolerance for position comparisons
  angle: number; // Tolerance for angle comparisons (radians)
  distance: number; // Tolerance for distance comparisons
  area: number; // Tolerance for area comparisons
}

/**
 * Default tolerance values for geometric calculations
 */
export const DEFAULT_TOLERANCE: GeometricTolerance = {
  position: 1e-6,
  angle: 1e-4,
  distance: 1e-6,
  area: 1e-6,
};

/**
 * Convex hull algorithms available
 */
export type ConvexHullAlgorithm = 'graham' | 'jarvis' | 'quickhull';

/**
 * Orientation of three points
 */
export type Orientation = 'clockwise' | 'counterclockwise' | 'collinear';
