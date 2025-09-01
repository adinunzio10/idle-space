import { Point2D, Beacon } from '../../types/galaxy';
import { GeometryUtils } from './GeometryUtils';

// Create a global geometry utilities instance
const geometryUtils = new GeometryUtils();

/**
 * Calculate the center point of a set of beacons
 */
export function calculateCentroid(beacons: Beacon[]): Point2D {
  if (beacons.length === 0) {
    return { x: 0, y: 0 };
  }
  
  const points = beacons.map(beacon => beacon.position);
  return geometryUtils.polygonCentroid(points);
}

/**
 * Calculate distance between two points
 */
export function distance(point1: Point2D, point2: Point2D): number {
  return geometryUtils.distance(point1, point2);
}

/**
 * Calculate the angle between three points (angle at middle point)
 */
export function angleBetweenPoints(point1: Point2D, center: Point2D, point2: Point2D): number {
  return geometryUtils.angleBetweenPoints(point1, center, point2);
}

/**
 * Check if a set of points forms a regular polygon within tolerance
 */
export function isRegularPolygon(points: Point2D[], tolerance: number = 0.2): boolean {
  if (points.length < 3) return false;
  
  const center = geometryUtils.polygonCentroid(points);
  
  // Check if all points are roughly equidistant from center
  const distances = points.map(point => geometryUtils.distance(point, center));
  const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
  
  for (const dist of distances) {
    if (Math.abs(dist - avgDistance) / avgDistance > tolerance) {
      return false;
    }
  }
  
  // Check if angles between consecutive points are roughly equal
  const expectedAngle = (2 * Math.PI) / points.length;
  
  for (let i = 0; i < points.length; i++) {
    const nextIndex = (i + 1) % points.length;
    const prevIndex = (i - 1 + points.length) % points.length;
    
    const angle = geometryUtils.angleBetweenPoints(points[prevIndex], points[i], points[nextIndex]);
    const expectedInternalAngle = Math.PI - expectedAngle;
    
    if (Math.abs(angle - expectedInternalAngle) > tolerance) {
      return false;
    }
  }
  
  return true;
}

/**
 * Sort points in clockwise order around their centroid
 */
export function sortPointsClockwise(points: Point2D[]): Point2D[] {
  return geometryUtils.sortPointsClockwise(points);
}

/**
 * Check if points form a triangle
 */
export function isTriangle(points: Point2D[]): boolean {
  if (points.length !== 3) return false;
  
  // Check that no three points are collinear
  const [p1, p2, p3] = points;
  return !geometryUtils.areCollinear(p1, p2, p3);
}

/**
 * Check if points form a square
 */
export function isSquare(points: Point2D[], tolerance: number = 0.2): boolean {
  if (points.length !== 4) return false;
  
  // Sort points in clockwise order
  const sortedPoints = geometryUtils.sortPointsClockwise(points);
  
  // Check if opposite sides are equal and parallel
  const sides = [];
  for (let i = 0; i < 4; i++) {
    const nextIndex = (i + 1) % 4;
    sides.push(geometryUtils.distance(sortedPoints[i], sortedPoints[nextIndex]));
  }
  
  // All sides should be roughly equal
  const avgSide = sides.reduce((sum, side) => sum + side, 0) / 4;
  for (const side of sides) {
    if (Math.abs(side - avgSide) / avgSide > tolerance) {
      return false;
    }
  }
  
  // Check if angles are roughly 90 degrees
  for (let i = 0; i < 4; i++) {
    const prevIndex = (i - 1 + 4) % 4;
    const nextIndex = (i + 1) % 4;
    const angle = geometryUtils.angleBetweenPoints(sortedPoints[prevIndex], sortedPoints[i], sortedPoints[nextIndex]);
    
    if (Math.abs(angle - Math.PI / 2) > tolerance) {
      return false;
    }
  }
  
  return true;
}

/**
 * Check if points form a pentagon
 */
