import { Point2D, Beacon, GeometricPattern, PatternType } from '../../types/galaxy';
import {
  PatternSuggestion,
  PatternCompletionAnalysis,
  IncompletePattern,
  PatternProbability,
} from '../../types/spatialHashing';
import {
  PATTERN_SUGGESTION_CONFIG,
  NEIGHBOR_QUERY_CONFIG,
  SPATIAL_PERFORMANCE_THRESHOLDS,
} from '../../constants/spatialHashing';
import { PATTERN_BONUSES } from '../../constants/connections';
import { GeometryUtils } from './GeometryUtils';
import { calculateCentroid } from './geometry';
import { SpatialHashMap } from '../spatial/SpatialHashMap';
import { GeometricTolerance, DEFAULT_TOLERANCE } from '../../types/geometry';

/**
 * Pattern completion analysis and suggestion engine
 */
export class PatternSuggestionEngine {
  private geometryUtils: GeometryUtils;
  private spatialHash: SpatialHashMap;
  private cachedSuggestions: Map<string, { suggestions: PatternSuggestion[]; timestamp: number }>;
  private cachedAnalysis: Map<string, { analysis: PatternCompletionAnalysis; timestamp: number }>;
  private tolerance: GeometricTolerance;

  constructor(
    spatialHash: SpatialHashMap,
    tolerance: GeometricTolerance = DEFAULT_TOLERANCE
  ) {
    this.spatialHash = spatialHash;
    this.tolerance = tolerance;
    this.geometryUtils = new GeometryUtils(tolerance);
    this.cachedSuggestions = new Map();
    this.cachedAnalysis = new Map();
  }

  /**
   * Analyze current beacon network and generate pattern completion suggestions
   */
  analyzePatternOpportunities(
    beacons: Beacon[],
    existingPatterns: GeometricPattern[] = []
  ): PatternCompletionAnalysis {
    const startTime = performance.now();
    
    // Check cache first
    const cacheKey = this.generateCacheKey(beacons);
    const cached = this.cachedAnalysis.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < PATTERN_SUGGESTION_CONFIG.SUGGESTION_CACHE_TTL) {
      return cached.analysis;
    }

    // Find incomplete patterns
    const incompletePatterns = this.findIncompletePatterns(beacons, existingPatterns);
    
    // Generate suggestions from incomplete patterns
    const suggestions = this.generateSuggestionsFromIncomplete(incompletePatterns, beacons);
    
    // Find optimal next placement
    const optimalPlacement = this.findOptimalPlacement(suggestions);
    
    // Calculate metrics
    const totalPotentialBonus = suggestions.reduce((sum, s) => sum + s.potentialBonus, 0);
    const averageCompletionCost = this.calculateAverageCompletionCost(suggestions);
    
    const analysis: PatternCompletionAnalysis = {
      incompletePatterns,
      suggestedPositions: suggestions.slice(0, PATTERN_SUGGESTION_CONFIG.MAX_SUGGESTIONS),
      optimalNextPlacement: optimalPlacement,
      totalPotentialBonus,
      averageCompletionCost,
    };
    
    // Cache the result
    this.cachedAnalysis.set(cacheKey, {
      analysis,
      timestamp: Date.now(),
    });
    
