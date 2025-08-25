import BigNumber from 'bignumber.js';
import { ResourceManager, ResourceModifier, ResourceType } from './ResourceManager';
import { Beacon } from '../entities/Beacon';
import { SPECIALIZATION_CONFIG } from '../types/beacon';

export class BeaconModifierManager {
  private resourceManager: ResourceManager;

  constructor() {
    this.resourceManager = ResourceManager.getInstance();
  }

  updateBeaconModifiers(beacons: Record<string, Beacon> | Beacon[]): void {
    // Clear existing beacon modifiers
    this.clearBeaconModifiers();

    // Convert to array if needed
    const beaconArray = Array.isArray(beacons) ? beacons : Object.values(beacons);
    const beaconMap = Array.isArray(beacons) 
      ? beaconArray.reduce((map, beacon) => ({ ...map, [beacon.id]: beacon }), {})
      : beacons;

    // Add modifiers for each active beacon
    beaconArray.forEach(beacon => {
      if (beacon.status === 'active') {
        this.addBeaconLevelModifiers(beacon);
        this.addBeaconTypeModifiers(beacon);
        this.addBeaconSpecializationModifiers(beacon);
        this.addBeaconConnectionModifiers(beacon, beaconMap);
      }
    });
  }

  private clearBeaconModifiers(): void {
    const activeModifiers = this.resourceManager.getActiveModifiers();
    
    // Remove beacon-related modifiers
    activeModifiers.forEach(modifier => {
      if (modifier.source.startsWith('beacon_') || 
          modifier.source.startsWith('connection_') ||
          modifier.source.startsWith('type_') ||
          modifier.source.startsWith('specialization_')) {
        this.resourceManager.removeModifier(modifier.id);
      }
    });
  }

  private addBeaconLevelModifiers(beacon: Beacon): void {
    if (beacon.level <= 1) return;

    // Each beacon level adds 25% to quantum data generation
    const levelBonus = new BigNumber(0.25).multipliedBy(beacon.level - 1);
    
    const modifier: ResourceModifier = {
      id: `beacon_level_${beacon.id}`,
      type: 'quantumData',
      multiplier: new BigNumber(1).plus(levelBonus),
      flatBonus: new BigNumber(0),
      source: `beacon_${beacon.id}`,
      createdAt: Date.now(),
    };

    this.resourceManager.addModifier(modifier);
  }

  private addBeaconTypeModifiers(beacon: Beacon): void {
    const typeModifiers = this.getBeaconTypeModifiers(beacon);
    
    typeModifiers.forEach(modifier => {
      this.resourceManager.addModifier(modifier);
    });
  }

  private getBeaconTypeModifiers(beacon: Beacon): ResourceModifier[] {
    const modifiers: ResourceModifier[] = [];
    const baseId = `type_${beacon.type}_${beacon.id}`;

    switch (beacon.type) {
      case 'harvester':
        // Harvesters have 50% bonus to stellar essence generation
        modifiers.push({
          id: `${baseId}_stellar`,
          type: 'stellarEssence',
          multiplier: new BigNumber(1.5),
          flatBonus: new BigNumber(0),
          source: `beacon_${beacon.id}`,
          createdAt: Date.now(),
        });
        break;

      case 'architect':
        // Architects boost void fragments generation by 75%
        modifiers.push({
          id: `${baseId}_void`,
          type: 'voidFragments',
          multiplier: new BigNumber(1.75),
          flatBonus: new BigNumber(0),
          source: `beacon_${beacon.id}`,
          createdAt: Date.now(),
        });
        break;

      case 'pioneer':
      default:
        // Pioneers have balanced base generation (no special modifiers)
        break;
    }

    return modifiers;
  }

  private addBeaconSpecializationModifiers(beacon: Beacon): void {
    if (beacon.specialization === 'none') return;

    const specializationConfig = SPECIALIZATION_CONFIG[beacon.specialization];
    const baseId = `specialization_${beacon.specialization}_${beacon.id}`;

    // Apply efficiency bonus (affects all resource generation)
    if (specializationConfig.efficiency > 1) {
      const resourceTypes: ResourceType[] = ['quantumData', 'stellarEssence', 'voidFragments'];
      
      resourceTypes.forEach(resourceType => {
        const modifier: ResourceModifier = {
          id: `${baseId}_${resourceType}`,
          type: resourceType,
          multiplier: new BigNumber(specializationConfig.efficiency),
          flatBonus: new BigNumber(0),
          source: `specialization_${beacon.specialization}`,
          createdAt: Date.now(),
        };
        
        this.resourceManager.addModifier(modifier);
      });
    }

    // Range specialization bonus is handled in connection logic
    // Stability specialization bonus is handled in pattern bonus calculations
  }

