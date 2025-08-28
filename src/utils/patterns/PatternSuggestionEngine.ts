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
import { BeaconType, BEACON_PLACEMENT_CONFIG } from '../../types/beacon';
import { GeometryUtils } from './GeometryUtils';
import { calculateCentroid } from './geometry';
import { SpatialHashMap } from '../spatial/SpatialHashMap';
import { GeometricTolerance, DEFAULT_TOLERANCE } from '../../types/geometry';
import { PlacementValidator } from '../spatial/PlacementValidator';
import { ShapeDetector } from './detection';

/**
 * Pattern completion analysis and suggestion engine
 */
export class PatternSuggestionEngine {
  private geometryUtils: GeometryUtils;
  private spatialHash: SpatialHashMap;
  private cachedSuggestions: Map<string, { suggestions: PatternSuggestion[]; timestamp: number }>;
  private cachedAnalysis: Map<string, { analysis: PatternCompletionAnalysis; timestamp: number }>;
  private tolerance: GeometricTolerance;
  private placementValidator: PlacementValidator | null;
  private shapeDetector: ShapeDetector;
  private lastTriangleKey?: string;

  constructor(
    spatialHash: SpatialHashMap,
    tolerance: GeometricTolerance = DEFAULT_TOLERANCE,
    placementValidator?: PlacementValidator
  ) {
    this.spatialHash = spatialHash;
    this.tolerance = tolerance;
    this.geometryUtils = new GeometryUtils(tolerance);
    this.cachedSuggestions = new Map();
    this.cachedAnalysis = new Map();
    this.placementValidator = placementValidator || null;
    this.shapeDetector = new ShapeDetector();
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
          newBeaconsNeeded: Math.max(...groupSuggestions.map(s => s.newBeaconsNeeded)),
          allMissingPositions: groupSuggestions.flatMap(s => s.allMissingPositions),
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
          
          // Determine beacon type from existing beacons in the combination (use most common type)
          const beaconType = this.getMostCommonBeaconType(combination);
          const missingPositions = this.calculateMissingPositions(combination, patternType, beaconType);
          
          if (missingPositions.length > 0) {
            incomplete.push({
              id: `incomplete-${patternType}-${combination.map(b => b.id).join('-')}`,
              type: patternType,
              existingBeacons: combination.map(b => b.id),
              missingPositions,
              estimatedBonus: PATTERN_BONUSES[patternType],
              proximityScore: this.calculateProximityScore(combination),
              feasibilityScore: this.calculateFeasibilityScore(missingPositions, beacons, beaconType),
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
      // Create one suggestion per incomplete pattern, not per position
      if (pattern.missingPositions.length > 0) {
        const requiredBeaconCount = this.getRequiredBeaconCount(pattern.type);
        const newBeaconsNeeded = requiredBeaconCount - pattern.existingBeacons.length;
        
        // Use the first missing position as the primary suggested position
        const primaryPosition = pattern.missingPositions[0];
        
        const suggestion: PatternSuggestion = {
          id: `${pattern.id}`,
          type: pattern.type,
          suggestedPosition: primaryPosition,
          requiredBeacons: [...pattern.existingBeacons],
          newBeaconsNeeded: newBeaconsNeeded,
          allMissingPositions: [...pattern.missingPositions],
          potentialBonus: pattern.estimatedBonus,
          completionPercentage: pattern.existingBeacons.length / requiredBeaconCount,
          priority: this.calculateSuggestionPriority(pattern, primaryPosition, beacons),
          estimatedValue: pattern.estimatedBonus,
          conflictingPatterns: this.findConflictingPatterns(primaryPosition, beacons),
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
  
  private calculateMissingPositions(beacons: Beacon[], patternType: PatternType, beaconType: BeaconType = 'pioneer'): Point2D[] {
    const positions = beacons.map(b => b.position);
    const requiredBeacons = this.getRequiredBeaconCount(patternType);
    const missing = requiredBeacons - beacons.length;
    
    if (missing <= 0) return [];
    
    // Calculate safe radius based on beacon type's minimum distance requirements
    const minDistance = BEACON_PLACEMENT_CONFIG.MINIMUM_DISTANCE[beaconType];
    
    let missingPositions: Point2D[] = [];
    
    // Use pattern-specific geometry when possible
    switch (patternType) {
      case 'square':
        missingPositions = this.calculateSquareCompletion(positions, missing, minDistance);
        break;
      case 'triangle':
        missingPositions = this.calculateTriangleCompletion(positions, missing, minDistance);
        break;
      default:
        // Fallback to centroid-based calculation for pentagon/hexagon
        missingPositions = this.calculateCentroidBasedPositions(positions, patternType, missing, minDistance);
        break;
    }
    
    console.log(`[PatternSuggestion] ${patternType} completion returned ${missingPositions.length} positions:`, missingPositions.map(p => `(${p.x},${p.y})`).join(', '));
    
    // For pattern-validated positions (squares/triangles), trust the validation and skip placement corruption
    const isPatternValidated = (patternType === 'square' || patternType === 'triangle') && missingPositions.length > 0;
    
    if (isPatternValidated) {
      console.log(`[PatternSuggestion] Pattern-validated positions - skipping placement validation to preserve pattern geometry`);
      return missingPositions;
    }
    
    // Only do placement validation for centroid-based fallbacks
    console.log(`[PatternSuggestion] Running placement validation for ${patternType} positions...`);
    const validatedPositions: Point2D[] = [];
    for (let i = 0; i < missingPositions.length; i++) {
      const position = missingPositions[i];
      let validPosition = position;
      
      if (this.placementValidator) {
        const validation = this.placementValidator.isValidPosition(position, beaconType);
        console.log(`[PatternSuggestion] Position ${i + 1} (${position.x},${position.y}) placement validation: ${validation.isValid ? 'VALID' : 'INVALID'} - ${validation.reasons?.join(', ') || 'no reasons'}`);
        
        if (!validation.isValid) {
          // Try to find a nearby valid position
          console.log(`[PatternSuggestion] Searching for nearby valid position...`);
          const nearbyValid = this.findNearbyValidPosition(position, beaconType, minDistance * 2);
          if (nearbyValid) {
            console.log(`[PatternSuggestion] Found nearby valid position: (${nearbyValid.x},${nearbyValid.y}) - moved ${Math.sqrt((nearbyValid.x - position.x) ** 2 + (nearbyValid.y - position.y) ** 2).toFixed(1)} units`);
            validPosition = nearbyValid;
          } else {
            console.log(`[PatternSuggestion] No nearby valid position found, keeping original`);
            validPosition = position;
          }
        }
      }
      
      validatedPositions.push(validPosition);
    }
    
    return this.validateAndFilterPositions(validatedPositions, beaconType);
  }

  /**
   * Calculate positions to complete a square from existing beacons
   */
  private calculateSquareCompletion(existingPositions: Point2D[], missing: number, minDistance: number): Point2D[] {
    if (existingPositions.length === 3 && missing === 1) {
      // Find the 4th corner of a square given 3 corners
      const [p1, p2, p3] = existingPositions;
      
      // Only log if this is a new calculation (avoid spam during map panning)
      const triangleKey = `${p1.x},${p1.y}|${p2.x},${p2.y}|${p3.x},${p3.y}`;
      const isNewCalculation = !this.lastTriangleKey || this.lastTriangleKey !== triangleKey;
      
      if (isNewCalculation) {
        console.log(`[PatternSuggestion] Square completion for triangle: P1(${p1.x},${p1.y}), P2(${p2.x},${p2.y}), P3(${p3.x},${p3.y})`);
        this.lastTriangleKey = triangleKey;
      }
      
      // Calculate potential 4th corners using parallelogram completion
      const candidates = [
        { x: p1.x + p3.x - p2.x, y: p1.y + p3.y - p2.y },
        { x: p2.x + p3.x - p1.x, y: p2.y + p3.y - p1.y },
        { x: p1.x + p2.x - p3.x, y: p1.y + p2.y - p3.y },
      ];
      
      if (isNewCalculation) {
        console.log(`[PatternSuggestion] Parallelogram candidates:`, candidates.map((c, i) => `${i + 1}: (${c.x},${c.y})`).join(', '));
      }
      
      // Validate each candidate using the same logic as pattern detection
      const validCandidates = candidates.filter((candidate, index) => {
        const testPoints = existingPositions.concat([candidate]);
        
        // Create temporary beacons for validation (just need positions and IDs)
        const tempBeacons: Beacon[] = testPoints.map((pos, idx) => ({
          id: `temp-${idx}`,
          position: pos,
          level: 1,
          type: 'pioneer',
          specialization: 'none',
          status: 'active',
          connections: [],
          createdAt: Date.now(),
          lastUpgraded: Date.now(),
          generationRate: 1.0,
          totalResourcesGenerated: 0,
        }));
        
        const beaconIds = tempBeacons.map(b => b.id);
        
        // Use the public detectSquare method which includes all validation
        const isValid = this.shapeDetector.detectSquare(tempBeacons, beaconIds, false);
        if (isNewCalculation) {
          console.log(`[PatternSuggestion] Candidate ${index + 1} (${candidate.x},${candidate.y}) validation: ${isValid ? 'VALID' : 'INVALID'}`);
        }
        return isValid;
      });
      
      // If we have valid candidates, pick the best one
      if (validCandidates.length > 0) {
        if (isNewCalculation) {
          console.log(`[PatternSuggestion] Found ${validCandidates.length} valid parallelogram candidates`);
        }
        let bestCandidate = validCandidates[0];
        let bestScore = -1;
        
        for (const candidate of validCandidates) {
          const score = this.evaluateSquareness(existingPositions.concat([candidate]));
          if (isNewCalculation) {
            console.log(`[PatternSuggestion] Candidate (${candidate.x},${candidate.y}) squareness score: ${score.toFixed(4)}`);
          }
          if (score > bestScore) {
            bestScore = score;
            bestCandidate = candidate;
          }
        }
        
        if (isNewCalculation) {
          console.log(`[PatternSuggestion] Selected best parallelogram candidate: (${bestCandidate.x},${bestCandidate.y}) with score ${bestScore.toFixed(4)}`);
        }
        return [bestCandidate];
      }
      
      // If no parallelogram candidates work, try alternative approaches
      console.log(`[PatternSuggestion] No valid parallelogram candidates, trying alternative approaches...`);
      const alternativeCandidates = this.generateAlternativeSquareCandidates(existingPositions, minDistance);
      console.log(`[PatternSuggestion] Generated ${alternativeCandidates.length} alternative candidates`);
      
      for (let i = 0; i < alternativeCandidates.length; i++) {
        const candidate = alternativeCandidates[i];
        const testPoints = existingPositions.concat([candidate]);
        
        // Create temporary beacons for validation
        const tempBeacons: Beacon[] = testPoints.map((pos, idx) => ({
          id: `temp-${idx}`,
          position: pos,
          level: 1,
          type: 'pioneer',
          specialization: 'none',
          status: 'active',
          connections: [],
          createdAt: Date.now(),
          lastUpgraded: Date.now(),
          generationRate: 1.0,
          totalResourcesGenerated: 0,
        }));
        
        const beaconIds = tempBeacons.map(b => b.id);
        
        const isValid = this.shapeDetector.detectSquare(tempBeacons, beaconIds, false);
        console.log(`[PatternSuggestion] Alternative candidate ${i + 1}/${alternativeCandidates.length} (${candidate.x.toFixed(1)},${candidate.y.toFixed(1)}) validation: ${isValid ? 'VALID' : 'INVALID'}`);
        
        if (isValid) {
          console.log(`[PatternSuggestion] Selected alternative candidate: (${candidate.x},${candidate.y})`);
          return [candidate];
        }
      }
    }
    
    // Fallback for other cases
    console.log(`[PatternSuggestion] No valid square candidates found, falling back to centroid method`);
    return this.calculateCentroidBasedPositions(existingPositions, 'square', missing, minDistance);
  }

  /**
   * Generate alternative square candidates using different geometric approaches
   */
  private generateAlternativeSquareCandidates(existingPositions: Point2D[], minDistance: number): Point2D[] {
    const candidates: Point2D[] = [];
    const [p1, p2, p3] = existingPositions;
    
    // Method 1: Try different distances based on existing side lengths
    const distances = [
      this.geometryUtils.distance(p1, p2),
      this.geometryUtils.distance(p2, p3), 
      this.geometryUtils.distance(p3, p1)
    ];
    const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
    
    // Try positions at the average distance from each point
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4; // 8 directions around each point
      
      candidates.push({
        x: p1.x + avgDistance * Math.cos(angle),
        y: p1.y + avgDistance * Math.sin(angle)
      });
      
      candidates.push({
        x: p2.x + avgDistance * Math.cos(angle),
        y: p2.y + avgDistance * Math.sin(angle)
      });
      
      candidates.push({
        x: p3.x + avgDistance * Math.cos(angle),
        y: p3.y + avgDistance * Math.sin(angle)
      });
    }
    
    // Method 2: Try perpendicular extensions from each side's midpoint
    const midpoints = [
      { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 },
      { x: (p2.x + p3.x) / 2, y: (p2.y + p3.y) / 2 },
      { x: (p3.x + p1.x) / 2, y: (p3.y + p1.y) / 2 }
    ];
    
    const perpVectors = [
      { x: -(p2.y - p1.y), y: p2.x - p1.x }, // perpendicular to p1-p2
      { x: -(p3.y - p2.y), y: p3.x - p2.x }, // perpendicular to p2-p3  
      { x: -(p1.y - p3.y), y: p1.x - p3.x }  // perpendicular to p3-p1
    ];
    
    for (let i = 0; i < 3; i++) {
      const len = Math.sqrt(perpVectors[i].x ** 2 + perpVectors[i].y ** 2);
      if (len > 0) {
        const normalized = { x: perpVectors[i].x / len, y: perpVectors[i].y / len };
        
        // Try both directions from midpoint
        candidates.push({
          x: midpoints[i].x + normalized.x * avgDistance,
          y: midpoints[i].y + normalized.y * avgDistance
        });
        
        candidates.push({
          x: midpoints[i].x - normalized.x * avgDistance,
          y: midpoints[i].y - normalized.y * avgDistance
        });
      }
    }
    
    return candidates;
  }

  /**
   * Calculate positions to complete a triangle from existing beacons
   */
  private calculateTriangleCompletion(existingPositions: Point2D[], missing: number, minDistance: number): Point2D[] {
    if (existingPositions.length === 2 && missing === 1) {
      // Complete equilateral triangle given 2 points
      const [p1, p2] = existingPositions;
      const distance = this.geometryUtils.distance(p1, p2);
      
      // Calculate the third point of an equilateral triangle
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      
      const height = Math.sqrt(3) * distance / 2;
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      
      const perpX = -dy / len;
      const perpY = dx / len;
      
      const p3 = {
        x: midX + perpX * height,
        y: midY + perpY * height,
      };
      
      return [p3];
    }
    
    // Fallback for other cases
    return this.calculateCentroidBasedPositions(existingPositions, 'triangle', missing, minDistance);
  }

  /**
   * Fallback centroid-based position calculation
   */
  private calculateCentroidBasedPositions(existingPositions: Point2D[], patternType: PatternType, missing: number, minDistance: number): Point2D[] {
    const center = calculateCentroid(existingPositions.map(pos => ({ position: pos }) as Beacon));
    const safeRadius = Math.max(minDistance * 1.5, 120);
    const missingPositions: Point2D[] = [];
    
    for (let i = 0; i < missing; i++) {
      const angle = (i / missing) * 2 * Math.PI;
      missingPositions.push({
        x: center.x + safeRadius * Math.cos(angle),
        y: center.y + safeRadius * Math.sin(angle),
      });
    }
    
    return missingPositions;
  }

  /**
   * Evaluate how square-like a set of 4 points are
   */
  private evaluateSquareness(points: Point2D[]): number {
    if (points.length !== 4) return 0;
    
    // Calculate all pairwise distances
    const distances: number[] = [];
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        distances.push(this.geometryUtils.distance(points[i], points[j]));
      }
    }
    
    distances.sort((a, b) => a - b);
    
    // In a perfect square, we should have 4 equal sides and 2 equal diagonals
    // distances[0-3] should be equal (sides), distances[4-5] should be equal (diagonals)
    const avgSideLength = (distances[0] + distances[1] + distances[2] + distances[3]) / 4;
    const avgDiagonalLength = (distances[4] + distances[5]) / 2;
    
    // Check side uniformity
    const sideVariance = distances.slice(0, 4).reduce((sum, d) => sum + Math.pow(d - avgSideLength, 2), 0) / 4;
    
    // Check if diagonals are sqrt(2) times the sides
    const expectedDiagonal = avgSideLength * Math.sqrt(2);
    const diagonalError = Math.abs(avgDiagonalLength - expectedDiagonal) / expectedDiagonal;
    
    // Score based on how close it is to a perfect square
    const uniformityScore = 1 / (1 + sideVariance / (avgSideLength * avgSideLength));
    const proportionScore = 1 / (1 + diagonalError);
    
    return uniformityScore * proportionScore;
  }

  /**
   * Get the most common beacon type from a group of beacons
   */
  private getMostCommonBeaconType(beacons: Beacon[]): BeaconType {
    if (beacons.length === 0) return 'pioneer';
    
    const typeCounts: Record<BeaconType, number> = {
      pioneer: 0,
      harvester: 0,
      architect: 0,
    };
    
    beacons.forEach(beacon => {
      if (beacon.type && typeCounts.hasOwnProperty(beacon.type)) {
        typeCounts[beacon.type]++;
      }
    });
    
    // Return the type with the highest count, defaulting to pioneer
    const mostCommonType = Object.entries(typeCounts).reduce((a, b) => 
      typeCounts[a[0] as BeaconType] > typeCounts[b[0] as BeaconType] ? a : b
    )[0] as BeaconType;
    
    return mostCommonType;
  }

  /**
   * Find a nearby valid position for beacon placement
   */
  private findNearbyValidPosition(originalPosition: Point2D, beaconType: BeaconType, searchRadius: number): Point2D | null {
    if (!this.placementValidator) return null;
    
    console.log(`[PatternSuggestion] Finding nearby valid position for (${originalPosition.x},${originalPosition.y})`);
    const attempts = 8; // Try 8 directions around the original position
    const minDistance = BEACON_PLACEMENT_CONFIG.MINIMUM_DISTANCE[beaconType];
    
    for (let i = 0; i < attempts; i++) {
      const angle = (i / attempts) * 2 * Math.PI;
      const offsetDistance = minDistance * 0.5; // Small offset to find valid position
      
      const candidatePosition = {
        x: originalPosition.x + offsetDistance * Math.cos(angle),
        y: originalPosition.y + offsetDistance * Math.sin(angle),
      };
      
      const validation = this.placementValidator.isValidPosition(candidatePosition, beaconType);
      console.log(`[PatternSuggestion] Nearby candidate ${i + 1}/8 (${candidatePosition.x.toFixed(1)},${candidatePosition.y.toFixed(1)}) at angle ${(angle * 180 / Math.PI).toFixed(0)}°: ${validation.isValid ? 'VALID' : 'INVALID'} - ${validation.reasons?.join(', ') || 'no reasons'}`);
      
      if (validation.isValid) {
        console.log(`[PatternSuggestion] Found valid nearby position after ${i + 1} attempts`);
        return candidatePosition;
      }
    }
    
    console.log(`[PatternSuggestion] No valid nearby position found after ${attempts} attempts`);
    return null;
  }

  /**
   * Validate and filter positions to ensure they meet minimum distance requirements
   */
  private validateAndFilterPositions(positions: Point2D[], beaconType: BeaconType): Point2D[] {
    if (!this.placementValidator) return positions;
    
    return positions.filter(position => {
      const validation = this.placementValidator!.isValidPosition(position, beaconType);
      return validation.isValid;
    });
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
  
  private calculateFeasibilityScore(positions: Point2D[], existingBeacons: Beacon[], beaconType: BeaconType = 'pioneer'): number {
    let score = 1;
    const minDistance = BEACON_PLACEMENT_CONFIG.MINIMUM_DISTANCE[beaconType];
    
    for (const position of positions) {
      // Check if position is too close to existing beacons using proper minimum distance
      const tooClose = existingBeacons.some(beacon => 
        this.geometryUtils.distance(position, beacon.position) < minDistance
      );
      
      if (tooClose) score *= 0.3; // Heavily penalize positions that are too close
      
      // Additional validation if we have a placement validator
      if (this.placementValidator) {
        const validation = this.placementValidator.isValidPosition(position, beaconType);
        if (!validation.isValid) {
          score *= 0.2; // Heavily penalize invalid positions
        }
      }
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