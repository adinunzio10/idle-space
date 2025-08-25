import { Point2D } from '../types/galaxy';
import { BeaconType, BeaconEntity } from '../types/beacon';
import { Beacon } from './Beacon';

export interface BeaconCreateOptions {
  position: Point2D;
  type: BeaconType;
  level?: number;
  id?: string;
}

export class BeaconFactory {
  private static idCounter = 0;

  /**
   * Generate unique beacon ID
   */
  private static generateId(): string {
    const timestamp = Date.now();
    const counter = ++BeaconFactory.idCounter;
    return `beacon-${timestamp}-${counter}`;
  }

  /**
   * Create a new beacon instance
   */
  public static create(options: BeaconCreateOptions): Beacon {
    const id = options.id ?? BeaconFactory.generateId();
    
    const beaconData: Partial<BeaconEntity> & {
      id: string;
      position: Point2D;
      type: BeaconType;
    } = {
      id,
      position: options.position,
      type: options.type,
      level: options.level ?? 1,
      specialization: 'none',
      status: 'active',
      connections: [],
      createdAt: Date.now(),
      lastUpgraded: Date.now(),
      totalResourcesGenerated: 0,
    };

    return new Beacon(beaconData);
  }

  /**
   * Create beacon from saved data
   */
  public static fromSaveData(data: BeaconEntity): Beacon {
    return new Beacon(data);
  }

  /**
   * Create multiple beacons from save data
   */
  public static fromSaveDataBatch(beaconData: Record<string, BeaconEntity>): Record<string, Beacon> {
    const beacons: Record<string, Beacon> = {};
    
    Object.values(beaconData).forEach(data => {
      beacons[data.id] = BeaconFactory.fromSaveData(data);
    });
    
    return beacons;
  }

  /**
   * Create a pioneer beacon at specified position
   */
  public static createPioneer(position: Point2D, level: number = 1): Beacon {
    return BeaconFactory.create({
      position,
      type: 'pioneer',
      level,
    });
  }

  /**
   * Create a harvester beacon at specified position
   */
  public static createHarvester(position: Point2D, level: number = 1): Beacon {
    return BeaconFactory.create({
      position,
      type: 'harvester',
      level,
    });
  }

  /**
   * Create an architect beacon at specified position
   */
  public static createArchitect(position: Point2D, level: number = 1): Beacon {
    return BeaconFactory.create({
      position,
      type: 'architect',
      level,
    });
  }

  /**
   * Validate beacon creation options
   */
  public static validateCreateOptions(options: BeaconCreateOptions): {
    isValid: boolean;
    reasons: string[];
  } {
    const reasons: string[] = [];

    // Validate position
    if (!options.position || typeof options.position.x !== 'number' || typeof options.position.y !== 'number') {
      reasons.push('Invalid position coordinates');
    }

    // Validate type
    if (!options.type || !['pioneer', 'harvester', 'architect'].includes(options.type)) {
      reasons.push('Invalid beacon type');
    }

    // Validate level if provided
    if (options.level !== undefined) {
      if (options.level < 1) {
        reasons.push('Level must be at least 1');
      }
      if (options.level > 50) {
        reasons.push('Level cannot exceed 50');
      }
    }

    // Validate ID if provided
    if (options.id !== undefined) {
      if (typeof options.id !== 'string' || options.id.length === 0) {
        reasons.push('ID must be a non-empty string');
      }
    }

    return {
      isValid: reasons.length === 0,
      reasons,
    };
  }

  /**
   * Create a test beacon with random properties for development
   */
  public static createTestBeacon(position?: Point2D): Beacon {
    const types: BeaconType[] = ['pioneer', 'harvester', 'architect'];
    const randomType = types[Math.floor(Math.random() * types.length)];
    const randomLevel = Math.floor(Math.random() * 10) + 1;
    
    const testPosition = position ?? {
      x: Math.random() * 1000,
      y: Math.random() * 1000,
    };

    return BeaconFactory.create({
      position: testPosition,
      type: randomType,
      level: randomLevel,
    });
  }

  /**
   * Reset the internal ID counter (useful for testing)
   */
  public static resetIdCounter(): void {
    BeaconFactory.idCounter = 0;
  }
}