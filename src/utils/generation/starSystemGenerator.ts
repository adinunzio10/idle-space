/**
 * Star System Generation Utilities
 * 
 * Generates star systems with realistic distribution and states
 * for the living galactic environment system.
 */

import { Point2D, StarSystem, StarSystemState } from '../../types/galaxy';
import { 
  generateHierarchicalStarSystems,
  generateStarSystemPositions,
  SamplingBounds
} from '../spatial/poissonDisk';

export interface StarSystemGenerationConfig {
  /** Bounds for star system generation */
  bounds: SamplingBounds;
  /** Base density of star systems (points per 1000x1000 area) */
  density: number;
  /** Random seed for deterministic generation */
  seed?: number;
  /** State distribution probabilities */
  stateDistribution?: {
    healthy: number;
    dying: number;
    dead: number;
  };
  /** Size variation for star systems */
  sizeVariation?: {
    min: number;
    max: number;
    average: number;
  };
}

export interface GalaxyRegionConfig {
  /** Central core region with highest density */
  core: {
    bounds: SamplingBounds;
    density: number;
    healthyProbability: number;
  };
  /** Spiral arms with moderate density */
  arms: {
    regions: SamplingBounds[];
    density: number;
    dyingProbability: number;
  };
  /** Outer regions with lower density */
  outer: {
    bounds: SamplingBounds;
    density: number;
    deadProbability: number;
  };
}

/**
 * Simple seeded random number generator
 */
class SeededRandom {
  private seed: number;

  constructor(seed: number = Math.random()) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  nextInRange(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  choice<T>(array: T[], weights?: number[]): T {
    if (!weights) {
      return array[Math.floor(this.next() * array.length)];
    }
    
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    let random = this.next() * totalWeight;
    
    for (let i = 0; i < array.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return array[i];
      }
    }
    
    return array[array.length - 1];
  }
}

/**
 * Generate star systems with uniform distribution
 */
export function generateUniformStarSystems(
  config: StarSystemGenerationConfig
): StarSystem[] {
  const {
    bounds,
    density,
    seed = Math.random(),
    stateDistribution = { healthy: 0.6, dying: 0.3, dead: 0.1 },
    sizeVariation = { min: 2, max: 8, average: 5 }
  } = config;

  const random = new SeededRandom(seed);
  
  // Calculate minimum distance based on density
  const area = (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY);
  const targetCount = Math.floor((area / 1000000) * density);
  const minDistance = Math.sqrt(area / targetCount) * 0.8; // Allow some overlap
  
  // Generate positions using Poisson disk sampling
  const positions = generateStarSystemPositions(bounds, minDistance, seed);
  
  // Convert positions to star systems
  const starSystems: StarSystem[] = positions.map((position, index) => {
    // Determine state based on distribution
    const states: StarSystemState[] = ['healthy', 'dying', 'dead'];
    const weights = [
      stateDistribution.healthy,
      stateDistribution.dying,
      stateDistribution.dead
    ];
    const state = random.choice(states, weights);
    
    // Generate system properties
    const radius = random.nextInRange(sizeVariation.min, sizeVariation.max);
    const brightness = state === 'dead' 
      ? random.nextInRange(0.1, 0.3)
      : state === 'dying'
      ? random.nextInRange(0.7, 1.0)
      : random.nextInRange(0.4, 0.8);
    
    const entropy = state === 'dead' 
      ? random.nextInRange(0.8, 1.0)
      : state === 'dying'
      ? random.nextInRange(0.5, 0.8)
      : random.nextInRange(0.0, 0.3);

    // Generate resources for harvestable systems
    const resources = state === 'dying' 
      ? { stellarEssence: Math.floor(random.nextInRange(10, 50)) }
      : state === 'dead'
      ? { voidFragments: Math.floor(random.nextInRange(5, 25)) }
      : undefined;

    return {
      id: `star_${index}_${Math.floor(position.x)}_${Math.floor(position.y)}`,
      position,
      state,
      radius,
      brightness,
      entropy,
      resources,
      lastStateChange: Date.now() - random.nextInRange(0, 86400000) // Random age up to 1 day
    };
  });
  
  return starSystems;
}

/**
 * Generate star systems with realistic galactic structure
 */
