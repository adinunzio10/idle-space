import BigNumber from 'bignumber.js';
import { ResourceType } from './resources';

export interface UpgradeCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
}

export interface UpgradeCost {
  [resource: string]: BigNumber;
}

export interface UpgradeEffect {
  type: UpgradeEffectType;
  target: string;
  value: BigNumber;
  multiplier?: BigNumber;
  description: string;
}

export type UpgradeEffectType =
  | 'beacon_efficiency'
  | 'probe_speed'
  | 'launch_capacity'
  | 'offline_earnings'
  | 'resource_generation'
  | 'beacon_range'
  | 'pattern_bonus';

export interface Upgrade {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  baseCost: UpgradeCost;
  costMultiplier: BigNumber;
  maxLevel: number;
  effects: UpgradeEffect[];
  unlockConditions: UpgradeUnlockCondition[];
  icon?: string;
  isMilestone?: boolean;
}

export interface UpgradeUnlockCondition {
  type: UnlockConditionType;
  target: string;
  value: BigNumber;
  description: string;
}

export type UnlockConditionType =
  | 'beacon_count'
  | 'pattern_discovered'
  | 'resource_earned'
  | 'achievement'
  | 'milestone_reached';

export interface PlayerUpgrade {
  upgradeId: string;
  level: number;
  purchasedAt: number;
  totalSpent: UpgradeCost;
}

export interface ConsciousnessExpansionMilestone {
  id: string;
  name: string;
  description: string;
  requiredBeacons: number;
  choices: MilestoneChoice[];
  completedAt?: number;
  chosenOption?: string;
}

export interface MilestoneChoice {
  id: string;
  name: string;
  description: string;
  effects: UpgradeEffect[];
  icon: string;
}

export interface UpgradePreview {
  upgrade: Upgrade;
  currentLevel: number;
  nextLevel: number;
  cost: UpgradeCost;
  canAfford: boolean;
  currentEffects: UpgradeEffect[];
  nextEffects: UpgradeEffect[];
  impactSummary: UpgradeImpact;
}

export interface UpgradeImpact {
  resourceGeneration: {
    [resourceType in ResourceType]?: {
      current: BigNumber;
      next: BigNumber;
      change: BigNumber;
      changePercentage: BigNumber;
    };
  };
  beaconEfficiency?: {
    current: BigNumber;
    next: BigNumber;
    change: BigNumber;
  };
  probeSpeed?: {
    current: BigNumber;
    next: BigNumber;
    change: BigNumber;
  };
  offlineEarnings?: {
    current: BigNumber;
    next: BigNumber;
    change: BigNumber;
  };
}

export const UPGRADE_CATEGORIES: Record<string, UpgradeCategory> = {
  beacon_efficiency: {
    id: 'beacon_efficiency',
    name: 'Beacon Efficiency',
    description: 'Improve beacon resource generation rates',
    icon: '📡',
    color: '#4F46E5',
  },
  probe_systems: {
    id: 'probe_systems',
    name: 'Probe Systems',
    description: 'Enhance probe speed and launch capabilities',
    icon: '🚀',
    color: '#7C3AED',
  },
  offline_processing: {
    id: 'offline_processing',
    name: 'Offline Processing',
    description: 'Maximize resource generation while away',
    icon: '⏰',
    color: '#F59E0B',
  },
  consciousness: {
    id: 'consciousness',
    name: 'Consciousness',
    description: 'Consciousness Expansion milestones and abilities',
    icon: '🧠',
    color: '#06B6D4',
  },
};

