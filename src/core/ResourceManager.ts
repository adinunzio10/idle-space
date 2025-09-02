import BigNumber from 'bignumber.js';
import { Resources } from '../storage/schemas/GameState';

export interface ResourceState {
  quantumData: BigNumber;
  stellarEssence: BigNumber;
  voidFragments: BigNumber;
  resonanceCrystals: BigNumber;
  chronosParticles: BigNumber;
  lastUpdated: number;
}

export interface ResourceModifier {
  id: string;
  type: ResourceType;
  multiplier: BigNumber;
  flatBonus: BigNumber;
  duration?: number; // in seconds, undefined for permanent
  source: string; // beacon, pattern, upgrade, etc.
  createdAt: number;
}

export type ResourceType =
  | 'quantumData'
  | 'stellarEssence'
  | 'voidFragments'
  | 'resonanceCrystals'
  | 'chronosParticles';

export interface ResourceGeneration {
  baseRate: BigNumber;
  modifiedRate: BigNumber;
  modifiers: ResourceModifier[];
}

export class ResourceManager {
  private static instance: ResourceManager | null = null;
  private resources: ResourceState;
  private modifiers: Map<string, ResourceModifier> = new Map();
  private onResourceChange?: (resources: ResourceState) => void;

  private constructor() {
    this.resources = {
      quantumData: new BigNumber(100),
      stellarEssence: new BigNumber(0),
      voidFragments: new BigNumber(0),
      resonanceCrystals: new BigNumber(0),
      chronosParticles: new BigNumber(0),
      lastUpdated: Date.now(),
    };
  }

  static getInstance(): ResourceManager {
    if (!ResourceManager.instance) {
      ResourceManager.instance = new ResourceManager();
    }
    return ResourceManager.instance;
  }

  setOnResourceChange(callback: (resources: ResourceState) => void): void {
    this.onResourceChange = callback;
  }

  getResources(): ResourceState {
    return { ...this.resources };
  }

  getResource(type: ResourceType): BigNumber {
    return this.resources[type];
  }

  addResource(type: ResourceType, amount: BigNumber | number): void {
    const amountBN =
      amount instanceof BigNumber ? amount : new BigNumber(amount);
    this.resources[type] = this.resources[type].plus(amountBN);
    this.resources.lastUpdated = Date.now();
    this.notifyChange();
  }

  subtractResource(type: ResourceType, amount: BigNumber | number): boolean {
    const amountBN =
      amount instanceof BigNumber ? amount : new BigNumber(amount);
    if (this.resources[type].isLessThan(amountBN)) {
      return false; // Insufficient resources
    }
    this.resources[type] = this.resources[type].minus(amountBN);
    this.resources.lastUpdated = Date.now();
    this.notifyChange();
    return true;
  }

  setResource(type: ResourceType, amount: BigNumber | number): void {
    const amountBN =
      amount instanceof BigNumber ? amount : new BigNumber(amount);
    this.resources[type] = amountBN;
    this.resources.lastUpdated = Date.now();
    this.notifyChange();
  }

  canAfford(costs: Partial<Record<ResourceType, BigNumber | number>>): boolean {
    return Object.entries(costs).every(([type, cost]) => {
      const costBN = cost instanceof BigNumber ? cost : new BigNumber(cost);
      return this.resources[type as ResourceType].isGreaterThanOrEqualTo(
        costBN
      );
    });
  }

  spendResources(
    costs: Partial<Record<ResourceType, BigNumber | number>>
  ): boolean {
    if (!this.canAfford(costs)) {
      return false;
    }

    Object.entries(costs).forEach(([type, cost]) => {
      const costBN = cost instanceof BigNumber ? cost : new BigNumber(cost);
      this.resources[type as ResourceType] =
        this.resources[type as ResourceType].minus(costBN);
    });

    this.resources.lastUpdated = Date.now();
    this.notifyChange();
    return true;
  }

  addModifier(modifier: ResourceModifier): void {
    this.modifiers.set(modifier.id, modifier);
  }

  removeModifier(modifierId: string): void {
    this.modifiers.delete(modifierId);
  }

  getActiveModifiers(resourceType?: ResourceType): ResourceModifier[] {
    const now = Date.now();
    return Array.from(this.modifiers.values()).filter(modifier => {
      // Filter by resource type if specified
      if (resourceType && modifier.type !== resourceType) return false;

      // Check if modifier is still active (not expired)
      if (modifier.duration !== undefined) {
        const elapsed = (now - modifier.createdAt) / 1000;
        return elapsed < modifier.duration;
      }

      return true;
    });
  }

