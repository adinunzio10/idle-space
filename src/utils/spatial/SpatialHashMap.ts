import { Point2D, Beacon } from '../../types/galaxy';
import {
  SpatialHashConfig,
  SpatialHashCell,
  HashBucket,
  SpatialQueryResult,
  NeighborQueryConfig,
  NeighborQueryResult,
  SpatialHashMetrics,
  SpatialHashFunction,
  MortonCode,
} from '../../types/spatialHashing';
import {
  DEFAULT_SPATIAL_HASH_CONFIG,
  MULTI_RESOLUTION_CELL_SIZES,
  NEIGHBOR_QUERY_CONFIG,
  HASH_FUNCTION_CONFIG,
  SPATIAL_PERFORMANCE_THRESHOLDS,
} from '../../constants/spatialHashing';

/**
 * Morton code implementation for Z-order spatial locality
 */
class MortonCodeUtil implements MortonCode {
  private static interleave(x: number): number {
    x = (x | (x << 8)) & 0x00FF00FF;
    x = (x | (x << 4)) & 0x0F0F0F0F;
    x = (x | (x << 2)) & 0x33333333;
    x = (x | (x << 1)) & 0x55555555;
    return x;
  }

  private static deinterleave(x: number): number {
    x = x & 0x55555555;
    x = (x | (x >> 1)) & 0x33333333;
    x = (x | (x >> 2)) & 0x0F0F0F0F;
    x = (x | (x >> 4)) & 0x00FF00FF;
    x = (x | (x >> 8)) & 0x0000FFFF;
    return x;
  }

  encode(x: number, y: number): number {
    // Convert to positive integers and clamp to bit depth
    const maxVal = (1 << HASH_FUNCTION_CONFIG.MORTON_BITS) - 1;
    const ix = Math.max(0, Math.min(maxVal, Math.floor(x)));
    const iy = Math.max(0, Math.min(maxVal, Math.floor(y)));
    
    return MortonCodeUtil.interleave(ix) | (MortonCodeUtil.interleave(iy) << 1);
  }

  decode(code: number): { x: number; y: number } {
    return {
      x: MortonCodeUtil.deinterleave(code),
      y: MortonCodeUtil.deinterleave(code >> 1),
    };
  }

  getNeighborCodes(code: number, radius: number): number[] {
    const center = this.decode(code);
    const neighbors: number[] = [];
    
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (dx === 0 && dy === 0) continue;
        
        const nx = center.x + dx;
        const ny = center.y + dy;
        
        if (nx >= 0 && ny >= 0) {
          neighbors.push(this.encode(nx, ny));
        }
      }
    }
    
    return neighbors;
  }
}

/**
 * Spatial hash function implementation
 */
class SpatialHashFunctionImpl implements SpatialHashFunction {
  private cellSize: number;
  private morton: MortonCode;

  constructor(cellSize: number) {
    this.cellSize = cellSize;
    this.morton = new MortonCodeUtil();
  }

  hash(x: number, y: number): string {
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);
    
    // Use Morton code for spatial locality
    const mortonCode = this.morton.encode(cellX, cellY);
    return mortonCode.toString(16);
  }

  unhash(key: string): { x: number; y: number } {
    const mortonCode = parseInt(key, 16);
    const cell = this.morton.decode(mortonCode);
    
    return {
      x: cell.x * this.cellSize,
      y: cell.y * this.cellSize,
    };
  }

  getAdjacentKeys(key: string, radius: number): string[] {
    const mortonCode = parseInt(key, 16);
    const neighborCodes = this.morton.getNeighborCodes(mortonCode, radius);
    
    return neighborCodes.map(code => code.toString(16));
  }
}

/**
 * High-performance spatial hash map optimized for pattern detection
 */
export class SpatialHashMap {
  private config: SpatialHashConfig;
  private cells: Map<string, SpatialHashCell>;
  private beaconToCell: Map<string, string>; // beacon ID -> cell key mapping
  private hashFunction: SpatialHashFunction;
  private metrics: SpatialHashMetrics;
  private neighborCache: Map<string, { result: NeighborQueryResult[]; timestamp: number }>;
  private queryCache: Map<string, { result: SpatialQueryResult; timestamp: number }>;
  