    return analysis;
  }

  /**
   * Get pattern suggestions for a specific area
   */
  getSuggestionsForArea(
    beacons: Beacon[],
    centerPosition: Point2D,
    radius: number
  ): PatternSuggestion[] {
    const analysis = this.analyzePatternOpportunities(beacons);
    
    return analysis.suggestedPositions.filter(suggestion => {
      const distance = this.geometryUtils.distance(
        suggestion.suggestedPosition,
        centerPosition
      );
      return distance <= radius;
    });
  }

  /**
   * Calculate pattern formation probability for a given position
   */
  calculatePatternProbability(
    position: Point2D,
    beacons: Beacon[],
    patternType: PatternType
  ): PatternProbability {
    const neighbors = this.findNearbyBeacons(position, beacons, NEIGHBOR_QUERY_CONFIG.PATTERN_RADII[patternType]);
    
    // Get required beacon count for pattern
    const requiredBeacons = this.getRequiredBeaconCount(patternType);
    
    if (neighbors.length < requiredBeacons - 1) {
      return {
        patternType,
        probability: 0,
        confidenceLevel: 1,
        requiredMoves: requiredBeacons,
        timeToCompletion: Infinity,
        riskFactors: ['Insufficient nearby beacons'],
      };
    }

    // Check possible pattern formations
    const possiblePatterns = this.findPossiblePatternFormations(
      position,
      neighbors,
      patternType
    );

    const bestFormation = possiblePatterns.reduce((best, current) => 
      current.quality > best.quality ? current : best
    , { quality: 0, requiredMoves: Infinity, riskFactors: [] as string[] });

    const probability = Math.min(1, bestFormation.quality);
    const confidenceLevel = this.calculateConfidenceLevel(possiblePatterns);
    
    return {
      patternType,
      probability,
      confidenceLevel,
      requiredMoves: bestFormation.requiredMoves,
      timeToCompletion: bestFormation.requiredMoves * 5000, // Estimated 5s per beacon
      riskFactors: bestFormation.riskFactors,
    };
  }

  /**
   * Find positions that would complete multiple patterns simultaneously
   */
  findMultiPatternPositions(beacons: Beacon[]): PatternSuggestion[] {
    const suggestions: PatternSuggestion[] = [];
    const analysis = this.analyzePatternOpportunities(beacons);
    
    // Group suggestions by position (with tolerance)
    const positionGroups = this.groupSuggestionsByPosition(analysis.suggestedPositions);
    
    for (const [position, groupSuggestions] of positionGroups) {
      if (groupSuggestions.length > 1) {
        // Create a multi-pattern suggestion
        const combinedBonus = groupSuggestions.reduce((sum, s) => sum + s.potentialBonus, 0);
        const combinedPriority = groupSuggestions.reduce((max, s) => Math.max(max, s.priority), 0);
        
        suggestions.push({
          id: `multi-${position.x}-${position.y}`,
          type: groupSuggestions[0].type, // Use the highest priority pattern type
          suggestedPosition: position,
          requiredBeacons: [...new Set(groupSuggestions.flatMap(s => s.requiredBeacons))],
          potentialBonus: combinedBonus,
          completionPercentage: Math.max(...groupSuggestions.map(s => s.completionPercentage)),
          priority: combinedPriority + 0.5, // Bonus for multi-pattern
          estimatedValue: combinedBonus,
          conflictingPatterns: [],
        });
      }
    }
    
    return suggestions.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get strategic placement recommendations based on game state
   */
  getStrategicRecommendations(
    beacons: Beacon[],
    availableResources: number,
    gamePhase: 'early' | 'mid' | 'late'
  ): PatternSuggestion[] {
    const analysis = this.analyzePatternOpportunities(beacons);
    
    // Adjust priorities based on game phase
    const adjustedSuggestions = analysis.suggestedPositions.map(suggestion => {
      let priorityMultiplier = 1;
      
      switch (gamePhase) {
        case 'early':
          // Focus on simple, cheap patterns
          if (suggestion.type === 'triangle') priorityMultiplier = 1.5;
          if (suggestion.estimatedValue > 2) priorityMultiplier = 0.7;
          break;
          
        case 'mid':
          // Balance efficiency and power
          if (suggestion.type === 'square') priorityMultiplier = 1.3;
          if (suggestion.estimatedValue < 1.5) priorityMultiplier = 0.8;
          break;
          
        case 'late':
          // Focus on high-value patterns
          if (suggestion.type === 'hexagon' || suggestion.type === 'pentagon') {
            priorityMultiplier = 1.4;
          }
          if (suggestion.potentialBonus < 3) priorityMultiplier = 0.6;
          break;
      }
      
      return {
        ...suggestion,
        priority: suggestion.priority * priorityMultiplier,
      };
    });
    
    // Filter by resource constraints
    const affordableSuggestions = adjustedSuggestions.filter(suggestion => {
      const beaconCost = 100; // Base beacon cost
      const requiredInvestment = suggestion.requiredBeacons.length * beaconCost;
      return requiredInvestment <= availableResources * 1.2; // Allow 20% over-budget
    });
    
    return affordableSuggestions
      .sort((a, b) => b.priority - a.priority)
      .slice(0, PATTERN_SUGGESTION_CONFIG.MAX_SUGGESTIONS);
  }

  /**
   * Clear cached suggestions and analysis
   */
  clearCache(): void {
    this.cachedSuggestions.clear();
    this.cachedAnalysis.clear();
  }

  /**
   * Private helper methods
   */
  
  private findIncompletePatterns(
    beacons: Beacon[],
    existingPatterns: GeometricPattern[]
  ): IncompletePattern[] {
    const incomplete: IncompletePattern[] = [];
    const existingPatternIds = new Set(existingPatterns.map(p => p.id));
    
    // Check each pattern type
    for (const patternType of ['triangle', 'square', 'pentagon', 'hexagon'] as PatternType[]) {
      const requiredBeacons = this.getRequiredBeaconCount(patternType);
      const threshold = PATTERN_SUGGESTION_CONFIG.COMPLETION_THRESHOLDS[patternType];
      const minExistingBeacons = Math.ceil(requiredBeacons * threshold);
      
      // Find combinations of beacons that could form this pattern
      const combinations = this.generateBeaconCombinations(beacons, minExistingBeacons);
      
      for (const combination of combinations) {
        if (this.couldFormPattern(combination, patternType) && 
            !this.isExistingPattern(combination, existingPatterns)) {
          
          const missingPositions = this.calculateMissingPositions(combination, patternType);
          
          if (missingPositions.length > 0) {
            incomplete.push({
              id: `incomplete-${patternType}-${combination.map(b => b.id).join('-')}`,
              type: patternType,
              existingBeacons: combination.map(b => b.id),
              missingPositions,
              estimatedBonus: PATTERN_BONUSES[patternType],
              proximityScore: this.calculateProximityScore(combination),
              feasibilityScore: this.calculateFeasibilityScore(missingPositions, beacons),
            });
          }
        }
      }
    }
    
    return incomplete;
  }
  
  private generateSuggestionsFromIncomplete(
    incompletePatterns: IncompletePattern[],
    beacons: Beacon[]
  ): PatternSuggestion[] {
    const suggestions: PatternSuggestion[] = [];
    
    for (const pattern of incompletePatterns) {
      for (const position of pattern.missingPositions) {
        const suggestion: PatternSuggestion = {
          id: `${pattern.id}-pos-${position.x}-${position.y}`,
          type: pattern.type,
          suggestedPosition: position,
          requiredBeacons: [...pattern.existingBeacons],
          potentialBonus: pattern.estimatedBonus,
          completionPercentage: pattern.existingBeacons.length / this.getRequiredBeaconCount(pattern.type),
          priority: this.calculateSuggestionPriority(pattern, position, beacons),
          estimatedValue: pattern.estimatedBonus,
          conflictingPatterns: this.findConflictingPatterns(position, beacons),
        };
        
        suggestions.push(suggestion);
      }
    }
    
    return suggestions.sort((a, b) => b.priority - a.priority);
  }
  
  private calculateSuggestionPriority(
    pattern: IncompletePattern,
    position: Point2D,
    beacons: Beacon[]
  ): number {
    const weights = PATTERN_SUGGESTION_CONFIG.PRIORITY_WEIGHTS;
    
    const bonusValue = pattern.estimatedBonus / 5; // Normalize to 0-1
    const completionEase = pattern.feasibilityScore;
    const proximity = pattern.proximityScore;
    const efficiency = this.calculateEfficiencyScore(pattern, position, beacons);
    
    return (
      bonusValue * weights.bonusValue +
      completionEase * weights.completionEase +
      proximity * weights.proximity +
      efficiency * weights.efficiency
    );
  }
  
  private findOptimalPlacement(suggestions: PatternSuggestion[]): Point2D | null {
    if (suggestions.length === 0) return null;
    
    // Find the suggestion with the highest priority
    const bestSuggestion = suggestions.reduce((best, current) => 
      current.priority > best.priority ? current : best
    );
    
    return bestSuggestion.suggestedPosition;
  }
  
  private calculateAverageCompletionCost(suggestions: PatternSuggestion[]): number {
    if (suggestions.length === 0) return 0;
    
    const beaconCost = 100; // Base cost per beacon
    const totalCost = suggestions.reduce((sum, s) => {
      const requiredBeacons = this.getRequiredBeaconCount(s.type) - s.requiredBeacons.length;
      return sum + (requiredBeacons * beaconCost);
    }, 0);
    
    return totalCost / suggestions.length;
  }
  
  private findNearbyBeacons(position: Point2D, beacons: Beacon[], radius: number): Beacon[] {
    return beacons.filter(beacon => {
      const distance = this.geometryUtils.distance(position, beacon.position);
      return distance <= radius;
    });
  }
  
  private getRequiredBeaconCount(patternType: PatternType): number {
    switch (patternType) {
      case 'triangle': return 3;
      case 'square': return 4;
      case 'pentagon': return 5;
      case 'hexagon': return 6;
      default: return 3;
    }
  }
  
  private findPossiblePatternFormations(
    position: Point2D,
    neighbors: Beacon[],
    patternType: PatternType
  ): Array<{ quality: number; requiredMoves: number; riskFactors: string[] }> {
    const formations: Array<{ quality: number; requiredMoves: number; riskFactors: string[] }> = [];
    const requiredBeacons = this.getRequiredBeaconCount(patternType);
    
    // Generate combinations of neighbors + position
    const combinations = this.generateBeaconCombinations(neighbors, requiredBeacons - 1);
    
    for (const combination of combinations) {
      const testBeacons = [...combination, { 
        id: 'temp', 
        position, 
        level: 1, 
        type: 'pioneer' as const,
        connections: [] 
      }];
      
      const quality = this.evaluatePatternQuality(testBeacons, patternType);
      const requiredMoves = requiredBeacons - combination.length;
      const riskFactors = this.identifyRiskFactors(testBeacons, patternType);
      
      formations.push({ quality, requiredMoves, riskFactors });
    }
    
    return formations;
  }
  
  private calculateConfidenceLevel(formations: Array<{ quality: number }>): number {
    if (formations.length === 0) return 0;
    
    const averageQuality = formations.reduce((sum, f) => sum + f.quality, 0) / formations.length;
    const variance = formations.reduce((sum, f) => sum + Math.pow(f.quality - averageQuality, 2), 0) / formations.length;
    
    // Lower variance = higher confidence
    return Math.max(0, 1 - Math.sqrt(variance));
  }
  
  private couldFormPattern(beacons: Beacon[], patternType: PatternType): boolean {
    if (beacons.length < 2) return false;
    
    // Check if beacons are within reasonable distance of each other
    const maxDistance = NEIGHBOR_QUERY_CONFIG.PATTERN_RADII[patternType];
    
    for (let i = 0; i < beacons.length; i++) {
      for (let j = i + 1; j < beacons.length; j++) {
        const distance = this.geometryUtils.distance(
          beacons[i].position,
          beacons[j].position
        );
        if (distance > maxDistance) return false;
      }
    }
    
    return true;
  }
  
  private isExistingPattern(beacons: Beacon[], existingPatterns: GeometricPattern[]): boolean {
    const beaconIds = new Set(beacons.map(b => b.id));
    
    return existingPatterns.some(pattern => {
      const patternBeacons = new Set(pattern.beaconIds);
      return this.setsOverlap(beaconIds, patternBeacons, 0.8); // 80% overlap threshold
    });
  }
  
  private setsOverlap<T>(set1: Set<T>, set2: Set<T>, threshold: number): boolean {
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    return intersection.size / union.size >= threshold;
  }
  
  private calculateMissingPositions(beacons: Beacon[], patternType: PatternType): Point2D[] {
    const positions = beacons.map(b => b.position);
    
    // This would use geometric algorithms to determine where additional beacons
    // should be placed to form the specified pattern type
    // For now, we'll return a simplified implementation
    
    const center = calculateCentroid(positions.map(pos => ({ position: pos }) as Beacon));
    const requiredBeacons = this.getRequiredBeaconCount(patternType);
    const missing = requiredBeacons - beacons.length;
    
    const missingPositions: Point2D[] = [];
    const radius = 100; // Average pattern radius
    
    for (let i = 0; i < missing; i++) {
      const angle = (i / missing) * 2 * Math.PI;
      missingPositions.push({
        x: center.x + radius * Math.cos(angle),
        y: center.y + radius * Math.sin(angle),
      });
    }
    
    return missingPositions;
  }
  
  private calculateProximityScore(beacons: Beacon[]): number {
    if (beacons.length < 2) return 0;
    
    const distances: number[] = [];
    for (let i = 0; i < beacons.length; i++) {
      for (let j = i + 1; j < beacons.length; j++) {
        distances.push(this.geometryUtils.distance(
          beacons[i].position,
          beacons[j].position
        ));
      }
    }
    
    const averageDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
    const idealDistance = 150; // Ideal beacon spacing
    
    return Math.max(0, 1 - Math.abs(averageDistance - idealDistance) / idealDistance);
  }
  
  private calculateFeasibilityScore(positions: Point2D[], existingBeacons: Beacon[]): number {
    let score = 1;
    
    for (const position of positions) {
      // Check if position is too close to existing beacons
      const tooClose = existingBeacons.some(beacon => 
        this.geometryUtils.distance(position, beacon.position) < 50
      );
      
      if (tooClose) score *= 0.5;
      
      // Check if position is in a good location (simplified)
      // In a real implementation, this would check placement validity
    }
    
    return score;
  }
  
  private calculateEfficiencyScore(pattern: IncompletePattern, position: Point2D, beacons: Beacon[]): number {
    const requiredBeacons = this.getRequiredBeaconCount(pattern.type) - pattern.existingBeacons.length;
    return pattern.estimatedBonus / Math.max(1, requiredBeacons);
  }
  
  private findConflictingPatterns(position: Point2D, beacons: Beacon[]): string[] {
    // Find existing patterns that might be affected by placing a beacon at this position
    // This is a simplified implementation
    return [];
  }
  
  private generateBeaconCombinations(beacons: Beacon[], size: number): Beacon[][] {
    if (size > beacons.length || size <= 0) return [];
    if (size === beacons.length) return [beacons];
    if (size === 1) return beacons.map(b => [b]);
    
    const combinations: Beacon[][] = [];
    const generate = (start: number, combo: Beacon[]) => {
      if (combo.length === size) {
        combinations.push([...combo]);
        return;
      }
      
      for (let i = start; i <= beacons.length - (size - combo.length); i++) {
        combo.push(beacons[i]);
        generate(i + 1, combo);
        combo.pop();
      }
    };
    
    generate(0, []);
    return combinations.slice(0, 1000); // Limit combinations for performance
  }
  
  private evaluatePatternQuality(beacons: Beacon[], patternType: PatternType): number {
    // Simplified quality evaluation
    // In a real implementation, this would check geometric properties
    const positions = beacons.map(b => b.position);
    
    if (positions.length < this.getRequiredBeaconCount(patternType)) {
      return 0;
    }
    
    // Check basic geometric properties
    const center = calculateCentroid(positions.map(pos => ({ position: pos }) as Beacon));
    const distances = positions.map(p => this.geometryUtils.distance(p, center));
    const averageDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
    const distanceVariance = distances.reduce((sum, d) => sum + Math.pow(d - averageDistance, 2), 0) / distances.length;
    
    // Lower variance = higher quality (more regular pattern)
    return Math.max(0, 1 - Math.sqrt(distanceVariance) / averageDistance);
  }
  
  private identifyRiskFactors(beacons: Beacon[], patternType: PatternType): string[] {
    const risks: string[] = [];
    
    if (beacons.length < this.getRequiredBeaconCount(patternType)) {
      risks.push('Insufficient beacons');
    }
    
    // Check beacon spacing
    const positions = beacons.map(b => b.position);
    const center = calculateCentroid(positions.map(pos => ({ position: pos }) as Beacon));
    const maxDistance = Math.max(...positions.map(p => this.geometryUtils.distance(p, center)));
    
    if (maxDistance > NEIGHBOR_QUERY_CONFIG.PATTERN_RADII[patternType]) {
      risks.push('Beacons too far apart');
    }
    
    return risks;
  }
  
  private groupSuggestionsByPosition(
    suggestions: PatternSuggestion[]
  ): Map<Point2D, PatternSuggestion[]> {
    const groups = new Map<string, PatternSuggestion[]>();
    const tolerance = 25; // Position grouping tolerance
    
    for (const suggestion of suggestions) {
      let foundGroup = false;
      
      for (const [posKey, group] of groups.entries()) {
        const [x, y] = posKey.split(',').map(Number);
        const groupPos = { x, y };
        
        if (this.geometryUtils.distance(suggestion.suggestedPosition, groupPos) <= tolerance) {
          group.push(suggestion);
          foundGroup = true;
          break;
        }
      }
      
      if (!foundGroup) {
        const key = `${suggestion.suggestedPosition.x},${suggestion.suggestedPosition.y}`;
        groups.set(key, [suggestion]);
      }
    }
    
    // Convert back to Point2D keys
    const result = new Map<Point2D, PatternSuggestion[]>();
    for (const [posKey, suggestions] of groups.entries()) {
      const [x, y] = posKey.split(',').map(Number);
      result.set({ x, y }, suggestions);
    }
    
    return result;
  }
  
  private generateCacheKey(beacons: Beacon[]): string {
    // Generate a simple hash of beacon positions
    const hash = beacons
      .map(b => `${b.id}:${b.position.x},${b.position.y}`)
      .sort()
      .join('|');
    
    return hash.slice(0, 50); // Limit key length
  }
}