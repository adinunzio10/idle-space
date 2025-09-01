import { 
  Beacon, 
  GeometricPattern, 
  PatternType, 
  Connection 
} from '../../types/galaxy';
import { 
  findCycles, 
  validateGeometricPattern, 
  calculateCentroid,
  isTriangle,
  isSquare,
  isPentagon,
  isHexagon,
  distance,
  sortPointsClockwise
} from './geometry';
import { GeometryUtils } from './GeometryUtils';
import { TriangulationEngine } from './TriangulationEngine';
import { PatternBonusCalculator } from './PatternBonusCalculator';
import { SpatialHashMap } from '../spatial/SpatialHashMap';
import { SpatialIndex } from '../spatial/indexing';
import { SpatialPatternCache } from './SpatialPatternCache';
import { PatternSuggestionEngine } from './PatternSuggestionEngine';
import { PlacementValidator } from '../spatial/PlacementValidator';
import { GeometricTolerance, DEFAULT_TOLERANCE } from '../../types/geometry';
import { DelaunayResult } from '../../types/triangulation';
import { BonusCalculationResult } from '../../types/bonuses';
import {
  SpatialHashConfig,
  SpatialCacheConfig,
  PatternSuggestion,
  PatternCompletionAnalysis,
  SpatialOptimizationSettings,
} from '../../types/spatialHashing';
import { PATTERN_BONUSES } from '../../constants/connections';
import {
  DEFAULT_SPATIAL_HASH_CONFIG,
  DEFAULT_SPATIAL_CACHE_CONFIG,
  SPATIAL_OPTIMIZATION_PRESETS,
  SPATIAL_PERFORMANCE_THRESHOLDS,
  NEIGHBOR_QUERY_CONFIG,
} from '../../constants/spatialHashing';

/**
 * Enhanced shape detection algorithms with configurable tolerance and adaptive robustness.
 * 
 * This class provides improved geometric pattern detection for beacon networks, featuring:
 * - Adaptive tolerance based on beacon density
 * - Side length validation for all shapes
 * - Enhanced angle tolerance checking
 * - Geometric integrity validation for imperfect placements
 * 
 * @example
 * ```typescript
 * const detector = new ShapeDetector({ tolerance: { angle: 0.1 } });
 * const triangles = detector.detectTriangle(beacons, cycle);
 * ```
 */
export class ShapeDetector {
  private geometryUtils: GeometryUtils;
  private tolerance: GeometricTolerance;

  constructor(options: { 
    tolerance?: Partial<GeometricTolerance>;
    geometryUtils?: GeometryUtils;
  } = {}) {
    this.tolerance = { ...DEFAULT_TOLERANCE, ...options.tolerance };
    this.geometryUtils = options.geometryUtils || new GeometryUtils(this.tolerance);
  }

  /**
   * Detect and validate triangle formation with enhanced robustness.
   * 
   * @param beacons - All beacons in the network
   * @param beaconIds - IDs of beacons forming potential triangle
   * @param adaptiveTolerance - Whether to adjust tolerance based on beacon density
   * @returns True if beacons form a valid triangle
   */
  detectTriangle(
    beacons: Beacon[], 
    beaconIds: string[], 
    adaptiveTolerance: boolean = true
  ): boolean {
    if (beaconIds.length !== 3) return false;

    const beaconMap = new Map(beacons.map(b => [b.id, b]));
    const points = beaconIds
      .map(id => beaconMap.get(id)?.position)
      .filter((p): p is NonNullable<typeof p> => p !== undefined);

    if (points.length !== 3) return false;

    // Basic triangle validation using existing function
    if (!isTriangle(points)) return false;

    // Enhanced validation with side length consistency
    if (!this.validateSideLengthConsistency(points, 'triangle', adaptiveTolerance)) {
      return false;
    }

    // Enhanced angle validation
    return this.validateTriangleAngles(points, adaptiveTolerance);
  }

  /**
   * Detect and validate square formation with enhanced robustness.
   * 
   * @param beacons - All beacons in the network
   * @param beaconIds - IDs of beacons forming potential square
   * @param adaptiveTolerance - Whether to adjust tolerance based on beacon density
   * @returns True if beacons form a valid square
   */
  detectSquare(
    beacons: Beacon[], 
    beaconIds: string[], 
    adaptiveTolerance: boolean = true
  ): boolean {
    if (beaconIds.length !== 4) return false;

    const beaconMap = new Map(beacons.map(b => [b.id, b]));
    const points = beaconIds
      .map(id => beaconMap.get(id)?.position)
      .filter((p): p is NonNullable<typeof p> => p !== undefined);

    if (points.length !== 4) return false;

    // Basic square validation using existing function
    const tolerance = adaptiveTolerance ? this.getAdaptiveTolerance(beacons) : 0.3;
    if (!isSquare(points, tolerance)) return false;

    // Enhanced validation with more sophisticated checks
    return this.validateSquareGeometry(points, adaptiveTolerance);
  }

