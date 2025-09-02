import { Point2D } from '../types/galaxy';
import {
  BeaconEntity,
  BeaconType,
  BeaconSpecialization,
  BeaconStatus,
  BeaconValidationResult,
  BEACON_TYPE_CONFIG,
  SPECIALIZATION_CONFIG,
  BEACON_PLACEMENT_CONFIG,
} from '../types/beacon';

export class Beacon implements BeaconEntity {
  public readonly id: string;
  public readonly position: Point2D;
  public level: number;
  public readonly type: BeaconType;
  public specialization: BeaconSpecialization;
  public status: BeaconStatus;
  public connections: string[];
  public generationRate: number;
  public readonly createdAt: number;
  public lastUpgraded: number;
  public totalResourcesGenerated: number;
  public upgradePendingAt?: number;

  constructor(
    data: Partial<BeaconEntity> & {
      id: string;
      position: Point2D;
      type: BeaconType;
    }
  ) {
    this.id = data.id;
    this.position = data.position;
    this.type = data.type;

    // Initialize with defaults

    this.level = data.level ?? 1;
    this.specialization = data.specialization ?? 'none';
    this.status = data.status ?? 'active';
    this.connections = data.connections ?? [];
    this.generationRate = this.calculateGenerationRate();
    this.createdAt = data.createdAt ?? Date.now();
    this.lastUpgraded = data.lastUpgraded ?? this.createdAt;
    this.totalResourcesGenerated = data.totalResourcesGenerated ?? 0;
    this.upgradePendingAt = data.upgradePendingAt;
  }

  /**
   * Calculate the effective generation rate based on level and specialization
   */
  public calculateGenerationRate(): number {
    const baseRate = BEACON_TYPE_CONFIG[this.type].baseGenerationRate;
    const levelMultiplier = 1 + (this.level - 1) * 0.1; // 10% increase per level
    const specializationBonus =
      SPECIALIZATION_CONFIG[this.specialization].efficiency;

    return baseRate * levelMultiplier * specializationBonus;
  }

  /**
   * Calculate the effective connection range based on level and specialization
   */
  public calculateConnectionRange(): number {
    const baseRange = BEACON_TYPE_CONFIG[this.type].connectionRange;
    const levelBonus = this.level * 5; // 5 units per level
    const specializationBonus =
      SPECIALIZATION_CONFIG[this.specialization].range;

    return (baseRange + levelBonus) * specializationBonus;
  }

  /**
   * Get maximum number of connections this beacon can have
   */
  public getMaxConnections(): number {
    const baseMax = BEACON_TYPE_CONFIG[this.type].maxConnections;
    const levelBonus = Math.floor(this.level / 10); // +1 connection every 10 levels

    return baseMax + levelBonus;
  }

  /**
   * Calculate territory radius for Voronoi visualization
   */
  public getTerritoryRadius(): number {
    const connectionRange = this.calculateConnectionRange();
    return (
      connectionRange * BEACON_PLACEMENT_CONFIG.TERRITORY_RADIUS_MULTIPLIER
    );
  }

  /**
   * Check if this beacon can connect to another beacon at given position
   */
  public canConnectTo(position: Point2D): boolean {
    const distance = this.getDistanceTo(position);
    const range = this.calculateConnectionRange();
    return distance <= range;
  }

