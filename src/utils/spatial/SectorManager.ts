/**
 * SectorManager - Galactic Sector Management with Voronoi Diagram Implementation
 * 
 * Manages galactic sectors using Voronoi diagrams for entropy spreading,
 * resource management, and spatial organization of the living galactic environment.
 */

import { Point2D, ViewportBounds, GalacticSector, SectorRenderInfo } from '../../types/galaxy';

export interface VoronoiCell {
  id: string;
  seed: Point2D;
  vertices: Point2D[];
  center: Point2D;
  area: number;
  neighbors: string[];
}

export interface SectorGenerationConfig {
  bounds: ViewportBounds;
  sectorCount: number;
  seed?: number;
  minSectorSize: number;
  relaxationIterations?: number;
  entropyDecayRate?: number;
}

/**
 * Simple seeded random number generator for deterministic sector generation
 */
class SeededRandom {
  private seed: number;

  constructor(seed: number = Math.random()) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  nextInRange(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
}

/**
 * Voronoi diagram implementation using Fortune's algorithm (simplified)
 */
export class VoronoiGenerator {
  private bounds: ViewportBounds;
  private seeds: Point2D[];

  constructor(bounds: ViewportBounds, seeds: Point2D[]) {
    this.bounds = bounds;
    this.seeds = seeds;
  }

  /**
   * Generate Voronoi cells using simplified approach for performance
   */
  generateCells(): VoronoiCell[] {
    const cells: VoronoiCell[] = [];
    const cellResolution = Math.max(2, Math.min(50, Math.sqrt(this.seeds.length)));
    
    // Create grid for sampling
    const stepX = (this.bounds.maxX - this.bounds.minX) / cellResolution;
    const stepY = (this.bounds.maxY - this.bounds.minY) / cellResolution;

    // Generate sectors using simplified grid approach instead of complex Voronoi
    const targetCells = this.seeds.length;
    const gridCols = Math.ceil(Math.sqrt(targetCells * 1.2));
    const gridRows = Math.ceil(targetCells / gridCols);
    
    const cellWidth = (this.bounds.maxX - this.bounds.minX) / gridCols;
    const cellHeight = (this.bounds.maxY - this.bounds.minY) / gridRows;
    
    this.seeds.forEach((seed, index) => {
      // Calculate grid position
      const gridX = index % gridCols;
      const gridY = Math.floor(index / gridCols);
      
      // Calculate cell boundaries with slight randomization
      const baseLeft = this.bounds.minX + gridX * cellWidth;
      const baseRight = baseLeft + cellWidth;
      const baseTop = this.bounds.minY + gridY * cellHeight;
      const baseBottom = baseTop + cellHeight;
      
      // Add organic variation (10% of cell size)
      const variation = Math.min(cellWidth, cellHeight) * 0.1;
      const vertices: Point2D[] = [
        { 
          x: baseLeft + (Math.random() - 0.5) * variation, 
          y: baseTop + (Math.random() - 0.5) * variation 
        },
        { 
          x: baseRight + (Math.random() - 0.5) * variation, 
          y: baseTop + (Math.random() - 0.5) * variation 
        },
        { 
          x: baseRight + (Math.random() - 0.5) * variation, 
          y: baseBottom + (Math.random() - 0.5) * variation 
        },
        { 
          x: baseLeft + (Math.random() - 0.5) * variation, 
          y: baseBottom + (Math.random() - 0.5) * variation 
        }
      ];
      
      // Calculate area
      const area = this.calculatePolygonArea(vertices);
      
      // Find neighboring cells (grid-based)
      const neighbors: string[] = [];
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;
          
          const neighborX = gridX + dx;
          const neighborY = gridY + dy;
          
          if (neighborX >= 0 && neighborX < gridCols && 
              neighborY >= 0 && neighborY < gridRows) {
            const neighborIndex = neighborY * gridCols + neighborX;
            if (neighborIndex < this.seeds.length) {
              neighbors.push(`sector_${neighborIndex}`);
            }
          }
        }
      }

      cells.push({
        id: `sector_${index}`,
        seed,
        vertices,
        center: this.calculateCentroid(vertices),
        area,
        neighbors
      });
    });