  private addBeaconConnectionModifiers(beacon: Beacon, allBeacons: Record<string, Beacon>): void {
    const connectionCount = beacon.connections.length;
    
    if (connectionCount === 0) return;

    // Each connection adds 10% to all resource generation
    const connectionBonus = new BigNumber(0.1).multipliedBy(connectionCount);
    const resourceTypes: ResourceType[] = ['quantumData', 'stellarEssence', 'voidFragments'];

    resourceTypes.forEach(resourceType => {
      const modifier: ResourceModifier = {
        id: `connection_${beacon.id}_${resourceType}`,
        type: resourceType,
        multiplier: new BigNumber(1).plus(connectionBonus),
        flatBonus: new BigNumber(0),
        source: `beacon_${beacon.id}`,
        createdAt: Date.now(),
      };

      this.resourceManager.addModifier(modifier);
    });

    // Special architect modifier: boosts nearby beacons if range specialized
    if (beacon.type === 'architect' && beacon.specialization === 'range') {
      this.addArchitectBoostModifiers(beacon, allBeacons);
    }
  }

  private addArchitectBoostModifiers(architect: Beacon, allBeacons: Record<string, Beacon>): void {
    // Range-specialized architects boost connected beacons by 30%
    architect.connections.forEach(connectedBeaconId => {
      const connectedBeacon = allBeacons[connectedBeaconId];
      if (!connectedBeacon || connectedBeacon.status !== 'active') return;

      const modifier: ResourceModifier = {
        id: `architect_boost_${architect.id}_${connectedBeaconId}`,
        type: 'quantumData',
        multiplier: new BigNumber(1.3),
        flatBonus: new BigNumber(0),
        source: `beacon_${architect.id}`,
        createdAt: Date.now(),
      };

      this.resourceManager.addModifier(modifier);
    });
  }

  addPatternBonusModifiers(patternBonuses: {
    id: string;
    beaconIds: string[];
    shape: string;
    bonusMultiplier: BigNumber;
    resourceTypes: ResourceType[];
  }[]): void {
    // Clear existing pattern modifiers
    const activeModifiers = this.resourceManager.getActiveModifiers();
    activeModifiers.forEach(modifier => {
      if (modifier.source.startsWith('pattern_')) {
        this.resourceManager.removeModifier(modifier.id);
      }
    });

    // Add new pattern modifiers
    patternBonuses.forEach(pattern => {
      pattern.resourceTypes.forEach(resourceType => {
        const modifier: ResourceModifier = {
          id: `pattern_${pattern.shape}_${pattern.id}_${resourceType}`,
          type: resourceType,
          multiplier: pattern.bonusMultiplier,
          flatBonus: new BigNumber(0),
          source: `pattern_${pattern.shape}`,
          createdAt: Date.now(),
        };

        this.resourceManager.addModifier(modifier);
      });
    });
  }

  addUpgradeModifiers(upgradeId: string, resourceType: ResourceType, multiplier: BigNumber, flatBonus?: BigNumber): void {
    const modifier: ResourceModifier = {
      id: `upgrade_${upgradeId}_${resourceType}`,
      type: resourceType,
      multiplier,
      flatBonus: flatBonus || new BigNumber(0),
      source: `upgrade_${upgradeId}`,
      createdAt: Date.now(),
    };

    this.resourceManager.addModifier(modifier);
  }

  addTemporaryModifier(
    id: string,
    resourceType: ResourceType, 
    multiplier: BigNumber, 
    flatBonus: BigNumber,
    duration: number,
    source: string
  ): void {
    const modifier: ResourceModifier = {
      id,
      type: resourceType,
      multiplier,
      flatBonus,
      duration,
      source,
      createdAt: Date.now(),
    };

    this.resourceManager.addModifier(modifier);
  }

  getModifierSummary(): Record<ResourceType, {
    totalMultiplier: BigNumber;
    totalFlatBonus: BigNumber;
    modifierCount: number;
  }> {
    const summary: Partial<Record<ResourceType, {
      totalMultiplier: BigNumber;
      totalFlatBonus: BigNumber;
      modifierCount: number;
    }>> = {};

    const resourceTypes: ResourceType[] = [
      'quantumData',
      'stellarEssence',
      'voidFragments',
      'resonanceCrystals',
      'chronosParticles'
    ];

    resourceTypes.forEach(resourceType => {
      const modifiers = this.resourceManager.getActiveModifiers(resourceType);
      
      let totalMultiplier = new BigNumber(1);
      let totalFlatBonus = new BigNumber(0);

      modifiers.forEach(modifier => {
        totalMultiplier = totalMultiplier.multipliedBy(modifier.multiplier);
        totalFlatBonus = totalFlatBonus.plus(modifier.flatBonus);
      });

      summary[resourceType] = {
        totalMultiplier,
        totalFlatBonus,
        modifierCount: modifiers.length,
      };
    });

    return summary as Record<ResourceType, {
      totalMultiplier: BigNumber;
      totalFlatBonus: BigNumber;
      modifierCount: number;
    }>;
  }
}