  calculateResourceGeneration(
    resourceType: ResourceType,
    baseRate: BigNumber
  ): ResourceGeneration {
    const activeModifiers = this.getActiveModifiers(resourceType);

    let totalMultiplier = new BigNumber(1);
    let totalFlatBonus = new BigNumber(0);

    activeModifiers.forEach(modifier => {
      totalMultiplier = totalMultiplier.multipliedBy(modifier.multiplier);
      totalFlatBonus = totalFlatBonus.plus(modifier.flatBonus);
    });

    const modifiedRate = baseRate
      .multipliedBy(totalMultiplier)
      .plus(totalFlatBonus);

    return {
      baseRate,
      modifiedRate,
      modifiers: activeModifiers,
    };
  }

  clearExpiredModifiers(): void {
    const now = Date.now();
    const expiredIds: string[] = [];

    this.modifiers.forEach((modifier, id) => {
      if (modifier.duration !== undefined) {
        const elapsed = (now - modifier.createdAt) / 1000;
        if (elapsed >= modifier.duration) {
          expiredIds.push(id);
        }
      }
    });

    expiredIds.forEach(id => this.modifiers.delete(id));
  }

  loadFromGameState(resources: Resources): void {
    this.resources = {
      quantumData: new BigNumber(resources.quantumData),
      stellarEssence: new BigNumber(resources.stellarEssence),
      voidFragments: new BigNumber(resources.voidFragments),
      resonanceCrystals: new BigNumber(resources.resonanceCrystals || 0), // Handle legacy saves
      chronosParticles: new BigNumber(resources.chronosParticles),
      lastUpdated: resources.lastUpdated,
    };
    this.notifyChange();
  }

  toGameStateFormat(): Resources {
    return {
      quantumData: this.resources.quantumData.toNumber(),
      stellarEssence: this.resources.stellarEssence.toNumber(),
      voidFragments: this.resources.voidFragments.toNumber(),
      resonanceCrystals: this.resources.resonanceCrystals.toNumber(),
      chronosParticles: this.resources.chronosParticles.toNumber(),
      lastUpdated: this.resources.lastUpdated,
    };
  }

  formatResourceValue(value: BigNumber, precision: number = 2): string {
    if (value.isLessThan(1000)) {
      return value.toFixed(0);
    } else if (value.isLessThan(1000000)) {
      return value.dividedBy(1000).toFixed(precision) + 'K';
    } else if (value.isLessThan(1000000000)) {
      return value.dividedBy(1000000).toFixed(precision) + 'M';
    } else if (value.isLessThan(1000000000000)) {
      return value.dividedBy(1000000000).toFixed(precision) + 'B';
    } else {
      return value.dividedBy(1000000000000).toFixed(precision) + 'T';
    }
  }

  /**
   * Calculate the cost to place a beacon based on current beacon count and specialization
   */
  calculateBeaconPlacementCost(
    beaconCount: number,
    specialization?: 'efficiency' | 'range' | 'stability'
  ): { quantumData: number } {
    const baseCost = 50;
    const scalingFactor = 1.5;

    // Calculate base escalating cost: 50 * 1.5^beacon_count
    let cost = Math.floor(baseCost * Math.pow(scalingFactor, beaconCount));

    // Apply specialization multipliers
    if (specialization) {
      const multipliers = {
        efficiency: 2.0, // +100% cost
        range: 2.5, // +150% cost
        stability: 3.0, // +200% cost
      };

      cost = Math.floor(cost * multipliers[specialization]);
    }

    return { quantumData: cost };
  }

  /**
   * Check if player can afford beacon placement at current beacon count
   */
  canAffordBeaconPlacement(
    beaconCount: number,
    specialization?: 'efficiency' | 'range' | 'stability'
  ): boolean {
    const cost = this.calculateBeaconPlacementCost(beaconCount, specialization);
    return this.canAfford(cost);
  }

  /**
   * Spend resources for beacon placement if affordable
   */
  spendBeaconPlacementCost(
    beaconCount: number,
    specialization?: 'efficiency' | 'range' | 'stability'
  ): boolean {
    const cost = this.calculateBeaconPlacementCost(beaconCount, specialization);
    return this.spendResources(cost);
  }

  private notifyChange(): void {
    if (this.onResourceChange) {
      this.onResourceChange(this.getResources());
    }
  }
}