  constructor(config: Partial<SpatialHashConfig> = {}) {
    this.config = { ...DEFAULT_SPATIAL_HASH_CONFIG, ...config };
    this.cells = new Map();
    this.beaconToCell = new Map();
    this.hashFunction = new SpatialHashFunctionImpl(this.config.cellSize);
    this.neighborCache = new Map();
    this.queryCache = new Map();
    
    this.metrics = {
      totalCells: 0,
      occupiedCells: 0,
      averageBeaconsPerCell: 0,
      maxBeaconsPerCell: 0,
      collisionRate: 0,
      loadFactor: 0,
      memoryUsageBytes: 0,
      queryPerformance: {
        averageQueryTime: 0,
        queryCount: 0,
        cacheHitRate: 0,
      },
      rebalanceCount: 0,
      lastRebalanceTime: Date.now(),
    };
  }

  /**
   * Add a beacon to the spatial hash map
   */
  addBeacon(beacon: Beacon): void {
    const cellKey = this.hashFunction.hash(beacon.position.x, beacon.position.y);
    
    // Remove from old cell if it exists
    this.removeBeacon(beacon.id);
    
    // Get or create cell
    let cell = this.cells.get(cellKey);
    if (!cell) {
      const cellPos = this.hashFunction.unhash(cellKey);
      cell = {
        id: cellKey,
        bounds: {
          x: cellPos.x,
          y: cellPos.y,
          size: this.config.cellSize,
        },
        beacons: new Set(),
        lastUpdated: Date.now(),
      };
      this.cells.set(cellKey, cell);
      this.metrics.totalCells++;
    }
    
    cell.beacons.add(beacon.id);
    cell.lastUpdated = Date.now();
    this.beaconToCell.set(beacon.id, cellKey);
    
    // Invalidate caches that might be affected
    this.invalidateCaches(cellKey);
    
    // Update metrics
    this.updateMetrics();
    
    // Check if rebalancing is needed
    if (this.shouldRebalance()) {
      this.rebalance();
    }
  }

  /**
   * Remove a beacon from the spatial hash map
   */
  removeBeacon(beaconId: string): boolean {
    const cellKey = this.beaconToCell.get(beaconId);
    if (!cellKey) return false;
    
    const cell = this.cells.get(cellKey);
    if (!cell) return false;
    
    const removed = cell.beacons.delete(beaconId);
    if (removed) {
      this.beaconToCell.delete(beaconId);
      cell.lastUpdated = Date.now();
      
      // Remove empty cells to save memory
      if (cell.beacons.size === 0) {
        this.cells.delete(cellKey);
        this.metrics.totalCells--;
      }
      
      this.invalidateCaches(cellKey);
      this.updateMetrics();
    }
    
    return removed;
  }

  /**
   * Update beacon position in the hash map
   */
  updateBeacon(beacon: Beacon, oldPosition: Point2D): void {
    const oldCellKey = this.hashFunction.hash(oldPosition.x, oldPosition.y);
    const newCellKey = this.hashFunction.hash(beacon.position.x, beacon.position.y);
    
    // If the cell hasn't changed, no need to update
    if (oldCellKey === newCellKey) {
      const cell = this.cells.get(newCellKey);
      if (cell) {
        cell.lastUpdated = Date.now();
      }
      return;
    }
    
    // Remove from old position and add to new position
    this.removeBeacon(beacon.id);
    this.addBeacon(beacon);
  }

  /**
   * Find neighbors within a radius using cached results when possible
   */
  findNeighbors(
    position: Point2D,
    config: Partial<NeighborQueryConfig> = {}
  ): NeighborQueryResult[] {
    const queryConfig = { ...NEIGHBOR_QUERY_CONFIG, ...config };
    const cacheKey = `${position.x},${position.y},${queryConfig.radius},${queryConfig.maxResults}`;
    
    // Check cache first
    const cached = this.neighborCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < NEIGHBOR_QUERY_CONFIG.NEIGHBOR_CACHE_TTL) {
      this.metrics.queryPerformance.cacheHitRate++;
      return cached.result;
    }
    