export function generateGalacticStarSystems(
  galaxyConfig: GalaxyRegionConfig,
  seed?: number
): StarSystem[] {
  const random = new SeededRandom(seed);
  const allSystems: StarSystem[] = [];
  
  // Generate core region systems (highest density, mostly healthy)
  const coreConfig: StarSystemGenerationConfig = {
    bounds: galaxyConfig.core.bounds,
    density: galaxyConfig.core.density,
    seed: random.next() * 1000000,
    stateDistribution: {
      healthy: galaxyConfig.core.healthyProbability,
      dying: (1 - galaxyConfig.core.healthyProbability) * 0.7,
      dead: (1 - galaxyConfig.core.healthyProbability) * 0.3
    },
    sizeVariation: { min: 3, max: 10, average: 7 } // Larger stars in core
  };
  allSystems.push(...generateUniformStarSystems(coreConfig));
  
  // Generate spiral arm systems (moderate density, more dying stars)
  for (const armBounds of galaxyConfig.arms.regions) {
    const armConfig: StarSystemGenerationConfig = {
      bounds: armBounds,
      density: galaxyConfig.arms.density,
      seed: random.next() * 1000000,
      stateDistribution: {
        dying: galaxyConfig.arms.dyingProbability,
        healthy: (1 - galaxyConfig.arms.dyingProbability) * 0.6,
        dead: (1 - galaxyConfig.arms.dyingProbability) * 0.4
      },
      sizeVariation: { min: 2, max: 8, average: 5 } // Medium stars in arms
    };
    allSystems.push(...generateUniformStarSystems(armConfig));
  }
  
  // Generate outer region systems (low density, mostly dead)
  const outerConfig: StarSystemGenerationConfig = {
    bounds: galaxyConfig.outer.bounds,
    density: galaxyConfig.outer.density,
    seed: random.next() * 1000000,
    stateDistribution: {
      dead: galaxyConfig.outer.deadProbability,
      dying: (1 - galaxyConfig.outer.deadProbability) * 0.3,
      healthy: (1 - galaxyConfig.outer.deadProbability) * 0.7
    },
    sizeVariation: { min: 1, max: 6, average: 3 } // Smaller stars in outer regions
  };
  allSystems.push(...generateUniformStarSystems(outerConfig));
  
  return allSystems;
}

/**
 * Generate star systems for a specific viewport region (LOD-based)
 */
export function generateViewportStarSystems(
  viewportBounds: SamplingBounds,
  zoomLevel: number,
  seed?: number
): StarSystem[] {
  // Adjust density based on zoom level
  const baseDensity = 20; // Base systems per 1000x1000 area
  const scaledDensity = Math.max(5, baseDensity / Math.max(1, zoomLevel));
  
  const config: StarSystemGenerationConfig = {
    bounds: viewportBounds,
    density: scaledDensity,
    seed,
    stateDistribution: { healthy: 0.5, dying: 0.35, dead: 0.15 },
    sizeVariation: { min: 2, max: 6, average: 4 }
  };
  
  return generateUniformStarSystems(config);
}

/**
 * Update star system states based on entropy progression
 */
export function updateStarSystemStates(
  systems: StarSystem[],
  deltaTime: number,
  entropySpreadRate: number = 0.001
): StarSystem[] {
  return systems.map(system => {
    const newSystem = { ...system };
    
    // Increase entropy over time
    newSystem.entropy = Math.min(1, system.entropy + deltaTime * entropySpreadRate);
    
    // State transitions based on entropy
    if (system.state === 'healthy' && newSystem.entropy > 0.7) {
      newSystem.state = 'dying';
      newSystem.lastStateChange = Date.now();
      newSystem.resources = { stellarEssence: Math.floor(Math.random() * 40 + 10) };
    } else if (system.state === 'dying' && newSystem.entropy > 0.9) {
      newSystem.state = 'dead';
      newSystem.lastStateChange = Date.now();
      newSystem.resources = { voidFragments: Math.floor(Math.random() * 20 + 5) };
      newSystem.brightness = Math.max(0.1, newSystem.brightness * 0.3);
    }
    
    return newSystem;
  });
}

/**
 * Default galaxy configuration for 2000x2000 space
 */
export function getDefaultGalaxyConfig(): GalaxyRegionConfig {
  return {
    core: {
      bounds: { minX: 800, maxX: 1200, minY: 800, maxY: 1200 },
      density: 50,
      healthyProbability: 0.8
    },
    arms: {
      regions: [
        // Spiral arm regions (simplified as rectangles)
        { minX: 200, maxX: 800, minY: 400, maxY: 600 },
        { minX: 1200, maxX: 1800, minY: 400, maxY: 600 },
        { minX: 400, maxX: 600, minY: 200, maxY: 800 },
        { minX: 1400, maxX: 1600, minY: 1200, maxY: 1800 },
      ],
      density: 30,
      dyingProbability: 0.4
    },
    outer: {
      bounds: { minX: 0, maxX: 2000, minY: 0, maxY: 2000 },
      density: 15,
      deadProbability: 0.5
    }
  };
}