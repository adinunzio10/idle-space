import { Point2D, ViewportBounds, Beacon } from '../../types/galaxy';

/**
 * Rectangle boundary for quadtree regions
 */
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Data item stored in QuadTree with position
 */
export interface QuadTreeItem {
  id: string;
  position: Point2D;
  data: any; // Generic data payload
}

/**
 * QuadTree node for efficient spatial partitioning
 */
export class QuadTreeNode {
  private bounds: Bounds;
  private items: QuadTreeItem[];
  private children: QuadTreeNode[] | null;
  private maxItems: number;
  private maxDepth: number;
  private depth: number;

  constructor(
    bounds: Bounds,
    maxItems: number = 10,
    maxDepth: number = 8,
    depth: number = 0
  ) {
    this.bounds = bounds;
    this.items = [];
    this.children = null;
    this.maxItems = maxItems;
    this.maxDepth = maxDepth;
    this.depth = depth;
  }

  /**
   * Insert an item into the quadtree
   */
  insert(item: QuadTreeItem): boolean {
    if (!this.contains(item.position)) {
      return false;
    }

    // If we have space and no children, add to this node
    if (this.items.length < this.maxItems && this.children === null) {
      this.items.push(item);
      return true;
    }

    // If we haven't subdivided yet, do it now
    if (this.children === null) {
      this.subdivide();
    }

    // Try to insert into children
    if (this.children) {
      for (const child of this.children) {
        if (child.insert(item)) {
          return true;
        }
      }
    }

    // If children couldn't take it, we're at max depth, add to this node
    this.items.push(item);
    return true;
  }

