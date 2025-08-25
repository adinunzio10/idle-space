import { Point2D } from '../../types/galaxy';
import { Beacon } from '../../entities/Beacon';

export interface VoronoiCell {
  site: Point2D;
  beaconId: string;
  vertices: Point2D[];
  area: number;
}

export interface VoronoiDiagram {
  cells: VoronoiCell[];
  edges: VoronoiEdge[];
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
}

export interface VoronoiEdge {
  start: Point2D;
  end: Point2D;
  leftSite?: Point2D;
  rightSite?: Point2D;
}

/**
 * Simple Voronoi diagram implementation using Fortune's algorithm approximation
 * Note: This is a simplified version suitable for mobile rendering
 */
export class VoronoiGenerator {
  private bounds: { minX: number; maxX: number; minY: number; maxY: number };

  constructor(bounds: { minX: number; maxX: number; minY: number; maxY: number }) {
    this.bounds = bounds;
  }

  /**
   * Generate Voronoi diagram from beacon positions
   */
  public generateFromBeacons(beacons: Beacon[]): VoronoiDiagram {
    const sites = beacons.map(beacon => ({
      point: beacon.position,
      beaconId: beacon.id,
    }));

    return this.generateDiagram(sites);
  }

  /**
   * Generate Voronoi diagram from point sites
   */
  private generateDiagram(sites: { point: Point2D; beaconId: string }[]): VoronoiDiagram {
    if (sites.length === 0) {
      return {
        cells: [],
        edges: [],
        bounds: this.bounds,
      };
    }

    // Use simplified approach: for each cell, find vertices by checking intersections
    const cells: VoronoiCell[] = [];
    const edges: VoronoiEdge[] = [];

    // Generate grid-based approximation for performance
    const gridSize = 20; // Adjust for quality vs performance

    // For each site, compute its Voronoi cell
    for (let i = 0; i < sites.length; i++) {
      const currentSite = sites[i];

      // Sample points around the boundary and find cell vertices
      const vertices = this.computeCellVertices(currentSite.point, sites, this.bounds);
      
      if (vertices.length > 0) {
        const cell: VoronoiCell = {
          site: currentSite.point,
          beaconId: currentSite.beaconId,
          vertices: vertices,
          area: this.calculatePolygonArea(vertices),
        };
        
        cells.push(cell);
      }
    }

    // Generate edges from cell boundaries
    for (const cell of cells) {
      for (let i = 0; i < cell.vertices.length; i++) {
        const start = cell.vertices[i];
        const end = cell.vertices[(i + 1) % cell.vertices.length];
        
        edges.push({
          start,
          end,
          leftSite: cell.site,
        });
      }
    }

    return {
      cells,
      edges,
      bounds: this.bounds,
    };
  }

  /**
   * Compute vertices of a Voronoi cell for a given site
   */
  private computeCellVertices(
    site: Point2D, 
    allSites: { point: Point2D; beaconId: string }[], 
    bounds: { minX: number; maxX: number; minY: number; maxY: number }
  ): Point2D[] {
    const vertices: Point2D[] = [];
    
    // Find potential vertices by checking perpendicular bisectors
    const otherSites = allSites.filter(s => s.point !== site);
    
    // Simplified approach: sample boundary points and check if they belong to this cell
    const boundaryPoints = [
      ...this.sampleBoundary(bounds, 50),
      ...this.sampleRadialPoints(site, 200, 16), // Sample around the site
    ];

    for (const point of boundaryPoints) {
      if (this.isPointInVoronoiCell(point, site, otherSites.map(s => s.point))) {
        vertices.push(point);
      }
    }

    // Sort vertices in clockwise order around the site
    return this.sortVerticesClockwise(vertices, site);
  }

