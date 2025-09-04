/**
 * GameController Extensions for Living Galactic Environment
 * 
 * Extends the game controller to manage star system states, entropy progression,
 * and integrate resource collection with existing Stellar Essence and Void
 * Fragments systems from resource management.
 */

import { StarSystem, GalacticSector } from '../../types/galaxy';

export interface GalacticEnvironmentState {
  /** All star systems in the galaxy */
  starSystems: Map<string, StarSystem>;
  /** All galactic sectors */
  sectors: Map<string, GalacticSector>;
  /** Resources collected from the galactic environment */
  environmentResources: {
    stellarEssence: number;
    voidFragments: number;
    totalHarvested: {
      stellarEssence: number;
      voidFragments: number;
    };
  };
  /** Entropy statistics */
  entropyStats: {
    averageEntropy: number;
    highEntropySectors: number;
    criticalEntropySectors: number;
    lastEntropyUpdate: number;
  };
  /** Star system statistics */
  starSystemStats: {
    healthyStars: number;
    dyingStars: number;
    deadStars: number;
    totalStars: number;
    harvestableStars: number;
  };
  /** Performance metrics */
  performanceMetrics: {
    renderingLoad: number;
    entropySimulationLoad: number;
    lastUpdateTime: number;
    fps: number;
  };
}

export interface ResourceHarvestEvent {
  starSystemId: string;
  resourceType: 'stellarEssence' | 'voidFragments';
  amount: number;
  timestamp: number;
  playerPosition?: { x: number; y: number };
}

export interface StarSystemStateChangeEvent {
  starSystemId: string;
  oldState: 'healthy' | 'dying' | 'dead';
  newState: 'healthy' | 'dying' | 'dead';
  cause: 'entropy' | 'player_action' | 'natural_progression' | 'cascade';
  timestamp: number;
}

export interface EntropyProgressionEvent {
  sectorId: string;
  oldEntropy: number;
  newEntropy: number;
  cause: 'spreading' | 'decay' | 'player_action' | 'cascade';
  timestamp: number;
}

/**
 * GameController extension for managing galactic environment
 */
export class GalacticEnvironmentController {
  private state: GalacticEnvironmentState;
  private eventHistory: Array<ResourceHarvestEvent | StarSystemStateChangeEvent | EntropyProgressionEvent>;
  private updateInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  // Event callbacks
  private onStateChangeCallback?: (state: GalacticEnvironmentState) => void;
  private onResourceHarvestCallback?: (event: ResourceHarvestEvent) => void;
  private onStarSystemChangeCallback?: (event: StarSystemStateChangeEvent) => void;
  private onEntropyProgressionCallback?: (event: EntropyProgressionEvent) => void;

  constructor(
    initialStarSystems: StarSystem[] = [],
    initialSectors: GalacticSector[] = []
  ) {
    this.state = {
      starSystems: new Map(initialStarSystems.map(s => [s.id, s])),
      sectors: new Map(initialSectors.map(s => [s.id, s])),
      environmentResources: {
        stellarEssence: 0,
        voidFragments: 0,
        totalHarvested: {
          stellarEssence: 0,
          voidFragments: 0,
        },
      },
      entropyStats: {
        averageEntropy: 0,
        highEntropySectors: 0,
        criticalEntropySectors: 0,
        lastEntropyUpdate: Date.now(),
      },
      starSystemStats: {
        healthyStars: 0,
        dyingStars: 0,
        deadStars: 0,
        totalStars: initialStarSystems.length,
        harvestableStars: 0,
      },
      performanceMetrics: {
        renderingLoad: 0,
        entropySimulationLoad: 0,
        lastUpdateTime: Date.now(),
        fps: 60,
      },
    };

    this.eventHistory = [];
    this.updateStatistics();
  }