  /**
   * Detect and validate pentagon formation with enhanced robustness.
   * 
   * @param beacons - All beacons in the network
   * @param beaconIds - IDs of beacons forming potential pentagon
   * @param adaptiveTolerance - Whether to adjust tolerance based on beacon density
   * @returns True if beacons form a valid pentagon
   */
  detectPentagon(
    beacons: Beacon[], 
    beaconIds: string[], 
    adaptiveTolerance: boolean = true
  ): boolean {
    if (beaconIds.length !== 5) return false;

    const beaconMap = new Map(beacons.map(b => [b.id, b]));
    const points = beaconIds
      .map(id => beaconMap.get(id)?.position)
      .filter((p): p is NonNullable<typeof p> => p !== undefined);

    if (points.length !== 5) return false;

    // Basic pentagon validation using existing function
    const tolerance = adaptiveTolerance ? this.getAdaptiveTolerance(beacons) : 0.2;
    if (!isPentagon(points, tolerance)) return false;

    // Enhanced validation with side length consistency
    return this.validateSideLengthConsistency(points, 'pentagon', adaptiveTolerance);
  }

  /**
   * Detect and validate hexagon formation with enhanced robustness.
   * 
   * @param beacons - All beacons in the network
   * @param beaconIds - IDs of beacons forming potential hexagon
   * @param adaptiveTolerance - Whether to adjust tolerance based on beacon density
   * @returns True if beacons form a valid hexagon
   */
  detectHexagon(
    beacons: Beacon[], 
    beaconIds: string[], 
    adaptiveTolerance: boolean = true
  ): boolean {
    if (beaconIds.length !== 6) return false;

    const beaconMap = new Map(beacons.map(b => [b.id, b]));
    const points = beaconIds
      .map(id => beaconMap.get(id)?.position)
      .filter((p): p is NonNullable<typeof p> => p !== undefined);

    if (points.length !== 6) return false;

    // Basic hexagon validation using existing function
    const tolerance = adaptiveTolerance ? this.getAdaptiveTolerance(beacons) : 0.2;
    if (!isHexagon(points, tolerance)) return false;

    // Enhanced validation with side length consistency
    return this.validateSideLengthConsistency(points, 'hexagon', adaptiveTolerance);
  }

  /**
   * Calculate adaptive tolerance based on beacon network density.
   * 
   * @param beacons - All beacons in the network
   * @returns Adaptive tolerance value
   */
  private getAdaptiveTolerance(beacons: Beacon[]): number {
    if (beacons.length < 3) return 0.35; // High tolerance for sparse networks

    // Calculate average distance between beacons
    let totalDistance = 0;
    let pairCount = 0;

    for (let i = 0; i < Math.min(beacons.length, 20); i++) { // Sample first 20 beacons for performance
      for (let j = i + 1; j < Math.min(beacons.length, 20); j++) {
        totalDistance += distance(beacons[i].position, beacons[j].position);
        pairCount++;
      }
    }

    const avgDistance = totalDistance / pairCount;
    
    // Adaptive tolerance: higher for sparse networks, lower for dense networks
    if (avgDistance > 200) return 0.4; // Very sparse
    if (avgDistance > 100) return 0.3; // Sparse
    if (avgDistance > 50) return 0.2;  // Normal
    return 0.15; // Dense network - stricter validation
  }

  /**
   * Validate side length consistency for geometric shapes.
   * 
   * @param points - Points forming the shape
   * @param shapeType - Type of shape being validated
   * @param adaptiveTolerance - Whether to use adaptive tolerance
   * @returns True if side lengths are sufficiently consistent
   */
  private validateSideLengthConsistency(
    points: { x: number; y: number }[],
    shapeType: PatternType,
    adaptiveTolerance: boolean
  ): boolean {
    const sortedPoints = sortPointsClockwise(points);
    const sideLengths = [];
    
    // Calculate all side lengths
    for (let i = 0; i < sortedPoints.length; i++) {
      const nextIndex = (i + 1) % sortedPoints.length;
      sideLengths.push(distance(sortedPoints[i], sortedPoints[nextIndex]));
    }

    // For triangles, allow more variation in side lengths
    if (shapeType === 'triangle') {
      const minSide = Math.min(...sideLengths);
      const maxSide = Math.max(...sideLengths);
      const ratio = maxSide / minSide;
      return ratio < 3.0; // Allow reasonable variation
    }

    // For regular polygons, enforce stricter side length consistency
    const avgLength = sideLengths.reduce((sum, len) => sum + len, 0) / sideLengths.length;
    const tolerance = adaptiveTolerance ? this.getAdaptiveTolerance([]) : 0.25;
    
    return sideLengths.every(length => {
      const deviation = Math.abs(length - avgLength) / avgLength;
      return deviation <= tolerance;
    });
  }

  /**
   * Validate triangle angles for geometric integrity.
   * 
   * @param points - Triangle vertices
   * @param adaptiveTolerance - Whether to use adaptive tolerance
   * @returns True if angles form a valid triangle
   */
  private validateTriangleAngles(
    points: { x: number; y: number }[],
    adaptiveTolerance: boolean
  ): boolean {
    const [p1, p2, p3] = points;
    
    // Calculate all three angles
    const angle1 = this.geometryUtils.angleBetweenPoints(p2, p1, p3);
    const angle2 = this.geometryUtils.angleBetweenPoints(p1, p2, p3);
    const angle3 = this.geometryUtils.angleBetweenPoints(p1, p3, p2);
    
    const angleSum = angle1 + angle2 + angle3;
    const expectedSum = Math.PI;
    
    const tolerance = adaptiveTolerance ? this.tolerance.angle * 2 : this.tolerance.angle;
    
    // Validate angle sum equals π (within tolerance)
    return Math.abs(angleSum - expectedSum) <= tolerance;
  }

