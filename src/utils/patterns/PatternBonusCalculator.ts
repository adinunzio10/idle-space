import { GeometricPattern, PatternType, Beacon } from '../../types/galaxy';
import { ResourceType } from '../../types/resources';
import {
  BonusCalculationResult,
  BonusCalculationConfig,
  BeaconBonusContribution,
  PatternOverlap,
  PatternBonusBreakdown,
  BonusCalculationMetrics,
  BonusValidationResult,
  BonusCacheEntry,
  PatternCombination,
  OverlapType,
  BonusStrategy,
  DEFAULT_BONUS_CONFIG,
  BEACON_TYPE_MULTIPLIERS,
  CONNECTION_QUALITY_BONUSES,
  OVERLAP_MODIFIERS,
  RESOURCE_BONUS_WEIGHTS,
} from '../../types/bonuses';
import { PATTERN_BONUSES } from '../../constants/connections';

/**
 * Advanced pattern bonus calculator with multiplicative stacking and overlap detection.
 *
 * Handles complex scenarios like:
 * - Multiple overlapping patterns sharing beacons
 * - Multiplicative stacking with diminishing returns
 * - Beacon type and connection quality bonuses
 * - Performance optimization with caching
 *
 * @example
 * ```typescript
 * const calculator = new PatternBonusCalculator();
 * const result = calculator.calculateTotalBonus(patterns, beacons);
 * console.log(`Total multiplier: ${result.totalMultiplier}x`);
 * ```
 */
export class PatternBonusCalculator {
  private config: BonusCalculationConfig;
  private bonusCache: Map<string, BonusCacheEntry> = new Map();
  private lastCleanup: number = Date.now();

  constructor(config: Partial<BonusCalculationConfig> = {}) {
    this.config = { ...DEFAULT_BONUS_CONFIG, ...config };
  }

  /**
   * Calculate total bonus for a set of patterns and beacons.
   *
   * @param patterns - Detected geometric patterns
   * @param beacons - All beacons in the network
   * @returns Complete bonus calculation result
   */
  calculateTotalBonus(
    patterns: GeometricPattern[],
    beacons: Beacon[]
  ): BonusCalculationResult {
    const startTime = performance.now();

    // Check cache first
    const cacheKey = this.generateCacheKey(patterns, beacons);
    const cached = this.getCachedResult(cacheKey);
    if (cached) {
      return cached;
    }

    // Detect overlaps between patterns
    const overlaps = this.detectOverlappingPatterns(patterns);

    // Calculate individual beacon contributions
    const beaconContributions = this.calculateBeaconContributions(
      patterns,
      beacons,
      overlaps
    );

    // Apply stacking strategy
    const totalMultiplier = this.applyStackingStrategy(
      beaconContributions,
      overlaps
    );

    // Generate pattern breakdown
    const patternBreakdown = this.generatePatternBreakdown(
      patterns,
      beaconContributions,
      overlaps
    );

    // Calculate resource generation
    const baseGeneration = this.calculateBaseGeneration(beacons);
    const bonusedGeneration = this.applyBonusesToGeneration(
      baseGeneration,
      totalMultiplier
    );

    const endTime = performance.now();
    const metrics: BonusCalculationMetrics = {
      calculationTimeMs: endTime - startTime,
      patternsProcessed: patterns.length,
      beaconsAnalyzed: beacons.length,
      overlapsDetected: overlaps.length,
      cacheHitRatio: this.calculateCacheHitRatio(),
    };

    const result: BonusCalculationResult = {
      totalMultiplier,
      baseGeneration,
      bonusedGeneration,
      beaconContributions,
      overlaps,
      patternBreakdown,
      calculationMetrics: metrics,
      strategy: this.config.strategy,
    };

    // Cache the result
    this.cacheResult(cacheKey, result);

    return result;
  }

  /**
   * Detect overlapping patterns that share beacons.
   *
   * @param patterns - Geometric patterns to analyze
   * @returns Array of pattern overlaps
   */
  private detectOverlappingPatterns(
    patterns: GeometricPattern[]
  ): PatternOverlap[] {
    const overlaps: PatternOverlap[] = [];

    // Compare each pattern with every other pattern
    for (let i = 0; i < patterns.length; i++) {
      for (let j = i + 1; j < patterns.length; j++) {
        const pattern1 = patterns[i];
        const pattern2 = patterns[j];

        const overlap = this.analyzePatternOverlap(pattern1, pattern2);
        if (overlap.overlapSeverity > this.config.minOverlapThreshold) {
          overlaps.push(overlap);
        }
      }
    }

    return overlaps;
  }