  /**
   * Remove an item from the quadtree
   */
  remove(itemId: string): boolean {
    // Check items in this node
    const itemIndex = this.items.findIndex(item => item.id === itemId);
    if (itemIndex !== -1) {
      this.items.splice(itemIndex, 1);
      return true;
    }

    // Check children
    if (this.children) {
      for (const child of this.children) {
        if (child.remove(itemId)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Query items within a boundary
   */
  query(queryBounds: Bounds): QuadTreeItem[] {
    const result: QuadTreeItem[] = [];
    
    if (!this.intersects(queryBounds)) {
      return result;
    }

    // Add items from this node that intersect with query bounds
    for (const item of this.items) {
      if (this.pointInBounds(item.position, queryBounds)) {
        result.push(item);
      }
    }

    // Query children
    if (this.children) {
      for (const child of this.children) {
        result.push(...child.query(queryBounds));
      }
    }

    return result;
  }

  /**
   * Find nearest neighbors within a radius
   */
  queryRadius(center: Point2D, radius: number): QuadTreeItem[] {
    const queryBounds: Bounds = {
      x: center.x - radius,
      y: center.y - radius,
      width: radius * 2,
      height: radius * 2,
    };

    const candidates = this.query(queryBounds);
    const radiusSquared = radius * radius;

    return candidates.filter(item => {
      const dx = item.position.x - center.x;
      const dy = item.position.y - center.y;
      return (dx * dx + dy * dy) <= radiusSquared;
    });
  }

  /**
   * Find k nearest neighbors
   */
  queryKNearest(center: Point2D, k: number, maxRadius: number = Infinity): QuadTreeItem[] {
    interface DistanceItem {
      item: QuadTreeItem;
      distance: number;
    }

    const candidates: DistanceItem[] = [];
    const searchRadius = Math.min(maxRadius, Math.max(this.bounds.width, this.bounds.height));
    
    const items = this.queryRadius(center, searchRadius);
    
    for (const item of items) {
      const dx = item.position.x - center.x;
      const dy = item.position.y - center.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      candidates.push({ item, distance });
    }

    // Sort by distance and return top k
    candidates.sort((a, b) => a.distance - b.distance);
    return candidates.slice(0, k).map(c => c.item);
  }

  /**
   * Get all items in the quadtree
   */
  getAllItems(): QuadTreeItem[] {
    const result: QuadTreeItem[] = [...this.items];
    
    if (this.children) {
      for (const child of this.children) {
        result.push(...child.getAllItems());
      }
    }
    
    return result;
  }

  /**
   * Clear all items from the quadtree
   */
  clear(): void {
    this.items = [];
    this.children = null;
  }

  /**
   * Get quadtree statistics
   */
  getStats(): { nodeCount: number; itemCount: number; maxDepth: number } {
    let nodeCount = 1;
    let itemCount = this.items.length;
    let maxDepth = this.depth;

    if (this.children) {
      for (const child of this.children) {
        const childStats = child.getStats();
        nodeCount += childStats.nodeCount;
        itemCount += childStats.itemCount;
        maxDepth = Math.max(maxDepth, childStats.maxDepth);
      }
    }

    return { nodeCount, itemCount, maxDepth };
  }

  /**
   * Subdivide this node into four children
   */
  private subdivide(): void {
    if (this.depth >= this.maxDepth) {
      return;
    }

    const halfWidth = this.bounds.width / 2;
    const halfHeight = this.bounds.height / 2;
    const x = this.bounds.x;
    const y = this.bounds.y;

    this.children = [
      // Top-left
      new QuadTreeNode(
        { x, y, width: halfWidth, height: halfHeight },
        this.maxItems,
        this.maxDepth,
        this.depth + 1
      ),
      // Top-right
      new QuadTreeNode(
        { x: x + halfWidth, y, width: halfWidth, height: halfHeight },
        this.maxItems,
        this.maxDepth,
        this.depth + 1
      ),
      // Bottom-left
      new QuadTreeNode(
        { x, y: y + halfHeight, width: halfWidth, height: halfHeight },
        this.maxItems,
        this.maxDepth,
        this.depth + 1
      ),
      // Bottom-right
      new QuadTreeNode(
        { x: x + halfWidth, y: y + halfHeight, width: halfWidth, height: halfHeight },
        this.maxItems,
        this.maxDepth,
        this.depth + 1
      ),
    ];

    // Redistribute items to children
    const itemsToRedistribute = [...this.items];
    this.items = [];

    for (const item of itemsToRedistribute) {
      let inserted = false;
      for (const child of this.children) {
        if (child.insert(item)) {
          inserted = true;
          break;
        }
      }
      
      // If item couldn't be inserted into children, keep it here
      if (!inserted) {
        this.items.push(item);
      }
    }
  }

  /**
   * Check if a point is within this node's bounds
   */
  private contains(point: Point2D): boolean {
    return (
      point.x >= this.bounds.x &&
      point.x < this.bounds.x + this.bounds.width &&
      point.y >= this.bounds.y &&
      point.y < this.bounds.y + this.bounds.height
    );
  }

  /**
   * Check if this node intersects with query bounds
   */
  private intersects(queryBounds: Bounds): boolean {
    return !(
      queryBounds.x >= this.bounds.x + this.bounds.width ||
      queryBounds.x + queryBounds.width <= this.bounds.x ||
      queryBounds.y >= this.bounds.y + this.bounds.height ||
      queryBounds.y + queryBounds.height <= this.bounds.y
    );
  }

  /**
   * Check if a point is within given bounds
   */
  private pointInBounds(point: Point2D, bounds: Bounds): boolean {
    return (
      point.x >= bounds.x &&
      point.x <= bounds.x + bounds.width &&
      point.y >= bounds.y &&
      point.y <= bounds.y + bounds.height
    );
  }
}

/**
 * Enhanced Spatial Index using QuadTree
 */
export class QuadTreeSpatialIndex {
  private quadTree: QuadTreeNode;
  private bounds: Bounds;

  constructor(bounds: Bounds, maxItems: number = 10, maxDepth: number = 8) {
    this.bounds = bounds;
    this.quadTree = new QuadTreeNode(bounds, maxItems, maxDepth);
  }

  /**
   * Add a beacon to the spatial index
   */
  addBeacon(beacon: Beacon): void {
    const item: QuadTreeItem = {
      id: beacon.id,
      position: beacon.position,
      data: beacon,
    };
    this.quadTree.insert(item);
  }

  /**
   * Remove a beacon from the spatial index
   */
  removeBeacon(beaconId: string): void {
    this.quadTree.remove(beaconId);
  }

  /**
   * Rebuild the index with new beacon data
   */
  rebuild(beacons: Beacon[]): void {
    this.quadTree.clear();
    for (const beacon of beacons) {
      this.addBeacon(beacon);
    }
  }

  /**
   * Query beacons within viewport bounds
   */
  queryBounds(viewportBounds: ViewportBounds): Beacon[] {
    const queryBounds: Bounds = {
      x: viewportBounds.minX,
      y: viewportBounds.minY,
      width: viewportBounds.maxX - viewportBounds.minX,
      height: viewportBounds.maxY - viewportBounds.minY,
    };

    const items = this.quadTree.query(queryBounds);
    return items.map(item => item.data as Beacon);
  }

  /**
   * Find beacons within radius of a point
   */
  queryRadius(center: Point2D, radius: number): Beacon[] {
    const items = this.quadTree.queryRadius(center, radius);
    return items.map(item => item.data as Beacon);
  }

  /**
   * Find k nearest beacons to a point
   */
  queryKNearest(center: Point2D, k: number): Beacon[] {
    const items = this.quadTree.queryKNearest(center, k);
    return items.map(item => item.data as Beacon);
  }

  /**
   * Get performance statistics
   */
  getStats(): { nodeCount: number; itemCount: number; maxDepth: number } {
    return this.quadTree.getStats();
  }

  /**
   * Update bounds (requires rebuild)
   */
  updateBounds(newBounds: Bounds): void {
    const allItems = this.quadTree.getAllItems();
    this.bounds = newBounds;
    this.quadTree = new QuadTreeNode(newBounds);
    
    for (const item of allItems) {
      this.quadTree.insert(item);
    }
  }
}