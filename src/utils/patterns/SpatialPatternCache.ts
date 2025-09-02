import {
  GeometricPattern,
  Beacon,
  Point2D,
  PatternType,
} from '../../types/galaxy';
import {
  SpatialPatternCacheEntry,
  SpatialCacheConfig,
  CacheStatistics,
  CacheInvalidationStrategy,
} from '../../types/spatialHashing';
import {
  DEFAULT_SPATIAL_CACHE_CONFIG,
  SPATIAL_PERFORMANCE_THRESHOLDS,
} from '../../constants/spatialHashing';

/**
 * LRU (Least Recently Used) cache implementation
 */
class LRUCache<K, V> {
  private capacity: number;
  private cache: Map<K, V>;
  private accessOrder: K[];

  constructor(capacity: number) {
    this.capacity = capacity;
    this.cache = new Map();
    this.accessOrder = [];
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to front (most recently used)
      this.moveToFront(key);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.set(key, value);
      this.moveToFront(key);
    } else {
      if (this.cache.size >= this.capacity) {
        this.evictLRU();
      }
      this.cache.set(key, value);
      this.accessOrder.push(key);
    }
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.removeFromOrder(key);
    }
    return deleted;
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  size(): number {
    return this.cache.size;
  }

  keys(): IterableIterator<K> {
    return this.cache.keys();
  }

  private moveToFront(key: K): void {
    this.removeFromOrder(key);
    this.accessOrder.push(key);
  }

  private removeFromOrder(key: K): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  private evictLRU(): void {
    if (this.accessOrder.length > 0) {
      const lruKey = this.accessOrder.shift()!;
      this.cache.delete(lruKey);
    }
  }
}

/**
 * Regional pattern cache with spatial awareness and invalidation strategies
 */
export class SpatialPatternCache {
  private config: SpatialCacheConfig;
  private cache:
    | LRUCache<string, SpatialPatternCacheEntry>
    | Map<string, SpatialPatternCacheEntry>;
  private regionIndex: Map<string, Set<string>>; // pattern ID -> region IDs
  private statistics: CacheStatistics;
  private lastCleanup: number;
  private version: number;

  constructor(config: Partial<SpatialCacheConfig> = {}) {
    this.config = { ...DEFAULT_SPATIAL_CACHE_CONFIG, ...config };

    // Choose cache implementation based on configuration
    this.cache = this.config.enableLRU
      ? new LRUCache<string, SpatialPatternCacheEntry>(this.config.maxEntries)
      : new Map<string, SpatialPatternCacheEntry>();

    this.regionIndex = new Map();
    this.version = 1;
    this.lastCleanup = Date.now();

    this.statistics = {
      hitRate: 0,
      missRate: 0,
      evictionCount: 0,
      totalQueries: 0,
      averageQueryTime: 0,
      memoryUsageMB: 0,
      entriesCount: 0,
    };
  }

  /**
   * Get patterns for a specific region
   */
  getRegionPatterns(regionId: string): GeometricPattern[] | null {
    const startTime = performance.now();
    this.statistics.totalQueries++;

    const entry =
      this.cache instanceof LRUCache
        ? this.cache.get(regionId)
        : this.cache.get(regionId);

    if (entry) {
      // Check if entry is still valid
      if (this.isEntryValid(entry)) {
        entry.accessCount++;
        this.statistics.hitRate = (this.statistics.hitRate + 1) / 2;
        this.updateQueryTime(performance.now() - startTime);
        return entry.patterns;
      } else {
        // Entry expired, remove it
        this.removeRegion(regionId);
      }
    }

    this.statistics.missRate = (this.statistics.missRate + 1) / 2;
    this.updateQueryTime(performance.now() - startTime);
    return null;
  }

  /**
   * Cache patterns for a specific region
   */
  setRegionPatterns(
    regionId: string,
    patterns: GeometricPattern[],
    bounds: { minX: number; maxX: number; minY: number; maxY: number }
  ): void {
    const entry: SpatialPatternCacheEntry = {
      regionId,
      patterns,
      bounds,
      lastUpdated: Date.now(),
      version: this.version,
      accessCount: 1,
      isDirty: false,
    };

    // Remove old entry if it exists
    this.removeRegion(regionId);

    // Add new entry
    if (this.cache instanceof LRUCache) {
      this.cache.set(regionId, entry);
    } else {
      // Handle capacity manually for Map
      if (this.cache.size >= this.config.maxEntries) {
        this.evictOldestEntry();
      }
      this.cache.set(regionId, entry);
    }

    // Update region index for patterns
    for (const pattern of patterns) {
      if (!this.regionIndex.has(pattern.id)) {
        this.regionIndex.set(pattern.id, new Set());
      }
      this.regionIndex.get(pattern.id)!.add(regionId);
    }

    this.updateStatistics();
  }

