import { AppState, AppStateStatus } from 'react-native';
import { SaveManager } from './SaveManager';
import { ResourceManager } from './ResourceManager';
import { ResourceGenerationEngine } from './ResourceGenerationEngine';
import { BeaconPlacementManager } from './BeaconPlacementManager';
import { BeaconConnectionManager } from './BeaconConnectionManager';
import { GameState, DEFAULT_RESOURCES, DEFAULT_PLAYER_SETTINGS, DEFAULT_PLAYER_STATISTICS } from '../storage/schemas/GameState';
import { BeaconType } from '../types/beacon';
import { Point2D } from '../types/galaxy';
import { Beacon } from '../entities/Beacon';

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
  private gameState: GameState | null = null;
  private autoSaveTimer: NodeJS.Timeout | null = null;
  private gameTimer: NodeJS.Timeout | null = null;
  private lastActiveTime: number = Date.now();
  private isInitialized = false;
  private appStateSubscription: any = null;

  private readonly config: GameControllerConfig = {
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
    });
    this.beaconConnectionManager = new BeaconConnectionManager();
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

  /**
   * Place a beacon at the specified position
   */
  placeBeacon(position: Point2D, type: BeaconType): { success: boolean; beacon?: Beacon; error?: string } {
    if (!this.gameState) {
      return { success: false, error: 'Game not initialized' };
    }

    // Check if player has enough resources (base cost is 50 quantum data)
    const cost = 50;
    if (this.resourceManager.getResource('quantumData').isLessThan(cost)) {
      return { success: false, error: 'Insufficient quantum data' };
    }

    // Attempt to place the beacon
    const result = this.beaconPlacementManager.placeBeacon(position, type);
    
    if (result.success && result.beacon) {
      // Deduct resources
      this.resourceManager.subtractResource('quantumData', cost);
      
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

      console.log(`[GameController] Placed ${type} beacon at (${position.x}, ${position.y})`);
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

    // Get all current beacons as Beacon instances
    const beacons = this.getBeacons();
    
    // Update the connection manager with current beacons
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
      
      if (this.beaconPlacementManager['spatialIndex']) {
        this.beaconPlacementManager['spatialIndex'].addBeacon(beacon);
      }
    }

    console.log(`[GameController] Loaded ${Object.keys(this.gameState.beacons).length} beacons into placement manager`);
    
    // Rebuild connections for loaded beacons
    this.updateBeaconConnections();
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
      this.stopGameTimer();
      this.generationEngine.stop();
      
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
      
      // Process offline resource generation using the generation engine
      await this.processOfflineResourceGeneration(offlineSeconds);
      
      // Update game time
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