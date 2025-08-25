import BigNumber from 'bignumber.js';
import { ResourceManager, ResourceType } from './ResourceManager';
import { BeaconModifierManager } from './BeaconModifierManager';
import { GameState } from '../storage/schemas/GameState';
import { Beacon } from '../entities/Beacon';

export interface GenerationSource {
  id: string;
  type: GenerationSourceType;
  baseGeneration: Partial<Record<ResourceType, BigNumber>>;
  efficiency: number;
  active: boolean;
}

export type GenerationSourceType = 'beacon' | 'pattern' | 'upgrade' | 'star' | 'special';

export interface PatternBonus {
  id: string;
  beaconIds: string[];
  shape: PatternShape;
  bonusMultiplier: BigNumber;
  resourceTypes: ResourceType[];
}

export type PatternShape = 'triangle' | 'square' | 'pentagon' | 'hexagon' | 'line' | 'star';

export class ResourceGenerationEngine {
  private resourceManager: ResourceManager;
  private beaconModifierManager: BeaconModifierManager;
  private generationSources: Map<string, GenerationSource> = new Map();
  private patternBonuses: PatternBonus[] = [];
  private isRunning: boolean = false;

  constructor() {
    this.resourceManager = ResourceManager.getInstance();
    this.beaconModifierManager = new BeaconModifierManager();
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
  }

  stop(): void {
    this.isRunning = false;
  }

  isActive(): boolean {
    return this.isRunning;
  }

  processGenerationTick(deltaSeconds: number = 1): void {
    if (!this.isRunning) return;

    // Clear expired modifiers before processing
    this.resourceManager.clearExpiredModifiers();

    // Calculate generation for each resource type
    const resourceTypes: ResourceType[] = [
      'quantumData',
      'stellarEssence', 
      'voidFragments',
      'resonanceCrystals',
      'chronosParticles'
    ];

    resourceTypes.forEach(resourceType => {
      const totalGeneration = this.calculateResourceGeneration(resourceType, deltaSeconds);
      if (totalGeneration.isGreaterThan(0)) {
        this.resourceManager.addResource(resourceType, totalGeneration);
      }
    });
  }

  updateFromGameState(gameState: GameState): void {
    // Clear existing sources
    this.generationSources.clear();

    // Convert GameState beacons to entity beacons for processing
    const entityBeacons = Object.values(gameState.beacons).map(beaconData => {
      return new Beacon({
        id: beaconData.id,
        position: { x: beaconData.x, y: beaconData.y },
        level: beaconData.level,
        type: beaconData.type,
        specialization: beaconData.specialization || 'none',
        status: beaconData.status || 'active',
        connections: beaconData.connections || [],
        generationRate: beaconData.generationRate || 1,
        createdAt: beaconData.createdAt || Date.now(),
        lastUpgraded: beaconData.lastUpgraded || Date.now(),
        totalResourcesGenerated: beaconData.totalResourcesGenerated || 0,
        upgradePendingAt: beaconData.upgradePendingAt,
      });
    });

    // Add beacon sources
    entityBeacons.forEach(beacon => {
      this.addBeaconSource(beacon);
    });

    // Detect and add pattern bonuses
    this.detectPatternBonuses(entityBeacons);

    // Update beacon modifiers
    this.beaconModifierManager.updateBeaconModifiers(entityBeacons);

    // Apply pattern bonus modifiers
    this.beaconModifierManager.addPatternBonusModifiers(
      this.patternBonuses.map(pattern => ({
        id: pattern.id,
        beaconIds: pattern.beaconIds,
        shape: pattern.shape,
        bonusMultiplier: pattern.bonusMultiplier,
        resourceTypes: pattern.resourceTypes,
      }))
    );
  }

  updateFromBeacons(beacons: Beacon[]): void {
    // Clear existing sources
    this.generationSources.clear();

    // Add beacon sources
    beacons.forEach(beacon => {
      this.addBeaconSource(beacon);
    });

    // Detect and add pattern bonuses
    this.detectPatternBonuses(beacons);

    // Update beacon modifiers
    this.beaconModifierManager.updateBeaconModifiers(beacons);

    // Apply pattern bonus modifiers
    this.beaconModifierManager.addPatternBonusModifiers(
      this.patternBonuses.map(pattern => ({
        id: pattern.id,
        beaconIds: pattern.beaconIds,
        shape: pattern.shape,
        bonusMultiplier: pattern.bonusMultiplier,
        resourceTypes: pattern.resourceTypes,
      }))
    );
  }

  private addBeaconSource(beacon: Beacon): void {
    const source: GenerationSource = {
      id: `beacon_${beacon.id}`,
      type: 'beacon',
      baseGeneration: this.calculateBeaconGeneration(beacon),
      efficiency: beacon.getEfficiencyMultiplier(),
      active: beacon.status === 'active',
    };

    this.generationSources.set(source.id, source);
  }

  private calculateBeaconGeneration(beacon: Beacon): Partial<Record<ResourceType, BigNumber>> {
    const generation: Partial<Record<ResourceType, BigNumber>> = {};
    
    // Use the beacon's calculated generation rate
    const baseRate = new BigNumber(beacon.generationRate);
    
    // Base quantum data generation for all active beacons
    generation.quantumData = baseRate;

    // Specialized generation based on beacon type
    switch (beacon.type) {
      case 'harvester':
        generation.stellarEssence = baseRate.multipliedBy(0.15);
        break;
      case 'architect':
        generation.voidFragments = baseRate.multipliedBy(0.1);
        break;
      case 'pioneer':
        // Balanced generation - small amounts of all resources
        generation.stellarEssence = baseRate.multipliedBy(0.05);
        generation.voidFragments = baseRate.multipliedBy(0.05);
        break;
    }

    return generation;
  }

