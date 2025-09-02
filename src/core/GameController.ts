import { AppState, AppStateStatus } from 'react-native';
import { SaveManager } from './SaveManager';
import { ResourceManager } from './ResourceManager';
import { ResourceGenerationEngine } from './ResourceGenerationEngine';
import { BeaconPlacementManager } from './BeaconPlacementManager';
import { BeaconConnectionManager } from './BeaconConnectionManager';
import { ProbeManager } from './ProbeManager';
import { UpgradeManager } from './UpgradeManager';
import { GameState, DEFAULT_RESOURCES, DEFAULT_PLAYER_SETTINGS, DEFAULT_PLAYER_STATISTICS } from '../storage/schemas/GameState';
import { BeaconType } from '../types/beacon';
import { Point2D } from '../types/galaxy';
import { Beacon } from '../entities/Beacon';
import { batteryOptimizationManager, BatteryOptimizationState } from '../utils/performance/BatteryOptimizationManager';

export interface GameControllerConfig {
  autoSaveInterval: number; // seconds
  enableAppStateHandling: boolean;
  enableBackgroundProcessing: boolean;
}

export class GameController {
  private static instance: GameController | null = null;
  private saveManager: SaveManager;
  private resourceManager: ResourceManager;
  private generationEngine: ResourceGenerationEngine;
  private beaconPlacementManager: BeaconPlacementManager;
  private beaconConnectionManager: BeaconConnectionManager;
  private probeManager: ProbeManager;
  private upgradeManager: UpgradeManager;
  private gameState: GameState | null = null;
  private autoSaveTimer: NodeJS.Timeout | null = null;
  private gameTimer: NodeJS.Timeout | null = null;
  private lastActiveTime: number = Date.now();
  private isInitialized = false;
  private appStateSubscription: any = null;
  private gameStateChangeCallbacks: Set<() => void> = new Set();

  private config: GameControllerConfig = {
    autoSaveInterval: 120,
    enableAppStateHandling: true,
    enableBackgroundProcessing: true,
  };

  private constructor() {
    this.saveManager = SaveManager.getInstance();
    this.resourceManager = ResourceManager.getInstance();
    this.generationEngine = new ResourceGenerationEngine();
    this.beaconPlacementManager = new BeaconPlacementManager({
      bounds: { minX: -10000, minY: -10000, maxX: 10000, maxY: 10000 },
      enableSpatialIndexing: true,
      performanceMode: false,
      enablePatternSuggestions: true,
    });
    this.beaconConnectionManager = new BeaconConnectionManager();
    this.probeManager = ProbeManager.getInstance();
    this.upgradeManager = UpgradeManager.getInstance();
  }

  static getInstance(): GameController {
    if (!GameController.instance) {
      GameController.instance = new GameController();
    }
    return GameController.instance;
  }

  async initialize(): Promise<void> {
    try {
      console.log('[GameController] Initializing...');
      
      // Initialize save manager
      await this.saveManager.initialize();

      // Try to load existing game state
      const savedState = await this.saveManager.loadGameState();
      if (savedState) {
        this.gameState = savedState;
        console.log('[GameController] Loaded existing game state');
        
        // Load resources into ResourceManager
        this.resourceManager.loadFromGameState(this.gameState.resources);
        
        // Load beacons into BeaconPlacementManager
        this.loadBeaconsIntoManager();
        
        // Load upgrade data into UpgradeManager
        this.loadUpgradeData();
        
        // Calculate offline time and apply offline progression
        await this.handleOfflineProgression();
      } else {
        // Create new game state
        this.gameState = this.createNewGameState();
        console.log('[GameController] Created new game state');
        
        // Load initial resources into ResourceManager
        this.resourceManager.loadFromGameState(this.gameState.resources);
        
        // Save initial state
        await this.saveManager.saveGameState(this.gameState);
      }

      // Update generation engine with current game state
      this.generationEngine.updateFromGameState(this.gameState);

      // Start automatic systems
      this.startAutoSave();
      this.startGameTimer();
      
      // Start resource generation
      this.generationEngine.start();
      
      // Initialize probe manager with background processing
      await this.probeManager.initialize();
      
      // Initialize battery optimization manager
      try {
        await batteryOptimizationManager.initialize();
        console.log('[GameController] Battery optimization initialized');
      } catch (error) {
        console.warn('[GameController] Battery optimization failed to initialize:', error);
      }
      
      if (this.config.enableAppStateHandling) {
        this.setupAppStateHandling();
      }

      this.isInitialized = true;
      console.log('[GameController] Initialized successfully');
    } catch (error) {
      console.error('[GameController] Failed to initialize:', error);
      throw error;
    }
  }

