import {
  BeaconSpecialization,
  BeaconUpgradeOption,
  SPECIALIZATION_OPTIONS,
  BEACON_PLACEMENT_CONFIG,
} from '../types/beacon';
import { Beacon } from '../entities/Beacon';

export interface UpgradeEvent {
  beaconId: string;
  fromLevel: number;
  toLevel: number;
  timestamp: number;
  specializationChosen?: BeaconSpecialization;
}

export interface UpgradeStats {
  totalUpgrades: number;
  specializationCounts: Record<BeaconSpecialization, number>;
  averageLevel: number;
  highestLevel: number;
}

export class BeaconUpgradeManager {
  private upgradeHistory: UpgradeEvent[] = [];
  private pendingSpecializations: Map<string, number> = new Map(); // beacon ID -> level when choice became available
  private onSpecializationNeeded?: (
    beaconId: string,
    options: BeaconUpgradeOption[]
  ) => void;
  private onUpgradeCompleted?: (event: UpgradeEvent) => void;

  constructor(config?: {
    onSpecializationNeeded?: (
      beaconId: string,
      options: BeaconUpgradeOption[]
    ) => void;
    onUpgradeCompleted?: (event: UpgradeEvent) => void;
  }) {
    this.onSpecializationNeeded = config?.onSpecializationNeeded;
    this.onUpgradeCompleted = config?.onUpgradeCompleted;
  }

  /**
   * Process automatic leveling for a beacon based on resources generated
   */
  public processAutoLeveling(
    beacon: Beacon,
    resourcesGenerated: number
  ): boolean {
    const requiredResources = this.getResourcesRequiredForNextLevel(
      beacon.level
    );

    if (
      resourcesGenerated >= requiredResources &&
      beacon.level < BEACON_PLACEMENT_CONFIG.MAX_LEVEL
    ) {
      return this.levelUpBeacon(beacon);
    }

    return false;
  }

  /**
   * Level up a beacon
   */
  public levelUpBeacon(beacon: Beacon): boolean {
    const fromLevel = beacon.level;

    try {
      beacon.levelUp();

      const event: UpgradeEvent = {
        beaconId: beacon.id,
        fromLevel,
        toLevel: beacon.level,
        timestamp: Date.now(),
      };

      this.upgradeHistory.push(event);

      // Check if specialization choice is needed
      if (beacon.needsSpecializationChoice()) {
        this.pendingSpecializations.set(beacon.id, beacon.level);
        this.triggerSpecializationChoice(beacon.id);
      }

      this.onUpgradeCompleted?.(event);
      return true;
    } catch (error) {
      console.error('Failed to level up beacon:', error);
      return false;
    }
  }

  /**
   * Apply specialization to a beacon
   */
  public applySpecialization(
    beacon: Beacon,
    specialization: BeaconSpecialization
  ): boolean {
    try {
      beacon.applySpecialization(specialization);

      // Update upgrade history
      const lastUpgrade = this.upgradeHistory.find(
        event => event.beaconId === beacon.id && !event.specializationChosen
      );

      if (lastUpgrade) {
        lastUpgrade.specializationChosen = specialization;
      }

      // Remove from pending
      this.pendingSpecializations.delete(beacon.id);

      return true;
    } catch (error) {
      console.error('Failed to apply specialization:', error);
      return false;
    }
  }

  /**
   * Get available specialization options for a beacon
   */
  public getSpecializationOptions(beacon: Beacon): BeaconUpgradeOption[] {
    if (!beacon.needsSpecializationChoice()) {
      return [];
    }

    return [...SPECIALIZATION_OPTIONS];
  }

  /**
   * Check if a beacon has pending specialization choice
   */
  public hasPendingSpecialization(beaconId: string): boolean {
    return this.pendingSpecializations.has(beaconId);
  }

  /**
   * Get all beacons with pending specializations
   */
  public getPendingSpecializations(): string[] {
    return Array.from(this.pendingSpecializations.keys());
  }

  /**
   * Calculate resources required for next level
   */
  public getResourcesRequiredForNextLevel(currentLevel: number): number {
    // Exponential scaling: 100 * 1.5^level
    return Math.floor(100 * Math.pow(1.5, currentLevel));
  }

  /**
   * Calculate upgrade cost for a beacon
   */
  public getUpgradeCost(beacon: Beacon): number {
    return beacon.getUpgradeCost();
  }

  /**
   * Get upgrade statistics
   */
  public getUpgradeStats(beacons: Beacon[]): UpgradeStats {
    const specializationCounts: Record<BeaconSpecialization, number> = {
      none: 0,
      efficiency: 0,
      range: 0,
      stability: 0,
    };

    let totalLevel = 0;
    let highestLevel = 0;

    for (const beacon of beacons) {
      specializationCounts[beacon.specialization]++;
      totalLevel += beacon.level;
      highestLevel = Math.max(highestLevel, beacon.level);
    }

    return {
      totalUpgrades: this.upgradeHistory.length,
      specializationCounts,
      averageLevel: beacons.length > 0 ? totalLevel / beacons.length : 0,
      highestLevel,
    };
  }