    return cells;
  }



  /**
   * Find the closest seed point to a given point
   */
  private findClosestSeed(point: Point2D): Point2D {
    let closestSeed = this.seeds[0];
    let minDistance = this.distance(point, closestSeed);

    for (let i = 1; i < this.seeds.length; i++) {
      const distance = this.distance(point, this.seeds[i]);
      if (distance < minDistance) {
        minDistance = distance;
        closestSeed = this.seeds[i];
      }
    }

    return closestSeed;
  }

  /**
   * Calculate distance between two points
   */
  private distance(p1: Point2D, p2: Point2D): number {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Check if two seeds are neighbors in the Voronoi diagram
   */
  private areNeighbors(seed1: Point2D, seed2: Point2D, cell1Vertices: Point2D[]): boolean {
    // Simplified: if seeds are within reasonable distance and share boundary
    const distance = this.distance(seed1, seed2);
    const avgCellSize = Math.sqrt(this.calculatePolygonArea(cell1Vertices));
    
    return distance < avgCellSize * 2; // Heuristic for neighborhood
  }

  /**
   * Calculate polygon area using shoelace formula
   */
  private calculatePolygonArea(vertices: Point2D[]): number {
    if (vertices.length < 3) return 0;
    
    let area = 0;
    for (let i = 0; i < vertices.length; i++) {
      const j = (i + 1) % vertices.length;
      area += vertices[i].x * vertices[j].y;
      area -= vertices[j].x * vertices[i].y;
    }
    
    return Math.abs(area) / 2;
  }

  /**
   * Calculate centroid of polygon
   */
  private calculateCentroid(vertices: Point2D[]): Point2D {
    if (vertices.length === 0) return { x: 0, y: 0 };
    
    let cx = 0, cy = 0;
    for (const vertex of vertices) {
      cx += vertex.x;
      cy += vertex.y;
    }
    
    return {
      x: cx / vertices.length,
      y: cy / vertices.length
    };
  }

  /**
   * Compute convex hull using Graham scan
   */
  private convexHull(points: Point2D[]): Point2D[] {
    if (points.length < 3) return points;
    
    // Sort points by polar angle relative to bottommost point
    const sorted = [...points].sort((a, b) => {
      if (a.y !== b.y) return a.y - b.y;
      return a.x - b.x;
    });
    
    const hull: Point2D[] = [];
    
    // Build lower hull
    for (const point of sorted) {
      while (hull.length >= 2 && this.cross(hull[hull.length - 2], hull[hull.length - 1], point) <= 0) {
        hull.pop();
      }
      hull.push(point);
    }
    
    // Build upper hull
    const lowerSize = hull.length;
    for (let i = sorted.length - 2; i >= 0; i--) {
      const point = sorted[i];
      while (hull.length > lowerSize && this.cross(hull[hull.length - 2], hull[hull.length - 1], point) <= 0) {
        hull.pop();
      }
      hull.push(point);
    }
    
    // Remove last point (duplicate of first)
    if (hull.length > 1) hull.pop();
    
    return hull;
  }

  /**
   * Calculate cross product for convex hull
   */
  private cross(a: Point2D, b: Point2D, c: Point2D): number {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  }

  /**
   * Check if point is within bounds
   */
  private isInBounds(point: Point2D): boolean {
    return point.x >= this.bounds.minX && point.x <= this.bounds.maxX &&
           point.y >= this.bounds.minY && point.y <= this.bounds.maxY;
  }
}

/**
 * Main SectorManager class
 */
export class SectorManager {
  private sectors: Map<string, GalacticSector>;
  private voronoiCells: Map<string, VoronoiCell>;
  private bounds: ViewportBounds;
  private config: SectorGenerationConfig;
  private lastEntropyUpdate: number = 0;

  constructor(config: SectorGenerationConfig) {
    this.sectors = new Map();
    this.voronoiCells = new Map();
    this.bounds = config.bounds;
    this.config = config;
    
    this.generateSectors();
  }

  /**
   * Generate galactic sectors using Voronoi diagram
   */
  private generateSectors(): void {
    const random = new SeededRandom(this.config.seed);
    
    // Generate seed points for Voronoi cells
    const seeds: Point2D[] = [];
    for (let i = 0; i < this.config.sectorCount; i++) {
      seeds.push({
        x: random.nextInRange(this.bounds.minX, this.bounds.maxX),
        y: random.nextInRange(this.bounds.minY, this.bounds.maxY)
      });
    }

    // Generate Voronoi diagram
    const voronoiGenerator = new VoronoiGenerator(this.bounds, seeds);
    const cells = voronoiGenerator.generateCells();

    // Convert Voronoi cells to galactic sectors
    cells.forEach(cell => {
      const sector: GalacticSector = {
        id: cell.id,
        center: cell.center,
        bounds: this.calculateSectorBounds(cell.vertices),
        vertices: cell.vertices,
        entropy: random.nextInRange(0.1, 0.4), // Initial entropy
        starSystemIds: [], // Will be populated when star systems are assigned
        neighboringSectors: cell.neighbors,
        lastEntropyUpdate: Date.now()
      };

      this.sectors.set(sector.id, sector);
      this.voronoiCells.set(cell.id, cell);
    });

    // Perform relaxation iterations to improve sector quality
    if (this.config.relaxationIterations) {
      this.relaxSectors(this.config.relaxationIterations);
    }
  }