  /**
   * Check if a point belongs to the Voronoi cell of a given site
   */
  private isPointInVoronoiCell(point: Point2D, site: Point2D, otherSites: Point2D[]): boolean {
    const distanceToSite = this.distance(point, site);
    
    // Check if this site is the closest to the point
    for (const otherSite of otherSites) {
      if (this.distance(point, otherSite) <= distanceToSite) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Sample points along the boundary
   */
  private sampleBoundary(
    bounds: { minX: number; maxX: number; minY: number; maxY: number }, 
    samples: number
  ): Point2D[] {
    const points: Point2D[] = [];
    const samplesPerSide = Math.floor(samples / 4);

    // Top edge
    for (let i = 0; i < samplesPerSide; i++) {
      const x = bounds.minX + (bounds.maxX - bounds.minX) * (i / samplesPerSide);
      points.push({ x, y: bounds.minY });
    }

    // Right edge
    for (let i = 0; i < samplesPerSide; i++) {
      const y = bounds.minY + (bounds.maxY - bounds.minY) * (i / samplesPerSide);
      points.push({ x: bounds.maxX, y });
    }

    // Bottom edge
    for (let i = 0; i < samplesPerSide; i++) {
      const x = bounds.maxX - (bounds.maxX - bounds.minX) * (i / samplesPerSide);
      points.push({ x, y: bounds.maxY });
    }

    // Left edge
    for (let i = 0; i < samplesPerSide; i++) {
      const y = bounds.maxY - (bounds.maxY - bounds.minY) * (i / samplesPerSide);
      points.push({ x: bounds.minX, y });
    }

    return points;
  }

  /**
   * Sample points in a radial pattern around a center point
   */
  private sampleRadialPoints(center: Point2D, radius: number, count: number): Point2D[] {
    const points: Point2D[] = [];
    
    for (let i = 0; i < count; i++) {
      const angle = (2 * Math.PI * i) / count;
      const x = center.x + radius * Math.cos(angle);
      const y = center.y + radius * Math.sin(angle);
      
      // Ensure point is within bounds
      if (x >= this.bounds.minX && x <= this.bounds.maxX && 
          y >= this.bounds.minY && y <= this.bounds.maxY) {
        points.push({ x, y });
      }
    }
    
    return points;
  }

  /**
   * Sort vertices in clockwise order around a center point
   */
  private sortVerticesClockwise(vertices: Point2D[], center: Point2D): Point2D[] {
    return vertices.sort((a, b) => {
      const angleA = Math.atan2(a.y - center.y, a.x - center.x);
      const angleB = Math.atan2(b.y - center.y, b.x - center.x);
      return angleA - angleB;
    });
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
   * Calculate area of a polygon using shoelace formula
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
   * Update bounds for the Voronoi diagram
   */
  public setBounds(bounds: { minX: number; maxX: number; minY: number; maxY: number }): void {
    this.bounds = bounds;
  }
}

/**
 * Utility functions for Voronoi diagram visualization
 */
export class VoronoiVisualizer {
  /**
   * Generate SVG path data for a Voronoi cell
   */
  public static cellToSVGPath(cell: VoronoiCell): string {
    if (cell.vertices.length < 3) return '';
    
    const firstVertex = cell.vertices[0];
    let path = `M ${firstVertex.x} ${firstVertex.y}`;
    
    for (let i = 1; i < cell.vertices.length; i++) {
      const vertex = cell.vertices[i];
      path += ` L ${vertex.x} ${vertex.y}`;
    }
    
    path += ' Z'; // Close the path
    return path;
  }

  /**
   * Generate connection range circle for a beacon
   */
  public static generateRangeCircle(beacon: Beacon): {
    center: Point2D;
    radius: number;
    strokeColor: string;
    fillColor: string;
  } {
    return {
      center: beacon.position,
      radius: beacon.calculateConnectionRange(),
      strokeColor: this.getBeaconColor(beacon.type, beacon.specialization),
      fillColor: this.getBeaconColor(beacon.type, beacon.specialization, 0.1),
    };
  }

  /**
   * Get color for beacon based on type and specialization
   */
  private static getBeaconColor(
    type: string, 
    specialization: string = 'none', 
    opacity: number = 1
  ): string {
    let baseColor: string;
    
    switch (type) {
      case 'pioneer':
        baseColor = '79, 70, 229'; // Indigo
        break;
      case 'harvester':
        baseColor = '245, 158, 11'; // Amber
        break;
      case 'architect':
        baseColor = '6, 182, 212'; // Cyan
        break;
      default:
        baseColor = '156, 163, 175'; // Gray
    }

    // Modify based on specialization
    if (specialization === 'efficiency') {
      baseColor = '34, 197, 94'; // Green
    } else if (specialization === 'range') {
      baseColor = '59, 130, 246'; // Blue
    } else if (specialization === 'stability') {
      baseColor = '147, 51, 234'; // Purple
    }

    return `rgba(${baseColor}, ${opacity})`;
  }

  /**
   * Generate territory visualization for a beacon
   */
  public static generateTerritoryVisualization(beacon: Beacon, alpha: number = 0.2): {
    path: string;
    fill: string;
    stroke: string;
  } {
    const territoryRadius = beacon.getTerritoryRadius();
    const center = beacon.position;
    
    // Generate a circle path
    const path = `M ${center.x - territoryRadius} ${center.y} ` +
                `A ${territoryRadius} ${territoryRadius} 0 1 0 ${center.x + territoryRadius} ${center.y} ` +
                `A ${territoryRadius} ${territoryRadius} 0 1 0 ${center.x - territoryRadius} ${center.y}`;

    return {
      path,
      fill: this.getBeaconColor(beacon.type, beacon.specialization, alpha),
      stroke: this.getBeaconColor(beacon.type, beacon.specialization, alpha * 2),
    };
  }
}