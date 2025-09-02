import BigNumber from 'bignumber.js';
import {
  Upgrade,
  UpgradeCategory,
  PlayerUpgrade,
  ConsciousnessExpansionMilestone,
  MilestoneChoice,
  UpgradePreview,
  UpgradeImpact,
  UpgradeEffect,
  UpgradeCost,
  UpgradeUnlockCondition,
  UPGRADE_CATEGORIES,
  CONSCIOUSNESS_EXPANSION_MILESTONES,
} from '../types/upgrade';
import {
  UpgradeData,
  PlayerUpgrade as SavePlayerUpgrade,
  ConsciousnessExpansionMilestone as SaveMilestone,
} from '../storage/schemas/GameState';
import { ResourceType } from '../types/resources';
import { ResourceManager } from './ResourceManager';

export interface UpgradeManagerState {
  playerUpgrades: Record<string, PlayerUpgrade>;
  completedMilestones: Record<string, ConsciousnessExpansionMilestone>;
  availableMilestones: ConsciousnessExpansionMilestone[];
  lastUpdated: number;
}

export class UpgradeManager {
  private static instance: UpgradeManager | null = null;
  private state: UpgradeManagerState;
  private resourceManager: ResourceManager;
  private upgrades: Map<string, Upgrade> = new Map();
  private categories: Map<string, UpgradeCategory> = new Map();

  private constructor() {
    this.resourceManager = ResourceManager.getInstance();
    this.state = {
      playerUpgrades: {},
      completedMilestones: {},
      availableMilestones: [],
      lastUpdated: Date.now(),
    };

    this.initializeUpgrades();
    this.initializeCategories();
  }

  static getInstance(): UpgradeManager {
    if (!UpgradeManager.instance) {
      UpgradeManager.instance = new UpgradeManager();
    }
    return UpgradeManager.instance;
  }

  /**
   * Initialize upgrade categories
   */
  private initializeCategories(): void {
    Object.values(UPGRADE_CATEGORIES).forEach(category => {
      this.categories.set(category.id, category);
    });
  }

  /**
   * Initialize basic upgrades for each category
   */
  private initializeUpgrades(): void {
    // Beacon Efficiency Upgrades
    this.addUpgrade({
      id: 'beacon_efficiency_1',
      categoryId: 'beacon_efficiency',
      name: 'Enhanced Quantum Resonance',
      description: 'Improve beacon efficiency by 25%',
      baseCost: { quantumData: new BigNumber(500) },
      costMultiplier: new BigNumber(1.5),
      maxLevel: 25,
      effects: [
        {
          type: 'beacon_efficiency',
          target: 'all',
          value: new BigNumber(0),
          multiplier: new BigNumber(1.25),
          description: '25% beacon efficiency increase',
        },
      ],
      unlockConditions: [
        {
          type: 'beacon_count',
          target: 'all',
          value: new BigNumber(5),
          description: 'Place 5 beacons',
        },
      ],
    });

    this.addUpgrade({
      id: 'beacon_efficiency_2',
      categoryId: 'beacon_efficiency',
      name: 'Advanced Signal Processing',
      description: 'Further improve beacon efficiency by 50%',
      baseCost: { quantumData: new BigNumber(2500) },
      costMultiplier: new BigNumber(1.6),
      maxLevel: 20,
      effects: [
        {
          type: 'beacon_efficiency',
          target: 'all',
          value: new BigNumber(0),
          multiplier: new BigNumber(1.5),
          description: '50% beacon efficiency increase',
        },
      ],
      unlockConditions: [
        {
          type: 'beacon_count',
          target: 'all',
          value: new BigNumber(15),
          description: 'Place 15 beacons',
        },
      ],
    });

    // Probe Speed Upgrades
    this.addUpgrade({
      id: 'probe_speed_1',
      categoryId: 'probe_systems',
      name: 'Improved Propulsion',
      description: 'Increase probe speed by 30%',
      baseCost: { quantumData: new BigNumber(750) },
      costMultiplier: new BigNumber(1.4),
      maxLevel: 20,
      effects: [
        {
          type: 'probe_speed',
          target: 'all',
          value: new BigNumber(0),
          multiplier: new BigNumber(1.3),
          description: '30% probe speed increase',
        },
      ],
      unlockConditions: [
        {
          type: 'beacon_count',
          target: 'all',
          value: new BigNumber(3),
          description: 'Place 3 beacons',
        },
      ],
    });

    this.addUpgrade({
      id: 'launch_capacity_1',
      categoryId: 'probe_systems',
      name: 'Expanded Launch Bays',
      description: 'Increase probe launch capacity by 2',
      baseCost: { quantumData: new BigNumber(1000) },
      costMultiplier: new BigNumber(2),
      maxLevel: 10,
      effects: [
        {
          type: 'launch_capacity',
          target: 'all',
          value: new BigNumber(2),
          multiplier: new BigNumber(1),
          description: '+2 probe launch capacity',
        },
      ],
      unlockConditions: [
        {
          type: 'beacon_count',
          target: 'all',
          value: new BigNumber(8),
          description: 'Place 8 beacons',
        },
      ],
    });

    // Offline Processing Upgrades
    this.addUpgrade({
      id: 'offline_earnings_1',
      categoryId: 'offline_processing',
      name: 'Autonomous Processing',
      description: 'Increase offline resource generation by 25%',
      baseCost: { quantumData: new BigNumber(1200) },
      costMultiplier: new BigNumber(1.8),
      maxLevel: 15,
      effects: [
        {
          type: 'offline_earnings',
          target: 'all',
          value: new BigNumber(0),
          multiplier: new BigNumber(1.25),
          description: '25% offline earnings increase',
        },
      ],
      unlockConditions: [
        {
          type: 'beacon_count',
          target: 'all',
          value: new BigNumber(10),
          description: 'Place 10 beacons',
        },
      ],
    });

    console.log(`[UpgradeManager] Initialized ${this.upgrades.size} upgrades`);
  }