  /**
   * Start the game controller update loop
   */
  public start(updateIntervalMs: number = 1000): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.updateInterval = setInterval(() => {
      this.update();
    }, updateIntervalMs);
  }

  /**
   * Stop the game controller
   */
  public stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Main update loop
   */
  private update(): void {
    const now = Date.now();
    const deltaTime = (now - this.state.performanceMetrics.lastUpdateTime) / 1000;

    // Update entropy progression (simplified)
    this.updateEntropyProgression(deltaTime);

    // Update star system states based on entropy
    this.updateStarSystemStates(deltaTime);

    // Update statistics
    this.updateStatistics();

    // Update performance metrics
    this.state.performanceMetrics.lastUpdateTime = now;

    // Emit state change event
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback(this.getState());
    }
  }

  /**
   * Update entropy progression for all sectors
   */
  private updateEntropyProgression(deltaTime: number): void {
    const entropySpreadRate = 0.001; // Base entropy spread rate

    this.state.sectors.forEach(sector => {
      const oldEntropy = sector.entropy;
      
      // Simple entropy progression (in real implementation, use EntropySpreadManager)
      let entropyChange = 0;

      // Find neighboring sectors with higher entropy
      for (const neighborId of sector.neighboringSectors) {
        const neighbor = this.state.sectors.get(neighborId);
        if (neighbor && neighbor.entropy > sector.entropy + 0.1) {
          entropyChange += (neighbor.entropy - sector.entropy) * entropySpreadRate * deltaTime;
        }
      }

      // Natural entropy decay
      if (sector.entropy > 0.1) {
        entropyChange -= sector.entropy * 0.0005 * deltaTime; // Natural decay
      }

      const newEntropy = Math.max(0, Math.min(1, sector.entropy + entropyChange));
      
      if (Math.abs(newEntropy - oldEntropy) > 0.01) {
        sector.entropy = newEntropy;
        sector.lastEntropyUpdate = Date.now();

        // Emit entropy progression event
        const event: EntropyProgressionEvent = {
          sectorId: sector.id,
          oldEntropy,
          newEntropy,
          cause: entropyChange > 0 ? 'spreading' : 'decay',
          timestamp: Date.now(),
        };

        this.eventHistory.push(event);
        
        if (this.onEntropyProgressionCallback) {
          this.onEntropyProgressionCallback(event);
        }
      }
    });
  }

  /**
   * Update star system states based on entropy
   */
  private updateStarSystemStates(deltaTime: number): void {
    this.state.starSystems.forEach(starSystem => {
      // Find the sector containing this star system
      const containingSector = Array.from(this.state.sectors.values())
        .find(sector => sector.starSystemIds.includes(starSystem.id));

      if (!containingSector) return;

      const oldState = starSystem.state;
      let newState = oldState;

      // State transitions based on sector entropy
      if (oldState === 'healthy' && containingSector.entropy > 0.7) {
        newState = 'dying';
        // Add stellar essence resources
        starSystem.resources = {
          stellarEssence: Math.floor(Math.random() * 40 + 10)
        };
      } else if (oldState === 'dying' && containingSector.entropy > 0.9) {
        newState = 'dead';
        // Convert to void fragments
        starSystem.resources = {
          voidFragments: Math.floor(Math.random() * 20 + 5)
        };
        starSystem.brightness = Math.max(0.1, starSystem.brightness * 0.3);
      }

      // Natural progression over time (even without entropy)
      const timeSinceLastChange = Date.now() - (starSystem.lastStateChange || 0);
      const naturalProgressionTime = 5 * 60 * 1000; // 5 minutes

      if (timeSinceLastChange > naturalProgressionTime && Math.random() < 0.1 * deltaTime) {
        if (oldState === 'healthy' && Math.random() < 0.3) {
          newState = 'dying';
          starSystem.resources = {
            stellarEssence: Math.floor(Math.random() * 30 + 5)
          };
        }
      }

      if (newState !== oldState) {
        starSystem.state = newState;
        starSystem.lastStateChange = Date.now();

        // Emit star system change event
        const event: StarSystemStateChangeEvent = {
          starSystemId: starSystem.id,
          oldState,
          newState,
          cause: containingSector.entropy > 0.8 ? 'entropy' : 'natural_progression',
          timestamp: Date.now(),
        };

        this.eventHistory.push(event);

        if (this.onStarSystemChangeCallback) {
          this.onStarSystemChangeCallback(event);
        }
      }

      // Update star system entropy to match sector
      starSystem.entropy = Math.min(1, starSystem.entropy + (containingSector.entropy - starSystem.entropy) * 0.1);
    });
  }

  /**
   * Handle resource harvest from UI
   */
  public harvestResource(
    starSystemId: string,
    resourceType: 'stellarEssence' | 'voidFragments',
    amount: number,
    playerPosition?: { x: number; y: number }
  ): boolean {
    const starSystem = this.state.starSystems.get(starSystemId);
    if (!starSystem || !starSystem.resources) return false;

    // Check if resource is available
    const availableAmount = resourceType === 'stellarEssence' 
      ? starSystem.resources.stellarEssence || 0
      : starSystem.resources.voidFragments || 0;

    if (availableAmount < amount) return false;

    // Deduct resource from star system
    if (resourceType === 'stellarEssence') {
      starSystem.resources.stellarEssence = (starSystem.resources.stellarEssence || 0) - amount;
    } else {
      starSystem.resources.voidFragments = (starSystem.resources.voidFragments || 0) - amount;
    }

    // Add to player's resources
    this.state.environmentResources[resourceType] += amount;
    this.state.environmentResources.totalHarvested[resourceType] += amount;

    // Create harvest event
    const event: ResourceHarvestEvent = {
      starSystemId,
      resourceType,
      amount,
      timestamp: Date.now(),
      playerPosition,
    };

    this.eventHistory.push(event);

    if (this.onResourceHarvestCallback) {
      this.onResourceHarvestCallback(event);
    }

    // Update statistics
    this.updateStatistics();

    return true;
  }

  /**
   * Update all statistics
   */
  private updateStatistics(): void {
    // Update entropy statistics
    const sectors = Array.from(this.state.sectors.values());
    const totalEntropy = sectors.reduce((sum, s) => sum + s.entropy, 0);
    
    this.state.entropyStats = {
      averageEntropy: sectors.length > 0 ? totalEntropy / sectors.length : 0,
      highEntropySectors: sectors.filter(s => s.entropy > 0.7).length,
      criticalEntropySectors: sectors.filter(s => s.entropy > 0.9).length,
      lastEntropyUpdate: Date.now(),
    };

    // Update star system statistics
    const starSystems = Array.from(this.state.starSystems.values());
    const healthyStars = starSystems.filter(s => s.state === 'healthy').length;
    const dyingStars = starSystems.filter(s => s.state === 'dying').length;
    const deadStars = starSystems.filter(s => s.state === 'dead').length;
    const harvestableStars = starSystems.filter(s => 
      (s.state === 'dying' && s.resources?.stellarEssence && s.resources.stellarEssence > 0) ||
      (s.state === 'dead' && s.resources?.voidFragments && s.resources.voidFragments > 0)
    ).length;

    this.state.starSystemStats = {
      healthyStars,
      dyingStars,
      deadStars,
      totalStars: starSystems.length,
      harvestableStars,
    };

    // Update performance metrics (simplified)
    this.state.performanceMetrics.renderingLoad = Math.min(1, 
      (starSystems.length + sectors.length) / 1000
    );
    this.state.performanceMetrics.entropySimulationLoad = Math.min(1,
      sectors.filter(s => s.entropy > 0.5).length / 50
    );
  }

  /**
   * Get current game state
   */
  public getState(): GalacticEnvironmentState {
    return JSON.parse(JSON.stringify(this.state)); // Deep copy
  }

  /**
   * Get star systems
   */
  public getStarSystems(): StarSystem[] {
    return Array.from(this.state.starSystems.values());
  }

  /**
   * Get sectors
   */
  public getSectors(): GalacticSector[] {
    return Array.from(this.state.sectors.values());
  }

  /**
   * Get recent events
   */
  public getRecentEvents(timeWindowMs: number = 60000): Array<ResourceHarvestEvent | StarSystemStateChangeEvent | EntropyProgressionEvent> {
    const cutoff = Date.now() - timeWindowMs;
    return this.eventHistory.filter(event => event.timestamp > cutoff);
  }

  /**
   * Add new star systems (for dynamic generation)
   */
  public addStarSystems(starSystems: StarSystem[]): void {
    starSystems.forEach(starSystem => {
      this.state.starSystems.set(starSystem.id, starSystem);
    });
    this.updateStatistics();
  }

  /**
   * Add new sectors (for dynamic generation)
   */
  public addSectors(sectors: GalacticSector[]): void {
    sectors.forEach(sector => {
      this.state.sectors.set(sector.id, sector);
    });
    this.updateStatistics();
  }

  /**
   * Manually trigger entropy increase (for special events)
   */
  public increaseSectorEntropy(sectorId: string, amount: number): boolean {
    const sector = this.state.sectors.get(sectorId);
    if (!sector) return false;

    const oldEntropy = sector.entropy;
    sector.entropy = Math.min(1, sector.entropy + amount);
    sector.lastEntropyUpdate = Date.now();

    const event: EntropyProgressionEvent = {
      sectorId,
      oldEntropy,
      newEntropy: sector.entropy,
      cause: 'player_action',
      timestamp: Date.now(),
    };

    this.eventHistory.push(event);

    if (this.onEntropyProgressionCallback) {
      this.onEntropyProgressionCallback(event);
    }

    return true;
  }

  /**
   * Save/load functionality for persistence
   */
  public saveState(): string {
    return JSON.stringify({
      starSystems: Array.from(this.state.starSystems.entries()),
      sectors: Array.from(this.state.sectors.entries()),
      environmentResources: this.state.environmentResources,
      timestamp: Date.now(),
    });
  }

  public loadState(saveData: string): boolean {
    try {
      const data = JSON.parse(saveData);
      
      this.state.starSystems = new Map(data.starSystems);
      this.state.sectors = new Map(data.sectors);
      this.state.environmentResources = data.environmentResources || {
        stellarEssence: 0,
        voidFragments: 0,
        totalHarvested: { stellarEssence: 0, voidFragments: 0 },
      };
      
      this.updateStatistics();
      return true;
    } catch (error) {
      console.error('Failed to load galactic environment state:', error);
      return false;
    }
  }

  /**
   * Set event callbacks
   */
  public setStateChangeCallback(callback: (state: GalacticEnvironmentState) => void): void {
    this.onStateChangeCallback = callback;
  }

  public setResourceHarvestCallback(callback: (event: ResourceHarvestEvent) => void): void {
    this.onResourceHarvestCallback = callback;
  }

  public setStarSystemChangeCallback(callback: (event: StarSystemStateChangeEvent) => void): void {
    this.onStarSystemChangeCallback = callback;
  }

  public setEntropyProgressionCallback(callback: (event: EntropyProgressionEvent) => void): void {
    this.onEntropyProgressionCallback = callback;
  }

  /**
   * Cleanup
   */
  public dispose(): void {
    this.stop();
    this.eventHistory = [];
    this.state.starSystems.clear();
    this.state.sectors.clear();
  }
}

/**
 * Integration utilities for existing GameController
 */
export function integrateWithExistingGameController(
  existingController: any,
  galacticController: GalacticEnvironmentController
): void {
  // Set up resource harvest integration
  galacticController.setResourceHarvestCallback((event) => {
    // Add resources to existing game state
    if (existingController.addResource) {
      existingController.addResource(event.resourceType, event.amount);
    }
  });

  // Set up periodic sync
  setInterval(() => {
    const galacticState = galacticController.getState();
    
    // Sync with existing resource system
    if (existingController.syncResources) {
      existingController.syncResources({
        stellarEssence: galacticState.environmentResources.stellarEssence,
        voidFragments: galacticState.environmentResources.voidFragments,
      });
    }
  }, 5000); // Sync every 5 seconds
}

export default GalacticEnvironmentController;