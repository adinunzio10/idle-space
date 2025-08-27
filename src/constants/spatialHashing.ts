import { SpatialHashConfig, SpatialCacheConfig, PlacementHintConfig, SpatialOptimizationSettings } from '../types/spatialHashing';
import { PatternType } from '../types/galaxy';

/**
 * Default spatial hash configuration optimized for beacon networks
 */
export const DEFAULT_SPATIAL_HASH_CONFIG: SpatialHashConfig = {
  cellSize: 150, // Average beacon connection distance
  initialCapacity: 256,
  loadFactor: 0.75,
  maxDepth: 8,
  enableMultiResolution: true,
} as const;

/**
 * Multi-resolution cell sizes for different zoom levels and beacon densities
 */
export const MULTI_RESOLUTION_CELL_SIZES = {
  COARSE: 500,    // Low zoom, sparse beacons
  MEDIUM: 150,    // Standard zoom, normal density
  FINE: 50,       // High zoom, dense beacon clusters
  ULTRA_FINE: 25, // Maximum zoom, very dense areas
} as const;

/**
 * Default spatial cache configuration
 */
export const DEFAULT_SPATIAL_CACHE_CONFIG: SpatialCacheConfig = {
  maxEntries: 1000,
  maxAge: 30000, // 30 seconds
  regionSize: 300, // Size of cached regions
  invalidationStrategy: 'lazy',
  enableLRU: true,
  memoryLimitMB: 5,
} as const;

/**
 * Pattern suggestion thresholds and scoring
 */
export const PATTERN_SUGGESTION_CONFIG = {
  // Minimum bonus multiplier to show suggestion
  MIN_BONUS_THRESHOLD: 1.2,
  
  // Maximum suggestions to display simultaneously
  MAX_SUGGESTIONS: 8,
  
  // Suggestion priority weights
  PRIORITY_WEIGHTS: {
    bonusValue: 0.4,      // How much bonus the pattern provides
    completionEase: 0.3,  // How easy it is to complete
    proximity: 0.2,       // How close existing beacons are
    efficiency: 0.1,      // Bonus per beacon investment
  },
  
  // Pattern completion thresholds (what percentage complete to suggest)
  COMPLETION_THRESHOLDS: {
    triangle: 0.67,  // 2/3 beacons placed
    square: 0.75,    // 3/4 beacons placed
    pentagon: 0.8,   // 4/5 beacons placed
    hexagon: 0.83,   // 5/6 beacons placed
  } as Record<PatternType, number>,
  
  // Distance tolerance for pattern suggestions (how far from ideal positions)
  POSITION_TOLERANCE: {
    triangle: 25,
    square: 20,
    pentagon: 15,
    hexagon: 10,
  } as Record<PatternType, number>,
  
  // Suggestion refresh rate
  UPDATE_INTERVAL: 1000, // milliseconds
  
  // Cache suggestions for this long
  SUGGESTION_CACHE_TTL: 5000, // milliseconds
} as const;

/**
 * Neighbor query optimization settings
 */
export const NEIGHBOR_QUERY_CONFIG = {
  // Default search radius for pattern detection
  DEFAULT_RADIUS: 300,
  
  // Maximum neighbors to return per query
  MAX_NEIGHBORS: 50,
  
  // Pattern-specific search radii
  PATTERN_RADII: {
    triangle: 200,
    square: 250,
    pentagon: 300,
    hexagon: 350,
  } as Record<PatternType, number>,
  
  // Cache neighbor results for this long
  NEIGHBOR_CACHE_TTL: 2000, // milliseconds
  
  // Batch size for neighbor queries
  BATCH_SIZE: 32,
} as const;

/**
 * Default placement hint configuration
 */
export const DEFAULT_PLACEMENT_HINT_CONFIG: PlacementHintConfig = {
  maxHints: 5,
  minBonusThreshold: 1.5,
  displayRadius: 1000, // screen pixels
  fadeDistanceThreshold: 1500,
  animationDuration: 500,
  colors: {
    triangle: '#10B981',
    square: '#3B82F6', 
    pentagon: '#8B5CF6',
    hexagon: '#F59E0B',
    ghost: '#6B7280',
    highlight: '#FDE047',
  },
  opacity: {
    ghost: 0.4,
    highlight: 0.8,
    text: 0.9,
  },
} as const;

/**
 * Performance optimization thresholds
 */
