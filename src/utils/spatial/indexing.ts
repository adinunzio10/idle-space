import { Point2D, ViewportBounds, Beacon } from '../../types/galaxy';
import RBush from 'rbush';

interface RBushItem {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  beacon: Beacon;
}

/**
 * R-tree based spatial index for efficient querying of beacons within viewport
 * Provides O(log n) complexity for spatial queries compared to O(n²) grid-based approach
 */
export class SpatialIndex {
  private tree: RBush<RBushItem>;
  private beaconMap: Map<string, RBushItem>;

  constructor(maxEntries: number = 16) {
    this.tree = new RBush<RBushItem>(maxEntries);
    this.beaconMap = new Map();
  }

  /**
   * Create R-tree item from beacon
   */
  private createRBushItem(beacon: Beacon): RBushItem {
    // Create a small bounding box around the beacon position
    // This allows for efficient point-in-region queries
    const padding = 0.1;
    return {
      minX: beacon.position.x - padding,
      minY: beacon.position.y - padding,
      maxX: beacon.position.x + padding,
      maxY: beacon.position.y + padding,
      beacon: beacon,
    };
  }

  /**
   * Add a beacon to the spatial index
   */
  addBeacon(beacon: Beacon): void {
    // Remove existing entry if it exists (for updates)
    this.removeBeacon(beacon);

    const item = this.createRBushItem(beacon);
    this.tree.insert(item);
    this.beaconMap.set(beacon.id, item);
  }

  /**
   * Remove a beacon from the spatial index
   */
  removeBeacon(beacon: Beacon): void {
    const existingItem = this.beaconMap.get(beacon.id);
    if (existingItem) {
      this.tree.remove(existingItem);
      this.beaconMap.delete(beacon.id);
    }
  }

  /**
   * Update beacon position in the index
   */
  updateBeacon(beacon: Beacon, oldPosition: Point2D): void {
    // Simply remove and re-add with new position
    // The addBeacon method already handles removing existing entries
    this.addBeacon(beacon);
  }

  /**
   * Query beacons within viewport bounds
   */
  queryBounds(bounds: ViewportBounds): Beacon[] {
    const searchBounds = {
      minX: bounds.minX,
      minY: bounds.minY,
      maxX: bounds.maxX,
      maxY: bounds.maxY,
    };

    const items = this.tree.search(searchBounds);
    return items.map(item => item.beacon);
  }

  /**
   * Find nearest beacon to a point
   */
  findNearest(point: Point2D, maxDistance: number = Infinity): Beacon | null {
    // Search in expanding circular areas around the point
    const searchSteps = [50, 100, 200, 500, 1000, maxDistance];

    for (const radius of searchSteps) {
      if (radius > maxDistance) continue;

      const searchBounds = {
        minX: point.x - radius,
        minY: point.y - radius,
        maxX: point.x + radius,
        maxY: point.y + radius,
      };

      const candidates = this.tree.search(searchBounds);

      let nearest: Beacon | null = null;
      let nearestDistance = maxDistance;

      for (const item of candidates) {
        const beacon = item.beacon;
        const distance = Math.sqrt(
          Math.pow(beacon.position.x - point.x, 2) +
            Math.pow(beacon.position.y - point.y, 2)
        );

        if (distance < nearestDistance) {
          nearest = beacon;
          nearestDistance = distance;
        }
      }

      if (nearest) {
        return nearest;
      }
    }

    return null;
  }

  /**
   * Clear all beacons from the index
   */
  clear(): void {
    this.tree.clear();
    this.beaconMap.clear();
  }

  /**
   * Rebuild the entire index with new beacons
   * Includes bulk loading optimization for better performance
   */
  rebuild(beacons: Beacon[]): void {
    this.clear();

    // Use bulk loading for better R-tree performance
    if (beacons.length > 0) {
      const items = beacons.map(beacon => {
        const item = this.createRBushItem(beacon);
        this.beaconMap.set(beacon.id, item);
        return item;
      });

      // Bulk load for O(n log n) construction instead of O(n²)
      this.tree.load(items);
    }
  }

  /**
   * Get performance statistics
   */
  getStats(): { totalBeacons: number; treeHeight: number } {
    return {
      totalBeacons: this.beaconMap.size,
      treeHeight: this.tree.toJSON().height || 0,
    };
  }

  /**
   * Query beacons within a circular radius (optimized using R-tree)
   */
  queryRadius(center: Point2D, radius: number): Beacon[] {
    const searchBounds = {
      minX: center.x - radius,
      minY: center.y - radius,
      maxX: center.x + radius,
      maxY: center.y + radius,
    };

    const items = this.tree.search(searchBounds);
    const radiusSquared = radius * radius;

    // Filter by actual circular distance
    return items
      .map(item => item.beacon)
      .filter(beacon => {
        const dx = beacon.position.x - center.x;
        const dy = beacon.position.y - center.y;
        return dx * dx + dy * dy <= radiusSquared;
      });
  }

  /**
   * Dynamic rebalancing - rebuilds tree if performance degrades
   */
  rebalanceIfNeeded(): void {
    const stats = this.getStats();
    const beacons = Array.from(this.beaconMap.values()).map(
      item => item.beacon
    );

    // Rebalance if tree becomes too deep (indicates poor balance)
    if (stats.treeHeight > Math.log2(stats.totalBeacons) * 2) {
      this.rebuild(beacons);
    }
  }
}