  /**
   * Validate square geometry with enhanced checks.
   * 
   * @param points - Square vertices
   * @param adaptiveTolerance - Whether to use adaptive tolerance
   * @returns True if geometry forms a valid square
   */
  private validateSquareGeometry(
    points: { x: number; y: number }[],
    adaptiveTolerance: boolean
  ): boolean {
    const sortedPoints = sortPointsClockwise(points);
    
    // Check diagonal lengths (should be equal and √2 times side length)
    const diagonal1 = distance(sortedPoints[0], sortedPoints[2]);
    const diagonal2 = distance(sortedPoints[1], sortedPoints[3]);
    const side = distance(sortedPoints[0], sortedPoints[1]);
    
    const expectedDiagonal = side * Math.sqrt(2);
    const tolerance = adaptiveTolerance ? this.getAdaptiveTolerance([]) : 0.35;
    
    const diagonal1Error = Math.abs(diagonal1 - expectedDiagonal) / expectedDiagonal;
    const diagonal2Error = Math.abs(diagonal2 - expectedDiagonal) / expectedDiagonal;
    const diagonalDifference = Math.abs(diagonal1 - diagonal2) / Math.max(diagonal1, diagonal2);
    
    return diagonal1Error <= tolerance && 
           diagonal2Error <= tolerance && 
           diagonalDifference <= tolerance;
  }

  /**
   * Update tolerance settings for the detector.
   * 
   * @param newTolerance - New tolerance settings
   */
  updateTolerance(newTolerance: Partial<GeometricTolerance>): void {
    this.tolerance = { ...this.tolerance, ...newTolerance };
    this.geometryUtils.setTolerance(this.tolerance);
  }

  /**
   * Get current tolerance settings.
   * 
   * @returns Current tolerance configuration
   */
  getTolerance(): GeometricTolerance {
    return { ...this.tolerance };
  }
}

/**
 * Detect all geometric patterns in a beacon network
 */
export function detectPatterns(
  beacons: Beacon[],
  connections: Connection[]
): GeometricPattern[] {
  const patterns: GeometricPattern[] = [];
  
  // Find patterns for each type
  patterns.push(...detectTriangles(beacons));
  patterns.push(...detectSquares(beacons));
  patterns.push(...detectPentagons(beacons));
  patterns.push(...detectHexagons(beacons));
  
  // Associate connections with patterns
  const enrichedPatterns = patterns.map(pattern => 
    enrichPatternWithConnections(pattern, connections)
  );
  
  return enrichedPatterns;
}

// Global shape detector instance for backward compatibility
const defaultShapeDetector = new ShapeDetector();

/**
 * Detect triangle patterns with enhanced validation
 */
function detectTriangles(beacons: Beacon[]): GeometricPattern[] {
  const triangleCycles = findCycles(beacons, 3, 50); // Limit to 50 triangles for performance
  const patterns: GeometricPattern[] = [];
  
  for (const cycle of triangleCycles) {
    // Use enhanced ShapeDetector for validation
    if (defaultShapeDetector.detectTriangle(beacons, cycle)) {
      const pattern = createPattern(cycle, beacons, 'triangle');
      if (pattern) {
        patterns.push(pattern);
      }
    }
  }
  
  return patterns;
}

/**
 * Detect square patterns with enhanced validation
 */
function detectSquares(beacons: Beacon[]): GeometricPattern[] {
  const squareCycles = findCycles(beacons, 4, 30); // Limit to 30 squares
  const patterns: GeometricPattern[] = [];
  
  for (const cycle of squareCycles) {
    // Use enhanced ShapeDetector for validation
    if (defaultShapeDetector.detectSquare(beacons, cycle)) {
      const pattern = createPattern(cycle, beacons, 'square');
      if (pattern) {
        patterns.push(pattern);
      }
    }
  }
  
  return patterns;
}

/**
 * Detect pentagon patterns with enhanced validation
 */
function detectPentagons(beacons: Beacon[]): GeometricPattern[] {
  const pentagonCycles = findCycles(beacons, 5, 20); // Limit to 20 pentagons
  const patterns: GeometricPattern[] = [];
  
  for (const cycle of pentagonCycles) {
    // Use enhanced ShapeDetector for validation
    if (defaultShapeDetector.detectPentagon(beacons, cycle)) {
      const pattern = createPattern(cycle, beacons, 'pentagon');
      if (pattern) {
        patterns.push(pattern);
      }
    }
  }
  
  return patterns;
}

/**
 * Detect hexagon patterns with enhanced validation
 */
function detectHexagons(beacons: Beacon[]): GeometricPattern[] {
  const hexagonCycles = findCycles(beacons, 6, 10); // Limit to 10 hexagons
  const patterns: GeometricPattern[] = [];
  
  for (const cycle of hexagonCycles) {
    // Use enhanced ShapeDetector for validation
    if (defaultShapeDetector.detectHexagon(beacons, cycle)) {
      const pattern = createPattern(cycle, beacons, 'hexagon');
      if (pattern) {
        patterns.push(pattern);
      }
    }
  }
  
  return patterns;
}

/**
 * Create a geometric pattern from a cycle of beacons
 */
