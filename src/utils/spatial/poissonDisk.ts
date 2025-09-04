/**
 * Poisson Disk Sampling Implementation
 * 
 * Generates naturally distributed points with guaranteed minimum distances.
 * Based on Bridson's algorithm for efficient 2D Poisson disk sampling.
 * 
 * Used for placing star systems in a realistic, non-clustered distribution
 * throughout the galaxy while maintaining aesthetic spacing.
 */

import { Point2D } from '../../types/galaxy';

export interface PoissonDiskConfig {
  /** Minimum distance between any two points */
  radius: number;
  /** Width of the sampling region */
  width: number;
  /** Height of the sampling region */
  height: number;
  /** Maximum attempts to place a point around existing points */
  maxAttempts?: number;
  /** Random seed for deterministic generation */
  seed?: number;
}

export interface SamplingBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Simple seeded random number generator for deterministic results
 */
class SeededRandom {
  private seed: number;

  constructor(seed: number = Math.random()) {
    this.seed = seed;
  }

  next(): number {
    // Linear congruential generator
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  nextInRange(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  nextAngle(): number {
    return this.next() * Math.PI * 2;
  }
}

/**
 * Background grid for fast spatial lookups during point placement
 */
class SpatialGrid {
  private cellSize: number;
  private cols: number;
  private rows: number;
  private grid: (Point2D | null)[][];

  constructor(width: number, height: number, radius: number) {
    // Cell size should be radius / sqrt(2) to ensure only one point per cell
    this.cellSize = radius / Math.sqrt(2);
    this.cols = Math.ceil(width / this.cellSize);
    this.rows = Math.ceil(height / this.cellSize);
    
    // Initialize empty grid
    this.grid = Array(this.rows).fill(null).map(() => 
      Array(this.cols).fill(null)
    );
  }

  /**
   * Convert world coordinates to grid coordinates
   */
  private worldToGrid(point: Point2D): { col: number; row: number } {
    return {
      col: Math.floor(point.x / this.cellSize),
      row: Math.floor(point.y / this.cellSize)
    };
  }

  /**
   * Add a point to the grid
   */
  addPoint(point: Point2D): boolean {
    const { col, row } = this.worldToGrid(point);
    
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) {
      return false;
    }

    this.grid[row][col] = point;
    return true;
  }

  /**
   * Check if a point can be placed (no conflicts with existing points)
   */
  canPlacePoint(point: Point2D, minRadius: number): boolean {
    const { col, row } = this.worldToGrid(point);
    
    // Check all neighboring cells (including diagonals)
    for (let r = Math.max(0, row - 2); r < Math.min(this.rows, row + 3); r++) {
      for (let c = Math.max(0, col - 2); c < Math.min(this.cols, col + 3); c++) {
        const existingPoint = this.grid[r][c];
        if (existingPoint) {
          const distance = Math.sqrt(
            Math.pow(point.x - existingPoint.x, 2) + 
            Math.pow(point.y - existingPoint.y, 2)
          );
          if (distance < minRadius) {
            return false;
          }
        }
      }
    }
    
    return true;
  }
}

/**
 * Generate points using Poisson disk sampling
 */
export function generatePoissonDiskSampling(config: PoissonDiskConfig): Point2D[] {
  const {
    radius,
    width,
    height,
    maxAttempts = 30,
    seed = Math.random()
  } = config;

  const random = new SeededRandom(seed);
  const grid = new SpatialGrid(width, height, radius);
  const points: Point2D[] = [];
  const activeList: Point2D[] = [];

  // Generate initial point in the center region
  const initialPoint: Point2D = {
    x: random.nextInRange(width * 0.3, width * 0.7),
    y: random.nextInRange(height * 0.3, height * 0.7)
  };

  points.push(initialPoint);
  activeList.push(initialPoint);
  grid.addPoint(initialPoint);

  // Continue until no more points can be placed
  while (activeList.length > 0) {
    // Pick a random point from the active list
    const activeIndex = Math.floor(random.next() * activeList.length);
    const activePoint = activeList[activeIndex];
    let pointPlaced = false;

    // Try to place a new point around the active point
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Generate point in annulus between radius and 2*radius
      const angle = random.nextAngle();
      const distance = random.nextInRange(radius, 2 * radius);
      
      const candidatePoint: Point2D = {
        x: activePoint.x + Math.cos(angle) * distance,
        y: activePoint.y + Math.sin(angle) * distance
      };

      // Check bounds
      if (candidatePoint.x < 0 || candidatePoint.x >= width || 
          candidatePoint.y < 0 || candidatePoint.y >= height) {
        continue;
      }

      // Check minimum distance constraint
      if (grid.canPlacePoint(candidatePoint, radius)) {
        points.push(candidatePoint);
        activeList.push(candidatePoint);
        grid.addPoint(candidatePoint);
        pointPlaced = true;
        break;
      }
    }

    // If no point could be placed, remove from active list
    if (!pointPlaced) {
      activeList.splice(activeIndex, 1);
    }
  }

  return points;
}

/**
 * Generate star system positions within specific bounds
 */
export function generateStarSystemPositions(
  bounds: SamplingBounds,
  minDistance: number,
  seed?: number
): Point2D[] {
  const config: PoissonDiskConfig = {
    radius: minDistance,
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY,
    maxAttempts: 30,
    seed
  };

  const localPoints = generatePoissonDiskSampling(config);
  
  // Translate points to actual bounds
  return localPoints.map(point => ({
    x: point.x + bounds.minX,
    y: point.y + bounds.minY
  }));
}

/**
 * Generate hierarchical star system distribution with varying densities
 */
export function generateHierarchicalStarSystems(
  bounds: SamplingBounds,
  densityLevels: { radius: number; weight: number }[],
  seed?: number
): Point2D[] {
  const random = new SeededRandom(seed);
  const allPoints: Point2D[] = [];
  
  // Sort density levels by radius (largest first)
  const sortedLevels = densityLevels
    .slice()
    .sort((a, b) => b.radius - a.radius);

  for (const level of sortedLevels) {
    // Generate points for this density level
    const levelPoints = generateStarSystemPositions(
      bounds,
      level.radius,
      random.next() * 1000000
    );
    
    // Apply weight-based filtering
    const filteredPoints = levelPoints.filter(() => 
      random.next() < level.weight
    );
    
    allPoints.push(...filteredPoints);
  }

  return allPoints;
}

/**
 * Utility function to validate point distribution quality
 */
export function validateDistribution(points: Point2D[], minRadius: number): {
  isValid: boolean;
  violations: number;
  averageDistance: number;
  minDistance: number;
} {
  let violations = 0;
  let totalDistance = 0;
  let distanceCount = 0;
  let minDistance = Infinity;

  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const distance = Math.sqrt(
        Math.pow(points[i].x - points[j].x, 2) + 
        Math.pow(points[i].y - points[j].y, 2)
      );
      
      if (distance < minRadius) {
        violations++;
      }
      
      totalDistance += distance;
      distanceCount++;
      minDistance = Math.min(minDistance, distance);
    }
  }

  return {
    isValid: violations === 0,
    violations,
    averageDistance: distanceCount > 0 ? totalDistance / distanceCount : 0,
    minDistance: minDistance === Infinity ? 0 : minDistance
  };
}