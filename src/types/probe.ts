import { Point2D } from './galaxy';
import { ResourceType } from './resources';

export type ProbeType = 'pioneer' | 'harvester' | 'architect';
export type ProbeStatus = 'queued' | 'launching' | 'traveling' | 'deployed' | 'failed';

export interface ProbeConfig {
  deploymentTime: number; // seconds
  cost: Partial<Record<ResourceType, number>>;
  bonus?: {
    stellarEssenceMultiplier?: number;
    connectionRangeMultiplier?: number;
  };
  description: string;
  icon: string;
  color: string;
}

export interface ProbeInstance {
  id: string;
  type: ProbeType;
  status: ProbeStatus;
  startPosition: Point2D;
  targetPosition: Point2D;
  createdAt: number;
  deploymentStartedAt?: number;
  deploymentCompletedAt?: number;
  travelProgress: number; // 0-1
  accelerationBonus: number; // Speed multiplier (1 = normal, 2 = 2x speed)
}

export interface ProbeQueueItem {
  probe: ProbeInstance;
  priority: number; // Higher = more priority
}

export interface ProbeDeploymentResult {
  success: boolean;
  probe?: ProbeInstance;
  error?: string;
}

export const PROBE_TYPE_CONFIG: Record<ProbeType, ProbeConfig> = {
  pioneer: {
    deploymentTime: 30, // 30 seconds
    cost: { quantumData: 100 },
    description: 'Fast deployment probe for rapid expansion',
    icon: '🚀',
    color: '#4F46E5', // Primary blue
  },
  harvester: {
    deploymentTime: 90, // 90 seconds
    cost: { quantumData: 50, stellarEssence: 10 },
    bonus: { stellarEssenceMultiplier: 1.5 }, // +50% Stellar Essence
    description: 'Specialized harvesting probe with resource bonus',
    icon: '⛏️',
    color: '#F59E0B', // Accent orange
  },
  architect: {
    deploymentTime: 60, // 60 seconds
    cost: { quantumData: 200 },
    bonus: { connectionRangeMultiplier: 2.0 }, // +100% connection range
    description: 'Advanced probe with enhanced beacon connectivity',
    icon: '🏗️',
    color: '#7C3AED', // Secondary purple
  },
};

export const PROBE_DISPLAY_ORDER: ProbeType[] = ['pioneer', 'harvester', 'architect'];

export class ProbeUtils {
  static getProbeConfig(type: ProbeType): ProbeConfig {
    return PROBE_TYPE_CONFIG[type];
  }

  static formatDeploymentTime(seconds: number): string {
    if (seconds < 60) {
      return `${seconds}s`;
    } else {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
    }
  }

  static calculateDeploymentTimeWithAcceleration(baseTime: number, accelerationBonus: number): number {
    return baseTime / accelerationBonus;
  }

  static getProbeStatusColor(status: ProbeStatus): string {
    switch (status) {
      case 'queued':
        return '#6B7280'; // Gray
      case 'launching':
        return '#F59E0B'; // Orange
      case 'traveling':
        return '#3B82F6'; // Blue
      case 'deployed':
        return '#10B981'; // Green
      case 'failed':
        return '#EF4444'; // Red
      default:
        return '#6B7280';
    }
  }

  static getProbeStatusIcon(status: ProbeStatus): string {
    switch (status) {
      case 'queued':
        return '⏳';
      case 'launching':
        return '🚀';
      case 'traveling':
        return '✈️';
      case 'deployed':
        return '✅';
      case 'failed':
        return '❌';
      default:
        return '❓';
    }
  }

  static formatProgress(progress: number): string {
    return `${Math.round(progress * 100)}%`;
  }
}