function createPattern(
  beaconIds: string[],
  beacons: Beacon[],
  type: PatternType
): GeometricPattern | null {
  const beaconMap = new Map(beacons.map(b => [b.id, b]));
  const patternBeacons = beaconIds
    .map(id => beaconMap.get(id))
    .filter((b): b is Beacon => b !== undefined);
  
  if (patternBeacons.length !== beaconIds.length) {
    return null; // Some beacons not found
  }
  
  const center = calculateCentroid(patternBeacons);
  const bonus = PATTERN_BONUSES[type];
  
  // Generate unique pattern ID
  const sortedIds = [...beaconIds].sort();
  const patternId = `${type}_${sortedIds.join('_')}`;
  
  return {
    id: patternId,
    type,
    beaconIds: [...beaconIds],
    connectionIds: [], // Will be filled in enrichPatternWithConnections
    center,
    bonus,
    isComplete: true, // All patterns found by cycle detection are complete
  };
}

/**
 * Associate connections with a pattern
 */
function enrichPatternWithConnections(
  pattern: GeometricPattern,
  connections: Connection[]
): GeometricPattern {
  const patternConnections: string[] = [];
  
  // Find connections between beacons in this pattern
  for (let i = 0; i < pattern.beaconIds.length; i++) {
    const currentBeacon = pattern.beaconIds[i];
    const nextBeacon = pattern.beaconIds[(i + 1) % pattern.beaconIds.length];
    
    // Find connection between current and next beacon
    const connection = connections.find(conn => 
      (conn.sourceId === currentBeacon && conn.targetId === nextBeacon) ||
      (conn.sourceId === nextBeacon && conn.targetId === currentBeacon)
    );
    
    if (connection) {
      patternConnections.push(connection.id);
    }
  }
  
  return {
    ...pattern,
    connectionIds: patternConnections,
  };
}

/**
 * Update connections with their pattern memberships
 */
export function updateConnectionPatterns(
  connections: Connection[],
  patterns: GeometricPattern[]
): Connection[] {
  // Create a map of connection ID to patterns it belongs to
  const connectionPatternMap = new Map<string, PatternType[]>();
  
  for (const pattern of patterns) {
    for (const connectionId of pattern.connectionIds) {
      if (!connectionPatternMap.has(connectionId)) {
        connectionPatternMap.set(connectionId, []);
      }
      connectionPatternMap.get(connectionId)!.push(pattern.type);
    }
  }
  
  // Update connections with their pattern information
  return connections.map(connection => ({
    ...connection,
    patterns: connectionPatternMap.get(connection.id) || [],
  }));
}

/**
 * Build connections array from beacon network
 */
export function buildConnectionsFromBeacons(beacons: Beacon[]): Connection[] {
  const connections: Connection[] = [];
  const processedPairs = new Set<string>();
  
  for (const beacon of beacons) {
    for (const connectedId of beacon.connections) {
      // Create a consistent pair key to avoid duplicates
      const pairKey = [beacon.id, connectedId].sort().join('|');
      
      if (!processedPairs.has(pairKey)) {
        processedPairs.add(pairKey);
        
        const connection: Connection = {
          id: `${beacon.id}_${connectedId}`,
          sourceId: beacon.id,
          targetId: connectedId,
          strength: calculateConnectionStrength(beacon, connectedId, beacons),
          isActive: Math.random() > 0.3, // 70% chance of being active (placeholder logic)
          patterns: [], // Will be filled by pattern detection
        };
        
        connections.push(connection);
      }
    }
  }
  
  return connections;
}

/**
 * Calculate connection strength between two beacons
 */
function calculateConnectionStrength(
  sourceBeacon: Beacon,
  targetId: string,
  beacons: Beacon[]
): number {
  const targetBeacon = beacons.find(b => b.id === targetId);
  if (!targetBeacon) return 1;
  
  // Base strength on beacon levels and types
  let strength = Math.min(sourceBeacon.level, targetBeacon.level);
  
  // Bonus for architect connections (they have longer range)
  if (sourceBeacon.type === 'architect' || targetBeacon.type === 'architect') {
    strength += 1;
  }
  
  // Bonus for harvester-pioneer connections (good synergy)
  if ((sourceBeacon.type === 'harvester' && targetBeacon.type === 'pioneer') ||
      (sourceBeacon.type === 'pioneer' && targetBeacon.type === 'harvester')) {
    strength += 1;
  }
  
  // Clamp to valid range
  return Math.max(1, Math.min(5, strength));
}

/**
 * Performance-optimized pattern detection with spatial hashing, caching, and pattern suggestions
 */
export class PatternDetector {
  private cachedPatterns: Map<string, GeometricPattern[]> = new Map();
  private cachedTriangulation: Map<string, DelaunayResult> = new Map();
  private cachedBonusResults: Map<string, BonusCalculationResult> = new Map();
  private lastBeaconHash: string = '';
  private triangulationEngine: TriangulationEngine;
  private bonusCalculator: PatternBonusCalculator;
  
  // Spatial optimization components
  private spatialHash: SpatialHashMap;
  private patternCache: SpatialPatternCache;
  private suggestionEngine: PatternSuggestionEngine;
  private optimizationSettings: SpatialOptimizationSettings;

