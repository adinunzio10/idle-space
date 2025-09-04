/**
 * EntropySpreadManager - Cellular Automata Entropy Spreading System
 * 
 * Manages the spread of entropy across galactic sectors using cellular automata principles.
 * Entropy spreads from high-entropy sectors to adjacent low-entropy sectors over time,
 * creating dynamic galactic decay patterns that affect star system states.
 */

import { GalacticSector } from '../../types/galaxy';

export interface EntropySpreadConfig {
  /** Base rate of entropy spreading (0-1 per second) */
  baseSpreadRate: number;
  /** Minimum entropy difference required for spreading */
  spreadThreshold: number;
  /** Maximum entropy level that can be reached */
  maxEntropy: number;
  /** Natural entropy decay rate (entropy reduction over time) */
  naturalDecayRate: number;
  /** Distance factor for entropy spreading (closer = more influence) */
  distanceFactor: number;
  /** Random variance in entropy spreading (0-1) */
  randomVariance: number;
  /** Update frequency in milliseconds */
  updateInterval: number;
}

export interface EntropySpreadEvent {
  type: 'entropy_increase' | 'entropy_decrease' | 'entropy_cascade' | 'entropy_stabilize';
  sectorId: string;
  oldEntropy: number;
  newEntropy: number;
  timestamp: number;
  cause?: 'natural_spread' | 'neighbor_influence' | 'natural_decay' | 'player_action';
}

export interface EntropySpreadStatistics {
  totalEntropy: number;
  averageEntropy: number;
  highEntropyRegions: number;
  lowEntropyRegions: number;
  spreadEvents: number;
  cascadeEvents: number;
  stabilizedRegions: number;
  lastUpdateTime: number;
}

/**
 * Cellular automata rules for entropy spreading
 */
export interface CellularAutomataRule {
  name: string;
  condition: (sector: GalacticSector, neighbors: GalacticSector[], config: EntropySpreadConfig) => boolean;
  effect: (sector: GalacticSector, neighbors: GalacticSector[], config: EntropySpreadConfig) => number;
  priority: number; // Higher priority rules are applied first
}

/**
 * Built-in entropy spreading rules
 */
const DEFAULT_ENTROPY_RULES: CellularAutomataRule[] = [
  {
    name: 'high_entropy_cascade',
    priority: 10,
    condition: (sector, neighbors, config) => {
      return sector.entropy > 0.8 && neighbors.some(n => n.entropy < 0.5);
    },
    effect: (sector, neighbors, config) => {
      // High entropy sectors cascade to low entropy neighbors
      const lowEntropyNeighbors = neighbors.filter(n => n.entropy < sector.entropy - config.spreadThreshold);
      const cascadeStrength = lowEntropyNeighbors.length * config.baseSpreadRate * 2;
      return Math.min(config.maxEntropy, sector.entropy + cascadeStrength * 0.1);
    }
  },
  
  {
    name: 'neighbor_influence',
    priority: 5,
    condition: (sector, neighbors, config) => {
      const avgNeighborEntropy = neighbors.reduce((sum, n) => sum + n.entropy, 0) / neighbors.length;
      return Math.abs(avgNeighborEntropy - sector.entropy) > config.spreadThreshold;
    },
    effect: (sector, neighbors, config) => {
      const avgNeighborEntropy = neighbors.reduce((sum, n) => sum + n.entropy, 0) / neighbors.length;
      const influenceStrength = config.baseSpreadRate * 0.5;
      const entropyDelta = (avgNeighborEntropy - sector.entropy) * influenceStrength;
      return Math.max(0, Math.min(config.maxEntropy, sector.entropy + entropyDelta));
    }
  },
  
  {
    name: 'natural_decay',
    priority: 1,
    condition: (sector, neighbors, config) => {
      return sector.entropy > 0.1 && config.naturalDecayRate > 0;
    },
    effect: (sector, neighbors, config) => {
      // Natural entropy decay over time
      const decayAmount = config.naturalDecayRate * (sector.entropy * 0.5); // Higher entropy decays faster
      return Math.max(0, sector.entropy - decayAmount);
    }
  },
  
  {
    name: 'entropy_stabilization',
    priority: 3,
    condition: (sector, neighbors, config) => {
      // Stabilize entropy in regions with similar neighbor entropy
      const avgNeighborEntropy = neighbors.reduce((sum, n) => sum + n.entropy, 0) / neighbors.length;
      const variance = neighbors.reduce((sum, n) => sum + Math.pow(n.entropy - avgNeighborEntropy, 2), 0) / neighbors.length;
      return variance < 0.05; // Low variance = stable region
    },
    effect: (sector, neighbors, config) => {
      const avgNeighborEntropy = neighbors.reduce((sum, n) => sum + n.entropy, 0) / neighbors.length;
      const stabilizeRate = config.baseSpreadRate * 0.2;
      const entropyDelta = (avgNeighborEntropy - sector.entropy) * stabilizeRate;
      return Math.max(0, Math.min(config.maxEntropy, sector.entropy + entropyDelta));
    }
  }
];