  private calculateResourceGeneration(resourceType: ResourceType, deltaSeconds: number): BigNumber {
    let totalGeneration = new BigNumber(0);

    // Sum base generation from all active sources
    this.generationSources.forEach(source => {
      if (!source.active) return;
      
      const baseAmount = source.baseGeneration[resourceType];
      if (!baseAmount) return;

      const sourceGeneration = baseAmount
        .multipliedBy(source.efficiency)
        .multipliedBy(deltaSeconds);

      totalGeneration = totalGeneration.plus(sourceGeneration);
    });

    // Apply pattern bonuses
    const patternBonus = this.calculatePatternBonus(resourceType);
    if (patternBonus.isGreaterThan(1)) {
      totalGeneration = totalGeneration.multipliedBy(patternBonus);
    }

    // Apply resource modifiers from ResourceManager
    const generationResult = this.resourceManager.calculateResourceGeneration(resourceType, totalGeneration);
    return generationResult.modifiedRate;
  }

  private calculatePatternBonus(resourceType: ResourceType): BigNumber {
    let totalBonus = new BigNumber(1);

    this.patternBonuses.forEach(pattern => {
      if (pattern.resourceTypes.includes(resourceType)) {
        totalBonus = totalBonus.multipliedBy(pattern.bonusMultiplier);
      }
    });

    return totalBonus;
  }

  private detectPatternBonuses(beacons: Beacon[]): void {
    this.patternBonuses = [];
    
    const activeBeacons = beacons.filter(b => b.status === 'active');
    
    // Simple triangle detection
    const triangles = this.findTrianglePatterns(activeBeacons);
    triangles.forEach(triangle => {
      this.patternBonuses.push({
        id: `triangle_${triangle.join('_')}`,
        beaconIds: triangle,
        shape: 'triangle',
        bonusMultiplier: new BigNumber(1.2),
        resourceTypes: ['resonanceCrystals', 'quantumData'],
      });
    });

    // Square detection
    const squares = this.findSquarePatterns(activeBeacons);
    squares.forEach(square => {
      this.patternBonuses.push({
        id: `square_${square.join('_')}`,
        beaconIds: square,
        shape: 'square',
        bonusMultiplier: new BigNumber(1.5),
        resourceTypes: ['resonanceCrystals', 'stellarEssence'],
      });
    });
  }

  private findTrianglePatterns(beacons: Beacon[]): string[][] {
    const triangles: string[][] = [];
    
    // Simple implementation: check all combinations of 3 connected beacons
    for (let i = 0; i < beacons.length; i++) {
      for (let j = i + 1; j < beacons.length; j++) {
        for (let k = j + 1; k < beacons.length; k++) {
          const b1 = beacons[i];
          const b2 = beacons[j];
          const b3 = beacons[k];
          
          // Check if they form a connected triangle
          if (this.areBeaconsConnected(b1, b2) && 
              this.areBeaconsConnected(b2, b3) && 
              this.areBeaconsConnected(b3, b1)) {
            triangles.push([b1.id, b2.id, b3.id]);
          }
        }
      }
    }
    
    return triangles;
  }

  private findSquarePatterns(beacons: Beacon[]): string[][] {
    const squares: string[][] = [];
    
    // Simple implementation: check all combinations of 4 beacons
    for (let i = 0; i < beacons.length; i++) {
      for (let j = i + 1; j < beacons.length; j++) {
        for (let k = j + 1; k < beacons.length; k++) {
          for (let l = k + 1; l < beacons.length; l++) {
            const beaconSet = [beacons[i], beacons[j], beacons[k], beacons[l]];
            
            if (this.formsSquarePattern(beaconSet)) {
              squares.push([beacons[i].id, beacons[j].id, beacons[k].id, beacons[l].id]);
            }
          }
        }
      }
    }
    
    return squares;
  }

  private areBeaconsConnected(beacon1: Beacon, beacon2: Beacon): boolean {
    return beacon1.connections.includes(beacon2.id) || beacon2.connections.includes(beacon1.id);
  }

  private formsSquarePattern(beacons: Beacon[]): boolean {
    if (beacons.length !== 4) return false;
    
    // Check that each beacon is connected to exactly 2 others (forming a cycle)
    return beacons.every(beacon => {
      const connections = beacons.filter(other => 
        other.id !== beacon.id && this.areBeaconsConnected(beacon, other)
      );
      return connections.length === 2;
    });
  }

  getGenerationSummary(): Record<ResourceType, BigNumber> {
    const summary: Partial<Record<ResourceType, BigNumber>> = {};
    
    const resourceTypes: ResourceType[] = [
      'quantumData',
      'stellarEssence',
      'voidFragments', 
      'resonanceCrystals',
      'chronosParticles'
    ];

    resourceTypes.forEach(resourceType => {
      summary[resourceType] = this.calculateResourceGeneration(resourceType, 1);
    });

    return summary as Record<ResourceType, BigNumber>;
  }

  getActivePatterns(): PatternBonus[] {
    return [...this.patternBonuses];
  }

  getActiveSources(): GenerationSource[] {
    return Array.from(this.generationSources.values()).filter(source => source.active);
  }

  getModifierManager(): BeaconModifierManager {
    return this.beaconModifierManager;
  }
}