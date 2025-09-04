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
   * Generate Voronoi cells using proper Voronoi tessellation for organic boundaries
   */
  generateCells(): VoronoiCell[] {
    const cells: VoronoiCell[] = [];
    
    // Use simplified Voronoi implementation for performance
    // For each seed point, find all points closer to it than to any other seed
    this.seeds.forEach((seed, index) => {
      const vertices = this.generateVoronoiVertices(seed, index);
      const area = this.calculatePolygonArea(vertices);
      const neighbors = this.findVoronoiNeighbors(seed, index);

      cells.push({
        id: `sector_${index}`,
        seed,
        vertices,
        center: seed, // Use seed as center for Voronoi cells
        area,
        neighbors
      });
    });

    return cells;
  }

  /**
   * Generate vertices for a Voronoi cell around a seed point
   */
  private generateVoronoiVertices(seed: Point2D, seedIndex: number): Point2D[] {
    const vertices: Point2D[] = [];
    const sampleResolution = 32; // Number of radial samples around seed
    const maxRadius = this.calculateMaxRadius(seed);
    
    // Generate points in a circle around the seed
    for (let i = 0; i < sampleResolution; i++) {
      const angle = (2 * Math.PI * i) / sampleResolution;
      let radius = maxRadius;
      
      // Find the distance to the nearest boundary with another Voronoi cell
      for (let j = 0; j < this.seeds.length; j++) {
        if (j === seedIndex) continue;
        
        const otherSeed = this.seeds[j];
        const distanceToOther = this.distance(seed, otherSeed);
        const midpointDistance = distanceToOther / 2;
        
        // Calculate perpendicular distance to the bisector line
        const dx = otherSeed.x - seed.x;
        const dy = otherSeed.y - seed.y;
        const midpointX = seed.x + dx / 2;
        const midpointY = seed.y + dy / 2;
        
        // Project the current ray onto the bisector
        const rayX = seed.x + Math.cos(angle) * radius;
        const rayY = seed.y + Math.sin(angle) * radius;
        
        // Calculate intersection with perpendicular bisector
        const intersectionDistance = this.calculateBisectorIntersection(
          seed, { x: rayX, y: rayY }, otherSeed
        );
        
        if (intersectionDistance > 0 && intersectionDistance < radius) {
          radius = intersectionDistance;
        }
      }
      
      // Clamp to bounds
      const x = Math.max(this.bounds.minX, Math.min(this.bounds.maxX, 
        seed.x + Math.cos(angle) * radius));
      const y = Math.max(this.bounds.minY, Math.min(this.bounds.maxY, 
        seed.y + Math.sin(angle) * radius));
      
      vertices.push({ x, y });
    }
    
    // Simplify polygon to remove redundant points
    return this.simplifyPolygon(vertices);
  }

  /**
   * Calculate maximum possible radius for a seed point
   */
  private calculateMaxRadius(seed: Point2D): number {
    const distToBounds = Math.min(
      seed.x - this.bounds.minX,
      this.bounds.maxX - seed.x,
      seed.y - this.bounds.minY,
      this.bounds.maxY - seed.y
    );
    
    // Find distance to nearest other seed
    let minDistanceToSeed = Infinity;
    for (const otherSeed of this.seeds) {
      if (otherSeed === seed) continue;
      const dist = this.distance(seed, otherSeed);
      minDistanceToSeed = Math.min(minDistanceToSeed, dist);
    }
    
    return Math.min(distToBounds, minDistanceToSeed / 2) * 1.2; // Add 20% buffer
  }

  /**
   * Calculate intersection distance with perpendicular bisector
   */
  private calculateBisectorIntersection(seed: Point2D, rayEnd: Point2D, otherSeed: Point2D): number {
    // Midpoint between seeds
    const midX = (seed.x + otherSeed.x) / 2;
    const midY = (seed.y + otherSeed.y) / 2;
    
    // Vector from seed to other seed
    const dx = otherSeed.x - seed.x;
    const dy = otherSeed.y - seed.y;
    
    // Perpendicular vector (bisector direction)
    const perpX = -dy;
    const perpY = dx;
    
    // Ray direction
    const rayDx = rayEnd.x - seed.x;
    const rayDy = rayEnd.y - seed.y;
    
    // Calculate intersection using parametric line equations
    const denominator = perpX * rayDy - perpY * rayDx;
    if (Math.abs(denominator) < 1e-10) return Infinity; // Lines are parallel
    
    const t = ((midX - seed.x) * rayDy - (midY - seed.y) * rayDx) / denominator;
    
    // If intersection is behind the bisector, ignore it
    if (t < 0) return Infinity;
    
    // Calculate intersection point
    const intersectionX = midX + t * perpX;
    const intersectionY = midY + t * perpY;
    
    // Return distance from seed to intersection
    return this.distance(seed, { x: intersectionX, y: intersectionY });
  }

  /**
   * Simplify polygon by removing collinear and very close points
   */
  private simplifyPolygon(vertices: Point2D[]): Point2D[] {
    if (vertices.length < 4) return vertices;
    
    const simplified: Point2D[] = [];
    const epsilon = 2.0; // Minimum distance between points
    
    for (let i = 0; i < vertices.length; i++) {
      const current = vertices[i];
      const prev = simplified[simplified.length - 1];
      
      // Skip points that are too close to the previous point
      if (!prev || this.distance(current, prev) >= epsilon) {
        simplified.push(current);
      }
    }
    
    // Ensure we have at least 3 points for a valid polygon
    return simplified.length >= 3 ? simplified : vertices.slice(0, 4);
  }

  /**
   * Find neighboring Voronoi cells by checking which seeds share boundaries
   */
  private findVoronoiNeighbors(seed: Point2D, seedIndex: number): string[] {
    const neighbors: string[] = [];
    const neighborThreshold = this.calculateNeighborThreshold(seed);
    
    for (let i = 0; i < this.seeds.length; i++) {
      if (i === seedIndex) continue;
      
      const otherSeed = this.seeds[i];
      const distance = this.distance(seed, otherSeed);
      
      if (distance <= neighborThreshold) {
        neighbors.push(`sector_${i}`);
      }
    }
    
    return neighbors;
  }

  /**
   * Calculate threshold distance for determining neighbors
   */
  private calculateNeighborThreshold(seed: Point2D): number {
    // Find distances to all other seeds
    const distances: number[] = [];
    for (const otherSeed of this.seeds) {
      if (otherSeed === seed) continue;
      distances.push(this.distance(seed, otherSeed));
    }
    
    distances.sort((a, b) => a - b);
    
    // Use the median distance as a reasonable threshold
    const medianIndex = Math.floor(distances.length / 2);
    return distances[medianIndex] * 1.5; // 50% buffer for neighbor detection
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
  private seeds: Point2D[] = [];
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
    this.seeds = [];
    for (let i = 0; i < this.config.sectorCount; i++) {
      this.seeds.push({
        x: random.nextInRange(this.bounds.minX, this.bounds.maxX),
        y: random.nextInRange(this.bounds.minY, this.bounds.maxY)
      });
    }

    // Generate Voronoi diagram
    const voronoiGenerator = new VoronoiGenerator(this.bounds, this.seeds);
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
   * Relax sector boundaries using Lloyd's algorithm for Voronoi tessellation
   */
  private relaxSectors(iterations: number): void {
    let currentSeeds = [...this.seeds];
    
    for (let i = 0; i < iterations; i++) {
      // Generate cells with current seeds
      const tempGenerator = new VoronoiGenerator(this.bounds, currentSeeds);
      const tempCells = tempGenerator.generateCells();
      
      // Move each seed toward the centroid of its Voronoi cell
      const newSeeds: Point2D[] = [];
      
      tempCells.forEach((cell, index) => {
        const centroid = this.calculateCentroid(cell.vertices);
        
        // Apply some damping to prevent oscillation
        const dampingFactor = 0.5;
        const currentSeed = currentSeeds[index];
        const newSeed = {
          x: currentSeed.x + (centroid.x - currentSeed.x) * dampingFactor,
          y: currentSeed.y + (centroid.y - currentSeed.y) * dampingFactor
        };
        
        // Ensure new seed stays within bounds
        newSeeds.push({
          x: Math.max(this.bounds.minX + 10, Math.min(this.bounds.maxX - 10, newSeed.x)),
          y: Math.max(this.bounds.minY + 10, Math.min(this.bounds.maxY - 10, newSeed.y))
        });
      });
      
      currentSeeds = newSeeds;
    }
    
    // Update the original seeds and regenerate final cells
    this.seeds = currentSeeds;
    const finalGenerator = new VoronoiGenerator(this.bounds, currentSeeds);
    const finalCells = finalGenerator.generateCells();
    
    // Update sectors and cells with final results
    finalCells.forEach((cell, index) => {
      const sectorId = `sector_${index}`;
      const sector = this.sectors.get(sectorId);
      
      if (sector) {
        sector.center = cell.center;
        sector.vertices = cell.vertices;
        sector.bounds = this.calculateSectorBounds(cell.vertices);
        sector.neighboringSectors = cell.neighbors;
      }
      
      this.voronoiCells.set(sectorId, cell);
    });
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
   * Generate optimized render info for sectors with performance culling
   */
  public generateSectorRenderInfo(
    sectors: GalacticSector[],
    zoomLevel: number,
    viewportBounds: ViewportBounds,
    performanceMode: boolean = false
  ): Map<string, SectorRenderInfo> {
    const renderInfoMap = new Map<string, SectorRenderInfo>();

    // Calculate viewport center for distance-based optimization
    const viewportCenter = {
      x: (viewportBounds.minX + viewportBounds.maxX) / 2,
      y: (viewportBounds.minY + viewportBounds.maxY) / 2
    };

    // Pre-filter sectors for performance
    const visibleSectors = performanceMode 
      ? sectors.filter(sector => this.boundsIntersect(sector.bounds, viewportBounds))
      : sectors;

    visibleSectors.forEach(sector => {
      const shouldRender = this.boundsIntersect(sector.bounds, viewportBounds);
      
      // Skip invisible sectors early
      if (!shouldRender) {
        renderInfoMap.set(sector.id, {
          shouldRender: false,
          shouldShowBoundary: false,
          boundaryOpacity: 0,
          entropyColor: this.getEntropyColor(sector.entropy),
          entropyOpacity: 0,
          lodLevel: 0,
          showLabels: false,
          showDetails: false
        });
        return;
      }

      // Calculate distance for LOD determination
      const distance = Math.hypot(
        sector.center.x - viewportCenter.x,
        sector.center.y - viewportCenter.y
      );
      
      // Determine level of detail based on zoom and distance
      const baseZoomThreshold = performanceMode ? 0.4 : 0.3;
      const shouldShowBoundary = zoomLevel > baseZoomThreshold;
      
      // Distance-based opacity scaling for performance
      const maxDistance = Math.max(
        Math.abs(viewportBounds.maxX - viewportBounds.minX),
        Math.abs(viewportBounds.maxY - viewportBounds.minY)
      );
      const distanceFactor = performanceMode 
        ? Math.max(0.3, 1 - (distance / maxDistance) * 0.7)
        : 1;
      
      const boundaryOpacity = Math.max(0, Math.min(0.6, 
        (zoomLevel - baseZoomThreshold) * 2 * distanceFactor
      ));
      
      // Calculate entropy color and opacity with performance considerations
      const entropyColor = this.getEntropyColor(sector.entropy);
      const baseEntropyOpacity = Math.min(0.15, sector.entropy * 0.2);
      const entropyOpacity = performanceMode 
        ? baseEntropyOpacity * distanceFactor * 0.8 // Reduce entropy rendering in perf mode
        : baseEntropyOpacity;

      renderInfoMap.set(sector.id, {
        shouldRender,
        shouldShowBoundary,
        boundaryOpacity,
        entropyColor,
        entropyOpacity,
        lodLevel: distance > 800 ? 0 : distance > 400 ? 1 : distance > 200 ? 2 : 3,
        showLabels: distance < 400 && zoomLevel > 0.5,
        showDetails: distance < 200 && zoomLevel > 1.0
      });
    });

    return renderInfoMap;
  }

  /**
   * Get performance-optimized sectors for viewport with intelligent culling
   */
  public getOptimizedSectorsForViewport(
    viewportBounds: ViewportBounds,
    zoomLevel: number,
    maxSectors: number = 50
  ): GalacticSector[] {
    const viewportCenter = {
      x: (viewportBounds.minX + viewportBounds.maxX) / 2,
      y: (viewportBounds.minY + viewportBounds.maxY) / 2
    };

    // Get sectors in viewport with extended bounds for smooth transitions
    const extendedBounds = {
      minX: viewportBounds.minX - 100,
      maxX: viewportBounds.maxX + 100,
      minY: viewportBounds.minY - 100,
      maxY: viewportBounds.maxY + 100
    };

    const candidateSectors = Array.from(this.sectors.values())
      .filter(sector => this.boundsIntersect(sector.bounds, extendedBounds))
      .map(sector => {
        const distance = Math.hypot(
          sector.center.x - viewportCenter.x,
          sector.center.y - viewportCenter.y
        );
        
        // Combined priority score: entropy, distance, and size
        const entropyPriority = sector.entropy * 1000;
        const sizePriority = (sector.bounds.maxX - sector.bounds.minX) * 
                           (sector.bounds.maxY - sector.bounds.minY);
        const distancePenalty = distance;
        
        return {
          sector,
          priority: entropyPriority + sizePriority - distancePenalty
        };
      })
      .sort((a, b) => b.priority - a.priority)
      .slice(0, maxSectors)
      .map(item => item.sector);

    return candidateSectors;
  }

  /**
   * Batch update entropy with performance throttling
   */
  public batchUpdateSectorEntropy(deltaTime: number, maxUpdatesPerFrame: number = 10): void {
    const now = Date.now();
    if (now - this.lastEntropyUpdate < 1000) return; // Limit to 1 update per second

    const entropySpreadRate = this.config.entropyDecayRate || 0.001;
    const newEntropyValues = new Map<string, number>();
    const sectorsToUpdate = Array.from(this.sectors.values()).slice(0, maxUpdatesPerFrame);

    // Update only a subset of sectors each frame for performance
    sectorsToUpdate.forEach(sector => {
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