  constructor(
    triangulationOptions?: any, 
    bonusOptions?: any,
    spatialHashConfig?: Partial<SpatialHashConfig>,
    spatialCacheConfig?: Partial<SpatialCacheConfig>,
    optimizationSettings?: Partial<SpatialOptimizationSettings>,
    placementValidator?: PlacementValidator,
    spatialIndex?: SpatialIndex
  ) {
    this.triangulationEngine = new TriangulationEngine(triangulationOptions);
    this.bonusCalculator = new PatternBonusCalculator(bonusOptions);
    
    // Initialize spatial optimization components
    this.optimizationSettings = {
      ...SPATIAL_OPTIMIZATION_PRESETS.balanced,
      ...optimizationSettings,
    };
    
    if (this.optimizationSettings.enableSpatialHashing) {
      this.spatialHash = new SpatialHashMap({
        ...DEFAULT_SPATIAL_HASH_CONFIG,
        ...spatialHashConfig,
      });
    } else {
      this.spatialHash = new SpatialHashMap(); // Fallback
    }
    
    if (this.optimizationSettings.enablePatternCache) {
      this.patternCache = new SpatialPatternCache({
        ...DEFAULT_SPATIAL_CACHE_CONFIG,
        ...spatialCacheConfig,
      });
    } else {
      this.patternCache = new SpatialPatternCache(); // Fallback
    }
    
    this.suggestionEngine = new PatternSuggestionEngine(this.spatialHash, DEFAULT_TOLERANCE, placementValidator, spatialIndex);
  }
  
  /**
   * Detect patterns with spatial hashing optimization and caching
   */
  detectPatternsOptimized(beacons: Beacon[], connections: Connection[]): GeometricPattern[] {
    const startTime = performance.now();
    const beaconHash = this.hashBeacons(beacons);
    
    // Update spatial hash with current beacons
    this.updateSpatialHash(beacons);
    
    // Check pattern cache first
    if (this.optimizationSettings.enablePatternCache) {
      const cachedPatterns = this.getCachedPatternsForBeacons(beacons);
      if (cachedPatterns.length > 0) {
        return cachedPatterns;
      }
    }
    
    // Return cached result if beacons haven't changed
    if (beaconHash === this.lastBeaconHash && this.cachedPatterns.has(beaconHash)) {
      const cachedResult = this.cachedPatterns.get(beaconHash)!;
      return cachedResult;
    }
    
    let patterns: GeometricPattern[];
    
    // Choose detection strategy based on beacon count and settings
    if (beacons.length > SPATIAL_PERFORMANCE_THRESHOLDS.HIGH_DENSITY_THRESHOLD) {
      // Use spatial hashing for very large networks
      patterns = this.detectPatternsWithSpatialHashing(beacons, connections);
    } else if (beacons.length > 50) {
      // Use triangulation for medium networks
      patterns = this.detectPatternsWithTriangulation(beacons, connections, beaconHash);
    } else {
      // Use direct detection for small networks
      patterns = detectPatterns(beacons, connections);
    }
    
    // Cache results
    this.cachePatternResults(beaconHash, patterns, beacons);
    
    this.lastBeaconHash = beaconHash;
    
    // Clean old cache entries
    this.cleanupCaches();
    
    const detectionTime = performance.now() - startTime;
    if (this.optimizationSettings.debugMode) {
      console.log(`Pattern detection took ${detectionTime.toFixed(2)}ms for ${beacons.length} beacons (${patterns.length} patterns found)`);
    }
    
    return patterns;
  }

  /**
   * Detect patterns using spatial hashing for O(1) neighbor lookups
   */
  private detectPatternsWithSpatialHashing(beacons: Beacon[], connections: Connection[]): GeometricPattern[] {
    const patterns: GeometricPattern[] = [];
    const processedCombinations = new Set<string>();
    
    // Use spatial hash to find neighbors efficiently
    for (const beacon of beacons) {
      // Get neighbors within pattern detection radius
      const neighbors = this.spatialHash.findNeighbors(beacon.position, {
        radius: NEIGHBOR_QUERY_CONFIG.DEFAULT_RADIUS,
        maxResults: NEIGHBOR_QUERY_CONFIG.MAX_NEIGHBORS,
      });
      
      // Find patterns starting from this beacon
      const localPatterns = this.findPatternsFromNeighbors(
        beacon, 
        neighbors.map(n => beacons.find(b => b.id === n.beacon.id)!).filter(Boolean),
        beacons,
        processedCombinations
      );
      
      patterns.push(...localPatterns);
      
      // Stop if we've found too many patterns (performance limit)
      if (patterns.length > SPATIAL_PERFORMANCE_THRESHOLDS.CACHE_AGGRESSIVE_THRESHOLD) {
        break;
      }
    }
    
    // Associate connections with patterns
    return patterns.map(pattern => 
      enrichPatternWithConnections(pattern, connections)
    );
  }

