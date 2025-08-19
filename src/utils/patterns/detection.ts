import { 
  Beacon, 
  GeometricPattern, 
  PatternType, 
  Connection 
} from '../../types/galaxy';
import { 
  findCycles, 
  validateGeometricPattern, 
  calculateCentroid 
} from './geometry';
import { PATTERN_BONUSES } from '../../constants/connections';

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

/**
 * Detect triangle patterns
 */
function detectTriangles(beacons: Beacon[]): GeometricPattern[] {
  const triangleCycles = findCycles(beacons, 3, 50); // Limit to 50 triangles for performance
  const patterns: GeometricPattern[] = [];
  
  for (const cycle of triangleCycles) {
    if (validateGeometricPattern(cycle, beacons, 'triangle')) {
      const pattern = createPattern(cycle, beacons, 'triangle');
      if (pattern) {
        patterns.push(pattern);
      }
    }
  }
  
  return patterns;
}

/**
 * Detect square patterns
 */
function detectSquares(beacons: Beacon[]): GeometricPattern[] {
  const squareCycles = findCycles(beacons, 4, 30); // Limit to 30 squares
  const patterns: GeometricPattern[] = [];
  
  for (const cycle of squareCycles) {
    if (validateGeometricPattern(cycle, beacons, 'square')) {
      const pattern = createPattern(cycle, beacons, 'square');
      if (pattern) {
        patterns.push(pattern);
      }
    }
  }
  
  return patterns;
}

/**
 * Detect pentagon patterns
 */
function detectPentagons(beacons: Beacon[]): GeometricPattern[] {
  const pentagonCycles = findCycles(beacons, 5, 20); // Limit to 20 pentagons
  const patterns: GeometricPattern[] = [];
  
  for (const cycle of pentagonCycles) {
    if (validateGeometricPattern(cycle, beacons, 'pentagon')) {
      const pattern = createPattern(cycle, beacons, 'pentagon');
      if (pattern) {
        patterns.push(pattern);
      }
    }
  }
  
  return patterns;
}

/**
 * Detect hexagon patterns
 */
function detectHexagons(beacons: Beacon[]): GeometricPattern[] {
  const hexagonCycles = findCycles(beacons, 6, 10); // Limit to 10 hexagons
  const patterns: GeometricPattern[] = [];
  
  for (const cycle of hexagonCycles) {
    if (validateGeometricPattern(cycle, beacons, 'hexagon')) {
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
 * Performance-optimized pattern detection with caching
 */
export class PatternDetector {
  private cachedPatterns: Map<string, GeometricPattern[]> = new Map();
  private lastBeaconHash: string = '';
  
  /**
   * Detect patterns with caching
   */
  detectPatternsOptimized(beacons: Beacon[], connections: Connection[]): GeometricPattern[] {
    const beaconHash = this.hashBeacons(beacons);
    
    // Return cached result if beacons haven't changed
    if (beaconHash === this.lastBeaconHash && this.cachedPatterns.has(beaconHash)) {
      return this.cachedPatterns.get(beaconHash)!;
    }
    
    // Detect patterns
    const patterns = detectPatterns(beacons, connections);
    
    // Cache result
    this.cachedPatterns.set(beaconHash, patterns);
    this.lastBeaconHash = beaconHash;
    
    // Clean old cache entries (keep only last 3)
    if (this.cachedPatterns.size > 3) {
      const oldestKey = this.cachedPatterns.keys().next().value;
      if (oldestKey) {
        this.cachedPatterns.delete(oldestKey);
      }
    }
    
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
   * Clear pattern cache
   */
  clearCache(): void {
    this.cachedPatterns.clear();
    this.lastBeaconHash = '';
  }
}