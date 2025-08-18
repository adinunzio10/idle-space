import { Point2D, ViewportBounds, Beacon } from '../../types/galaxy';

/**
 * Simple spatial grid for efficient querying of beacons within viewport
 */
export class SpatialIndex {
  private cellSize: number;
  private grid: Map<string, Beacon[]>;

  constructor(cellSize: number = 1000) {
    this.cellSize = cellSize;
    this.grid = new Map();
  }

  /**
   * Get grid cell key for a position
   */
  private getCellKey(x: number, y: number): string {
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);
    return `${cellX},${cellY}`;
  }

  /**
   * Add a beacon to the spatial index
   */
  addBeacon(beacon: Beacon): void {
    const key = this.getCellKey(beacon.position.x, beacon.position.y);
    if (!this.grid.has(key)) {
      this.grid.set(key, []);
    }
    this.grid.get(key)!.push(beacon);
  }

  /**
   * Remove a beacon from the spatial index
   */
  removeBeacon(beacon: Beacon): void {
    const key = this.getCellKey(beacon.position.x, beacon.position.y);
    const cell = this.grid.get(key);
    if (cell) {
      const index = cell.findIndex(b => b.id === beacon.id);
      if (index !== -1) {
        cell.splice(index, 1);
        if (cell.length === 0) {
          this.grid.delete(key);
        }
      }
    }
  }

  /**
   * Update beacon position in the index
   */
  updateBeacon(beacon: Beacon, oldPosition: Point2D): void {
    // Remove from old position
    const oldKey = this.getCellKey(oldPosition.x, oldPosition.y);
    const oldCell = this.grid.get(oldKey);
    if (oldCell) {
      const index = oldCell.findIndex(b => b.id === beacon.id);
      if (index !== -1) {
        oldCell.splice(index, 1);
        if (oldCell.length === 0) {
          this.grid.delete(oldKey);
        }
      }
    }

    // Add to new position
    this.addBeacon(beacon);
  }

  /**
   * Query beacons within viewport bounds
   */
  queryBounds(bounds: ViewportBounds): Beacon[] {
    const results: Beacon[] = [];
    const visited = new Set<string>();

    // Calculate grid cell range
    const minCellX = Math.floor(bounds.minX / this.cellSize);
    const maxCellX = Math.floor(bounds.maxX / this.cellSize);
    const minCellY = Math.floor(bounds.minY / this.cellSize);
    const maxCellY = Math.floor(bounds.maxY / this.cellSize);

    // Query all cells that intersect with bounds
    for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
      for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
        const key = `${cellX},${cellY}`;
        const cell = this.grid.get(key);
        
        if (cell) {
          for (const beacon of cell) {
            if (!visited.has(beacon.id)) {
              visited.add(beacon.id);
              // Check if beacon is actually within bounds
              if (
                beacon.position.x >= bounds.minX &&
                beacon.position.x <= bounds.maxX &&
                beacon.position.y >= bounds.minY &&
                beacon.position.y <= bounds.maxY
              ) {
                results.push(beacon);
              }
            }
          }
        }
      }
    }

    return results;
  }

  /**
   * Find nearest beacon to a point
   */
  findNearest(point: Point2D, maxDistance: number = Infinity): Beacon | null {
    let nearest: Beacon | null = null;
    let nearestDistance = maxDistance;

    // Search in expanding grid cells around the point
    const searchRadius = Math.ceil(maxDistance / this.cellSize);
    const centerCellX = Math.floor(point.x / this.cellSize);
    const centerCellY = Math.floor(point.y / this.cellSize);

    for (let radius = 0; radius <= searchRadius; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          // Only check cells on the perimeter of current radius
          if (Math.abs(dx) === radius || Math.abs(dy) === radius) {
            const cellX = centerCellX + dx;
            const cellY = centerCellY + dy;
            const key = `${cellX},${cellY}`;
            const cell = this.grid.get(key);

            if (cell) {
              for (const beacon of cell) {
                const distance = Math.sqrt(
                  Math.pow(beacon.position.x - point.x, 2) +
                  Math.pow(beacon.position.y - point.y, 2)
                );
                if (distance < nearestDistance) {
                  nearest = beacon;
                  nearestDistance = distance;
                }
              }
            }
          }
        }
      }
    }

    return nearest;
  }

  /**
   * Clear all beacons from the index
   */
  clear(): void {
    this.grid.clear();
  }

  /**
   * Rebuild the entire index with new beacons
   */
  rebuild(beacons: Beacon[]): void {
    this.clear();
    for (const beacon of beacons) {
      this.addBeacon(beacon);
    }
  }
}