  /**
   * Find patterns starting from a beacon using its spatial neighbors
   */
  private findPatternsFromNeighbors(
    centerBeacon: Beacon,
    neighbors: Beacon[],
    allBeacons: Beacon[],
    processedCombinations: Set<string>
  ): GeometricPattern[] {
    const patterns: GeometricPattern[] = [];
    const beaconMap = new Map(allBeacons.map(b => [b.id, b]));
    
    // Try to form patterns with different numbers of neighbors
    for (let patternSize = 3; patternSize <= 6; patternSize++) {
      const combinations = this.generateCombinations(neighbors, patternSize - 1);
      
      for (const combination of combinations) {
        const patternBeacons = [centerBeacon, ...combination];
        const beaconIds = patternBeacons.map(b => b.id).sort();
        const combinationKey = beaconIds.join('|');
        
        if (processedCombinations.has(combinationKey)) continue;
        processedCombinations.add(combinationKey);
        
        // Try each pattern type for this combination
        for (const patternType of this.getPatternTypesForSize(patternSize)) {
          if (this.validatePattern(patternBeacons, patternType)) {
            const pattern = createPattern(beaconIds, allBeacons, patternType);
            if (pattern) {
              patterns.push(pattern);
            }
          }
        }
      }
    }
    
    return patterns;
  }

  /**
   * Detect patterns using Delaunay triangulation for large beacon networks
   */
  private detectPatternsWithTriangulation(
    beacons: Beacon[], 
    connections: Connection[], 
    beaconHash: string
  ): GeometricPattern[] {
    // Get or create triangulation
    let triangulationResult = this.cachedTriangulation.get(beaconHash);
    if (!triangulationResult) {
      triangulationResult = this.triangulationEngine.triangulate(beacons);
      this.cachedTriangulation.set(beaconHash, triangulationResult);
    }

    // Use triangulation neighbor map to find potential patterns more efficiently
    return this.detectPatternsFromNeighborMap(
      beacons, 
      connections, 
      triangulationResult.neighborMap
    );
  }

  /**
   * Detect patterns using pre-computed neighbor mapping from triangulation
   */
  private detectPatternsFromNeighborMap(
    beacons: Beacon[],
    connections: Connection[],
    neighborMap: Map<string, Set<string>>
  ): GeometricPattern[] {
    const patterns: GeometricPattern[] = [];
    
    // Create beacon lookup map
    const beaconMap = new Map(beacons.map(b => [b.id, b]));
    
    // Find patterns for each type using neighbor-based traversal
    patterns.push(...this.findTrianglesFromNeighbors(beaconMap, neighborMap));
    patterns.push(...this.findSquaresFromNeighbors(beaconMap, neighborMap));
    patterns.push(...this.findPentagonsFromNeighbors(beaconMap, neighborMap));
    patterns.push(...this.findHexagonsFromNeighbors(beaconMap, neighborMap));
    
    // Associate connections with patterns
    const enrichedPatterns = patterns.map(pattern => 
      enrichPatternWithConnections(pattern, connections)
    );
    
    return enrichedPatterns;
  }

  /**
   * Find triangular patterns using neighbor map traversal
   */
  private findTrianglesFromNeighbors(
    beaconMap: Map<string, Beacon>,
    neighborMap: Map<string, Set<string>>
  ): GeometricPattern[] {
    const patterns: GeometricPattern[] = [];
    const processedTriangles = new Set<string>();
    
    for (const [beaconId, neighbors] of neighborMap) {
      const neighborsArray = Array.from(neighbors);
      
      // Check all pairs of neighbors for triangles
      for (let i = 0; i < neighborsArray.length; i++) {
        for (let j = i + 1; j < neighborsArray.length; j++) {
          const neighbor1 = neighborsArray[i];
          const neighbor2 = neighborsArray[j];
          
          // Check if neighbor1 and neighbor2 are connected (forming triangle)
          if (neighborMap.get(neighbor1)?.has(neighbor2)) {
            const triangle = [beaconId, neighbor1, neighbor2].sort();
            const triangleKey = triangle.join('|');
            
            if (!processedTriangles.has(triangleKey)) {
              processedTriangles.add(triangleKey);
              
              // Validate triangle with enhanced detection
              if (defaultShapeDetector.detectTriangle(Array.from(beaconMap.values()), triangle)) {
                const pattern = createPattern(triangle, Array.from(beaconMap.values()), 'triangle');
                if (pattern) {
                  patterns.push(pattern);
                }
              }
            }
          }
        }
      }
    }
    
    return patterns.slice(0, 50); // Limit for performance
  }

  /**
   * Find square patterns using neighbor map traversal
   */
  private findSquaresFromNeighbors(
    beaconMap: Map<string, Beacon>,
    neighborMap: Map<string, Set<string>>
  ): GeometricPattern[] {
    const patterns: GeometricPattern[] = [];
    const processedSquares = new Set<string>();
    
    for (const [beaconId, neighbors] of neighborMap) {
      const neighborsArray = Array.from(neighbors);
      
      // Look for 4-cycles (squares) starting from this beacon
      for (const neighbor1 of neighborsArray) {
        const neighbor1Neighbors = neighborMap.get(neighbor1);
        if (!neighbor1Neighbors) continue;
        
        for (const neighbor2 of neighbor1Neighbors) {
          if (neighbor2 === beaconId) continue;
          
          const neighbor2Neighbors = neighborMap.get(neighbor2);
          if (!neighbor2Neighbors) continue;
          
          for (const neighbor3 of neighbor2Neighbors) {
            if (neighbor3 === neighbor1 || neighbor3 === beaconId) continue;
            
            // Check if neighbor3 connects back to beaconId (completing square)
            if (neighborMap.get(neighbor3)?.has(beaconId)) {
              const square = [beaconId, neighbor1, neighbor2, neighbor3].sort();
              const squareKey = square.join('|');
              
              if (!processedSquares.has(squareKey)) {
                processedSquares.add(squareKey);
                
                // Validate square with enhanced detection
                if (defaultShapeDetector.detectSquare(Array.from(beaconMap.values()), square)) {
                  const pattern = createPattern(square, Array.from(beaconMap.values()), 'square');
                  if (pattern) {
                    patterns.push(pattern);
                  }
                }
              }
            }
          }
        }
      }
    }
    
    return patterns.slice(0, 30); // Limit for performance
  }