  /**
   * Invalidate cache entries affected by beacon changes
   */
  invalidateByBeaconChange(beacon: Beacon, oldPosition?: Point2D): void {
    const affectedRegions = new Set<string>();

    // Get regions affected by new position
    const newRegions = this.getRegionsForPosition(beacon.position);
    newRegions.forEach(region => affectedRegions.add(region));

    // Get regions affected by old position if provided
    if (oldPosition) {
      const oldRegions = this.getRegionsForPosition(oldPosition);
      oldRegions.forEach(region => affectedRegions.add(region));
    }

    // Invalidate all affected regions
    for (const regionId of affectedRegions) {
      this.invalidateRegion(regionId);
    }
  }

  /**
   * Invalidate cache entries for specific patterns
   */
  invalidatePatterns(patternIds: string[]): void {
    const affectedRegions = new Set<string>();

    for (const patternId of patternIds) {
      const regions = this.regionIndex.get(patternId);
      if (regions) {
        regions.forEach(region => affectedRegions.add(region));
      }
    }

    // Invalidate all affected regions
    for (const regionId of affectedRegions) {
      this.invalidateRegion(regionId);
    }
  }

  /**
   * Invalidate a specific region
   */
  invalidateRegion(regionId: string): void {
    const entry =
      this.cache instanceof LRUCache
        ? this.cache.get(regionId)
        : this.cache.get(regionId);

    if (entry) {
      switch (this.config.invalidationStrategy) {
        case 'immediate':
          this.removeRegion(regionId);
          break;

        case 'lazy':
          entry.isDirty = true;
          break;

        case 'periodic':
          entry.isDirty = true;
          this.scheduleCleanup();
          break;

        case 'on-demand':
          entry.isDirty = true;
          break;
      }
    }
  }

  /**
   * Get all patterns of a specific type from cache
   */
  getPatternsByType(
    patternType: PatternType,
    bounds?: { minX: number; maxX: number; minY: number; maxY: number }
  ): GeometricPattern[] {
    const results: GeometricPattern[] = [];

    const regions = bounds
      ? this.getRegionsInBounds(bounds)
      : this.getAllRegions();

    for (const regionId of regions) {
      const patterns = this.getRegionPatterns(regionId);
      if (patterns) {
        const matchingPatterns = patterns.filter(p => p.type === patternType);
        results.push(...matchingPatterns);
      }
    }

    return results;
  }

  /**
   * Preload patterns for upcoming viewport areas
   */
  preloadRegions(centerPosition: Point2D, radius: number): void {
    const preloadRegions = this.getRegionsInRadius(centerPosition, radius);

    // This would typically trigger pattern detection for these regions
    // The actual implementation would depend on the pattern detection system
    for (const regionId of preloadRegions) {
      if (!this.hasRegion(regionId)) {
        // Mark region for preloading (implementation specific)
        // This might trigger background pattern detection
      }
    }
  }

  /**
   * Compact cache by removing expired and least accessed entries
   */
  compact(): number {
    let removedCount = 0;
    const now = Date.now();
    const entriesToRemove: string[] = [];

    const entries =
      this.cache instanceof LRUCache
        ? Array.from(this.cache.keys()).map(
            k =>
              [k, this.cache.get(k)] as [
                string,
                SpatialPatternCacheEntry | undefined,
              ]
          )
        : Array.from(this.cache.entries());

    for (const [regionId, entry] of entries) {
      if (!entry) continue;

      // Remove expired entries
      if (!this.isEntryValid(entry)) {
        entriesToRemove.push(regionId);
        continue;
      }

      // Remove least accessed entries if over memory limit
      if (this.isOverMemoryLimit() && entry.accessCount < 2) {
        entriesToRemove.push(regionId);
        continue;
      }
    }

    for (const regionId of entriesToRemove) {
      this.removeRegion(regionId);
      removedCount++;
    }

    this.updateStatistics();
    return removedCount;
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    this.cache.clear();
    this.regionIndex.clear();
    this.version++;
    this.resetStatistics();
  }

  /**
   * Get current cache statistics
   */
  getStatistics(): CacheStatistics {
    this.updateStatistics();
    return { ...this.statistics };
  }

  /**
   * Check if cache has patterns for a region
   */
  hasRegion(regionId: string): boolean {
    return this.cache instanceof LRUCache
      ? this.cache.has(regionId)
      : this.cache.has(regionId);
  }