/**
 * Simple seeded random number generator for consistent entropy spreading
 */
class SeededRandom {
  private seed: number;

  constructor(seed: number = Date.now()) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  nextGaussian(mean: number = 0, stdDev: number = 1): number {
    // Box-Muller transform for gaussian distribution
    const u1 = this.next();
    const u2 = this.next();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z0 * stdDev + mean;
  }
}

/**
 * Main entropy spreading manager using cellular automata
 */
export class EntropySpreadManager {
  private sectors: Map<string, GalacticSector>;
  private config: EntropySpreadConfig;
  private rules: CellularAutomataRule[];
  private eventHistory: EntropySpreadEvent[];
  private statistics: EntropySpreadStatistics;
  private random: SeededRandom;
  private lastUpdateTime: number = 0;
  private updateIntervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor(
    sectors: GalacticSector[],
    config?: Partial<EntropySpreadConfig>,
    customRules: CellularAutomataRule[] = []
  ) {
    this.sectors = new Map(sectors.map(s => [s.id, { ...s }]));
    this.config = {
      baseSpreadRate: 0.002,
      spreadThreshold: 0.1,
      maxEntropy: 1.0,
      naturalDecayRate: 0.001,
      distanceFactor: 0.5,
      randomVariance: 0.05,
      updateInterval: 1000, // 1 second
      ...config
    };
    
    // Combine default rules with custom rules, sorted by priority
    this.rules = [...DEFAULT_ENTROPY_RULES, ...customRules]
      .sort((a, b) => b.priority - a.priority);
    
    this.eventHistory = [];
    this.random = new SeededRandom();
    this.statistics = this.calculateStatistics();
  }

  /**
   * Start the entropy spreading simulation
   */
  public start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.lastUpdateTime = Date.now();
    
