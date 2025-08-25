import { BeaconType } from '../types/beacon';

export const BEACON_CONSTANTS = {
  // Placement constraints
  PLACEMENT: {
    MINIMUM_DISTANCE: {
      pioneer: 80,
      harvester: 60,
      architect: 100,
    } as Record<BeaconType, number>,
    SAFE_MARGIN: 20,
    AUTO_LEVEL_INTERVAL: 5,
    MAX_LEVEL: 50,
    TERRITORY_RADIUS_MULTIPLIER: 1.2,
  },

  // Visual appearance
  VISUAL: {
    BASE_SIZE: 24,
    LEVEL_SIZE_MULTIPLIER: 0.1,
    GLOW_OPACITY: 0.4,
    CONNECTION_WIDTH: 2,
    TERRITORY_OPACITY: 0.1,
  },

  // Performance thresholds
  PERFORMANCE: {
    MAX_VISIBLE_BEACONS: 500,
    SPATIAL_INDEX_THRESHOLD: 100,
    CLUSTERING_THRESHOLD: 1000,
    LOD_DISTANCE_THRESHOLD: 200,
  },

  // Upgrade costs (base values, multiplied by level)
  COSTS: {
    UPGRADE_BASE: {
      pioneer: 50,
      harvester: 75,
      architect: 100,
    } as Record<BeaconType, number>,
    UPGRADE_MULTIPLIER: 1.5,
    PLACEMENT_COST: {
      pioneer: 100,
      harvester: 150,
      architect: 200,
    } as Record<BeaconType, number>,
  },

  // Generation rates
  GENERATION: {
    BASE_RATE: {
      pioneer: 1.0,
      harvester: 1.5,
      architect: 0.8,
    } as Record<BeaconType, number>,
    LEVEL_MULTIPLIER: 0.1, // 10% increase per level
    SPECIALIZATION_BONUS: {
      efficiency: 0.25, // 25% bonus
      range: 0.0, // No generation bonus
      stability: 0.0, // No generation bonus
    },
  },

  // Connection parameters
  CONNECTIONS: {
    BASE_RANGE: {
      pioneer: 150,
      harvester: 120,
      architect: 200,
    } as Record<BeaconType, number>,
    RANGE_PER_LEVEL: 5,
    MAX_CONNECTIONS: {
      pioneer: 3,
      harvester: 4,
      architect: 6,
    } as Record<BeaconType, number>,
    CONNECTIONS_PER_10_LEVELS: 1,
    SPECIALIZATION_RANGE_BONUS: 0.5, // 50% bonus for range specialization
  },

  // Colors for rendering
  COLORS: {
    pioneer: {
      primary: '#4F46E5', // Indigo
      secondary: '#7C3AED', // Purple
      glow: '#8B5CF6',
    },
    harvester: {
      primary: '#F59E0B', // Amber
      secondary: '#F97316', // Orange
      glow: '#FBA500',
    },
    architect: {
      primary: '#06B6D4', // Cyan
      secondary: '#0891B2', // Cyan-600
      glow: '#22D3EE',
    },
  },
};