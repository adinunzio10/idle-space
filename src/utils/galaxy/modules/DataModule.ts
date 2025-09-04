import { BaseModule } from './BaseModule';
import { ModuleCategory, ModuleContext, ModuleRenderResult } from './types';
import { Beacon, Connection, GeometricPattern, StarSystem, GalacticSector } from '../../../types/galaxy';

export interface DataCacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt?: number;
  accessCount: number;
}

export interface SpatialIndex<T> {
  insert(item: T, position: { x: number; y: number }): void;
  remove(item: T): void;
  query(bounds: { minX: number; maxX: number; minY: number; maxY: number }): T[];
  clear(): void;
  size(): number;
}

export abstract class DataModule extends BaseModule {
  readonly category: ModuleCategory = 'data';

  protected cache = new Map<string, DataCacheEntry<any>>();
  protected defaultCacheTtl = 5000; // 5 seconds default cache TTL
  protected maxCacheSize = 1000;
  protected spatialIndices = new Map<string, SpatialIndex<any>>();

  protected async onInitialize(context: ModuleContext): Promise<void> {
    await this.initializeDataStructures(context);
    this.setupCacheCleanup();
  }

  protected async onEnable(): Promise<void> {
    await this.enableDataProcessing();
  }

  protected async onDisable(): Promise<void> {
    await this.disableDataProcessing();
  }

  protected async onCleanup(): Promise<void> {
    this.clearAllCaches();
    this.clearAllSpatialIndices();
    await this.cleanupDataStructures();
  }

  protected onUpdate(context: ModuleContext): void {
    this.updateDataStructures(context);
    this.maintainCaches();
  }

  protected onRender(context: ModuleContext): ModuleRenderResult {
    // Data modules typically don't render anything
    // but may render debug information
    const elements = this.renderDebugOverlay(context);
    
    return {
      elements,
      shouldContinueRendering: true,
      performanceImpact: 'low',
    };
  }

  // Cache management
  protected setCache<T>(key: string, data: T, ttl?: number): void {
    // Clean cache if it's getting too large
    if (this.cache.size >= this.maxCacheSize) {
      this.evictOldestCacheEntries();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresAt: ttl ? Date.now() + ttl : Date.now() + this.defaultCacheTtl,
      accessCount: 0,
    });
  }

  protected getCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Update access count
    entry.accessCount++;
    return entry.data;
  }

  protected invalidateCache(keyPattern?: string): void {
    if (!keyPattern) {
      this.cache.clear();
      return;
    }

    // Remove entries matching pattern
    for (const key of this.cache.keys()) {
      if (key.includes(keyPattern)) {
        this.cache.delete(key);
      }
    }
  }

  protected clearAllCaches(): void {
    this.cache.clear();
  }

  // Spatial indexing
  protected createSpatialIndex<T>(name: string): SpatialIndex<T> {
    // Simple implementation - in a real app you might use R-tree or QuadTree
    const index: SpatialIndex<T> = {
      insert: (item: T, position: { x: number; y: number }) => {
        // Simple implementation for now
      },
      remove: (item: T) => {
        // Simple implementation for now
      },
      query: (bounds) => {
        // Simple implementation for now
        return [];
      },
      clear: () => {
        // Simple implementation for now
      },
      size: () => 0,
    };

    this.spatialIndices.set(name, index);
    return index;
  }

  protected getSpatialIndex<T>(name: string): SpatialIndex<T> | null {
    return this.spatialIndices.get(name) || null;
  }

  protected clearAllSpatialIndices(): void {
    for (const index of this.spatialIndices.values()) {
      index.clear();
    }
    this.spatialIndices.clear();
  }

  // Data processing utilities
  protected processBeacons(beacons: Beacon[], context: ModuleContext): Beacon[] {
    return this.onProcessBeacons(beacons, context);
  }

  protected processConnections(connections: Connection[], context: ModuleContext): Connection[] {
    return this.onProcessConnections(connections, context);
  }

  protected processPatterns(patterns: GeometricPattern[], context: ModuleContext): GeometricPattern[] {
    return this.onProcessPatterns(patterns, context);
  }

  // Cache maintenance
  private maintainCaches(): void {
    const now = Date.now();
    
    // Remove expired entries
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  private evictOldestCacheEntries(): void {
    // Remove 25% of oldest/least accessed entries
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => {
      // Sort by timestamp and access count
      const scoreA = a[1].timestamp + (a[1].accessCount * 1000);
      const scoreB = b[1].timestamp + (b[1].accessCount * 1000);
      return scoreA - scoreB;
    });

    const toRemove = Math.floor(entries.length * 0.25);
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  private setupCacheCleanup(): void {
    // Clean up cache every 10 seconds
    setInterval(() => {
      this.maintainCaches();
    }, 10000);
  }

  // Abstract methods for subclasses
  protected abstract initializeDataStructures(context: ModuleContext): Promise<void> | void;
  protected abstract enableDataProcessing(): Promise<void> | void;
  protected abstract disableDataProcessing(): Promise<void> | void;
  protected abstract cleanupDataStructures(): Promise<void> | void;
  protected abstract updateDataStructures(context: ModuleContext): void;
  
  // Optional hooks with default implementations
  protected renderDebugOverlay(context: ModuleContext): React.ReactNode[] { return []; }
  
  protected onProcessBeacons(beacons: Beacon[], context: ModuleContext): Beacon[] {
    return beacons;
  }
  
  protected onProcessConnections(connections: Connection[], context: ModuleContext): Connection[] {
    return connections;
  }
  
  protected onProcessPatterns(patterns: GeometricPattern[], context: ModuleContext): GeometricPattern[] {
    return patterns;
  }
}