  /**
   * Analyze overlap between two specific patterns.
   *
   * @param pattern1 - First pattern
   * @param pattern2 - Second pattern
   * @returns Pattern overlap information
   */
  private analyzePatternOverlap(
    pattern1: GeometricPattern,
    pattern2: GeometricPattern
  ): PatternOverlap {
    const sharedBeacons = pattern1.beaconIds.filter(id =>
      pattern2.beaconIds.includes(id)
    );

    const overlapType = this.classifyOverlapType(
      pattern1,
      pattern2,
      sharedBeacons
    );
    const overlapSeverity = this.calculateOverlapSeverity(
      pattern1,
      pattern2,
      sharedBeacons
    );

    return {
      patternIds: [pattern1.id, pattern2.id],
      patternTypes: [pattern1.type, pattern2.type],
      sharedBeacons,
      individualBonuses: [
        PATTERN_BONUSES[pattern1.type],
        PATTERN_BONUSES[pattern2.type],
      ],
      overlapType,
      overlapSeverity,
    };
  }

  /**
   * Classify the type of overlap between two patterns.
   *
   * @param pattern1 - First pattern
   * @param pattern2 - Second pattern
   * @param sharedBeacons - Beacons shared between patterns
   * @returns Type of overlap
   */
  private classifyOverlapType(
    pattern1: GeometricPattern,
    pattern2: GeometricPattern,
    sharedBeacons: string[]
  ): OverlapType {
    if (sharedBeacons.length === 0) return 'none';

    const shared = sharedBeacons.length;
    const total1 = pattern1.beaconIds.length;
    const total2 = pattern2.beaconIds.length;

    // Identical patterns
    if (shared === total1 && shared === total2) {
      return 'identical';
    }

    // One pattern completely inside another
    if (shared === Math.min(total1, total2)) {
      return 'nested';
    }

    // Edge sharing (2+ consecutive beacons)
    if (shared >= 2 && this.hasSharedEdge(pattern1, pattern2, sharedBeacons)) {
      return 'edge';
    }

    // Multiple vertices but not nested
    if (shared > 2) {
      return 'partial';
    }

    // Single or double vertex sharing
    return 'vertex';
  }