  /**
   * Find pentagon patterns using neighbor map traversal
   */
  private findPentagonsFromNeighbors(
    beaconMap: Map<string, Beacon>,
    neighborMap: Map<string, Set<string>>
  ): GeometricPattern[] {
    const patterns: GeometricPattern[] = [];
    // Simplified implementation - use existing cycle detection for now
    // Pentagon detection via neighbor traversal is complex and would need 5-cycle detection
    return patterns;
  }

  /**
   * Find hexagon patterns using neighbor map traversal  
   */
  private findHexagonsFromNeighbors(
    beaconMap: Map<string, Beacon>,
    neighborMap: Map<string, Set<string>>
  ): GeometricPattern[] {
    const patterns: GeometricPattern[] = [];
    // Simplified implementation - use existing cycle detection for now
    // Hexagon detection via neighbor traversal is complex and would need 6-cycle detection
    return patterns;
  }
  
  /**
   * Create a hash of beacon positions and connections for cache key
   */
  private hashBeacons(beacons: Beacon[]): string {
    const data = beacons.map(b => ({
      id: b.id,
      x: Math.round(b.position.x),
      y: Math.round(b.position.y),
      connections: [...b.connections].sort(),
    }));
    
    return JSON.stringify(data);
  }
  
  /**
   * Calculate bonuses for detected patterns with caching.
   * 
   * @param patterns - Detected patterns
   * @param beacons - All beacons in network
   * @returns Bonus calculation result
   */
  calculatePatternBonuses(
    patterns: GeometricPattern[],
    beacons: Beacon[]
  ): BonusCalculationResult {
    const beaconHash = this.hashBeacons(beacons);
    
    // Check cache first
    const cached = this.cachedBonusResults.get(beaconHash);
    if (cached) {
      return cached;
    }
    
    // Calculate bonuses
    const result = this.bonusCalculator.calculateTotalBonus(patterns, beacons);
    
    // Cache result
    this.cachedBonusResults.set(beaconHash, result);
    
    return result;
  }

  /**
   * Detect patterns and calculate bonuses in one operation.
   * 
   * @param beacons - All beacons in network
   * @param connections - All connections
   * @returns Combined pattern and bonus result
   */
  detectPatternsWithBonuses(
    beacons: Beacon[],
    connections: Connection[]
  ): { patterns: GeometricPattern[]; bonuses: BonusCalculationResult } {
    const patterns = this.detectPatternsOptimized(beacons, connections);
    const bonuses = this.calculatePatternBonuses(patterns, beacons);
    
    return { patterns, bonuses };
  }

  /**
   * Clear pattern, triangulation, and bonus caches
   */
  clearCache(): void {
    this.cachedPatterns.clear();
    this.cachedTriangulation.clear();
    this.cachedBonusResults.clear();
    this.lastBeaconHash = '';
  }

  /**
   * Get triangulation engine for advanced operations
   */
  getTriangulationEngine(): TriangulationEngine {
    return this.triangulationEngine;
  }

  /**
   * Get bonus calculator for configuration
   */
  getBonusCalculator(): PatternBonusCalculator {
    return this.bonusCalculator;
  }

  /**
   * Get cached triangulation result if available
   */
  getCachedTriangulation(beaconHash?: string): DelaunayResult | undefined {
    const hash = beaconHash || this.lastBeaconHash;
    return this.cachedTriangulation.get(hash);
  }

  /**
   * Get cached bonus result if available
   */
  getCachedBonusResult(beaconHash?: string): BonusCalculationResult | undefined {
    const hash = beaconHash || this.lastBeaconHash;
    return this.cachedBonusResults.get(hash);
  }

  /**
   * Get pattern suggestions using the integrated suggestion engine
   */
  getPatternSuggestions(
    beacons: Beacon[], 
    existingPatterns?: GeometricPattern[]
  ): PatternSuggestion[] {
    if (!this.optimizationSettings.enableSuggestions) {
      return [];
    }

    const analysis = this.suggestionEngine.analyzePatternOpportunities(
      beacons, 
      existingPatterns || this.detectPatternsOptimized(beacons, [])
    );
    
    return analysis.suggestedPositions;
  }

  /**
   * Get comprehensive pattern completion analysis
   */
  getPatternCompletionAnalysis(
    beacons: Beacon[],
    existingPatterns?: GeometricPattern[]
  ): PatternCompletionAnalysis {
    return this.suggestionEngine.analyzePatternOpportunities(
      beacons, 
      existingPatterns || this.detectPatternsOptimized(beacons, [])
    );
  }