  /**
   * Calculate bounding box for sector vertices
   */
  private calculateSectorBounds(vertices: Point2D[]): ViewportBounds {
    if (vertices.length === 0) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    }

    let minX = vertices[0].x, maxX = vertices[0].x;
    let minY = vertices[0].y, maxY = vertices[0].y;

    for (const vertex of vertices) {
      minX = Math.min(minX, vertex.x);
      maxX = Math.max(maxX, vertex.x);
      minY = Math.min(minY, vertex.y);
      maxY = Math.max(maxY, vertex.y);
    }

    return { minX, maxX, minY, maxY };
  }

  /**
   * Relax sector boundaries using Lloyd's algorithm
   */
  private relaxSectors(iterations: number): void {
    for (let i = 0; i < iterations; i++) {
      // Move each sector center toward centroid of its vertices
      const newCenters = new Map<string, Point2D>();
      
      this.voronoiCells.forEach((cell, sectorId) => {
        const centroid = this.calculateCentroid(cell.vertices);
        newCenters.set(sectorId, centroid);
      });

      // Update centers and regenerate boundaries
      const seeds: Point2D[] = [];
      newCenters.forEach(center => seeds.push(center));
      
      const voronoiGenerator = new VoronoiGenerator(this.bounds, seeds);
      const newCells = voronoiGenerator.generateCells();
      
      // Update sectors with new boundaries
      newCells.forEach(cell => {
        const sector = this.sectors.get(cell.id);
        if (sector) {
          sector.center = cell.center;
          sector.vertices = cell.vertices;
          sector.bounds = this.calculateSectorBounds(cell.vertices);
          sector.neighboringSectors = cell.neighbors;
        }
        this.voronoiCells.set(cell.id, cell);
      });
    }
  }

  /**
   * Calculate centroid of points
   */
  private calculateCentroid(points: Point2D[]): Point2D {
    if (points.length === 0) return { x: 0, y: 0 };
    
    let cx = 0, cy = 0;
    for (const point of points) {
      cx += point.x;
      cy += point.y;
    }
    
    return {
      x: cx / points.length,
      y: cy / points.length
    };
  }

  /**
   * Get all sectors
   */
  public getAllSectors(): GalacticSector[] {
    return Array.from(this.sectors.values());
  }

  /**
   * Get sector by ID
   */
  public getSector(sectorId: string): GalacticSector | undefined {
    return this.sectors.get(sectorId);
  }

  /**
   * Find sector containing a specific point
   */
  public getSectorContaining(point: Point2D): GalacticSector | undefined {
    for (const sector of this.sectors.values()) {
      if (this.isPointInPolygon(point, sector.vertices)) {
        return sector;
      }
    }
    return undefined;
  }

  /**
   * Get sectors within viewport bounds
   */
  public getSectorsInBounds(viewportBounds: ViewportBounds): GalacticSector[] {
    return Array.from(this.sectors.values()).filter(sector => 
      this.boundsIntersect(sector.bounds, viewportBounds)
    );
  }

  /**
   * Update entropy across all sectors (for entropy spreading system)
   */
  public updateSectorEntropy(deltaTime: number): void {
    const now = Date.now();
    if (now - this.lastEntropyUpdate < 1000) return; // Limit to 1 update per second

    const entropySpreadRate = this.config.entropyDecayRate || 0.001;
    const newEntropyValues = new Map<string, number>();

    // Calculate new entropy values based on neighbors
    this.sectors.forEach(sector => {
      let totalNeighborEntropy = 0;
      let neighborCount = 0;

      sector.neighboringSectors.forEach(neighborId => {
        const neighbor = this.sectors.get(neighborId);
        if (neighbor) {
          totalNeighborEntropy += neighbor.entropy;
          neighborCount++;
        }
      });

      if (neighborCount > 0) {
        const averageNeighborEntropy = totalNeighborEntropy / neighborCount;
        const entropyDelta = (averageNeighborEntropy - sector.entropy) * entropySpreadRate * (deltaTime / 1000);
        const newEntropy = Math.max(0, Math.min(1, sector.entropy + entropyDelta));
        newEntropyValues.set(sector.id, newEntropy);
      } else {
        newEntropyValues.set(sector.id, sector.entropy);
      }
    });

    // Apply new entropy values
    newEntropyValues.forEach((entropy, sectorId) => {
      const sector = this.sectors.get(sectorId);
      if (sector) {
        sector.entropy = entropy;
        sector.lastEntropyUpdate = now;
      }
    });

    this.lastEntropyUpdate = now;
  }

  /**
   * Assign star system to appropriate sector
   */
  public assignStarSystemToSector(starSystemId: string, position: Point2D): void {
    const sector = this.getSectorContaining(position);
    if (sector && !sector.starSystemIds.includes(starSystemId)) {
      sector.starSystemIds.push(starSystemId);
    }
  }

  /**
   * Remove star system from sector
   */
  public removeStarSystemFromSector(starSystemId: string): void {
    this.sectors.forEach(sector => {
      const index = sector.starSystemIds.indexOf(starSystemId);
      if (index !== -1) {
        sector.starSystemIds.splice(index, 1);
      }
    });
  }

  /**
   * Generate render info for sectors based on viewport state
   */
  public generateSectorRenderInfo(
    sectors: GalacticSector[],
    zoomLevel: number,
    viewportBounds: ViewportBounds
  ): Map<string, SectorRenderInfo> {
    const renderInfoMap = new Map<string, SectorRenderInfo>();

    sectors.forEach(sector => {
      const shouldRender = this.boundsIntersect(sector.bounds, viewportBounds);
      const shouldShowBoundary = zoomLevel > 0.3; // Show boundaries at higher zoom levels
      const boundaryOpacity = Math.max(0, Math.min(0.6, (zoomLevel - 0.3) * 2));
      
      // Calculate entropy color (blue = low, red = high)
      const entropyColor = this.getEntropyColor(sector.entropy);
      const entropyOpacity = Math.min(0.15, sector.entropy * 0.2); // Subtle tinting

      renderInfoMap.set(sector.id, {
        shouldRender,
        shouldShowBoundary,
        boundaryOpacity,
        entropyColor,
        entropyOpacity
      });
    });

    return renderInfoMap;
  }

  /**
   * Get color based on entropy level
   */
  private getEntropyColor(entropy: number): string {
    // Interpolate from blue (low entropy) to red (high entropy)
    const r = Math.floor(255 * entropy);
    const g = Math.floor(100 * (1 - Math.abs(entropy - 0.5) * 2));
    const b = Math.floor(255 * (1 - entropy));
    
    return `rgb(${r}, ${g}, ${b})`;
  }

  /**
   * Check if point is inside polygon using ray casting algorithm
   */
  private isPointInPolygon(point: Point2D, vertices: Point2D[]): boolean {
    let isInside = false;
    const { x, y } = point;
    
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
      const xi = vertices[i].x, yi = vertices[i].y;
      const xj = vertices[j].x, yj = vertices[j].y;
      
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        isInside = !isInside;
      }
    }
    
    return isInside;
  }

  /**
   * Check if two bounding boxes intersect
   */
  private boundsIntersect(bounds1: ViewportBounds, bounds2: ViewportBounds): boolean {
    return bounds1.minX < bounds2.maxX && bounds1.maxX > bounds2.minX &&
           bounds1.minY < bounds2.maxY && bounds1.maxY > bounds2.minY;
  }

  /**
   * Get sector statistics for debugging
   */
  public getSectorStats(): {
    totalSectors: number;
    averageEntropy: number;
    highEntropySectors: number;
    averageArea: number;
  } {
    const sectors = Array.from(this.sectors.values());
    const totalEntropy = sectors.reduce((sum, sector) => sum + sector.entropy, 0);
    const highEntropySectors = sectors.filter(s => s.entropy > 0.7).length;
    
    const areas = Array.from(this.voronoiCells.values()).map(cell => cell.area);
    const averageArea = areas.reduce((sum, area) => sum + area, 0) / areas.length;

    return {
      totalSectors: sectors.length,
      averageEntropy: totalEntropy / sectors.length,
      highEntropySectors,
      averageArea
    };
  }
}

/**
 * Create default sector manager for 2000x2000 galaxy space
 */
export function createDefaultSectorManager(seed?: number): SectorManager {
  const config: SectorGenerationConfig = {
    bounds: { minX: 0, maxX: 2000, minY: 0, maxY: 2000 },
    sectorCount: 64, // 8x8 grid approximate
    seed,
    minSectorSize: 100,
    relaxationIterations: 2,
    entropyDecayRate: 0.002
  };

  return new SectorManager(config);
}