  /**
   * Check if patterns share an edge (consecutive beacons).
   *
   * @param pattern1 - First pattern
   * @param pattern2 - Second pattern
   * @param sharedBeacons - Shared beacon IDs
   * @returns True if patterns share an edge
   */
  private hasSharedEdge(
    pattern1: GeometricPattern,
    pattern2: GeometricPattern,
    sharedBeacons: string[]
  ): boolean {
    if (sharedBeacons.length < 2) return false;

    // Check if any two shared beacons are consecutive in both patterns
    for (let i = 0; i < sharedBeacons.length; i++) {
      for (let j = i + 1; j < sharedBeacons.length; j++) {
        const beacon1 = sharedBeacons[i];
        const beacon2 = sharedBeacons[j];

        if (
          this.areConsecutiveInPattern(beacon1, beacon2, pattern1) &&
          this.areConsecutiveInPattern(beacon1, beacon2, pattern2)
        ) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if two beacons are consecutive in a pattern.
   *
   * @param beacon1 - First beacon ID
   * @param beacon2 - Second beacon ID
   * @param pattern - Pattern to check
   * @returns True if beacons are consecutive
   */
  private areConsecutiveInPattern(
    beacon1: string,
    beacon2: string,
    pattern: GeometricPattern
  ): boolean {
    const idx1 = pattern.beaconIds.indexOf(beacon1);
    const idx2 = pattern.beaconIds.indexOf(beacon2);

    if (idx1 === -1 || idx2 === -1) return false;

    const n = pattern.beaconIds.length;
    const diff = Math.abs(idx1 - idx2);

    return diff === 1 || diff === n - 1; // Adjacent or wrap-around
  }

  /**
   * Calculate overlap severity (0 = no overlap, 1 = complete overlap).
   *
   * @param pattern1 - First pattern
   * @param pattern2 - Second pattern
   * @param sharedBeacons - Shared beacon IDs
   * @returns Overlap severity
   */
  private calculateOverlapSeverity(
    pattern1: GeometricPattern,
    pattern2: GeometricPattern,
    sharedBeacons: string[]
  ): number {
    if (sharedBeacons.length === 0) return 0;

    const total1 = pattern1.beaconIds.length;
    const total2 = pattern2.beaconIds.length;
    const shared = sharedBeacons.length;

    // Severity based on proportion of shared beacons
    const severity1 = shared / total1;
    const severity2 = shared / total2;

    // Return average severity
    return (severity1 + severity2) / 2;
  }

  /**
   * Calculate individual beacon contributions to bonuses.
   *
   * @param patterns - All detected patterns
   * @param beacons - All beacons
   * @param overlaps - Detected overlaps
   * @returns Beacon bonus contributions
   */
  private calculateBeaconContributions(
    patterns: GeometricPattern[],
    beacons: Beacon[],
    overlaps: PatternOverlap[]
  ): BeaconBonusContribution[] {
    const contributions: BeaconBonusContribution[] = [];
    const beaconMap = new Map(beacons.map(b => [b.id, b]));

    // Create a map of beacon to patterns
    const beaconToPatterns = new Map<string, string[]>();

    for (const pattern of patterns) {
      for (const beaconId of pattern.beaconIds) {
        if (!beaconToPatterns.has(beaconId)) {
          beaconToPatterns.set(beaconId, []);
        }
        beaconToPatterns.get(beaconId)!.push(pattern.id);
      }
    }

    // Calculate contribution for each beacon
    for (const [beaconId, patternIds] of beaconToPatterns) {
      const beacon = beaconMap.get(beaconId);
      if (!beacon) continue;

      const contribution = this.calculateSingleBeaconContribution(
        beacon,
        patternIds,
        patterns,
        overlaps
      );

      contributions.push(contribution);
    }

    return contributions;
  }

  /**
   * Calculate contribution of a single beacon to bonus.
   *
   * @param beacon - Beacon to analyze
   * @param patternIds - Patterns this beacon participates in
   * @param allPatterns - All patterns for lookup
   * @param overlaps - All overlaps for consideration
   * @returns Beacon bonus contribution
   */
  private calculateSingleBeaconContribution(
    beacon: Beacon,
    patternIds: string[],
    allPatterns: GeometricPattern[],
    overlaps: PatternOverlap[]
  ): BeaconBonusContribution {
    const patternMap = new Map(allPatterns.map(p => [p.id, p]));

    // Get base multipliers from patterns
    const multipliers = patternIds.map(id => {
      const pattern = patternMap.get(id);
      return pattern ? PATTERN_BONUSES[pattern.type] : 1;
    });

    // Apply beacon type bonus
    const beaconTypeMultiplier = BEACON_TYPE_MULTIPLIERS[beacon.type] || 1;

    // Apply connection quality bonus
    const connectionQualityMultiplier =
      this.calculateConnectionQualityBonus(beacon);

    // Calculate effective multiplier based on strategy
    let effectiveMultiplier: number;

    switch (this.config.strategy) {
      case 'multiplicative':
        effectiveMultiplier = multipliers.reduce(
          (acc, mult) => acc * mult,
          1 as number
        );
        break;
      case 'additive':
        effectiveMultiplier =
          1 + multipliers.reduce((acc, mult) => acc + (mult - 1), 0 as number);
        break;
      case 'maximum':
        effectiveMultiplier = Math.max(...multipliers);
        break;
      default:
        effectiveMultiplier = multipliers.reduce(
          (acc, mult) => acc * mult,
          1 as number
        );
    }

    // Apply type and connection bonuses
    effectiveMultiplier *= beaconTypeMultiplier * connectionQualityMultiplier;

    // Apply overlap penalties/bonuses
    effectiveMultiplier = this.applyOverlapModifiers(
      effectiveMultiplier,
      beacon.id,
      overlaps
    );

    // Calculate beacon weight (based on connections and level)
    const weight = this.calculateBeaconWeight(beacon);

    return {
      beaconId: beacon.id,
      patterns: patternIds,
      multipliers,
      effectiveMultiplier,
      weight,
      resourceTypes: this.config.targetResourceTypes,
    };
  }

  /**
   * Calculate connection quality bonus for a beacon.
   *
   * @param beacon - Beacon to analyze
   * @returns Connection quality multiplier
   */
  private calculateConnectionQualityBonus(beacon: Beacon): number {
    if (!this.config.applyConnectionBonuses) return 1;

    const connectionCount = beacon.connections.length;
    const beaconLevel = beacon.level;

    // Base quality on beacon level and connection count
    const qualityLevel = Math.min(
      5,
      Math.max(1, Math.floor((beaconLevel + connectionCount) / 2))
    );

    return (
      CONNECTION_QUALITY_BONUSES[
        qualityLevel as keyof typeof CONNECTION_QUALITY_BONUSES
      ] || 1
    );
  }

  /**
   * Apply overlap modifiers to effective multiplier.
   *
   * @param baseMultiplier - Base multiplier before overlap adjustments
   * @param beaconId - Beacon ID to check for overlaps
   * @param overlaps - All detected overlaps
   * @returns Modified multiplier
   */
  private applyOverlapModifiers(
    baseMultiplier: number,
    beaconId: string,
    overlaps: PatternOverlap[]
  ): number {
    let modifier = 1.0;

    // Find overlaps involving this beacon
    const relevantOverlaps = overlaps.filter(overlap =>
      overlap.sharedBeacons.includes(beaconId)
    );

    // Apply cumulative overlap modifiers
    for (const overlap of relevantOverlaps) {
      const overlapModifier = OVERLAP_MODIFIERS[overlap.overlapType];
      // Weight modifier by overlap severity
      const weightedModifier =
        1 + (overlapModifier - 1) * overlap.overlapSeverity;
      modifier *= weightedModifier;
    }

    return baseMultiplier * modifier;
  }

  /**
   * Calculate weight of a beacon based on its properties.
   *
   * @param beacon - Beacon to analyze
   * @returns Beacon weight (higher = more important)
   */
  private calculateBeaconWeight(beacon: Beacon): number {
    let weight = 1.0;

    // Weight by beacon level
    weight *= beacon.level;

    // Weight by connection count (more connected = higher weight)
    weight *= Math.sqrt(beacon.connections.length + 1);

    // Weight by beacon type
    const typeMultiplier = BEACON_TYPE_MULTIPLIERS[beacon.type];
    weight *= typeMultiplier;

    return weight;
  }

  /**
   * Apply stacking strategy to combine beacon contributions.
   *
   * @param contributions - Individual beacon contributions
   * @param overlaps - Pattern overlaps
   * @returns Total multiplier
   */
  private applyStackingStrategy(
    contributions: BeaconBonusContribution[],
    overlaps: PatternOverlap[]
  ): number {
    if (contributions.length === 0) return 1;

    let totalMultiplier: number;

    switch (this.config.strategy) {
      case 'multiplicative':
        totalMultiplier = this.applyMultiplicativeStacking(contributions);
        break;
      case 'additive':
        totalMultiplier = this.applyAdditiveStacking(contributions);
        break;
      case 'maximum':
        totalMultiplier = this.applyMaximumStacking(contributions);
        break;
      case 'weighted':
        totalMultiplier = this.applyWeightedStacking(contributions);
        break;
      default:
        totalMultiplier = this.applyMultiplicativeStacking(contributions);
    }

    // Apply diminishing returns if configured
    if (this.config.diminishingReturnsThreshold > 0) {
      totalMultiplier = this.applyDiminishingReturns(totalMultiplier);
    }

    // Apply maximum cap if configured
    if (this.config.maxMultiplierCap > 0) {
      totalMultiplier = Math.min(totalMultiplier, this.config.maxMultiplierCap);
    }

    return totalMultiplier;
  }

  /**
   * Apply multiplicative stacking strategy.
   *
   * @param contributions - Beacon contributions
   * @returns Total multiplier
   */
  private applyMultiplicativeStacking(
    contributions: BeaconBonusContribution[]
  ): number {
    // Weight contributions by beacon importance
    const totalWeight = contributions.reduce(
      (sum, contrib) => sum + contrib.weight,
      0
    );

    if (totalWeight === 0) return 1;

    // Weighted geometric mean for more balanced stacking
    let weightedProduct = 1;

    for (const contrib of contributions) {
      const weightRatio = contrib.weight / totalWeight;
      const contributionPower = Math.pow(
        contrib.effectiveMultiplier,
        weightRatio
      );
      weightedProduct *= contributionPower;
    }

    return weightedProduct;
  }

  /**
   * Apply additive stacking strategy.
   *
   * @param contributions - Beacon contributions
   * @returns Total multiplier
   */
  private applyAdditiveStacking(
    contributions: BeaconBonusContribution[]
  ): number {
    const totalWeight = contributions.reduce(
      (sum, contrib) => sum + contrib.weight,
      0
    );

    if (totalWeight === 0) return 1;

    let weightedSum = 0;

    for (const contrib of contributions) {
      const weightRatio = contrib.weight / totalWeight;
      const bonusContribution = (contrib.effectiveMultiplier - 1) * weightRatio;
      weightedSum += bonusContribution;
    }

    return 1 + weightedSum;
  }

  /**
   * Apply maximum stacking strategy.
   *
   * @param contributions - Beacon contributions
   * @returns Total multiplier
   */
  private applyMaximumStacking(
    contributions: BeaconBonusContribution[]
  ): number {
    if (contributions.length === 0) return 1;

    // Return the highest effective multiplier
    return Math.max(...contributions.map(c => c.effectiveMultiplier));
  }

  /**
   * Apply weighted stacking strategy.
   *
   * @param contributions - Beacon contributions
   * @returns Total multiplier
   */
  private applyWeightedStacking(
    contributions: BeaconBonusContribution[]
  ): number {
    // Combination of multiplicative and additive based on contribution size
    const multipliers = contributions.map(c => c.effectiveMultiplier);
    const weights = contributions.map(c => c.weight);
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);

    if (totalWeight === 0) return 1;

    // Use multiplicative for small bonuses, additive for large ones
    let result = 1;

    for (let i = 0; i < contributions.length; i++) {
      const contrib = contributions[i];
      const weightRatio = weights[i] / totalWeight;

      if (contrib.effectiveMultiplier <= 2) {
        // Multiplicative for small bonuses
        result *= Math.pow(contrib.effectiveMultiplier, weightRatio);
      } else {
        // Additive for large bonuses
        result += (contrib.effectiveMultiplier - 1) * weightRatio;
      }
    }

    return result;
  }

  /**
   * Apply diminishing returns to total multiplier.
   *
   * @param multiplier - Base multiplier
   * @returns Multiplier with diminishing returns
   */
  private applyDiminishingReturns(multiplier: number): number {
    const threshold = this.config.diminishingReturnsThreshold;
    const factor = this.config.diminishingReturnsFactor;

    if (multiplier <= threshold) {
      return multiplier;
    }

    const excess = multiplier - threshold;
    const diminishedExcess = excess * factor;

    return threshold + diminishedExcess;
  }

  /**
   * Generate pattern breakdown for analysis.
   *
   * @param patterns - All patterns
   * @param contributions - Beacon contributions
   * @param overlaps - Pattern overlaps
   * @returns Pattern breakdown array
   */
  private generatePatternBreakdown(
    patterns: GeometricPattern[],
    contributions: BeaconBonusContribution[],
    overlaps: PatternOverlap[]
  ): PatternBonusBreakdown[] {
    const breakdown: PatternBonusBreakdown[] = [];

    for (const pattern of patterns) {
      const patternContributions = contributions.filter(c =>
        c.patterns.includes(pattern.id)
      );

      const baseBonus = PATTERN_BONUSES[pattern.type];
      const effectiveBonus =
        patternContributions.length > 0
          ? patternContributions.reduce(
              (sum, c) => sum + c.effectiveMultiplier,
              0
            ) / patternContributions.length
          : baseBonus;

      const hasOverlaps = overlaps.some(o => o.patternIds.includes(pattern.id));

      breakdown.push({
        patternId: pattern.id,
        type: pattern.type,
        baseBonus,
        effectiveBonus,
        beaconCount: pattern.beaconIds.length,
        contributingBeacons: patternContributions.map(c => c.beaconId),
        resourceTypes: this.config.targetResourceTypes,
        hasOverlaps,
      });
    }

    return breakdown;
  }

  /**
   * Calculate base resource generation rates.
   *
   * @param beacons - All beacons
   * @returns Base generation rates
   */
  private calculateBaseGeneration(
    beacons: Beacon[]
  ): Partial<Record<ResourceType, number>> {
    const generation: Partial<Record<ResourceType, number>> = {};

    // Placeholder base generation calculation
    // This would be replaced with actual game logic
    generation.quantumData = beacons.length * 10;
    generation.stellarEssence = beacons.length * 2;
    generation.resonanceCrystals = beacons.length * 0.5;

    return generation;
  }

  /**
   * Apply bonuses to base generation rates.
   *
   * @param baseGeneration - Base generation rates
   * @param totalMultiplier - Total bonus multiplier
   * @returns Bonused generation rates
   */
  private applyBonusesToGeneration(
    baseGeneration: Partial<Record<ResourceType, number>>,
    totalMultiplier: number
  ): Partial<Record<ResourceType, number>> {
    const bonusedGeneration: Partial<Record<ResourceType, number>> = {};

    for (const [resourceType, baseRate] of Object.entries(baseGeneration)) {
      if (
        baseRate &&
        this.config.targetResourceTypes.includes(resourceType as ResourceType)
      ) {
        const resourceWeight =
          RESOURCE_BONUS_WEIGHTS[resourceType as ResourceType] || 1;
        const effectiveMultiplier = 1 + (totalMultiplier - 1) * resourceWeight;
        bonusedGeneration[resourceType as ResourceType] =
          baseRate * effectiveMultiplier;
      }
    }

    return bonusedGeneration;
  }

  /**
   * Generate cache key for bonus calculation.
   *
   * @param patterns - Patterns to cache
   * @param beacons - Beacons to cache
   * @returns Cache key
   */
  private generateCacheKey(
    patterns: GeometricPattern[],
    beacons: Beacon[]
  ): string {
    const patternData = patterns.map(p => ({
      id: p.id,
      type: p.type,
      beacons: [...p.beaconIds].sort(),
    }));

    const beaconData = beacons.map(b => ({
      id: b.id,
      level: b.level,
      type: b.type,
      connections: b.connections.length,
    }));

    return JSON.stringify({ patterns: patternData, beacons: beaconData });
  }

  /**
   * Get cached result if available and valid.
   *
   * @param cacheKey - Cache key
   * @returns Cached result or null
   */
  private getCachedResult(cacheKey: string): BonusCalculationResult | null {
    const cached = this.bonusCache.get(cacheKey);

    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > cached.ttlMs) {
      this.bonusCache.delete(cacheKey);
      return null;
    }

    return cached.result;
  }

  /**
   * Cache calculation result.
   *
   * @param cacheKey - Cache key
   * @param result - Result to cache
   */
  private cacheResult(cacheKey: string, result: BonusCalculationResult): void {
    const ttlMs = 60000; // 1 minute TTL

    this.bonusCache.set(cacheKey, {
      patternHash: cacheKey,
      result,
      timestamp: Date.now(),
      ttlMs,
    });

    // Periodic cleanup
    if (Date.now() - this.lastCleanup > 300000) {
      // 5 minutes
      this.cleanupCache();
    }
  }

  /**
   * Clean up expired cache entries.
   */
  private cleanupCache(): void {
    const now = Date.now();

    for (const [key, entry] of this.bonusCache) {
      if (now - entry.timestamp > entry.ttlMs) {
        this.bonusCache.delete(key);
      }
    }

    this.lastCleanup = now;
  }

  /**
   * Calculate cache hit ratio for metrics.
   *
   * @returns Cache hit ratio (0-1)
   */
  private calculateCacheHitRatio(): number {
    // This would track actual hits vs misses in a real implementation
    return 0.75; // Placeholder
  }

  /**
   * Update calculator configuration.
   *
   * @param config - New configuration options
   */
  updateConfig(config: Partial<BonusCalculationConfig>): void {
    this.config = { ...this.config, ...config };

    // Clear cache when configuration changes
    this.bonusCache.clear();
  }

  /**
   * Get current configuration.
   *
   * @returns Current configuration
   */
  getConfig(): BonusCalculationConfig {
    return { ...this.config };
  }

  /**
   * Clear all cached results.
   */
  clearCache(): void {
    this.bonusCache.clear();
  }

  /**
   * Validate bonus calculation result.
   *
   * @param result - Result to validate
   * @returns Validation result
   */
  validateResult(result: BonusCalculationResult): BonusValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation checks
    if (result.totalMultiplier < 1) {
      errors.push('Total multiplier cannot be less than 1');
    }

    if (
      result.beaconContributions.length === 0 &&
      result.totalMultiplier !== 1
    ) {
      warnings.push('No beacon contributions but multiplier is not 1');
    }

    // Check for reasonable multiplier values
    if (result.totalMultiplier > 1000) {
      warnings.push(`Very high multiplier: ${result.totalMultiplier}x`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