    const startTime = performance.now();
    const results: NeighborQueryResult[] = [];
    
    // Calculate search radius in cells
    const radius = queryConfig.radius || this.config.cellSize;
    const cellRadius = Math.ceil(radius / this.config.cellSize);
    const centerCellKey = this.hashFunction.hash(position.x, position.y);
    
    // Get adjacent cell keys
    const searchCells = [centerCellKey, ...this.hashFunction.getAdjacentKeys(centerCellKey, cellRadius)];
    
    // Search all relevant cells
    for (const cellKey of searchCells) {
      const cell = this.cells.get(cellKey);
      if (!cell) continue;
      
      for (const beaconId of cell.beacons) {
        // Note: We need beacon data to calculate distance
        // This would need to be injected or maintained in the hash map
        // For now, we'll return the beacon ID and cell info
        results.push({
          beacon: { id: beaconId } as Beacon, // Placeholder
          distance: 0, // Would calculate actual distance
          direction: 0, // Would calculate actual direction
          cellId: cellKey,
        });
        
        const maxResults = queryConfig.maxResults || Number.MAX_SAFE_INTEGER;
        if (results.length >= maxResults) break;
      }
      
      const maxResults = queryConfig.maxResults || Number.MAX_SAFE_INTEGER;
      if (results.length >= maxResults) break;
    }
    
    const queryTime = performance.now() - startTime;
    
    // Cache the result
    this.neighborCache.set(cacheKey, {
      result: results,
      timestamp: Date.now(),
    });
    
    // Update metrics
    this.metrics.queryPerformance.queryCount++;
    this.metrics.queryPerformance.averageQueryTime = 
      (this.metrics.queryPerformance.averageQueryTime + queryTime) / 2;
    