export const CONSCIOUSNESS_EXPANSION_MILESTONES: ConsciousnessExpansionMilestone[] =
  [
    {
      id: 'first_expansion',
      name: 'First Expansion',
      description: 'Your consciousness begins to spread across the galaxy',
      requiredBeacons: 10,
      choices: [
        {
          id: 'efficiency_focus',
          name: 'Efficiency Focus',
          description: '+20% beacon efficiency for all beacons',
          effects: [
            {
              type: 'beacon_efficiency',
              target: 'all',
              value: new BigNumber(0),
              multiplier: new BigNumber(1.2),
              description: '20% beacon efficiency bonus',
            },
          ],
          icon: '⚡',
        },
        {
          id: 'speed_focus',
          name: 'Speed Focus',
          description: '+30% probe speed for all probes',
          effects: [
            {
              type: 'probe_speed',
              target: 'all',
              value: new BigNumber(0),
              multiplier: new BigNumber(1.3),
              description: '30% probe speed bonus',
            },
          ],
          icon: '🚀',
        },
      ],
    },
    {
      id: 'network_growth',
      name: 'Network Growth',
      description: 'Your network expands with growing complexity',
      requiredBeacons: 25,
      choices: [
        {
          id: 'generation_boost',
          name: 'Generation Boost',
          description: '+50% quantum data generation',
          effects: [
            {
              type: 'resource_generation',
              target: 'quantumData',
              value: new BigNumber(0),
              multiplier: new BigNumber(1.5),
              description: '50% quantum data generation bonus',
            },
          ],
          icon: '💎',
        },
        {
          id: 'offline_boost',
          name: 'Offline Boost',
          description: '+25% offline resource generation',
          effects: [
            {
              type: 'offline_earnings',
              target: 'all',
              value: new BigNumber(0),
              multiplier: new BigNumber(1.25),
              description: '25% offline generation bonus',
            },
          ],
          icon: '🌙',
        },
      ],
    },
    {
      id: 'pattern_mastery',
      name: 'Pattern Mastery',
      description: 'Master geometric patterns for enhanced capabilities',
      requiredBeacons: 50,
      choices: [
        {
          id: 'pattern_efficiency',
          name: 'Pattern Efficiency',
          description: '+100% bonus from all geometric patterns',
          effects: [
            {
              type: 'pattern_bonus',
              target: 'all',
              value: new BigNumber(0),
              multiplier: new BigNumber(2),
              description: '100% pattern bonus multiplier',
            },
          ],
          icon: '🔺',
        },
        {
          id: 'beacon_range',
          name: 'Beacon Range',
          description: '+50% beacon connection range',
          effects: [
            {
              type: 'beacon_range',
              target: 'all',
              value: new BigNumber(0),
              multiplier: new BigNumber(1.5),
              description: '50% beacon range bonus',
            },
          ],
          icon: '📡',
        },
      ],
    },
    {
      id: 'deep_expansion',
      name: 'Deep Expansion',
      description: 'Consciousness spreads to distant galaxy regions',
      requiredBeacons: 100,
      choices: [
        {
          id: 'massive_efficiency',
          name: 'Massive Efficiency',
          description: '+200% beacon efficiency',
          effects: [
            {
              type: 'beacon_efficiency',
              target: 'all',
              value: new BigNumber(0),
              multiplier: new BigNumber(3),
              description: '200% beacon efficiency bonus',
            },
          ],
          icon: '⚡',
        },
        {
          id: 'probe_mastery',
          name: 'Probe Mastery',
          description: '+100% probe speed and +5 launch capacity',
          effects: [
            {
              type: 'probe_speed',
              target: 'all',
              value: new BigNumber(0),
              multiplier: new BigNumber(2),
              description: '100% probe speed bonus',
            },
            {
              type: 'launch_capacity',
              target: 'all',
              value: new BigNumber(5),
              multiplier: new BigNumber(1),
              description: '+5 probe launch capacity',
            },
          ],
          icon: '🚀',
        },
      ],
    },
    {
      id: 'galactic_presence',
      name: 'Galactic Presence',
      description: 'Your presence dominates multiple galaxy sectors',
      requiredBeacons: 250,
      choices: [
        {
          id: 'resource_mastery',
          name: 'Resource Mastery',
          description: '+300% all resource generation',
          effects: [
            {
              type: 'resource_generation',
              target: 'all',
              value: new BigNumber(0),
              multiplier: new BigNumber(4),
              description: '300% resource generation bonus',
            },
          ],
          icon: '💰',
        },
        {
          id: 'offline_mastery',
          name: 'Offline Mastery',
          description: '+200% offline earnings and 12h cap',
          effects: [
            {
              type: 'offline_earnings',
              target: 'all',
              value: new BigNumber(0),
              multiplier: new BigNumber(3),
              description: '200% offline earnings bonus',
            },
          ],
          icon: '🌌',
        },
      ],
    },
    {
      id: 'consciousness_singularity',
      name: 'Consciousness Singularity',
      description: 'Achieve unprecedented consciousness expansion',
      requiredBeacons: 500,
      choices: [
        {
          id: 'ultimate_efficiency',
          name: 'Ultimate Efficiency',
          description: '+500% beacon efficiency and pattern bonuses',
          effects: [
            {
              type: 'beacon_efficiency',
              target: 'all',
              value: new BigNumber(0),
              multiplier: new BigNumber(6),
              description: '500% beacon efficiency bonus',
            },
            {
              type: 'pattern_bonus',
              target: 'all',
              value: new BigNumber(0),
              multiplier: new BigNumber(6),
              description: '500% pattern bonus multiplier',
            },
          ],
          icon: '🌟',
        },
        {
          id: 'ultimate_presence',
          name: 'Ultimate Presence',
          description: '+1000% all generation and offline processing',
          effects: [
            {
              type: 'resource_generation',
              target: 'all',
              value: new BigNumber(0),
              multiplier: new BigNumber(11),
              description: '1000% resource generation bonus',
            },
            {
              type: 'offline_earnings',
              target: 'all',
              value: new BigNumber(0),
              multiplier: new BigNumber(11),
              description: '1000% offline earnings bonus',
            },
          ],
          icon: '✨',
        },
      ],
    },
  ];