    this.updateIntervalId = setInterval(() => {
      this.updateEntropySpread();
    }, this.config.updateInterval);
  }

  /**
   * Stop the entropy spreading simulation
   */
  public stop(): void {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    
    if (this.updateIntervalId) {
      clearInterval(this.updateIntervalId);
      this.updateIntervalId = null;
    }
  }

  /**
   * Perform one update cycle of entropy spreading
   */
  public updateEntropySpread(): void {
    const now = Date.now();
    const deltaTime = (now - this.lastUpdateTime) / 1000; // Convert to seconds
    
    if (deltaTime <= 0) return;

    const newEntropyValues = new Map<string, number>();
    const events: EntropySpreadEvent[] = [];

    // Apply cellular automata rules to each sector
    this.sectors.forEach(sector => {
      const neighbors = this.getNeighboringSectors(sector);
      const oldEntropy = sector.entropy;
      let newEntropy = oldEntropy;
      let appliedRule: string | undefined;

      // Apply rules in priority order (first matching rule wins)
      for (const rule of this.rules) {
        if (rule.condition(sector, neighbors, this.config)) {
          newEntropy = rule.effect(sector, neighbors, this.config);
          appliedRule = rule.name;
          break;
        }
      }

      // Apply random variance
      if (this.config.randomVariance > 0) {
        const variance = this.random.nextGaussian(0, this.config.randomVariance);
        newEntropy = Math.max(0, Math.min(this.config.maxEntropy, newEntropy + variance));
      }

      // Scale entropy change by delta time
      const entropyChange = (newEntropy - oldEntropy) * deltaTime;
      newEntropy = Math.max(0, Math.min(this.config.maxEntropy, oldEntropy + entropyChange));
      
      newEntropyValues.set(sector.id, newEntropy);

      // Record significant entropy changes
      if (Math.abs(newEntropy - oldEntropy) > 0.01) {
        const eventType = this.determineEventType(oldEntropy, newEntropy, appliedRule);
        
        events.push({
          type: eventType,
          sectorId: sector.id,
          oldEntropy,
          newEntropy,
          timestamp: now,
          cause: this.mapRuleToCause(appliedRule)
        });
      }
    });

    // Apply new entropy values
    newEntropyValues.forEach((entropy, sectorId) => {
      const sector = this.sectors.get(sectorId);
      if (sector) {
        sector.entropy = entropy;
        sector.lastEntropyUpdate = now;
      }
    });

    // Update event history and statistics
    this.eventHistory.push(...events);
    this.trimEventHistory();
    this.statistics = this.calculateStatistics();
    this.lastUpdateTime = now;
  }

  /**
   * Get neighboring sectors for a given sector
   */
  private getNeighboringSectors(sector: GalacticSector): GalacticSector[] {
    const neighbors: GalacticSector[] = [];
    
    for (const neighborId of sector.neighboringSectors) {
      const neighbor = this.sectors.get(neighborId);
      if (neighbor) {
        neighbors.push(neighbor);
      }
    }
    
    return neighbors;
  }

  /**
   * Determine event type based on entropy change
   */
  private determineEventType(oldEntropy: number, newEntropy: number, appliedRule?: string): EntropySpreadEvent['type'] {
    const entropyChange = newEntropy - oldEntropy;
    
    if (Math.abs(entropyChange) < 0.02) {
      return 'entropy_stabilize';
    } else if (entropyChange > 0.1 || appliedRule === 'high_entropy_cascade') {
      return 'entropy_cascade';
    } else if (entropyChange > 0) {
      return 'entropy_increase';
    } else {
      return 'entropy_decrease';
    }
  }

  /**
   * Map rule name to cause
   */
  private mapRuleToCause(ruleName?: string): EntropySpreadEvent['cause'] {
    switch (ruleName) {
      case 'high_entropy_cascade':
      case 'neighbor_influence':
        return 'neighbor_influence';
      case 'natural_decay':
        return 'natural_decay';
      default:
        return 'natural_spread';
    }
  }

  /**
   * Trim event history to prevent memory growth
   */
  private trimEventHistory(): void {
    const maxEvents = 1000;
    if (this.eventHistory.length > maxEvents) {
      this.eventHistory = this.eventHistory.slice(-maxEvents);
    }
  }

  /**
   * Calculate current entropy statistics
   */
  private calculateStatistics(): EntropySpreadStatistics {
    const sectors = Array.from(this.sectors.values());
    const totalEntropy = sectors.reduce((sum, s) => sum + s.entropy, 0);
    const averageEntropy = totalEntropy / sectors.length;
    
    const highEntropyRegions = sectors.filter(s => s.entropy > 0.7).length;
    const lowEntropyRegions = sectors.filter(s => s.entropy < 0.3).length;
    
    // Count recent events
    const recentEvents = this.eventHistory.filter(e => Date.now() - e.timestamp < 60000); // Last minute
    const spreadEvents = recentEvents.filter(e => e.type === 'entropy_increase' || e.type === 'entropy_decrease').length;
    const cascadeEvents = recentEvents.filter(e => e.type === 'entropy_cascade').length;
    const stabilizedRegions = recentEvents.filter(e => e.type === 'entropy_stabilize').length;

    return {
      totalEntropy,
      averageEntropy,
      highEntropyRegions,
      lowEntropyRegions,
      spreadEvents,
      cascadeEvents,
      stabilizedRegions,
      lastUpdateTime: this.lastUpdateTime
    };
  }

  /**
   * Get updated sectors with current entropy values
   */
  public getUpdatedSectors(): GalacticSector[] {
    return Array.from(this.sectors.values());
  }

  /**
   * Get current entropy statistics
   */
  public getStatistics(): EntropySpreadStatistics {
    return { ...this.statistics };
  }

  /**
   * Get recent entropy events
   */
  public getRecentEvents(timeWindowMs: number = 60000): EntropySpreadEvent[] {
    const cutoff = Date.now() - timeWindowMs;
    return this.eventHistory.filter(event => event.timestamp > cutoff);
  }

  /**
   * Manually trigger entropy increase in a sector (for player actions)
   */
  public increaseSectorEntropy(sectorId: string, amount: number): boolean {
    const sector = this.sectors.get(sectorId);
    if (!sector) return false;

    const oldEntropy = sector.entropy;
    sector.entropy = Math.min(this.config.maxEntropy, oldEntropy + amount);
    sector.lastEntropyUpdate = Date.now();

    // Record the event
    this.eventHistory.push({
      type: 'entropy_increase',
      sectorId,
      oldEntropy,
      newEntropy: sector.entropy,
      timestamp: Date.now(),
      cause: 'player_action'
    });

    return true;
  }

  /**
   * Manually trigger entropy decrease in a sector (for player actions)
   */
  public decreaseSectorEntropy(sectorId: string, amount: number): boolean {
    const sector = this.sectors.get(sectorId);
    if (!sector) return false;

    const oldEntropy = sector.entropy;
    sector.entropy = Math.max(0, oldEntropy - amount);
    sector.lastEntropyUpdate = Date.now();

    // Record the event
    this.eventHistory.push({
      type: 'entropy_decrease',
      sectorId,
      oldEntropy,
      newEntropy: sector.entropy,
      timestamp: Date.now(),
      cause: 'player_action'
    });

    return true;
  }

  /**
   * Add custom entropy spreading rule
   */
  public addCustomRule(rule: CellularAutomataRule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<EntropySpreadConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart with new interval if it changed
    if (newConfig.updateInterval && this.isRunning) {
      this.stop();
      this.start();
    }
  }

  /**
   * Get sectors in entropy cascade danger (high entropy with low entropy neighbors)
   */
  public getCascadeDangerSectors(): GalacticSector[] {
    return Array.from(this.sectors.values()).filter(sector => {
      if (sector.entropy < 0.7) return false;
      
      const neighbors = this.getNeighboringSectors(sector);
      return neighbors.some(n => n.entropy < 0.3);
    });
  }

  /**
   * Predict entropy spread patterns (for strategic planning)
   */
  public predictEntropySpread(steps: number = 5): Map<string, number[]> {
    const predictions = new Map<string, number[]>();
    
    // Create a copy of current state
    const sectorCopies = new Map(this.sectors);
    
    // Simulate future steps
    for (let step = 0; step < steps; step++) {
      const newValues = new Map<string, number>();
      
      sectorCopies.forEach(sector => {
        const neighbors = sector.neighboringSectors
          .map(id => sectorCopies.get(id))
          .filter(n => n !== undefined) as GalacticSector[];
        
        let newEntropy = sector.entropy;
        
        // Apply simplified prediction rules
        for (const rule of this.rules) {
          if (rule.condition(sector, neighbors, this.config)) {
            newEntropy = rule.effect(sector, neighbors, this.config);
            break;
          }
        }
        
        newValues.set(sector.id, newEntropy);
        
        if (!predictions.has(sector.id)) {
          predictions.set(sector.id, []);
        }
        predictions.get(sector.id)!.push(newEntropy);
      });
      
      // Apply new values for next iteration
      newValues.forEach((entropy, sectorId) => {
        const sector = sectorCopies.get(sectorId);
        if (sector) {
          sector.entropy = entropy;
        }
      });
    }
    
    return predictions;
  }

  /**
   * Cleanup resources
   */
  public dispose(): void {
    this.stop();
    this.eventHistory = [];
    this.sectors.clear();
  }
}

/**
 * Create default entropy spread manager for galactic sectors
 */
export function createDefaultEntropySpreadManager(sectors: GalacticSector[]): EntropySpreadManager {
  const config: EntropySpreadConfig = {
    baseSpreadRate: 0.002,
    spreadThreshold: 0.1,
    maxEntropy: 1.0,
    naturalDecayRate: 0.001,
    distanceFactor: 0.5,
    randomVariance: 0.03,
    updateInterval: 2000, // 2 seconds for better performance
  };

  return new EntropySpreadManager(sectors, config);
}