  async saveGame(): Promise<void> {
    if (!this.gameState) return;
    
    try {
      // Update last active time and save count
      this.gameState.player.lastActiveAt = Date.now();
      
      // Sync resources from ResourceManager to GameState
      this.gameState.resources = this.resourceManager.toGameStateFormat();
      
      // Sync upgrade data from UpgradeManager to GameState
      this.gameState.upgrades = this.upgradeManager.toSaveState();
      
      await this.saveManager.saveGameState(this.gameState);
      console.log('[GameController] Game saved manually');
    } catch (error) {
      console.error('[GameController] Failed to save game:', error);
      throw error;
    }
  }

  getGameState(): GameState | null {
    if (!this.gameState) return null;
    
    // Always return fresh resources from ResourceManager
    return {
      ...this.gameState,
      resources: this.resourceManager.toGameStateFormat()
    };
  }

  getResourceManager(): ResourceManager {
    return this.resourceManager;
  }

  getGenerationEngine(): ResourceGenerationEngine {
    return this.generationEngine;
  }

  getBeaconPlacementManager(): BeaconPlacementManager {
    return this.beaconPlacementManager;
  }

  getBeaconConnectionManager(): BeaconConnectionManager {
    return this.beaconConnectionManager;
  }

  getProbeManager(): ProbeManager {
    return this.probeManager;
  }

  getUpgradeManager(): UpgradeManager {
    return this.upgradeManager;
  }

  /**
   * Update auto-save interval and restart auto-save with new interval
   */
  updateAutoSaveInterval(intervalSeconds: number): void {
    console.log(`[GameController] Updating auto-save interval to ${intervalSeconds}s`);
    this.config.autoSaveInterval = intervalSeconds;
    
    if (this.isInitialized) {
      this.stopAutoSave();
      this.startAutoSave();
    }
  }

