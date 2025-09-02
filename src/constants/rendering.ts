export const RENDERING_CONFIG = {
  // LOD (Level of Detail) thresholds
  LOD_LEVELS: {
    FULL_DETAIL: 2.0, // zoom > 2.0 - full animations and effects
    STANDARD: 0.5, // zoom 0.5-2.0 - static icons
    SIMPLIFIED: 0.1, // zoom 0.1-0.5 - simple shapes
    CLUSTERING: 0.1, // zoom < 0.1 - cluster beacons
  },

  // Performance thresholds
  PERFORMANCE: {
    MAX_VISIBLE_BEACONS: 500,
    CLUSTERING_DENSITY_THRESHOLD: 0.001, // beacons per square unit
    CLUSTER_MIN_SIZE: 3,
    CLUSTER_MAX_DISTANCE: 100,
  },

  // Visual settings
  BEACON_SIZES: {
    FULL: 24,
    STANDARD: 16,
    SIMPLIFIED: 8,
    CLUSTER: 32,
  },

  // Colors for different beacon types
  BEACON_COLORS: {
    pioneer: {
      primary: '#4F46E5',
      glow: '#6366F1',
      secondary: '#818CF8',
    },
    harvester: {
      primary: '#10B981',
      glow: '#34D399',
      secondary: '#6EE7B7',
    },
    architect: {
      primary: '#7C3AED',
      glow: '#8B5CF6',
      secondary: '#A78BFA',
    },
  },

  // Animation settings
  ANIMATIONS: {
    PULSE_DURATION: 2000,
    GLOW_OPACITY: 0.6,
    TRANSITION_DURATION: 300,
    LEVEL_UP_SCALE: 1.5,
  },

  // Touch interaction
  INTERACTION: {
    HIT_RADIUS_BASE: 20,
    HIT_RADIUS_MIN: 15,
    HIT_RADIUS_MAX: 40,
  },
} as const;

export type BeaconType = keyof typeof RENDERING_CONFIG.BEACON_COLORS;

export interface LODLevel {
  level: number;
  name: string;
  minZoom: number;
  maxZoom: number;
  renderMode: 'full' | 'standard' | 'simplified' | 'clustered';
}

export const LOD_LEVELS: LODLevel[] = [
  {
    level: 0,
    name: 'Full Detail',
    minZoom: RENDERING_CONFIG.LOD_LEVELS.FULL_DETAIL,
    maxZoom: Infinity,
    renderMode: 'full',
  },
  {
    level: 1,
    name: 'Standard',
    minZoom: RENDERING_CONFIG.LOD_LEVELS.STANDARD,
    maxZoom: RENDERING_CONFIG.LOD_LEVELS.FULL_DETAIL,
    renderMode: 'standard',
  },
  {
    level: 2,
    name: 'Simplified',
    minZoom: RENDERING_CONFIG.LOD_LEVELS.SIMPLIFIED,
    maxZoom: RENDERING_CONFIG.LOD_LEVELS.STANDARD,
    renderMode: 'simplified',
  },
  {
    level: 3,
    name: 'Clustered',
    minZoom: 0,
    maxZoom: RENDERING_CONFIG.LOD_LEVELS.CLUSTERING,
    renderMode: 'clustered',
  },
];