  /**
   * Get memory usage estimate in bytes
   */
  getMemoryUsage(): number {
    let totalSize = 0;

    const entries =
      this.cache instanceof LRUCache
        ? Array.from(this.cache.keys()).map(
            k =>
              [k, this.cache.get(k)] as [
                string,
                SpatialPatternCacheEntry | undefined,
              ]
          )
        : Array.from(this.cache.entries());

    for (const [regionId, entry] of entries) {
      if (entry) {
        totalSize += this.estimateEntrySize(entry);
      }
    }

    return totalSize;
  }

  /**
   * Private helper methods
   */

  private getRegionsForPosition(position: Point2D): string[] {
    // Calculate which regions this position affects
    const regionSize = this.config.regionSize;
    const regionX = Math.floor(position.x / regionSize);
    const regionY = Math.floor(position.y / regionSize);

    // Return the region and its neighbors (since patterns can span regions)
    const regions: string[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        regions.push(`${regionX + dx},${regionY + dy}`);
      }
    }

    return regions;
  }

  private getRegionsInBounds(bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  }): string[] {
    const regionSize = this.config.regionSize;
    const regions: string[] = [];

    const minRegionX = Math.floor(bounds.minX / regionSize);
    const maxRegionX = Math.floor(bounds.maxX / regionSize);
    const minRegionY = Math.floor(bounds.minY / regionSize);
    const maxRegionY = Math.floor(bounds.maxY / regionSize);

    for (let x = minRegionX; x <= maxRegionX; x++) {
      for (let y = minRegionY; y <= maxRegionY; y++) {
        regions.push(`${x},${y}`);
      }
    }

    return regions;
  }

  private getRegionsInRadius(center: Point2D, radius: number): string[] {
    const regionSize = this.config.regionSize;
    const regions: string[] = [];

    const regionRadius = Math.ceil(radius / regionSize);
    const centerRegionX = Math.floor(center.x / regionSize);
    const centerRegionY = Math.floor(center.y / regionSize);

    for (let dx = -regionRadius; dx <= regionRadius; dx++) {
      for (let dy = -regionRadius; dy <= regionRadius; dy++) {
        if (dx * dx + dy * dy <= regionRadius * regionRadius) {
          regions.push(`${centerRegionX + dx},${centerRegionY + dy}`);
        }
      }
    }

    return regions;
  }

  private getAllRegions(): string[] {
    return this.cache instanceof LRUCache
      ? Array.from(this.cache.keys())
      : Array.from(this.cache.keys());
  }

  private isEntryValid(entry: SpatialPatternCacheEntry): boolean {
    const now = Date.now();

    // Check if entry is expired
    if (now - entry.lastUpdated > this.config.maxAge) {
      return false;
    }

    // Check if entry is dirty and should be invalidated
    if (entry.isDirty && this.config.invalidationStrategy === 'on-demand') {
      return false;
    }

    return true;
  }

  private removeRegion(regionId: string): void {
    const entry =
      this.cache instanceof LRUCache
        ? this.cache.get(regionId)
        : this.cache.get(regionId);

    if (entry) {
      // Remove from pattern index
      for (const pattern of entry.patterns) {
        const regions = this.regionIndex.get(pattern.id);
        if (regions) {
          regions.delete(regionId);
          if (regions.size === 0) {
            this.regionIndex.delete(pattern.id);
          }
        }
      }
    }

    this.cache.delete(regionId);
  }

  private evictOldestEntry(): void {
    if (this.cache instanceof Map && this.cache.size > 0) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.removeRegion(oldestKey);
        this.statistics.evictionCount++;
      }
    }
  }

  private isOverMemoryLimit(): boolean {
    const memoryUsageMB = this.getMemoryUsage() / (1024 * 1024);
    return memoryUsageMB > this.config.memoryLimitMB;
  }

  private estimateEntrySize(entry: SpatialPatternCacheEntry): number {
    // Rough estimate of entry size in bytes
    return (
      entry.patterns.length * 200 + // Pattern objects
      100 + // Entry metadata
      entry.regionId.length * 2 // String storage
    );
  }

  private scheduleCleanup(): void {
    const now = Date.now();
    if (now - this.lastCleanup > 30000) {
      // 30 seconds
      setTimeout(() => this.compact(), 0);
      this.lastCleanup = now;
    }
  }

  private updateQueryTime(queryTime: number): void {
    this.statistics.averageQueryTime =
      (this.statistics.averageQueryTime + queryTime) / 2;
  }

  private updateStatistics(): void {
    this.statistics.entriesCount =
      this.cache instanceof LRUCache ? this.cache.size() : this.cache.size;
    this.statistics.memoryUsageMB = this.getMemoryUsage() / (1024 * 1024);
  }

  private resetStatistics(): void {
    this.statistics = {
      hitRate: 0,
      missRate: 0,
      evictionCount: 0,
      totalQueries: 0,
      averageQueryTime: 0,
      memoryUsageMB: 0,
      entriesCount: 0,
    };
  }
}