  /**
   * Get strategic placement recommendations
   */
  getStrategicRecommendations(
    beacons: Beacon[],
    availableResources: number,
    gamePhase: 'early' | 'mid' | 'late' = 'mid'
  ): PatternSuggestion[] {
    if (!this.optimizationSettings.enableSuggestions) {
      return [];
    }

    return this.suggestionEngine.getStrategicRecommendations(
      beacons,
      availableResources,
      gamePhase
    );
  }

  /**
   * Update spatial hash with current beacon positions
   */
  private updateSpatialHash(beacons: Beacon[]): void {
    if (!this.optimizationSettings.enableSpatialHashing) return;
    
    // Clear and rebuild spatial hash
    this.spatialHash.clear();
    for (const beacon of beacons) {
      this.spatialHash.addBeacon(beacon);
    }
  }

  /**
   * Get cached patterns for current beacon set
   */
  private getCachedPatternsForBeacons(beacons: Beacon[]): GeometricPattern[] {
    // This is a simplified implementation - in practice, you'd query by spatial regions
    const allPatterns: GeometricPattern[] = [];
    
    // Calculate viewport bounds
    if (beacons.length === 0) return [];
    
    const minX = Math.min(...beacons.map(b => b.position.x)) - 100;
    const maxX = Math.max(...beacons.map(b => b.position.x)) + 100;
    const minY = Math.min(...beacons.map(b => b.position.y)) - 100;
    const maxY = Math.max(...beacons.map(b => b.position.y)) + 100;
    
    // Query patterns from cache by region
    const regionPatterns = this.patternCache.getPatternsByType('triangle', {
      minX, maxX, minY, maxY
    });
    
    return regionPatterns;
  }

  /**
   * Cache pattern results for future use
   */
  private cachePatternResults(
    beaconHash: string, 
    patterns: GeometricPattern[], 
    beacons: Beacon[]
  ): void {
    // Cache in memory
    this.cachedPatterns.set(beaconHash, patterns);
    
    // Cache in spatial cache if enabled
    if (this.optimizationSettings.enablePatternCache && patterns.length > 0) {
      // Calculate bounds for this pattern set
      const minX = Math.min(...beacons.map(b => b.position.x));
      const maxX = Math.max(...beacons.map(b => b.position.x));
      const minY = Math.min(...beacons.map(b => b.position.y));
      const maxY = Math.max(...beacons.map(b => b.position.y));
      
      const regionId = `${Math.floor(minX / 300)},${Math.floor(minY / 300)}`;
      this.patternCache.setRegionPatterns(regionId, patterns, {
        minX, maxX, minY, maxY
      });
    }
  }

  /**
   * Clean up old cache entries to prevent memory leaks
   */
  private cleanupCaches(): void {
    // Clean memory cache (keep only last 3)
    if (this.cachedPatterns.size > 3) {
      const oldestKey = this.cachedPatterns.keys().next().value;
      if (oldestKey) {
        this.cachedPatterns.delete(oldestKey);
        this.cachedTriangulation.delete(oldestKey);
        this.cachedBonusResults.delete(oldestKey);
      }
    }

    // Clean spatial cache periodically
    if (this.optimizationSettings.enablePatternCache) {
      // Run compact operation occasionally
      if (Math.random() < 0.1) { // 10% chance
        this.patternCache.compact();
      }
    }
  }

  /**
   * Generate combinations of beacons for pattern detection
   */
  private generateCombinations<T>(array: T[], size: number): T[][] {
    if (size > array.length || size <= 0) return [];
    if (size === array.length) return [array];
    if (size === 1) return array.map(item => [item]);
    
    const combinations: T[][] = [];
    const generate = (start: number, combo: T[]) => {
      if (combo.length === size) {
        combinations.push([...combo]);
        return;
      }
      
      for (let i = start; i <= array.length - (size - combo.length); i++) {
        combo.push(array[i]);
        generate(i + 1, combo);
        combo.pop();
      }
    };
    
    generate(0, []);
    return combinations.slice(0, 100); // Limit for performance
  }

  /**
   * Get pattern types that can be formed with a given number of beacons
   */
  private getPatternTypesForSize(size: number): PatternType[] {
    switch (size) {
      case 3: return ['triangle'];
      case 4: return ['square'];
      case 5: return ['pentagon'];
      case 6: return ['hexagon'];
      default: return [];
    }
  }

  /**
   * Validate that a set of beacons can form the specified pattern type
   */
  private validatePattern(beacons: Beacon[], patternType: PatternType): boolean {
    const positions = beacons.map(b => b.position);
    
    switch (patternType) {
      case 'triangle':
        return isTriangle(positions);
      case 'square':
        return isSquare(positions);
      case 'pentagon':
        return isPentagon(positions);
      case 'hexagon':
        return isHexagon(positions);
      default:
        return false;
    }
  }

  /**
   * Get spatial hash performance metrics
   */
  getSpatialMetrics() {
    return {
      spatialHash: this.spatialHash.getMetrics(),
      patternCache: this.patternCache.getStatistics(),
      optimizationSettings: this.optimizationSettings,
    };
  }

  /**
   * Clear all caches and reset optimization components
   */
  clearAllCaches(): void {
    this.cachedPatterns.clear();
    this.cachedTriangulation.clear();
    this.cachedBonusResults.clear();
    this.patternCache.clear();
    this.spatialHash.clear();
    this.suggestionEngine.clearCache();
    this.lastBeaconHash = '';
  }
}