  /**
   * Enable/disable offline generation processing
   */
  setOfflineGenerationEnabled(enabled: boolean): void {
    console.log(`[GameController] ${enabled ? 'Enabling' : 'Disabling'} offline generation`);
    this.config.enableBackgroundProcessing = enabled;
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<GameControllerConfig> {
    return { ...this.config };
  }

  /**
   * Register a callback to be notified when game state changes significantly
   */
  addGameStateChangeCallback(callback: () => void): () => void {
    this.gameStateChangeCallbacks.add(callback);
    return () => this.gameStateChangeCallbacks.delete(callback);
  }

  /**
   * Notify all registered callbacks about game state changes
   */
  private notifyGameStateChanged(): void {
    this.gameStateChangeCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('[GameController] Error in game state change callback:', error);
      }
    });
  }

  /**
   * Place a beacon at the specified position
   */
  placeBeacon(position: Point2D, type: BeaconType): { success: boolean; beacon?: Beacon; error?: string } {
    if (!this.gameState) {
      return { success: false, error: 'Game not initialized' };
    }

    // Calculate escalating cost based on current beacon count
    const currentBeaconCount = Object.keys(this.gameState.beacons).length;
    const cost = this.resourceManager.calculateBeaconPlacementCost(currentBeaconCount);
    
    // Check if player has enough resources
    if (!this.resourceManager.canAfford(cost)) {
      return { success: false, error: `Insufficient resources: need ${cost.quantumData} Quantum Data` };
    }

    // Attempt to place the beacon
    const result = this.beaconPlacementManager.placeBeacon(position, type);
    
    if (result.success && result.beacon) {
      // Deduct escalating cost
      if (!this.resourceManager.spendResources(cost)) {
        return { success: false, error: 'Failed to spend resources' };
      }
      
      // Add beacon to game state
      this.gameState.beacons[result.beacon.id] = {
        id: result.beacon.id,
        x: result.beacon.position.x,
        y: result.beacon.position.y,
        z: 0,
        level: result.beacon.level,
        type: result.beacon.type,
        specialization: result.beacon.specialization,
        status: result.beacon.status,
        connections: result.beacon.connections,
        createdAt: result.beacon.createdAt,
        lastUpgraded: result.beacon.lastUpgraded,
        generationRate: result.beacon.generationRate,
        totalResourcesGenerated: result.beacon.totalResourcesGenerated,
      };

      // Update player statistics
      this.gameState.player.statistics.beaconsPlaced++;

      // Update beacon connection manager with all beacons
      this.updateBeaconConnections();

      // Update generation engine
      this.generationEngine.updateFromGameState(this.gameState);

      // Update milestones based on new beacon count
      const beaconCount = Object.keys(this.gameState.beacons).length;
      this.upgradeManager.updateMilestones(beaconCount);

      // Notify UI components about the new beacon
      this.notifyGameStateChanged();

      console.log(`[GameController] Placed ${type} beacon at (${position.x}, ${position.y})`);
    }

    return result;
  }

  /**
   * Place a beacon with smart fallback to nearby positions if initial position fails
   * Used primarily for probe deployments to handle placement conflicts
   */
  placeBeaconWithFallback(
    targetPosition: Point2D, 
    type: BeaconType
  ): { success: boolean; beacon?: Beacon; error?: string; finalPosition?: Point2D } {
    if (!this.gameState) {
      return { success: false, error: 'Game not initialized' };
    }

    // Calculate escalating cost based on current beacon count
    const currentBeaconCount = Object.keys(this.gameState.beacons).length;
    const cost = this.resourceManager.calculateBeaconPlacementCost(currentBeaconCount);
    
    // Check if player has enough resources
    if (!this.resourceManager.canAfford(cost)) {
      return { success: false, error: `Insufficient resources: need ${cost.quantumData} Quantum Data` };
    }

    // Attempt to place the beacon with fallback
    const result = this.beaconPlacementManager.placeBeaconWithFallback(targetPosition, type);
    
    if (result.success && result.beacon) {
      // Deduct escalating cost
      if (!this.resourceManager.spendResources(cost)) {
        return { success: false, error: 'Failed to spend resources' };
      }
      
      // Add beacon to game state
      this.gameState.beacons[result.beacon.id] = {
        id: result.beacon.id,
        x: result.beacon.position.x,
        y: result.beacon.position.y,
        z: 0,
        level: result.beacon.level,
        type: result.beacon.type,
        specialization: result.beacon.specialization,
        status: result.beacon.status,
        connections: result.beacon.connections,
        createdAt: result.beacon.createdAt,
        lastUpgraded: result.beacon.lastUpgraded,
        generationRate: result.beacon.generationRate,
        totalResourcesGenerated: result.beacon.totalResourcesGenerated,
      };

      // Update player statistics
      this.gameState.player.statistics.beaconsPlaced++;

      // Update beacon connection manager with all beacons
      this.updateBeaconConnections();

      // Update generation engine
      this.generationEngine.updateFromGameState(this.gameState);

      // Update milestones based on new beacon count
      const beaconCount = Object.keys(this.gameState.beacons).length;
      this.upgradeManager.updateMilestones(beaconCount);

      // Notify UI components about the new beacon
      this.notifyGameStateChanged();

      const finalPos = result.finalPosition || result.beacon.position;
      const wasRelocated = finalPos.x !== targetPosition.x || finalPos.y !== targetPosition.y;
      
      if (wasRelocated) {
        console.log(`[GameController] Placed ${type} beacon at fallback position (${finalPos.x}, ${finalPos.y}) instead of target (${targetPosition.x}, ${targetPosition.y})`);
      } else {
        console.log(`[GameController] Placed ${type} beacon at target position (${finalPos.x}, ${finalPos.y})`);
      }
    }

    return result;
  }

  /**
   * Get all placed beacons
   */
  getBeacons(): Record<string, Beacon> {
    if (!this.gameState) return {};
    
    const beacons: Record<string, Beacon> = {};
    for (const [id, beaconData] of Object.entries(this.gameState.beacons)) {
      beacons[id] = new Beacon({
        id: beaconData.id,
        position: { x: beaconData.x, y: beaconData.y },
        level: beaconData.level,
        type: beaconData.type,
        specialization: beaconData.specialization,
        status: beaconData.status,
        connections: beaconData.connections,
        createdAt: beaconData.createdAt,
        lastUpgraded: beaconData.lastUpgraded,
        generationRate: beaconData.generationRate,
        totalResourcesGenerated: beaconData.totalResourcesGenerated,
      });
    }
    return beacons;
  }

  /**
   * Get the current cost to place a beacon based on existing beacon count
   */
  getBeaconPlacementCost(specialization?: 'efficiency' | 'range' | 'stability'): { quantumData: number } {
    if (!this.gameState) {
      return { quantumData: 50 }; // Default to base cost if game not initialized
    }
    
    const currentBeaconCount = Object.keys(this.gameState.beacons).length;
    return this.resourceManager.calculateBeaconPlacementCost(currentBeaconCount, specialization);
  }

  /**
   * Check if player can afford to place a beacon at current cost
   */
  canAffordBeaconPlacement(specialization?: 'efficiency' | 'range' | 'stability'): boolean {
    if (!this.gameState) {
      return false;
    }
    
    const currentBeaconCount = Object.keys(this.gameState.beacons).length;
    return this.resourceManager.canAffordBeaconPlacement(currentBeaconCount, specialization);
  }

  /**
   * Get beacon by ID
   */
  getBeacon(beaconId: string): Beacon | null {
    if (!this.gameState || !this.gameState.beacons[beaconId]) {
      return null;
    }
    
    const beaconData = this.gameState.beacons[beaconId];
    return new Beacon({
      id: beaconData.id,
      position: { x: beaconData.x, y: beaconData.y },
      level: beaconData.level,
      type: beaconData.type,
      specialization: beaconData.specialization,
      status: beaconData.status,
      connections: beaconData.connections,
      createdAt: beaconData.createdAt,
      lastUpgraded: beaconData.lastUpgraded,
      generationRate: beaconData.generationRate,
      totalResourcesGenerated: beaconData.totalResourcesGenerated,
    });
  }

  /**
   * Update beacon connections by rebuilding the connection network
   */
  private updateBeaconConnections(): void {
    if (!this.gameState) return;

    // Create fresh beacon instances with mutable connections arrays
    const beacons: Record<string, Beacon> = {};
    for (const [id, beaconData] of Object.entries(this.gameState.beacons)) {
      beacons[id] = new Beacon({
        id: beaconData.id,
        position: { x: beaconData.x, y: beaconData.y },
        level: beaconData.level,
        type: beaconData.type,
        specialization: beaconData.specialization,
        status: beaconData.status,
        connections: [], // Start with empty connections array
        createdAt: beaconData.createdAt,
        lastUpgraded: beaconData.lastUpgraded,
        generationRate: beaconData.generationRate,
        totalResourcesGenerated: beaconData.totalResourcesGenerated,
      });
    }
    
    // Update the connection manager with fresh beacons
    this.beaconConnectionManager.updateBeacons(beacons);
    
    // Sync the updated connection data back to game state
    for (const [beaconId, beacon] of Object.entries(beacons)) {
      if (this.gameState.beacons[beaconId]) {
        this.gameState.beacons[beaconId].connections = [...beacon.connections];
      }
    }

    const connectionCount = this.beaconConnectionManager.getAllConnections().length;
    console.log(`[GameController] Updated beacon connections: ${connectionCount} active connections`);
  }

  /**
   * Clear all beacons and reset quantum data (debug/testing purposes)
   */
  clearAllBeacons(): void {
    if (!this.gameState) return;

    // Clear beacons from game state
    this.gameState.beacons = {};
    
    // Clear beacons from placement manager (use public API)
    this.beaconPlacementManager.clear();
    
    // Clear connection manager
    this.beaconConnectionManager.clear();

    // Reset quantum data to 0
    this.resourceManager.setResource('quantumData', 0);

    // Update generation engine to reflect cleared state
    this.generationEngine.updateFromGameState(this.gameState);

    // Notify UI components about the state change
    this.notifyGameStateChanged();

    console.log('[GameController] Cleared all beacons and reset quantum data for debugging');
  }

  /**
   * Load existing beacons from game state into the placement manager
   */
  private loadBeaconsIntoManager(): void {
    if (!this.gameState) return;

    for (const beaconData of Object.values(this.gameState.beacons)) {
      const beacon = new Beacon({
        id: beaconData.id,
        position: { x: beaconData.x, y: beaconData.y },
        level: beaconData.level,
        type: beaconData.type,
        specialization: beaconData.specialization,
        status: beaconData.status,
        connections: beaconData.connections,
        createdAt: beaconData.createdAt,
        lastUpgraded: beaconData.lastUpgraded,
        generationRate: beaconData.generationRate,
        totalResourcesGenerated: beaconData.totalResourcesGenerated,
      });

      // Add to placement manager's internal tracking
      // Note: This bypasses placement validation since these are already placed
      this.beaconPlacementManager['beacons'].set(beacon.id, beacon);
      
      // IMPORTANT: Add to validator so it knows about existing beacons for future placement validation
      this.beaconPlacementManager['validator'].addBeacon(beacon);
      
      if (this.beaconPlacementManager['spatialIndex']) {
        this.beaconPlacementManager['spatialIndex'].addBeacon(beacon);
      }
    }

    console.log(`[GameController] Loaded ${Object.keys(this.gameState.beacons).length} beacons into placement manager`);
    
    // Rebuild connections for loaded beacons
    this.updateBeaconConnections();
  }

  /**
   * Load upgrade data from game state into the upgrade manager
   */
  private loadUpgradeData(): void {
    if (!this.gameState) return;

    if (this.gameState.upgrades) {
      this.upgradeManager.loadFromState(this.gameState.upgrades);
      console.log('[GameController] Loaded upgrade data from saved game');
    } else {
      console.log('[GameController] No upgrade data found, starting with fresh upgrade state');
    }

    // Update milestones based on current beacon count
    const beaconCount = Object.keys(this.gameState.beacons).length;
    this.upgradeManager.updateMilestones(beaconCount);
  }

  updateGameState(updates: Partial<GameState>): void {
    if (!this.gameState) return;
    
    this.gameState = {
      ...this.gameState,
      ...updates,
      player: {
        ...this.gameState.player,
        lastActiveAt: Date.now(),
      },
    };
    
    // Update SaveManager's current state
    this.saveManager.updateGameState(this.gameState);
  }


  async shutdown(): Promise<void> {
    try {
      console.log('[GameController] Shutting down...');
      
      // Save final state
      if (this.gameState) {
        await this.saveGame();
      }
      
      // Stop timers and systems
      this.stopAutoSave();
      
      // Shutdown battery optimization
      batteryOptimizationManager.shutdown();
      this.stopGameTimer();
      this.generationEngine.stop();
      await this.probeManager.stop();
      
      // Remove app state listener
      if (this.appStateSubscription) {
        this.appStateSubscription.remove();
        this.appStateSubscription = null;
      }
      
      console.log('[GameController] Shutdown complete');
    } catch (error) {
      console.error('[GameController] Error during shutdown:', error);
    }
  }

  // Private methods

  private startAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }

    this.autoSaveTimer = setInterval(async () => {
      try {
        await this.saveGame();
        console.log('[GameController] Auto-save completed');
      } catch (error) {
        console.error('[GameController] Auto-save failed:', error);
      }
    }, this.config.autoSaveInterval * 1000);

    console.log(`[GameController] Auto-save started (interval: ${this.config.autoSaveInterval}s)`);
  }

  private stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
      console.log('[GameController] Auto-save stopped');
    }
  }

  private startGameTimer(): void {
    if (this.gameTimer) {
      clearInterval(this.gameTimer);
    }

    // Update game time every second
    this.gameTimer = setInterval(() => {
      if (this.gameState) {
        this.gameState.gameTime += 1;
        this.gameState.player.statistics.totalPlayTime += 1;
        
        // Process game logic here (resource generation, etc.)
        this.processGameTick();
      }
    }, 1000);

    console.log('[GameController] Game timer started');
  }

  private stopGameTimer(): void {
    if (this.gameTimer) {
      clearInterval(this.gameTimer);
      this.gameTimer = null;
      console.log('[GameController] Game timer stopped');
    }
  }

  private processGameTick(): void {
    if (!this.gameState) return;
    
    // Process resource generation using the new engine
    this.generationEngine.processGenerationTick(1);
    
    // Update generation engine with current game state periodically
    this.generationEngine.updateFromGameState(this.gameState);
  }

  private setupAppStateHandling(): void {
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange.bind(this));
    console.log('[GameController] App state handling enabled');
  }

  private async handleAppStateChange(nextAppState: AppStateStatus): Promise<void> {
    console.log(`[GameController] App state changed to: ${nextAppState}`);
    
    if (nextAppState === 'background' || nextAppState === 'inactive') {
      // App going to background - save state
      this.lastActiveTime = Date.now();
      try {
        await this.saveGame();
        console.log('[GameController] Saved state before going to background');
      } catch (error) {
        console.error('[GameController] Failed to save before background:', error);
      }
    } else if (nextAppState === 'active') {
      // App returning to foreground - handle offline progression
      try {
        await this.handleOfflineProgression();
        console.log('[GameController] Handled offline progression');
      } catch (error) {
        console.error('[GameController] Failed to handle offline progression:', error);
      }
    }
  }

  private async handleOfflineProgression(): Promise<void> {
    if (!this.gameState) return;
    
    const now = Date.now();
    const offlineTime = Math.max(0, now - this.gameState.player.lastActiveAt);
    const maxOfflineTime = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
    const cappedOfflineTime = Math.min(offlineTime, maxOfflineTime);
    
    if (cappedOfflineTime > 60000) { // Only process if offline for more than 1 minute
      const offlineSeconds = cappedOfflineTime / 1000;
      const offlineHours = offlineSeconds / 3600;
      
      console.log(`[GameController] Processing ${offlineHours.toFixed(2)} hours of offline progression`);
      
      // Only process offline resource generation if enabled
      if (this.config.enableBackgroundProcessing) {
        await this.processOfflineResourceGeneration(offlineSeconds);
        console.log('[GameController] Offline resource generation processed');
      } else {
        console.log('[GameController] Offline resource generation disabled, skipping');
      }
      
      // Update game time regardless of offline generation setting
      this.gameState.gameTime += offlineSeconds;
      this.gameState.player.statistics.totalPlayTime += offlineSeconds;
    }
    
    // Update last active time
    this.gameState.player.lastActiveAt = now;
  }

  private async processOfflineResourceGeneration(offlineSeconds: number): Promise<void> {
    if (!this.gameState) return;
    
    // Update generation engine with current game state
    this.generationEngine.updateFromGameState(this.gameState);
    
    // Get current generation rates
    const generationSummary = this.generationEngine.getGenerationSummary();
    
    // Calculate offline resources with 50% efficiency and time chunks
    const offlineEfficiency = 0.5;
    const chunkSize = 60; // Process in 1-minute chunks for accuracy
    const totalChunks = Math.ceil(offlineSeconds / chunkSize);
    
    console.log(`[GameController] Processing ${totalChunks} chunks of offline progression`);
    
    for (let chunk = 0; chunk < totalChunks; chunk++) {
      const chunkDuration = Math.min(chunkSize, offlineSeconds - (chunk * chunkSize));
      
      // Apply generation for this chunk
      Object.entries(generationSummary).forEach(([resourceType, baseRate]) => {
        if (baseRate.isGreaterThan(0)) {
          const offlineGeneration = baseRate
            .multipliedBy(chunkDuration)
            .multipliedBy(offlineEfficiency);
          
          if (offlineGeneration.isGreaterThan(0)) {
            this.resourceManager.addResource(resourceType as any, offlineGeneration);
          }
        }
      });
    }
    
    // Log offline resources generated
    const totalGenerated = Object.entries(generationSummary)
      .filter(([_, rate]) => rate.isGreaterThan(0))
      .map(([resourceType, rate]) => {
        const total = rate.multipliedBy(offlineSeconds).multipliedBy(offlineEfficiency);
        return `${this.resourceManager.formatResourceValue(total)} ${resourceType}`;
      });
    
    if (totalGenerated.length > 0) {
      console.log(`[GameController] Generated offline: ${totalGenerated.join(', ')}`);
    }
  }

  private createNewGameState(): GameState {
    const now = Date.now();
    const playerId = `player_${now}`;
    
    return {
      version: 1,
      player: {
        id: playerId,
        name: 'Commander',
        level: 1,
        experience: 0,
        createdAt: now,
        lastActiveAt: now,
        settings: { ...DEFAULT_PLAYER_SETTINGS },
        statistics: { ...DEFAULT_PLAYER_STATISTICS },
      },
      resources: { ...DEFAULT_RESOURCES },
      beacons: {},
      probes: {},
      galaxy: {
        id: `galaxy_${now}`,
        sectors: [],
        discoveredSectors: 0,
        totalSectors: 1000,
        centerX: 0,
        centerY: 0,
        zoom: 1,
        lastExplored: now,
      },
      gameTime: 0,
      lastSaved: now,
      saveCount: 0,
    };
  }
}