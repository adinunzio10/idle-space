import { GeometricPattern, PatternType, Beacon } from './galaxy';
import { ResourceType } from './resources';

/**
 * Strategy for combining bonuses from multiple patterns
 */
export type BonusStrategy = 'multiplicative' | 'additive' | 'maximum' | 'weighted';

/**
 * Individual beacon's contribution to bonus calculations
 */
export interface BeaconBonusContribution {
  /** Beacon ID */
  beaconId: string;
  /** Patterns this beacon participates in */
  patterns: string[];
  /** Individual multipliers from each pattern */
  multipliers: number[];
  /** Final effective multiplier for this beacon */
  effectiveMultiplier: number;
  /** Weight of this beacon's contribution (based on connections, type, etc.) */
  weight: number;
  /** Resource types this bonus applies to */
  resourceTypes: ResourceType[];
}

/**
 * Information about patterns that share beacons
 */
export interface PatternOverlap {
  /** IDs of overlapping patterns */
  patternIds: string[];
  /** Pattern types involved */
  patternTypes: PatternType[];
  /** Shared beacon IDs */
  sharedBeacons: string[];
  /** Individual pattern bonuses */
  individualBonuses: number[];
  /** Overlap type classification */
  overlapType: OverlapType;
  /** Severity of overlap (0 = no overlap, 1 = complete overlap) */
  overlapSeverity: number;
}

/**
 * Types of pattern overlaps
 */
export type OverlapType = 
  | 'none'           // No shared beacons
  | 'vertex'         // Share 1-2 vertices
  | 'edge'           // Share an entire edge
  | 'partial'        // Share multiple vertices but not nested
  | 'nested'         // One pattern completely inside another
  | 'identical';     // Same pattern (duplicate)

/**
 * Complete bonus calculation result
 */
export interface BonusCalculationResult {
  /** Total effective multiplier */
  totalMultiplier: number;
  /** Base resource generation rate before bonuses */
  baseGeneration: Partial<Record<ResourceType, number>>;
  /** Final resource generation rate after bonuses */
  bonusedGeneration: Partial<Record<ResourceType, number>>;
  /** Individual beacon contributions */
  beaconContributions: BeaconBonusContribution[];
  /** Detected overlaps between patterns */
  overlaps: PatternOverlap[];
  /** Breakdown by pattern */
  patternBreakdown: PatternBonusBreakdown[];
  /** Performance metrics */
  calculationMetrics: BonusCalculationMetrics;
  /** Strategy used for calculation */
  strategy: BonusStrategy;
}

/**
 * Bonus breakdown for individual patterns
 */
export interface PatternBonusBreakdown {
  /** Pattern ID */
  patternId: string;
  /** Pattern type */
  type: PatternType;
  /** Base bonus multiplier */
  baseBonus: number;
  /** Effective bonus after overlap adjustments */
  effectiveBonus: number;
  /** Number of beacons in pattern */
  beaconCount: number;
  /** Beacons contributing to this pattern's bonus */
  contributingBeacons: string[];
  /** Resource types affected */
  resourceTypes: ResourceType[];
  /** Whether this pattern has overlaps */
  hasOverlaps: boolean;
}

/**
 * Performance metrics for bonus calculations
 */
export interface BonusCalculationMetrics {
  /** Time taken for calculation in milliseconds */
  calculationTimeMs: number;
  /** Number of patterns processed */
  patternsProcessed: number;
  /** Number of beacons analyzed */
  beaconsAnalyzed: number;
  /** Number of overlaps detected */
  overlapsDetected: number;
  /** Cache hit/miss ratio */
  cacheHitRatio: number;
}

/**
 * Configuration for bonus calculations
 */
export interface BonusCalculationConfig {
  /** Stacking strategy to use */
  strategy: BonusStrategy;
  /** Maximum multiplier cap (0 = no cap) */
  maxMultiplierCap: number;
  /** Diminishing returns threshold */
  diminishingReturnsThreshold: number;
  /** Diminishing returns factor (0-1) */
  diminishingReturnsFactor: number;
  /** Whether to apply beacon type bonuses */
  applyBeaconTypeBonuses: boolean;
  /** Whether to apply connection bonuses */
  applyConnectionBonuses: boolean;
  /** Minimum overlap threshold to consider overlapping */
  minOverlapThreshold: number;
  /** Resource types to calculate bonuses for */
  targetResourceTypes: ResourceType[];
}

/**
 * Default bonus calculation configuration
 */
