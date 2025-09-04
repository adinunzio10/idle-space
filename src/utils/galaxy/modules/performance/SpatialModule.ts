import { PerformanceModule } from '../PerformanceModule';
import { ModuleContext } from '../types';
import { Beacon, Connection, StarSystem, ViewportBounds } from '../../../../types/galaxy';

export interface SpatialQueryResult<T> {
  items: T[];
  queryTime: number;
  fromCache: boolean;
}

export class SpatialModule extends PerformanceModule {
  readonly id = 'spatial-indexing';
  readonly name = 'Spatial Indexing';
  readonly version = '1.0.0';

  // Spatial indexing configuration
  private useQuadTree = true;
  private maxElementsPerNode = 10;
  private maxDepth = 8;
  private queryCache = new Map<string, { result: any; timestamp: number }>();
  private cacheTtl = 100; // Cache spatial queries for 100ms

  protected async initializePerformanceSystem(context: ModuleContext): Promise<void> {
    this.logDebug('Initializing spatial indexing system');
  }

  protected async enablePerformanceMonitoring(): Promise<void> {
    this.logDebug('Enabling spatial performance monitoring');
  }

  protected async disablePerformanceMonitoring(): Promise<void> {
    this.logDebug('Disabling spatial performance monitoring');
    this.queryCache.clear();
  }

  protected async cleanupPerformanceSystem(): Promise<void> {
    this.logDebug('Cleaning up spatial indexing system');
    this.queryCache.clear();
  }

  protected updateDataStructures(context: ModuleContext): void {
    // Clean expired cache entries
    this.cleanExpiredQueries();
  }

  protected registerPerformanceStrategies(): void {
    // Aggressive spatial optimization for low performance
    this.registerStrategy({
      name: 'aggressive-spatial-optimization',
      description: 'Use aggressive spatial culling and simplified indexing',
      apply: (context: ModuleContext) => {
        this.maxElementsPerNode = 20; // Larger nodes for less overhead
        this.maxDepth = 6; // Shallower tree
        this.cacheTtl = 200; // Longer cache for less rebuilding
      },
      revert: (context: ModuleContext) => {
        this.maxElementsPerNode = 10;
        this.maxDepth = 8;
        this.cacheTtl = 100;
      },
      isApplicable: (context: ModuleContext) => {
        return this.metrics.averageFps < 25;
      },
    });

    // High-quality spatial indexing for good performance
    this.registerStrategy({
      name: 'high-quality-spatial',
      description: 'Use high-quality spatial indexing for smooth interactions',
      apply: (context: ModuleContext) => {
        this.maxElementsPerNode = 5; // Smaller nodes for precision
        this.maxDepth = 10; // Deeper tree for better culling
        this.cacheTtl = 50; // Shorter cache for more responsive updates
      },
      revert: (context: ModuleContext) => {
        this.maxElementsPerNode = 10;
        this.maxDepth = 8;
        this.cacheTtl = 100;
      },
      isApplicable: (context: ModuleContext) => {
        return this.metrics.averageFps > 55;
      },
    });
  }

  // Spatial query methods
  queryVisibleBeacons(bounds: ViewportBounds, beacons: Beacon[]): SpatialQueryResult<Beacon> {
    const startTime = performance.now();
    const cacheKey = this.generateCacheKey('beacons', bounds);
    
    // Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return {
        items: cached,
        queryTime: performance.now() - startTime,
        fromCache: true,
      };
    }

    // Perform spatial query (simple implementation for now)
    const result = beacons.filter(beacon => 
      this.isInBounds(beacon.position, bounds)
    );

    // Cache the result
    this.setInCache(cacheKey, result);

    return {
      items: result,
      queryTime: performance.now() - startTime,
      fromCache: false,
    };
  }

  queryVisibleConnections(bounds: ViewportBounds, connections: Connection[], beacons: Beacon[]): SpatialQueryResult<Connection> {
    const startTime = performance.now();
    const cacheKey = this.generateCacheKey('connections', bounds);
    
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return {
        items: cached,
        queryTime: performance.now() - startTime,
        fromCache: true,
      };
    }

    // Find connections where at least one endpoint is visible
    const result = connections.filter(connection => {
      const sourceBeacon = beacons.find(b => b.id === connection.sourceId);
      const targetBeacon = beacons.find(b => b.id === connection.targetId);
      
      if (!sourceBeacon || !targetBeacon) return false;
      
      return this.isInBounds(sourceBeacon.position, bounds) || 
             this.isInBounds(targetBeacon.position, bounds);
    });

    this.setInCache(cacheKey, result);

    return {
      items: result,
      queryTime: performance.now() - startTime,
      fromCache: false,
    };
  }

  queryVisibleStarSystems(bounds: ViewportBounds, starSystems: StarSystem[]): SpatialQueryResult<StarSystem> {
    const startTime = performance.now();
    const cacheKey = this.generateCacheKey('starSystems', bounds);
    
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return {
        items: cached,
        queryTime: performance.now() - startTime,
        fromCache: true,
      };
    }

    // Include star systems that intersect with viewport bounds (considering their radius)
    const result = starSystems.filter(starSystem => {
      const expandedBounds = {
        minX: bounds.minX - starSystem.radius,
        maxX: bounds.maxX + starSystem.radius,
        minY: bounds.minY - starSystem.radius,
        maxY: bounds.maxY + starSystem.radius,
      };
      return this.isInBounds(starSystem.position, expandedBounds);
    });

    this.setInCache(cacheKey, result);

    return {
      items: result,
      queryTime: performance.now() - startTime,
      fromCache: false,
    };
  }

  // Cache management
  private generateCacheKey(type: string, bounds: ViewportBounds): string {
    // Round bounds to nearest 10 to increase cache hits
    const roundedBounds = {
      minX: Math.floor(bounds.minX / 10) * 10,
      maxX: Math.ceil(bounds.maxX / 10) * 10,
      minY: Math.floor(bounds.minY / 10) * 10,
      maxY: Math.ceil(bounds.maxY / 10) * 10,
    };
    
    return `${type}:${roundedBounds.minX},${roundedBounds.minY},${roundedBounds.maxX},${roundedBounds.maxY}`;
  }

  private setInCache(key: string, data: any): void {
    // Limit cache size
    if (this.queryCache.size > 50) {
      this.cleanExpiredQueries();
    }

    this.queryCache.set(key, {
      result: data,
      timestamp: Date.now(),
    });
  }

  private getFromCache(key: string): any | null {
    const entry = this.queryCache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > this.cacheTtl) {
      this.queryCache.delete(key);
      return null;
    }

    return entry.result;
  }

  private cleanExpiredQueries(): void {
    const now = Date.now();
    for (const [key, entry] of this.queryCache.entries()) {
      if (now - entry.timestamp > this.cacheTtl) {
        this.queryCache.delete(key);
      }
    }
  }

  private isInBounds(position: { x: number; y: number }, bounds: ViewportBounds): boolean {
    return (
      position.x >= bounds.minX &&
      position.x <= bounds.maxX &&
      position.y >= bounds.minY &&
      position.y <= bounds.maxY
    );
  }

  // Configuration methods
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.queryCache.size,
      hitRate: 0, // TODO: Implement hit rate tracking
    };
  }
}