    return results;
  }

  /**
   * Query beacons within bounds with performance optimization
   */
  queryBounds(bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  }): SpatialQueryResult {
    const cacheKey = `${bounds.minX},${bounds.minY},${bounds.maxX},${bounds.maxY}`;
    
    // Check cache
    const cached = this.queryCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < 1000) { // 1 second cache
      return cached.result;
    }
    
    const startTime = performance.now();
    const beaconIds = new Set<string>();
    let cellsSearched = 0;
    let hitCount = 0;
    let missCount = 0;
    
    // Calculate cell range
    const minCellX = Math.floor(bounds.minX / this.config.cellSize);
    const maxCellX = Math.floor(bounds.maxX / this.config.cellSize);
    const minCellY = Math.floor(bounds.minY / this.config.cellSize);
    const maxCellY = Math.floor(bounds.maxY / this.config.cellSize);
    
    // Search cells within bounds
    for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
      for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
        const cellKey = this.hashFunction.hash(
          cellX * this.config.cellSize,
          cellY * this.config.cellSize
        );
        
        cellsSearched++;
        const cell = this.cells.get(cellKey);
        
        if (cell) {
          hitCount++;
          for (const beaconId of cell.beacons) {
            beaconIds.add(beaconId);
          }
        } else {
          missCount++;
        }
      }
    }
    
    const queryTime = performance.now() - startTime;
    
    const result: SpatialQueryResult = {
      beacons: [], // Would need actual beacon objects
      cellsSearched,
      queryTime,
      hitCount,
      missCount,
    };
    
    // Cache result
    this.queryCache.set(cacheKey, {
      result,
      timestamp: Date.now(),
    });
    
    return result;
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): SpatialHashMetrics {
    return { ...this.metrics };
  }

  /**
   * Clear all data and reset the hash map
   */
  clear(): void {
    this.cells.clear();
    this.beaconToCell.clear();
    this.neighborCache.clear();
    this.queryCache.clear();
    this.resetMetrics();
  }

  /**
   * Get all beacon IDs in a specific cell
   */
  getCellBeacons(cellKey: string): Set<string> {
    const cell = this.cells.get(cellKey);
    return cell ? new Set(cell.beacons) : new Set();
  }

  /**
   * Get cell key for a position
   */
  getCellKey(position: Point2D): string {
    return this.hashFunction.hash(position.x, position.y);
  }

  /**
   * Get all occupied cell keys
   */
  getOccupiedCells(): string[] {
    return Array.from(this.cells.keys()).filter(key => {
      const cell = this.cells.get(key);
      return cell && cell.beacons.size > 0;
    });
  }

  /**
   * Rebuild the entire hash map (useful when changing cell size)
   */
  rebuild(beacons: Beacon[]): void {
    this.clear();
    for (const beacon of beacons) {
      this.addBeacon(beacon);
    }
  }

  /**
   * Private helper methods
   */
  
  private invalidateCaches(affectedCellKey: string): void {
    // Clear neighbor cache entries that might be affected
    const keysToDelete: string[] = [];
    for (const [cacheKey] of this.neighborCache) {
      // Simple heuristic: invalidate if cache key might overlap with affected cell
      keysToDelete.push(cacheKey);
    }
    
    // For performance, only clear old cache entries
    const now = Date.now();
    for (const key of keysToDelete) {
      const cached = this.neighborCache.get(key);
      if (cached && (now - cached.timestamp) > NEIGHBOR_QUERY_CONFIG.NEIGHBOR_CACHE_TTL / 2) {
        this.neighborCache.delete(key);
      }
    }
    
    // Clear query cache
    this.queryCache.clear();
  }

  private updateMetrics(): void {
    this.metrics.occupiedCells = this.cells.size;
    
    let totalBeacons = 0;
    let maxBeacons = 0;
    
    for (const cell of this.cells.values()) {
      const beaconCount = cell.beacons.size;
      totalBeacons += beaconCount;
      maxBeacons = Math.max(maxBeacons, beaconCount);
    }
    
    this.metrics.averageBeaconsPerCell = this.metrics.occupiedCells > 0 
      ? totalBeacons / this.metrics.occupiedCells 
      : 0;
    this.metrics.maxBeaconsPerCell = maxBeacons;
    this.metrics.loadFactor = totalBeacons / (this.config.initialCapacity * this.metrics.totalCells);
    
    // Estimate memory usage
    this.metrics.memoryUsageBytes = 
      this.cells.size * 200 + // Approximate cell overhead
      this.beaconToCell.size * 50 + // Beacon mapping overhead
      this.neighborCache.size * 100 + // Cache overhead
      this.queryCache.size * 150;
  }

  private shouldRebalance(): boolean {
    return (
      this.metrics.loadFactor > this.config.loadFactor ||
      this.metrics.maxBeaconsPerCell > SPATIAL_PERFORMANCE_THRESHOLDS.HIGH_DENSITY_THRESHOLD / 10 ||
      (Date.now() - this.metrics.lastRebalanceTime) > 60000 // 1 minute
    );
  }

  private rebalance(): void {
    // Simple rebalancing: adjust cell size based on beacon density
    const totalBeacons = this.beaconToCell.size;
    
    if (totalBeacons > SPATIAL_PERFORMANCE_THRESHOLDS.HIGH_DENSITY_THRESHOLD) {
      // Use coarser cells for high density
      this.config.cellSize = MULTI_RESOLUTION_CELL_SIZES.COARSE;
    } else if (totalBeacons < 100) {
      // Use finer cells for low density
      this.config.cellSize = MULTI_RESOLUTION_CELL_SIZES.FINE;
    }
    
    this.hashFunction = new SpatialHashFunctionImpl(this.config.cellSize);
    this.metrics.rebalanceCount++;
    this.metrics.lastRebalanceTime = Date.now();
    
    // Clear caches after rebalancing
    this.neighborCache.clear();
    this.queryCache.clear();
  }

  private resetMetrics(): void {
    this.metrics = {
      totalCells: 0,
      occupiedCells: 0,
      averageBeaconsPerCell: 0,
      maxBeaconsPerCell: 0,
      collisionRate: 0,
      loadFactor: 0,
      memoryUsageBytes: 0,
      queryPerformance: {
        averageQueryTime: 0,
        queryCount: 0,
        cacheHitRate: 0,
      },
      rebalanceCount: 0,
      lastRebalanceTime: Date.now(),
    };
  }
}