  /**
   * Calculate distance to a point
   */
  public getDistanceTo(position: Point2D): number {
    const dx = this.position.x - position.x;
    const dy = this.position.y - position.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Check if this beacon needs to show upgrade UI
   */
  public needsSpecializationChoice(): boolean {
    const levelsToUpgrade = BEACON_PLACEMENT_CONFIG.AUTO_LEVEL_INTERVAL;
    return (
      this.level > 1 &&
      this.level % levelsToUpgrade === 0 &&
      this.specialization === 'none' &&
      !this.upgradePendingAt
    );
  }

  /**
   * Apply specialization to this beacon
   */
  public applySpecialization(specialization: BeaconSpecialization): void {
    if (this.specialization !== 'none') {
      throw new Error('Beacon already has a specialization');
    }

    this.specialization = specialization;
    this.generationRate = this.calculateGenerationRate();
    this.lastUpgraded = Date.now();
    this.upgradePendingAt = undefined;
  }

  /**
   * Level up this beacon
   */
  public levelUp(): void {
    if (this.level >= BEACON_PLACEMENT_CONFIG.MAX_LEVEL) {
      throw new Error('Beacon is already at maximum level');
    }

    this.level++;
    this.generationRate = this.calculateGenerationRate();
    this.lastUpgraded = Date.now();

    // Check if specialization choice is needed
    if (this.needsSpecializationChoice()) {
      this.upgradePendingAt = Date.now();
    }
  }

  /**
   * Add a connection to another beacon
   */
  public addConnection(beaconId: string): boolean {
    if (this.connections.includes(beaconId)) {
      return false; // Already connected
    }

    if (this.connections.length >= this.getMaxConnections()) {
      return false; // At max capacity
    }

    this.connections.push(beaconId);
    return true;
  }

  /**
   * Remove a connection to another beacon
   */
  public removeConnection(beaconId: string): boolean {
    const index = this.connections.indexOf(beaconId);
    if (index === -1) {
      return false; // Not connected
    }

    this.connections.splice(index, 1);
    return true;
  }

  /**
   * Check if this beacon is connected to another
   */
  public isConnectedTo(beaconId: string): boolean {
    return this.connections.includes(beaconId);
  }

  /**
   * Validate beacon state consistency
   */
  public validateState(): BeaconValidationResult {
    const reasons: string[] = [];

    // Check level bounds
    if (this.level < 1) {
      reasons.push('Level must be at least 1');
    }

    if (this.level > BEACON_PLACEMENT_CONFIG.MAX_LEVEL) {
      reasons.push(`Level cannot exceed ${BEACON_PLACEMENT_CONFIG.MAX_LEVEL}`);
    }

    // Check connection limits
    if (this.connections.length > this.getMaxConnections()) {
      reasons.push(
        `Too many connections: ${this.connections.length}/${this.getMaxConnections()}`
      );
    }

    // Check specialization consistency
    if (
      this.level < BEACON_PLACEMENT_CONFIG.AUTO_LEVEL_INTERVAL &&
      this.specialization !== 'none'
    ) {
      reasons.push('Specialization not available until level 5');
    }

    // Check status
    if (
      !['active', 'inactive', 'upgrading', 'corrupted'].includes(this.status)
    ) {
      reasons.push('Invalid beacon status');
    }

    return {
      isValid: reasons.length === 0,
      reasons,
    };
  }

  /**
   * Get upgrade cost for next level
   */
  public getUpgradeCost(): number {
    const baseCost = BEACON_TYPE_CONFIG[this.type].upgradeCost;
    const levelMultiplier = Math.pow(1.5, this.level - 1);
    return Math.floor(baseCost * levelMultiplier);
  }

  /**
   * Create a serializable representation for saving
   */
  public toSaveData(): BeaconEntity {
    return {
      id: this.id,
      position: this.position,
      level: this.level,
      type: this.type,
      specialization: this.specialization,
      status: this.status,
      connections: [...this.connections],
      generationRate: this.generationRate,
      createdAt: this.createdAt,
      lastUpgraded: this.lastUpgraded,
      totalResourcesGenerated: this.totalResourcesGenerated,
      upgradePendingAt: this.upgradePendingAt,
    };
  }

  /**
   * Calculate pattern stability bonus multiplier
   */
  public getPatternStabilityBonus(): number {
    return SPECIALIZATION_CONFIG[this.specialization].stability;
  }

  /**
   * Get efficiency multiplier for resource generation
   */
  public getEfficiencyMultiplier(): number {
    return SPECIALIZATION_CONFIG[this.specialization].efficiency;
  }

  /**
   * Update total resources generated (called by generation engine)
   */
  public addResourcesGenerated(amount: number): void {
    this.totalResourcesGenerated += amount;
  }
}