export const SPATIAL_PERFORMANCE_THRESHOLDS = {
  // Switch to coarser cells when beacon count exceeds this
  HIGH_DENSITY_THRESHOLD: 500,
  
  // Disable suggestions when beacon count exceeds this
  SUGGESTION_DISABLE_THRESHOLD: 1000,
  
  // Enable aggressive caching when pattern count exceeds this
  CACHE_AGGRESSIVE_THRESHOLD: 100,
  
  // Reduce update frequency when FPS drops below this
  LOW_FPS_THRESHOLD: 30,
  
  // Maximum time per frame for spatial operations (milliseconds)
  MAX_FRAME_TIME: 8,
  
  // Memory usage limits
  MAX_MEMORY_USAGE_MB: 50,
  
  // Cache size limits
  MAX_CACHE_ENTRIES: 2000,
  
  // Query timeout
  QUERY_TIMEOUT_MS: 100,
} as const;

/**
 * Hash function parameters
 */
export const HASH_FUNCTION_CONFIG = {
  // Morton code bit depth
  MORTON_BITS: 16,
  
  // Hash table size (power of 2)
  TABLE_SIZE: 4096,
  
  // Collision resolution method
  COLLISION_RESOLUTION: 'linear_probing' as const,
  
  // Rehash threshold
  REHASH_THRESHOLD: 0.8,
  
  // Hash seed for consistent results
  HASH_SEED: 0x9E3779B9,
} as const;

/**
 * Default spatial optimization settings by performance level
 */
export const SPATIAL_OPTIMIZATION_PRESETS: Record<'high' | 'balanced' | 'low', SpatialOptimizationSettings> = {
  high: {
    enableSpatialHashing: true,
    enablePatternCache: true,
    enableSuggestions: true,
    dynamicCellSizing: true,
    adaptiveThresholds: true,
    performanceMode: 'high',
    debugMode: false,
  },
  balanced: {
    enableSpatialHashing: true,
    enablePatternCache: true,
    enableSuggestions: true,
    dynamicCellSizing: false,
    adaptiveThresholds: true,
    performanceMode: 'balanced',
    debugMode: false,
  },
  low: {
    enableSpatialHashing: true,
    enablePatternCache: false,
    enableSuggestions: false,
    dynamicCellSizing: false,
    adaptiveThresholds: false,
    performanceMode: 'low',
    debugMode: false,
  },
} as const;

/**
 * Debug visualization settings
 */
export const DEBUG_VISUALIZATION_CONFIG = {
  // Show spatial hash grid
  SHOW_GRID: false,
  
  // Grid line color and opacity
  GRID_COLOR: '#4B5563',
  GRID_OPACITY: 0.3,
  
  // Show cell occupancy
  SHOW_OCCUPANCY: false,
  
  // Occupancy heat map colors
  OCCUPANCY_COLORS: {
    EMPTY: '#1F2937',
    LOW: '#10B981',
    MEDIUM: '#F59E0B',
    HIGH: '#EF4444',
  },
  
  // Show query regions
  SHOW_QUERY_REGIONS: false,
  
  // Query region color
  QUERY_REGION_COLOR: '#8B5CF6',
  QUERY_REGION_OPACITY: 0.2,
  
  // Show performance metrics
  SHOW_PERFORMANCE_OVERLAY: false,
  
  // Performance overlay position
  PERFORMANCE_OVERLAY_POSITION: { x: 10, y: 10 },
} as const;

/**
 * Animation and transition settings
 */
export const SPATIAL_ANIMATION_CONFIG = {
  // Suggestion appearance animation
  SUGGESTION_APPEAR_DURATION: 300,
  SUGGESTION_APPEAR_EASING: 'ease-out' as const,
  
  // Suggestion highlight pulse
  HIGHLIGHT_PULSE_DURATION: 2000,
  HIGHLIGHT_PULSE_INTENSITY: 0.3,
  
  // Pattern preview fade in/out
  PREVIEW_FADE_DURATION: 200,
  
  // Hint card slide animation
  HINT_CARD_SLIDE_DURATION: 250,
  HINT_CARD_SPRING_CONFIG: {
    damping: 20,
    stiffness: 300,
  },
  
  // Ghost beacon pulse
  GHOST_PULSE_DURATION: 1500,
  GHOST_PULSE_SCALE: 1.1,
} as const;