export const DEFAULT_BONUS_CONFIG: BonusCalculationConfig = {
  strategy: 'multiplicative',
  maxMultiplierCap: 0, // No cap by default
  diminishingReturnsThreshold: 10, // Start diminishing returns after 10x
  diminishingReturnsFactor: 0.8, // 80% effectiveness after threshold
  applyBeaconTypeBonuses: true,
  applyConnectionBonuses: true,
  minOverlapThreshold: 0.1, // 10% overlap minimum
  targetResourceTypes: ['quantumData', 'stellarEssence', 'resonanceCrystals'],
};

/**
 * Beacon type multipliers for bonus calculations
 */
export const BEACON_TYPE_MULTIPLIERS = {
  pioneer: 1.0,     // Base multiplier
  harvester: 1.2,   // 20% bonus for resource generation
  architect: 1.1,   // 10% bonus for pattern efficiency
} as const;

/**
 * Connection quality bonuses
 */
export const CONNECTION_QUALITY_BONUSES = {
  1: 1.0,  // Weak connections (level 1 beacons)
  2: 1.05, // 5% bonus
  3: 1.1,  // 10% bonus
  4: 1.15, // 15% bonus
  5: 1.2,  // 20% bonus (max level connections)
} as const;

/**
 * Overlap penalty/bonus modifiers
 */
export const OVERLAP_MODIFIERS = {
  none: 1.0,
  vertex: 0.95,    // 5% penalty for vertex sharing
  edge: 0.9,       // 10% penalty for edge sharing
  partial: 0.85,   // 15% penalty for partial overlap
  nested: 1.1,     // 10% bonus for nested patterns
  identical: 0.5,  // 50% penalty for identical patterns
} as const;

/**
 * Resource type weights for bonus application
 */
export const RESOURCE_BONUS_WEIGHTS = {
  quantumData: 1.0,        // Primary resource, full bonus
  stellarEssence: 0.8,     // Secondary resource, 80% bonus
  voidFragments: 0.6,      // Secondary resource, 60% bonus
  resonanceCrystals: 1.5,  // Special resource, 150% bonus from patterns
  chronosParticles: 0.3,   // Premium resource, limited bonus
} as const;

/**
 * Cached bonus calculation for performance
 */
export interface BonusCacheEntry {
  /** Hash of input patterns */
  patternHash: string;
  /** Calculation result */
  result: BonusCalculationResult;
  /** Timestamp of calculation */
  timestamp: number;
  /** TTL in milliseconds */
  ttlMs: number;
}

/**
 * Validation result for bonus calculations
 */
export interface BonusValidationResult {
  /** Whether the calculation is valid */
  isValid: boolean;
  /** Validation errors found */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
  /** Expected vs actual multiplier comparison */
  multiplierCheck?: {
    expected: number;
    actual: number;
    difference: number;
    withinTolerance: boolean;
  };
}

/**
 * Helper type for pattern combinations in overlap detection
 */
export interface PatternCombination {
  /** Primary pattern */
  primary: GeometricPattern;
  /** Secondary pattern */
  secondary: GeometricPattern;
  /** Combination key for caching */
  combinationKey: string;
}

/**
 * Strategy-specific calculation parameters
 */
export interface StrategyParameters {
  multiplicative: {
    /** Base multiplier when no patterns exist */
    baseMultiplier: number;
    /** Maximum effective multiplier per beacon */
    maxBeaconMultiplier: number;
  };
  additive: {
    /** Base bonus added to each beacon */
    baseBonus: number;
    /** Maximum total bonus */
    maxTotalBonus: number;
  };
  maximum: {
    /** Whether to consider beacon weights in maximum calculation */
    useBeaconWeights: boolean;
  };
  weighted: {
    /** How to weight different pattern types */
    patternTypeWeights: Partial<Record<PatternType, number>>;
    /** How to weight beacon types */
    beaconTypeWeights: Partial<Record<string, number>>;
  };
}

/**
 * Default strategy parameters
 */
export const DEFAULT_STRATEGY_PARAMS: StrategyParameters = {
  multiplicative: {
    baseMultiplier: 1.0,
    maxBeaconMultiplier: 50.0,
  },
  additive: {
    baseBonus: 0.1,
    maxTotalBonus: 10.0,
  },
  maximum: {
    useBeaconWeights: true,
  },
  weighted: {
    patternTypeWeights: {
      triangle: 1.0,
      square: 1.2,
      pentagon: 1.5,
      hexagon: 2.0,
    },
    beaconTypeWeights: {
      pioneer: 1.0,
      harvester: 1.2,
      architect: 1.1,
    },
  },
};