  /**
   * Add a new upgrade to the system
   */
  private addUpgrade(upgrade: Upgrade): void {
    this.upgrades.set(upgrade.id, upgrade);
  }

  /**
   * Get all available upgrade categories
   */
  getCategories(): UpgradeCategory[] {
    return Array.from(this.categories.values());
  }

  /**
   * Get upgrades by category
   */
  getUpgradesByCategory(categoryId: string): Upgrade[] {
    return Array.from(this.upgrades.values()).filter(
      upgrade => upgrade.categoryId === categoryId
    );
  }

  /**
   * Get all upgrades
   */
  getAllUpgrades(): Upgrade[] {
    return Array.from(this.upgrades.values());
  }

  /**
   * Get upgrade by ID
   */
  getUpgrade(upgradeId: string): Upgrade | null {
    return this.upgrades.get(upgradeId) || null;
  }

  /**
   * Get player's current upgrade level
   */
  getUpgradeLevel(upgradeId: string): number {
    return this.state.playerUpgrades[upgradeId]?.level || 0;
  }

  /**
   * Check if an upgrade is unlocked based on conditions
   */
  isUpgradeUnlocked(upgradeId: string, currentBeaconCount: number): boolean {
    const upgrade = this.getUpgrade(upgradeId);
    if (!upgrade) return false;

    for (const condition of upgrade.unlockConditions) {
      if (!this.checkUnlockCondition(condition, currentBeaconCount)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check a specific unlock condition
   */
  private checkUnlockCondition(
    condition: UpgradeUnlockCondition,
    currentBeaconCount: number
  ): boolean {
    switch (condition.type) {
      case 'beacon_count':
        return new BigNumber(currentBeaconCount).isGreaterThanOrEqualTo(
          condition.value
        );
      case 'resource_earned':
        // This would check total resources earned - not implemented yet
        return true;
      case 'pattern_discovered':
        // This would check pattern discovery - not implemented yet
        return true;
      case 'achievement':
        // This would check achievements - not implemented yet
        return true;
      case 'milestone_reached':
        return !!this.state.completedMilestones[condition.target];
      default:
        return false;
    }
  }

  /**
   * Get the cost for the next level of an upgrade
   */
  getUpgradeCost(upgradeId: string): UpgradeCost | null {
    const upgrade = this.getUpgrade(upgradeId);
    if (!upgrade) return null;

    const currentLevel = this.getUpgradeLevel(upgradeId);
    if (currentLevel >= upgrade.maxLevel) return null;

    const cost: UpgradeCost = {};
    Object.entries(upgrade.baseCost).forEach(([resource, baseCost]) => {
      cost[resource] = baseCost.multipliedBy(
        upgrade.costMultiplier.pow(currentLevel)
      );
    });

    return cost;
  }

  /**
   * Check if player can afford an upgrade
   */
  canAffordUpgrade(upgradeId: string): boolean {
    const cost = this.getUpgradeCost(upgradeId);
    if (!cost) return false;

    return this.resourceManager.canAfford(cost);
  }

  /**
   * Purchase an upgrade
   */
  purchaseUpgrade(upgradeId: string): { success: boolean; error?: string } {
    const upgrade = this.getUpgrade(upgradeId);
    if (!upgrade) {
      return { success: false, error: 'Upgrade not found' };
    }

    const currentLevel = this.getUpgradeLevel(upgradeId);
    if (currentLevel >= upgrade.maxLevel) {
      return { success: false, error: 'Upgrade already at maximum level' };
    }

    const cost = this.getUpgradeCost(upgradeId);
    if (!cost || !this.canAffordUpgrade(upgradeId)) {
      return { success: false, error: 'Insufficient resources' };
    }

    // Spend resources
    if (!this.resourceManager.spendResources(cost)) {
      return { success: false, error: 'Failed to spend resources' };
    }

    // Update player upgrade
    if (!this.state.playerUpgrades[upgradeId]) {
      this.state.playerUpgrades[upgradeId] = {
        upgradeId,
        level: 0,
        purchasedAt: Date.now(),
        totalSpent: {},
      };
    }

    this.state.playerUpgrades[upgradeId].level = currentLevel + 1;
    this.state.playerUpgrades[upgradeId].purchasedAt = Date.now();

    // Track total spent
    Object.entries(cost).forEach(([resource, amount]) => {
      const current =
        this.state.playerUpgrades[upgradeId].totalSpent[resource] ||
        new BigNumber(0);
      this.state.playerUpgrades[upgradeId].totalSpent[resource] =
        current.plus(amount);
    });

    this.state.lastUpdated = Date.now();

    console.log(
      `[UpgradeManager] Purchased ${upgrade.name} level ${currentLevel + 1}`
    );
    return { success: true };
  }

  /**
   * Update available milestones based on current beacon count
   */
  updateMilestones(currentBeaconCount: number): void {
    const previousAvailable = this.state.availableMilestones.length;

    this.state.availableMilestones = CONSCIOUSNESS_EXPANSION_MILESTONES.filter(
      milestone =>
        currentBeaconCount >= milestone.requiredBeacons &&
        !this.state.completedMilestones[milestone.id]
    );

    const newlyAvailable =
      this.state.availableMilestones.length - previousAvailable;
    if (newlyAvailable > 0) {
      console.log(
        `[UpgradeManager] ${newlyAvailable} new milestone(s) available!`
      );
      this.state.availableMilestones.forEach(milestone => {
        console.log(
          `[UpgradeManager] Available: ${milestone.name} (${milestone.requiredBeacons} beacons)`
        );
      });
    }
  }

  /**
   * Get the next milestone requirements
   */
  getNextMilestone(
    currentBeaconCount: number
  ): ConsciousnessExpansionMilestone | null {
    return (
      CONSCIOUSNESS_EXPANSION_MILESTONES.filter(
        milestone =>
          currentBeaconCount < milestone.requiredBeacons &&
          !this.state.completedMilestones[milestone.id]
      ).sort((a, b) => a.requiredBeacons - b.requiredBeacons)[0] || null
    );
  }

  /**
   * Get milestone progress information
   */
  getMilestoneProgress(currentBeaconCount: number): {
    current: number;
    next?: ConsciousnessExpansionMilestone;
    progress: number;
    completed: number;
    total: number;
  } {
    const nextMilestone = this.getNextMilestone(currentBeaconCount);
    const completedCount = Object.keys(this.state.completedMilestones).length;
    const totalMilestones = CONSCIOUSNESS_EXPANSION_MILESTONES.length;

    let progress = 1; // 100% if no next milestone
    if (nextMilestone) {
      const previousMilestone = CONSCIOUSNESS_EXPANSION_MILESTONES.filter(
        m => m.requiredBeacons <= currentBeaconCount
      ).sort((a, b) => b.requiredBeacons - a.requiredBeacons)[0];

      const previousBeacons = previousMilestone?.requiredBeacons || 0;
      const requiredBeacons = nextMilestone.requiredBeacons - previousBeacons;
      const currentProgress = currentBeaconCount - previousBeacons;

      progress = Math.min(currentProgress / requiredBeacons, 1);
    }

    return {
      current: currentBeaconCount,
      next: nextMilestone || undefined,
      progress,
      completed: completedCount,
      total: totalMilestones,
    };
  }

  /**
   * Get available milestones
   */
  getAvailableMilestones(): ConsciousnessExpansionMilestone[] {
    return [...this.state.availableMilestones];
  }

  /**
   * Get completed milestones
   */
  getCompletedMilestones(): ConsciousnessExpansionMilestone[] {
    return Object.values(this.state.completedMilestones);
  }

  /**
   * Complete a milestone choice
   */
  completeMilestone(
    milestoneId: string,
    choiceId: string
  ): { success: boolean; error?: string; effects?: UpgradeEffect[] } {
    const milestone = this.state.availableMilestones.find(
      m => m.id === milestoneId
    );
    if (!milestone) {
      return { success: false, error: 'Milestone not available' };
    }

    const choice = milestone.choices.find(c => c.id === choiceId);
    if (!choice) {
      return { success: false, error: 'Choice not found' };
    }

    // Validate that milestone is actually available (double-check)
    if (this.state.completedMilestones[milestoneId]) {
      return { success: false, error: 'Milestone already completed' };
    }

    // Mark milestone as completed
    const completedMilestone: ConsciousnessExpansionMilestone = {
      ...milestone,
      completedAt: Date.now(),
      chosenOption: choiceId,
    };

    this.state.completedMilestones[milestoneId] = completedMilestone;

    // Remove from available milestones
    this.state.availableMilestones = this.state.availableMilestones.filter(
      m => m.id !== milestoneId
    );

    this.state.lastUpdated = Date.now();

    console.log(
      `[UpgradeManager] Completed milestone ${milestone.name} with choice ${choice.name}`
    );

    // Log the effects that were applied
    choice.effects.forEach(effect => {
      console.log(`[UpgradeManager] Applied effect: ${effect.description}`);
    });

    return {
      success: true,
      effects: [...choice.effects],
    };
  }

  /**
   * Get details about a milestone choice for preview
   */
  getMilestoneChoicePreview(
    milestoneId: string,
    choiceId: string
  ): {
    milestone: ConsciousnessExpansionMilestone;
    choice: MilestoneChoice;
    effects: UpgradeEffect[];
    impactDescription: string[];
  } | null {
    const milestone = this.state.availableMilestones.find(
      m => m.id === milestoneId
    );
    if (!milestone) return null;

    const choice = milestone.choices.find(c => c.id === choiceId);
    if (!choice) return null;

    // Generate impact descriptions based on effects
    const impactDescription = choice.effects.map(effect => {
      if (effect.multiplier && effect.multiplier.isGreaterThan(1)) {
        const percentIncrease = effect.multiplier
          .minus(1)
          .multipliedBy(100)
          .toFixed(0);
        return `+${percentIncrease}% ${this.getEffectTargetDescription(effect)}`;
      } else if (effect.value.isGreaterThan(0)) {
        return `+${effect.value.toFixed(0)} ${this.getEffectTargetDescription(effect)}`;
      }
      return effect.description;
    });

    return {
      milestone,
      choice,
      effects: [...choice.effects],
      impactDescription,
    };
  }

  /**
   * Get a human-readable description of an effect target
   */
  private getEffectTargetDescription(effect: UpgradeEffect): string {
    switch (effect.type) {
      case 'beacon_efficiency':
        return 'beacon efficiency';
      case 'probe_speed':
        return 'probe speed';
      case 'launch_capacity':
        return 'probe launch capacity';
      case 'offline_earnings':
        return 'offline earnings';
      case 'resource_generation':
        return effect.target === 'all'
          ? 'all resource generation'
          : `${effect.target} generation`;
      case 'beacon_range':
        return 'beacon connection range';
      case 'pattern_bonus':
        return 'pattern bonuses';
      default:
        return effect.target;
    }
  }

  /**
   * Check if a specific milestone choice is better than another based on current game state
   */
  compareMilestoneChoices(
    milestoneId: string,
    currentBeaconCount: number,
    currentResourceGenerationRates: Record<string, BigNumber>
  ): {
    milestone: ConsciousnessExpansionMilestone;
    recommendations: {
      choiceId: string;
      score: number;
      reason: string;
    }[];
  } | null {
    const milestone = this.state.availableMilestones.find(
      m => m.id === milestoneId
    );
    if (!milestone) return null;

    const recommendations = milestone.choices.map(choice => {
      let score = 50; // Base score
      let reason = `${choice.name}: ${choice.description}`;

      // Analyze effects and adjust score based on current game state
      choice.effects.forEach(effect => {
        switch (effect.type) {
          case 'beacon_efficiency':
            // Higher score if we have many beacons
            if (currentBeaconCount >= 20) {
              score += 20;
              reason += ` (Good for ${currentBeaconCount} beacons)`;
            }
            break;
          case 'probe_speed':
            // Higher score if we're in early-mid game
            if (currentBeaconCount <= 50) {
              score += 15;
              reason += ` (Good for expansion phase)`;
            }
            break;
          case 'resource_generation':
            // Always valuable
            score += 10;
            break;
          case 'offline_earnings':
            // Good for players who play intermittently
            score += 12;
            reason += ` (Great for idle play)`;
            break;
        }
      });

      return {
        choiceId: choice.id,
        score,
        reason,
      };
    });

    // Sort by score (highest first)
    recommendations.sort((a, b) => b.score - a.score);

    return {
      milestone,
      recommendations,
    };
  }

  /**
   * Get preview of upgrade impact
   */
  getUpgradePreview(upgradeId: string): UpgradePreview | null {
    const upgrade = this.getUpgrade(upgradeId);
    if (!upgrade) return null;

    const currentLevel = this.getUpgradeLevel(upgradeId);
    const nextLevel = currentLevel + 1;
    const cost = this.getUpgradeCost(upgradeId);

    if (!cost || nextLevel > upgrade.maxLevel) return null;

    const canAfford = this.canAffordUpgrade(upgradeId);

    // Calculate current and next effects
    const currentEffects = this.calculateUpgradeEffects(upgrade, currentLevel);
    const nextEffects = this.calculateUpgradeEffects(upgrade, nextLevel);

    // Calculate impact summary (placeholder implementation)
    const impactSummary = this.calculateUpgradeImpact(
      currentEffects,
      nextEffects
    );

    return {
      upgrade,
      currentLevel,
      nextLevel,
      cost,
      canAfford,
      currentEffects,
      nextEffects,
      impactSummary,
    };
  }

  /**
   * Calculate upgrade effects for a given level
   */
  private calculateUpgradeEffects(
    upgrade: Upgrade,
    level: number
  ): UpgradeEffect[] {
    if (level <= 0) return [];

    return upgrade.effects.map(effect => ({
      ...effect,
      value: effect.value.multipliedBy(level),
      multiplier: effect.multiplier
        ? new BigNumber(1).plus(effect.multiplier.minus(1).multipliedBy(level))
        : new BigNumber(1),
    }));
  }

  /**
   * Calculate upgrade impact with detailed analysis
   */
  private calculateUpgradeImpact(
    currentEffects: UpgradeEffect[],
    nextEffects: UpgradeEffect[]
  ): UpgradeImpact {
    const impact: UpgradeImpact = {
      resourceGeneration: {},
    };

    // Calculate resource generation impacts
    const currentResourceMultipliers =
      this.calculateResourceMultipliers(currentEffects);
    const nextResourceMultipliers =
      this.calculateResourceMultipliers(nextEffects);

    Object.entries(nextResourceMultipliers).forEach(
      ([resourceType, nextMultiplier]) => {
        const currentMultiplier =
          currentResourceMultipliers[resourceType] || new BigNumber(1);
        const change = nextMultiplier.minus(currentMultiplier);
        const changePercentage = currentMultiplier.isGreaterThan(0)
          ? change.dividedBy(currentMultiplier).multipliedBy(100)
          : new BigNumber(0);

        impact.resourceGeneration[resourceType as ResourceType] = {
          current: currentMultiplier,
          next: nextMultiplier,
          change,
          changePercentage,
        };
      }
    );

    // Calculate beacon efficiency impact
    const currentBeaconEfficiency =
      this.calculateEfficiencyMultiplier(currentEffects);
    const nextBeaconEfficiency =
      this.calculateEfficiencyMultiplier(nextEffects);

    if (!currentBeaconEfficiency.isEqualTo(nextBeaconEfficiency)) {
      impact.beaconEfficiency = {
        current: currentBeaconEfficiency,
        next: nextBeaconEfficiency,
        change: nextBeaconEfficiency.minus(currentBeaconEfficiency),
      };
    }

    // Calculate probe speed impact
    const currentProbeSpeed =
      this.calculateProbeSpeedMultiplier(currentEffects);
    const nextProbeSpeed = this.calculateProbeSpeedMultiplier(nextEffects);

    if (!currentProbeSpeed.isEqualTo(nextProbeSpeed)) {
      impact.probeSpeed = {
        current: currentProbeSpeed,
        next: nextProbeSpeed,
        change: nextProbeSpeed.minus(currentProbeSpeed),
      };
    }

    // Calculate offline earnings impact
    const currentOffline = this.calculateOfflineMultiplier(currentEffects);
    const nextOffline = this.calculateOfflineMultiplier(nextEffects);

    if (!currentOffline.isEqualTo(nextOffline)) {
      impact.offlineEarnings = {
        current: currentOffline,
        next: nextOffline,
        change: nextOffline.minus(currentOffline),
      };
    }

    return impact;
  }

  /**
   * Calculate resource generation multipliers from effects
   */
  private calculateResourceMultipliers(
    effects: UpgradeEffect[]
  ): Record<string, BigNumber> {
    const multipliers: Record<string, BigNumber> = {};

    effects.forEach(effect => {
      if (effect.type === 'resource_generation') {
        if (effect.target === 'all') {
          // Apply to all resource types
          [
            'quantumData',
            'stellarEssence',
            'voidFragments',
            'resonanceCrystals',
            'chronosParticles',
          ].forEach(resourceType => {
            const current = multipliers[resourceType] || new BigNumber(1);
            multipliers[resourceType] = current.multipliedBy(
              effect.multiplier || new BigNumber(1)
            );
          });
        } else {
          const current = multipliers[effect.target] || new BigNumber(1);
          multipliers[effect.target] = current.multipliedBy(
            effect.multiplier || new BigNumber(1)
          );
        }
      }
    });

    return multipliers;
  }

  /**
   * Calculate beacon efficiency multiplier from effects
   */
  private calculateEfficiencyMultiplier(effects: UpgradeEffect[]): BigNumber {
    let multiplier = new BigNumber(1);

    effects.forEach(effect => {
      if (effect.type === 'beacon_efficiency' && effect.multiplier) {
        multiplier = multiplier.multipliedBy(effect.multiplier);
      }
    });

    return multiplier;
  }

  /**
   * Calculate probe speed multiplier from effects
   */
  private calculateProbeSpeedMultiplier(effects: UpgradeEffect[]): BigNumber {
    let multiplier = new BigNumber(1);

    effects.forEach(effect => {
      if (effect.type === 'probe_speed' && effect.multiplier) {
        multiplier = multiplier.multipliedBy(effect.multiplier);
      }
    });

    return multiplier;
  }

  /**
   * Calculate offline earnings multiplier from effects
   */
  private calculateOfflineMultiplier(effects: UpgradeEffect[]): BigNumber {
    let multiplier = new BigNumber(1);

    effects.forEach(effect => {
      if (effect.type === 'offline_earnings' && effect.multiplier) {
        multiplier = multiplier.multipliedBy(effect.multiplier);
      }
    });

    return multiplier;
  }

  /**
   * Get comprehensive upgrade analysis with impact on current game state
   */
  getDetailedUpgradeAnalysis(
    upgradeId: string,
    currentGameState?: {
      beaconCount: number;
      resourceGenerationRates: Record<string, BigNumber>;
      totalResourcesPerSecond: BigNumber;
    }
  ): {
    preview: UpgradePreview;
    recommendation:
      | 'highly_recommended'
      | 'recommended'
      | 'situational'
      | 'not_recommended';
    reasoning: string[];
    costEfficiency: {
      resourcesPerQuantumDataSpent: BigNumber;
      paybackTimeHours: BigNumber;
    } | null;
  } | null {
    const preview = this.getUpgradePreview(upgradeId);
    if (!preview) return null;

    const reasoning: string[] = [];
    let recommendation:
      | 'highly_recommended'
      | 'recommended'
      | 'situational'
      | 'not_recommended' = 'situational';

    // Analyze upgrade effects
    const hasResourceGeneration = preview.nextEffects.some(
      e => e.type === 'resource_generation'
    );
    const hasBeaconEfficiency = preview.nextEffects.some(
      e => e.type === 'beacon_efficiency'
    );
    const hasProbeSpeed = preview.nextEffects.some(
      e => e.type === 'probe_speed'
    );
    const hasOfflineEarnings = preview.nextEffects.some(
      e => e.type === 'offline_earnings'
    );

    // Scoring system
    let score = 0;

    if (hasResourceGeneration) {
      score += 30;
      reasoning.push('Increases resource generation rates');
      if (currentGameState?.beaconCount && currentGameState.beaconCount >= 10) {
        score += 20;
        reasoning.push(
          `Especially valuable with ${currentGameState.beaconCount} active beacons`
        );
      }
    }

    if (hasBeaconEfficiency) {
      score += 25;
      reasoning.push('Improves beacon efficiency');
      if (currentGameState?.beaconCount && currentGameState.beaconCount >= 20) {
        score += 15;
        reasoning.push('High impact due to beacon count');
      }
    }

    if (
      hasProbeSpeed &&
      currentGameState?.beaconCount &&
      currentGameState.beaconCount <= 50
    ) {
      score += 20;
      reasoning.push('Useful for expansion phase');
    } else if (hasProbeSpeed) {
      score += 10;
      reasoning.push('Moderate benefit for probe operations');
    }

    if (hasOfflineEarnings) {
      score += 15;
      reasoning.push('Improves idle gameplay experience');
    }

    // Cost analysis
    const quantumDataCost = preview.cost.quantumData;
    let costEfficiency: {
      resourcesPerQuantumDataSpent: BigNumber;
      paybackTimeHours: BigNumber;
    } | null = null;

    if (currentGameState?.totalResourcesPerSecond && quantumDataCost) {
      const estimatedIncreasePercent = new BigNumber(0.1); // Simplified 10% increase estimate
      const additionalResourcesPerSecond =
        currentGameState.totalResourcesPerSecond.multipliedBy(
          estimatedIncreasePercent
        );

      if (additionalResourcesPerSecond.isGreaterThan(0)) {
        const paybackTimeSeconds = quantumDataCost.dividedBy(
          additionalResourcesPerSecond
        );
        const paybackTimeHours = paybackTimeSeconds.dividedBy(3600);

        costEfficiency = {
          resourcesPerQuantumDataSpent:
            additionalResourcesPerSecond.dividedBy(quantumDataCost),
          paybackTimeHours,
        };

        if (paybackTimeHours.isLessThan(24)) {
          score += 15;
          reasoning.push('Fast payback time (< 24 hours)');
        } else if (paybackTimeHours.isLessThan(72)) {
          score += 10;
          reasoning.push('Good payback time (< 3 days)');
        }
      }
    }

    // Determine recommendation
    if (score >= 70) {
      recommendation = 'highly_recommended';
    } else if (score >= 50) {
      recommendation = 'recommended';
    } else if (score >= 30) {
      recommendation = 'situational';
    } else {
      recommendation = 'not_recommended';
    }

    // Add cost affordability reasoning
    if (!preview.canAfford) {
      reasoning.push('Currently unaffordable - save more resources');
      recommendation = 'not_recommended';
    }

    return {
      preview,
      recommendation,
      reasoning,
      costEfficiency,
    };
  }

  /**
   * Get all active upgrade effects for application to game systems
   */
  getActiveUpgradeEffects(): UpgradeEffect[] {
    const allEffects: UpgradeEffect[] = [];

    // Get effects from purchased upgrades
    Object.values(this.state.playerUpgrades).forEach(playerUpgrade => {
      const upgrade = this.getUpgrade(playerUpgrade.upgradeId);
      if (upgrade && playerUpgrade.level > 0) {
        const effects = this.calculateUpgradeEffects(
          upgrade,
          playerUpgrade.level
        );
        allEffects.push(...effects);
      }
    });

    // Get effects from completed milestones
    Object.values(this.state.completedMilestones).forEach(milestone => {
      if (milestone.chosenOption) {
        const choice = milestone.choices.find(
          c => c.id === milestone.chosenOption
        );
        if (choice) {
          allEffects.push(...choice.effects);
        }
      }
    });

    return allEffects;
  }

  /**
   * Load upgrade manager state from saved data
   */
  loadFromState(savedState: Partial<UpgradeData>): void {
    if (savedState.playerUpgrades) {
      // Convert saved data to internal format with BigNumber instances
      this.state.playerUpgrades = {};
      Object.entries(savedState.playerUpgrades).forEach(
        ([id, savedUpgrade]) => {
          const upgrade: PlayerUpgrade = {
            upgradeId: savedUpgrade.upgradeId,
            level: savedUpgrade.level,
            purchasedAt: savedUpgrade.purchasedAt,
            totalSpent: {},
          };

          // Convert totalSpent from numbers back to BigNumbers
          Object.entries(savedUpgrade.totalSpent).forEach(
            ([resource, amount]) => {
              upgrade.totalSpent[resource] = new BigNumber(amount);
            }
          );

          this.state.playerUpgrades[id] = upgrade;
        }
      );
    }

    if (savedState.completedMilestones) {
      // Convert saved milestones to internal format
      this.state.completedMilestones = {};
      Object.entries(savedState.completedMilestones).forEach(
        ([id, savedMilestone]) => {
          this.state.completedMilestones[id] = {
            id: savedMilestone.id,
            name: savedMilestone.name,
            description: savedMilestone.description,
            requiredBeacons: savedMilestone.requiredBeacons,
            completedAt: savedMilestone.completedAt,
            chosenOption: savedMilestone.chosenOption,
            choices: [], // Will be populated from CONSCIOUSNESS_EXPANSION_MILESTONES
          };
        }
      );
    }

    this.state.lastUpdated = savedState.lastUpdated || Date.now();

    console.log(
      `[UpgradeManager] Loaded state with ${Object.keys(this.state.playerUpgrades).length} upgrades`
    );
  }

  /**
   * Export upgrade manager state for saving
   */
  toSaveState(): UpgradeData {
    // Convert internal format to save format
    const playerUpgrades: Record<string, SavePlayerUpgrade> = {};

    Object.entries(this.state.playerUpgrades).forEach(([id, upgrade]) => {
      const totalSpent: Record<string, number> = {};
      Object.entries(upgrade.totalSpent).forEach(([resource, amount]) => {
        totalSpent[resource] = amount.toNumber(); // Convert BigNumber to number for storage
      });

      playerUpgrades[id] = {
        upgradeId: upgrade.upgradeId,
        level: upgrade.level,
        purchasedAt: upgrade.purchasedAt,
        totalSpent,
      };
    });

    // Convert completed milestones to save format
    const completedMilestones: Record<string, SaveMilestone> = {};
    Object.entries(this.state.completedMilestones).forEach(
      ([id, milestone]) => {
        completedMilestones[id] = {
          id: milestone.id,
          name: milestone.name,
          description: milestone.description,
          requiredBeacons: milestone.requiredBeacons,
          completedAt: milestone.completedAt,
          chosenOption: milestone.chosenOption,
        };
      }
    );

    return {
      playerUpgrades,
      completedMilestones,
      lastUpdated: this.state.lastUpdated,
    };
  }

  /**
   * Reset all upgrades (for debugging/testing)
   */
  reset(): void {
    this.state = {
      playerUpgrades: {},
      completedMilestones: {},
      availableMilestones: [],
      lastUpdated: Date.now(),
    };
    console.log('[UpgradeManager] Reset all upgrade progress');
  }
}
