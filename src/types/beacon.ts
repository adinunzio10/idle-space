import { Point2D } from './galaxy';

export type BeaconType = 'pioneer' | 'harvester' | 'architect';
export type BeaconSpecialization =
  | 'none'
  | 'efficiency'
  | 'range'
  | 'stability';
export type BeaconStatus = 'active' | 'inactive' | 'upgrading' | 'corrupted';

export interface BeaconSpecializationBonus {
  efficiency: number; // Resource generation multiplier
  range: number; // Connection range multiplier
  stability: number; // Pattern bonus multiplier
}

export interface BeaconStats {
  baseGenerationRate: number;
  connectionRange: number;
  maxConnections: number;
  upgradeCost: number;
  level: number;
}

export interface BeaconEntity {
  id: string;
  position: Point2D;
  level: number;
  type: BeaconType;
  specialization: BeaconSpecialization;
  status: BeaconStatus;
  connections: string[];
  generationRate: number;
  createdAt: number;
  lastUpgraded: number;
  totalResourcesGenerated: number;
  upgradePendingAt?: number;
}

export interface BeaconUpgradeOption {
  type: BeaconSpecialization;
  name: string;
  description: string;
  bonus: BeaconSpecializationBonus;
  icon: string;
}

export interface BeaconPlacementInfo {
  position: Point2D;
  type: BeaconType;
  isValid: boolean;
  validationReasons: string[];
  estimatedConnections: string[];
  territoryRadius: number;
}

export interface BeaconValidationResult {
  isValid: boolean;
  reasons: string[];
  minDistanceViolation?: {
    nearestBeacon: string;
    distance: number;
    minimumRequired: number;
  };
  outOfBounds?: {
    x: boolean;
    y: boolean;
  };
}

export const BEACON_TYPE_CONFIG: Record<BeaconType, BeaconStats> = {
  pioneer: {
    baseGenerationRate: 1.0,
    connectionRange: 150,
    maxConnections: 3,
    upgradeCost: 50,
    level: 1,
  },
  harvester: {
    baseGenerationRate: 1.5,
    connectionRange: 120,
    maxConnections: 4,
    upgradeCost: 75,
    level: 1,
  },
  architect: {
    baseGenerationRate: 0.8,
    connectionRange: 200,
    maxConnections: 6,
    upgradeCost: 100,
    level: 1,
  },
};

export const SPECIALIZATION_CONFIG: Record<
  BeaconSpecialization,
  BeaconSpecializationBonus
> = {
  none: {
    efficiency: 1.0,
    range: 1.0,
    stability: 1.0,
  },
  efficiency: {
    efficiency: 1.25, // +25% resource generation
    range: 1.0,
    stability: 1.0,
  },
  range: {
    efficiency: 1.0,
    range: 1.5, // +50% connection range
    stability: 1.0,
  },
  stability: {
    efficiency: 1.0,
    range: 1.0,
    stability: 2.0, // +100% pattern bonus multiplier
  },
};

export const SPECIALIZATION_OPTIONS: BeaconUpgradeOption[] = [
  {
    type: 'efficiency',
    name: 'Quantum Efficiency',
    description: '+25% resource generation rate',
    bonus: SPECIALIZATION_CONFIG.efficiency,
    icon: '⚡',
  },
  {
    type: 'range',
    name: 'Signal Amplifier',
    description: '+50% connection range',
    bonus: SPECIALIZATION_CONFIG.range,
    icon: '📡',
  },
  {
    type: 'stability',
    name: 'Pattern Stabilizer',
    description: '+100% geometric pattern bonus',
    bonus: SPECIALIZATION_CONFIG.stability,
    icon: '🔷',
  },
];

export const BEACON_PLACEMENT_CONFIG = {
  MINIMUM_DISTANCE: {
    pioneer: 80,
    harvester: 60,
    architect: 100,
  },
  AUTO_LEVEL_INTERVAL: 5, // Levels between specialization choices
  MAX_LEVEL: 50,
  TERRITORY_RADIUS_MULTIPLIER: 1.2,
};
