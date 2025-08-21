import { AppState, AppStateStatus } from 'react-native';
import { SaveManager } from './SaveManager';
import { GameState, DEFAULT_RESOURCES, DEFAULT_PLAYER_SETTINGS, DEFAULT_PLAYER_STATISTICS } from '../storage/schemas/GameState';

export interface GameControllerConfig {
  autoSaveInterval: number; // seconds
  enableAppStateHandling: boolean;
  enableBackgroundProcessing: boolean;
}

export class GameController {
  private static instance: GameController | null = null;
  private saveManager: SaveManager;
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
        
        // Calculate offline time and apply offline progression
        await this.handleOfflineProgression();
      } else {
        // Create new game state
        this.gameState = this.createNewGameState();
        console.log('[GameController] Created new game state');
        
        // Save initial state
        await this.saveManager.saveGameState(this.gameState);
      }

      // Start automatic systems
      this.startAutoSave();
      this.startGameTimer();
      
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
      
      await this.saveManager.saveGameState(this.gameState);
      console.log('[GameController] Game saved manually');
    } catch (error) {
      console.error('[GameController] Failed to save game:', error);
      throw error;
    }
  }

  getGameState(): GameState | null {
    return this.gameState ? { ...this.gameState } : null;
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

  addResources(resources: Partial<NonNullable<typeof this.gameState>['resources']>): void {
    if (!this.gameState) return;
    
    const updatedResources = { ...this.gameState.resources };
    Object.entries(resources).forEach(([key, value]) => {
      if (typeof value === 'number' && key in updatedResources) {
        (updatedResources as any)[key] += value;
      }
    });
    
    updatedResources.lastUpdated = Date.now();
    
    this.updateGameState({ resources: updatedResources });
  }

  async shutdown(): Promise<void> {
    try {
      console.log('[GameController] Shutting down...');
      
      // Save final state
      if (this.gameState) {
        await this.saveGame();
      }
      
      // Stop timers
      this.stopAutoSave();
      this.stopGameTimer();
      
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
    
    // Basic resource generation from beacons
    let quantumDataGenerated = 0;
    
    Object.values(this.gameState.beacons).forEach(beacon => {
      if (beacon.status === 'active') {
        quantumDataGenerated += beacon.productionRate * beacon.efficiency;
      }
    });
    
    if (quantumDataGenerated > 0) {
      this.addResources({ quantumData: quantumDataGenerated });
    }
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
      
      // Calculate offline resource generation (50% efficiency)
      let offlineQuantumData = 0;
      
      Object.values(this.gameState.beacons).forEach(beacon => {
        if (beacon.status === 'active') {
          offlineQuantumData += beacon.productionRate * beacon.efficiency * offlineSeconds * 0.5;
        }
      });
      
      if (offlineQuantumData > 0) {
        this.addResources({ quantumData: Math.floor(offlineQuantumData) });
        console.log(`[GameController] Generated ${Math.floor(offlineQuantumData)} quantum data offline`);
      }
      
      // Update game time
      this.gameState.gameTime += offlineSeconds;
      this.gameState.player.statistics.totalPlayTime += offlineSeconds;
    }
    
    // Update last active time
    this.gameState.player.lastActiveAt = now;
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