export function isPentagon(points: Point2D[], tolerance: number = 0.2): boolean {
  if (points.length !== 5) return false;
  return isRegularPolygon(points, tolerance);
}

/**
 * Check if points form a hexagon
 */
export function isHexagon(points: Point2D[], tolerance: number = 0.2): boolean {
  if (points.length !== 6) return false;
  return isRegularPolygon(points, tolerance);
}

/**
 * Get all possible cycles of a given length in a connection graph
 */
export function findCycles(
  beacons: Beacon[],
  cycleLength: number,
  maxCycles: number = 100
): string[][] {
  const cycles: string[][] = [];
  
  console.log(`[findCycles] Looking for cycles of length ${cycleLength} in ${beacons.length} beacons`);
  
  // Build adjacency list
  const adjacencyList = new Map<string, string[]>();
  for (const beacon of beacons) {
    adjacencyList.set(beacon.id, beacon.connections);
    console.log(`[findCycles] Beacon ${beacon.id} has ${beacon.connections.length} connections:`, beacon.connections);
  }
  
  // DFS to find cycles
  function dfs(
    currentPath: string[],
    visited: Set<string>,
    targetLength: number
  ): void {
    if (cycles.length >= maxCycles) return;
    
    if (currentPath.length === targetLength) {
      // Check if we can complete the cycle
      const lastBeacon = currentPath[currentPath.length - 1];
      const firstBeacon = currentPath[0];
      const connections = adjacencyList.get(lastBeacon) || [];
      
      if (connections.includes(firstBeacon)) {
        // Found a cycle - sort to ensure consistent ordering
        const sortedCycle = [...currentPath].sort();
        const cycleKey = sortedCycle.join(',');
        
        // Check if this cycle is already found (different starting point)
        const isDuplicate = cycles.some(cycle => {
          const sortedExisting = [...cycle].sort().join(',');
          return sortedExisting === cycleKey;
        });
        
        if (!isDuplicate) {
          cycles.push([...currentPath]);
        }
      }
      return;
    }
    
    const currentBeacon = currentPath[currentPath.length - 1];
    const connections = adjacencyList.get(currentBeacon) || [];
    
    for (const nextBeaconId of connections) {
      // Don't revisit nodes except for the first one (to complete cycle)
      if (visited.has(nextBeaconId)) {
        if (nextBeaconId === currentPath[0] && currentPath.length === targetLength - 1) {
          // This would complete the cycle, handle in the base case above
          continue;
        } else {
          continue;
        }
      }
      
      currentPath.push(nextBeaconId);
      visited.add(nextBeaconId);
      dfs(currentPath, visited, targetLength);
      currentPath.pop();
      visited.delete(nextBeaconId);
    }
  }
  
  // Try starting from each beacon
  for (const beacon of beacons) {
    if (cycles.length >= maxCycles) break;
    
    const visited = new Set([beacon.id]);
    dfs([beacon.id], visited, cycleLength);
  }
  
  console.log(`[findCycles] Found ${cycles.length} cycles of length ${cycleLength}`);
  return cycles;
}

/**
 * Check if a cycle forms a valid geometric pattern
 */
export function validateGeometricPattern(
  beaconIds: string[],
  beacons: Beacon[],
  expectedType: 'triangle' | 'square' | 'pentagon' | 'hexagon'
): boolean {
  const beaconMap = new Map(beacons.map(b => [b.id, b]));
  const points = beaconIds
    .map(id => beaconMap.get(id)?.position)
    .filter((p): p is Point2D => p !== undefined);
  
  if (points.length !== beaconIds.length) {
    return false; // Some beacons not found
  }
  
  switch (expectedType) {
    case 'triangle':
      return isTriangle(points);
    case 'square':
      return isSquare(points);
    case 'pentagon':
      return isPentagon(points);
    case 'hexagon':
      return isHexagon(points);
    default:
      return false;
  }
}