  /**
   * Get upgrade history
   */
  public getUpgradeHistory(): UpgradeEvent[] {
    return [...this.upgradeHistory];
  }

  /**
   * Get recent upgrades (last n upgrades)
   */
  public getRecentUpgrades(count: number = 10): UpgradeEvent[] {
    return this.upgradeHistory.slice(-count);
  }

  /**
   * Clear upgrade history
   */
  public clearHistory(): void {
    this.upgradeHistory = [];
  }

  /**
   * Load upgrade history from save data
   */
  public loadHistory(events: UpgradeEvent[]): void {
    this.upgradeHistory = [...events];
  }

  /**
   * Export upgrade data for saving
   */
  public exportData(): {
    history: UpgradeEvent[];
    pendingSpecializations: { beaconId: string; level: number }[];
  } {
    return {
      history: this.upgradeHistory,
      pendingSpecializations: Array.from(
        this.pendingSpecializations.entries()
      ).map(([beaconId, level]) => ({ beaconId, level })),
    };
  }

  /**
   * Import upgrade data from save
   */
  public importData(data: {
    history?: UpgradeEvent[];
    pendingSpecializations?: { beaconId: string; level: number }[];
  }): void {
    if (data.history) {
      this.upgradeHistory = data.history;
    }

    if (data.pendingSpecializations) {
      this.pendingSpecializations.clear();
      data.pendingSpecializations.forEach(({ beaconId, level }) => {
        this.pendingSpecializations.set(beaconId, level);
      });
    }
  }

  /**
   * Process multiple beacons for auto-leveling
   */
  public processBeaconCollection(beacons: Beacon[]): {
    upgraded: string[];
    pendingSpecializations: string[];
  } {
    const upgraded: string[] = [];
    const pendingSpecializations: string[] = [];

    for (const beacon of beacons) {
      // Check if beacon should level up based on total resources generated
      const shouldUpgrade =
        beacon.totalResourcesGenerated >=
        this.getResourcesRequiredForNextLevel(beacon.level);

      if (shouldUpgrade && this.levelUpBeacon(beacon)) {
        upgraded.push(beacon.id);

        if (beacon.needsSpecializationChoice()) {
          pendingSpecializations.push(beacon.id);
        }
      }
    }

    return { upgraded, pendingSpecializations };
  }

  /**
   * Get next milestone for a beacon (resources needed for next level)
   */
  public getNextMilestone(beacon: Beacon): {
    currentLevel: number;
    nextLevel: number;
    resourcesNeeded: number;
    resourcesGenerated: number;
    progress: number; // 0-1
  } {
    const resourcesNeeded = this.getResourcesRequiredForNextLevel(beacon.level);
    const progress = Math.min(
      beacon.totalResourcesGenerated / resourcesNeeded,
      1
    );

    return {
      currentLevel: beacon.level,
      nextLevel: beacon.level + 1,
      resourcesNeeded,
      resourcesGenerated: beacon.totalResourcesGenerated,
      progress,
    };
  }

  /**
   * Predict when a beacon will level up based on current generation rate
   */
  public predictUpgradeTime(beacon: Beacon): number | null {
    if (beacon.level >= BEACON_PLACEMENT_CONFIG.MAX_LEVEL) {
      return null; // Already at max level
    }

    const milestone = this.getNextMilestone(beacon);
    const remainingResources =
      milestone.resourcesNeeded - milestone.resourcesGenerated;

    if (remainingResources <= 0) {
      return 0; // Ready now
    }

    const generationRate = beacon.generationRate;
    if (generationRate <= 0) {
      return null; // No generation
    }

    return remainingResources / generationRate; // Seconds until next level
  }

  /**
   * Trigger specialization choice UI
   */
  private triggerSpecializationChoice(beaconId: string): void {
    if (this.onSpecializationNeeded) {
      const options = SPECIALIZATION_OPTIONS;
      this.onSpecializationNeeded(beaconId, options);
    }
  }

  /**
   * Batch upgrade multiple beacons to specific level
   */
  public batchUpgrade(
    beacons: Beacon[],
    targetLevel: number
  ): {
    success: string[];
    failed: string[];
  } {
    const success: string[] = [];
    const failed: string[] = [];

    for (const beacon of beacons) {
      let upgraded = true;

      try {
        while (
          beacon.level < targetLevel &&
          beacon.level < BEACON_PLACEMENT_CONFIG.MAX_LEVEL
        ) {
          if (!this.levelUpBeacon(beacon)) {
            upgraded = false;
            break;
          }
        }

        if (upgraded) {
          success.push(beacon.id);
        } else {
          failed.push(beacon.id);
        }
      } catch {
        failed.push(beacon.id);
      }
    }

    return { success, failed };
  }
}
