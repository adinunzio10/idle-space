import { Point2D, Beacon, GeometricPattern, PatternType } from './galaxy';

/**
 * Configuration for spatial hash map
 */
export interface SpatialHashConfig {
  cellSize: number;
  initialCapacity: number;
  loadFactor: number;
  maxDepth: number;
  enableMultiResolution: boolean;
}

/**
 * Spatial hash cell containing beacons
 */
export interface SpatialHashCell {
  id: string;
  bounds: {
    x: number;
    y: number;
    size: number;
  };
  beacons: Set<string>; // Beacon IDs for memory efficiency
  lastUpdated: number;
  neighborCells?: Set<string>; // Cached neighbor cell IDs
}

/**
 * Hash table bucket for collision resolution
 */
export interface HashBucket {
  key: string;
  cells: SpatialHashCell[];
  collisionCount: number;
}

/**
 * Morton code utilities for Z-order spatial hashing
 */
export interface MortonCode {
  encode(x: number, y: number): number;
  decode(code: number): { x: number; y: number };
  getNeighborCodes(code: number, radius: number): number[];
}

/**
 * Spatial query result
 */
export interface SpatialQueryResult {
  beacons: Beacon[];
  cellsSearched: number;
  queryTime: number;
  hitCount: number;
  missCount: number;
}

/**
 * Pattern suggestion types
 */
export interface PatternSuggestion {
  id: string;
  type: PatternType;
  suggestedPosition: Point2D;
  requiredBeacons: string[]; // IDs of beacons needed to complete pattern
  potentialBonus: number;
  completionPercentage: number; // 0.0 to 1.0
  priority: number; // Higher = more important
  estimatedValue: number; // Bonus per beacon investment
  conflictingPatterns: string[]; // Pattern IDs that would be affected
}

/**
 * Pattern completion analysis
 */
export interface PatternCompletionAnalysis {
  incompletePatterns: IncompletePattern[];
  suggestedPositions: PatternSuggestion[];
  optimalNextPlacement: Point2D | null;
  totalPotentialBonus: number;
  averageCompletionCost: number;
}

/**
 * Incomplete pattern detected in beacon network
 */
export interface IncompletePattern {
  id: string;
  type: PatternType;
  existingBeacons: string[]; // IDs of beacons already placed
  missingPositions: Point2D[]; // Positions where beacons are needed
  estimatedBonus: number;
  proximityScore: number; // How close existing beacons are to ideal positions
  feasibilityScore: number; // How realistic completion is
}

/**
 * Spatial cache entry for patterns
 */
export interface SpatialPatternCacheEntry {
  regionId: string;
  patterns: GeometricPattern[];
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  lastUpdated: number;
  version: number;
  accessCount: number;
  isDirty: boolean;
}

/**
 * Cache invalidation strategy
 */
export type CacheInvalidationStrategy = 
  | 'immediate' 
  | 'lazy' 
  | 'periodic' 
  | 'on-demand';

/**
 * Spatial cache configuration
 */
export interface SpatialCacheConfig {
  maxEntries: number;
  maxAge: number; // milliseconds
  regionSize: number;
  invalidationStrategy: CacheInvalidationStrategy;
  enableLRU: boolean;
  memoryLimitMB: number;
}

/**
 * Cache statistics for monitoring
 */
export interface CacheStatistics {
  hitRate: number;
  missRate: number;
  evictionCount: number;
  totalQueries: number;
  averageQueryTime: number;
  memoryUsageMB: number;
  entriesCount: number;
}

/**
 * Neighbor query configuration
 */
export interface NeighborQueryConfig {
  radius: number;
  maxResults: number;
  includeDistance: boolean;
  sortByDistance: boolean;
  filterFunction?: (beacon: Beacon) => boolean;
}

/**
 * Neighbor query result
 */
export interface NeighborQueryResult {
  beacon: Beacon;
  distance: number;
  direction: number; // angle in radians
  cellId: string;
}

/**
 * Spatial hash performance metrics
 */
export interface SpatialHashMetrics {
  totalCells: number;
  occupiedCells: number;
  averageBeaconsPerCell: number;
  maxBeaconsPerCell: number;
  collisionRate: number;
  loadFactor: number;
  memoryUsageBytes: number;
  queryPerformance: {
    averageQueryTime: number;
    queryCount: number;
    cacheHitRate: number;
  };
  rebalanceCount: number;
  lastRebalanceTime: number;
}

/**
 * Hash function interface
 */
export interface SpatialHashFunction {
  hash(x: number, y: number): string;
  unhash(key: string): { x: number; y: number };
  getAdjacentKeys(key: string, radius: number): string[];
}

/**
 * Placement hint display configuration
 */
export interface PlacementHintConfig {
  maxHints: number;
  minBonusThreshold: number;
  displayRadius: number; // screen pixels
  fadeDistanceThreshold: number;
  animationDuration: number;
  colors: {
    triangle: string;
    square: string;
    pentagon: string;
    hexagon: string;
    ghost: string;
    highlight: string;
  };
  opacity: {
    ghost: number;
    highlight: number;
    text: number;
  };
}

/**
 * Pattern suggestion UI state
 */
export interface PatternSuggestionState {
  popupVisible: boolean;
  mapVisualizationsVisible: boolean;
  selectedSuggestion: PatternSuggestion | null;
  hoveredSuggestion: PatternSuggestion | null;
  dismissedSuggestions: Set<string>;
  autoHideTimer: number | null;
  displayMode: 'all' | 'best' | 'near-cursor' | 'high-value';
}

/**
 * Suggestion interaction event
 */
export interface SuggestionInteractionEvent {
  type: 'hover' | 'select' | 'dismiss' | 'place';
  suggestion: PatternSuggestion;
  position: Point2D;
  timestamp: number;
}

/**
 * Spatial optimization settings
 */
export interface SpatialOptimizationSettings {
  enableSpatialHashing: boolean;
  enablePatternCache: boolean;
  enableSuggestions: boolean;
  dynamicCellSizing: boolean;
  adaptiveThresholds: boolean;
  performanceMode: 'high' | 'balanced' | 'low';
  debugMode: boolean;
}

/**
 * Pattern formation probability
 */
export interface PatternProbability {
  patternType: PatternType;
  probability: number; // 0.0 to 1.0
  confidenceLevel: number;
  requiredMoves: number;
  timeToCompletion: number; // estimated milliseconds
  riskFactors: string[]; // Potential issues with completion
}