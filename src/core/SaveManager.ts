import { Platform } from 'react-native';
import { AsyncStorageAdapter } from '../storage/adapters/AsyncStorageAdapter';
import { SQLiteAdapter } from '../storage/adapters/SQLiteAdapter';
import { StorageError } from '../storage/adapters/StorageAdapter';
import { CompressionUtils } from '../utils/compression';
import {
  GameState,
  SaveFile,
  SaveMetadata,
  CURRENT_SAVE_VERSION,
  DEFAULT_PLAYER_SETTINGS,
  DEFAULT_PLAYER_STATISTICS,
  DEFAULT_RESOURCES,
  Player,
} from '../storage/schemas/GameState';
import { MigrationManager } from '../storage/schemas/migrations/MigrationManager';
import { registerAllMigrations } from '../storage/schemas/migrations/migrations';
import { DatabaseSchema } from '../storage/schemas/DatabaseSchema';

export interface SaveManagerConfig {
  useCompression: boolean;
  autoSaveInterval: number; // seconds
  maxBackups: number;
  enableLogging: boolean;
}

export class SaveManager {
  private static instance: SaveManager | null = null;
  private asyncStorage: AsyncStorageAdapter;
  private sqliteStorage: SQLiteAdapter | null = null;
  private migrationManager: MigrationManager;
  private databaseSchema: DatabaseSchema | null = null;
  private autoSaveTimer: NodeJS.Timeout | null = null;
  private isInitialized = false;
  private currentGameState: GameState | null = null;
  private isWebPlatform = Platform.OS === 'web';

  private readonly config: SaveManagerConfig = {
    useCompression: true,
    autoSaveInterval: 30,
    maxBackups: 5,
    enableLogging: true,
  };

  private constructor() {
    this.asyncStorage = new AsyncStorageAdapter();

    // Only initialize SQLite on native platforms
    if (!this.isWebPlatform) {
      this.sqliteStorage = new SQLiteAdapter();
      this.databaseSchema = new DatabaseSchema(this.sqliteStorage);
    }

    this.migrationManager = new MigrationManager();

    // Register all available migrations
    registerAllMigrations(this.migrationManager);
  }

  static getInstance(): SaveManager {
    if (!SaveManager.instance) {
      SaveManager.instance = new SaveManager();
    }
    return SaveManager.instance;
  }

  async initialize(): Promise<void> {
    try {
      this.log('Initializing SaveManager...');

      // Initialize AsyncStorage
      await this.asyncStorage.initialize();

      // Only initialize SQLite on native platforms
      if (!this.isWebPlatform && this.sqliteStorage) {
        await this.sqliteStorage.initialize();

        // Initialize database schema
        if (this.databaseSchema) {
          await this.databaseSchema.initializeSchema();
        }
      }

      this.isInitialized = true;
      this.log(
        `SaveManager initialized successfully (platform: ${Platform.OS})`
      );
    } catch (error) {
      this.logError('Failed to initialize SaveManager', error);
      throw new StorageError(
        'SaveManager initialization failed',
        'SAVE_MANAGER_INIT_ERROR',
        error as Error
      );
    }
  }

  async saveGameState(gameState: GameState): Promise<void> {
    this.ensureInitialized();

    try {
      this.log('Saving game state...');

      // Update save metadata
      gameState.lastSaved = Date.now();
      gameState.saveCount++;
      gameState.checksum = this.generateChecksum(gameState);

      const saveFile: SaveFile = {
        metadata: this.createSaveMetadata(gameState),
        gameState,
      };

      // Create backup before saving
      await this.createBackup();

      // Save to available storage systems
      const savePromises = [this.saveToAsyncStorage(saveFile)];

      // Only save to SQLite on native platforms
      if (!this.isWebPlatform && this.sqliteStorage) {
        savePromises.push(this.saveToSQLite(saveFile));
      }

      await Promise.all(savePromises);

      // Update current state
      this.currentGameState = { ...gameState };

      // Update player statistics
      if (this.currentGameState.player.statistics) {
        this.currentGameState.player.statistics.totalSaveCount++;
      }

      this.log(`Game state saved successfully (save #${gameState.saveCount})`);
    } catch (error) {
      this.logError('Failed to save game state', error);
      throw new StorageError(
        'Failed to save game state',
        'SAVE_GAME_STATE_ERROR',
        error as Error
      );
    }
  }

  async loadGameState(): Promise<GameState | null> {
    this.ensureInitialized();

    try {
      this.log('Loading game state...');

      // Load from available storage systems
      let saveFile: SaveFile | null = null;

      if (!this.isWebPlatform && this.sqliteStorage) {
        // Try SQLite first on native platforms
        saveFile = await this.loadFromSQLite();
        if (!saveFile) {
          this.log('SQLite load failed, trying AsyncStorage...');
          saveFile = await this.loadFromAsyncStorage();
        }
      } else {
        // Use AsyncStorage on web
        saveFile = await this.loadFromAsyncStorage();
      }

      if (!saveFile) {
        this.log('No saved game found');
        return null;
      }

      // Validate save file
      const isValid = await this.validateSaveFile(saveFile);
      if (!isValid) {
        this.log('Save file validation failed, attempting recovery...');
        const recoveredState = await this.recoverFromCorruption();
        return recoveredState;
      }

      // Handle version migration if needed
      const migratedState = await this.migrationManager.migrateGameState(
        saveFile.gameState
      );

      this.currentGameState = migratedState;
      this.log(
        `Game state loaded successfully (save #${migratedState.saveCount})`
      );

      return migratedState;
    } catch (error) {
      this.logError('Failed to load game state', error);

      // Attempt recovery
      try {
        const recoveredState = await this.recoverFromCorruption();
        if (recoveredState) {
          this.log('Successfully recovered from corruption');
          return recoveredState;
        }
      } catch (recoveryError) {
        this.logError('Recovery also failed', recoveryError);
      }

      throw new StorageError(
        'Failed to load game state',
        'LOAD_GAME_STATE_ERROR',
        error as Error
      );
    }
  }

  async createBackup(): Promise<void> {
    if (!this.currentGameState) return;

    try {
      const backupKey = `backup_${Date.now()}`;
      const saveFile: SaveFile = {
        metadata: this.createSaveMetadata(this.currentGameState),
        gameState: this.currentGameState,
      };

      await this.asyncStorage.set(backupKey, saveFile);

      // Clean up old backups
      await this.cleanupOldBackups();

      this.log(`Backup created: ${backupKey}`);
    } catch (error) {
      this.logError('Failed to create backup', error);
      // Don't throw - backup failure shouldn't prevent normal saves
    }
  }

  async recoverFromCorruption(): Promise<GameState | null> {
    this.log('Attempting corruption recovery...');

    try {
      // Try to load from backups
      const backupKeys = await this.getBackupKeys();

      for (const backupKey of backupKeys.reverse()) {
        // Try newest first
        try {
          const backup = await this.asyncStorage.get<SaveFile>(backupKey);
          if (backup && (await this.validateSaveFile(backup))) {
            this.log(`Recovered from backup: ${backupKey}`);
            return backup.gameState;
          }
        } catch {
          this.log(`Backup ${backupKey} is also corrupted`);
        }
      }

      // If all backups failed, create a new game state
      this.log('All recovery attempts failed, creating new game state');
      return this.createNewGameState();
    } catch (error) {
      this.logError('Recovery failed', error);
      return null;
    }
  }

  async startAutoSave(): Promise<void> {
    this.ensureInitialized();

    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }

    this.autoSaveTimer = setInterval(async () => {
      if (this.currentGameState) {
        try {
          await this.saveGameState(this.currentGameState);
          this.log('Auto-save completed');
        } catch (error) {
          this.logError('Auto-save failed', error);
        }
      }
    }, this.config.autoSaveInterval * 1000);

    this.log(`Auto-save started (interval: ${this.config.autoSaveInterval}s)`);
  }

  stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
      this.log('Auto-save stopped');
    }
  }

  updateGameState(gameState: GameState): void {
    this.currentGameState = { ...gameState };
  }

  getCurrentGameState(): GameState | null {
    return this.currentGameState ? { ...this.currentGameState } : null;
  }

  // Private methods

  private async saveToAsyncStorage(saveFile: SaveFile): Promise<void> {
    const data = this.config.useCompression
      ? CompressionUtils.compressObject(saveFile)
      : JSON.stringify(saveFile);

    await this.asyncStorage.set('gameState', data);
  }

  private async saveToSQLite(saveFile: SaveFile): Promise<void> {
    if (!this.sqliteStorage) {
      throw new StorageError('SQLite not available', 'SQLITE_NOT_AVAILABLE');
    }

    const data = this.config.useCompression
      ? CompressionUtils.compressObject(saveFile)
      : JSON.stringify(saveFile);

    await this.sqliteStorage.set('gameState', data);
  }

  private async loadFromAsyncStorage(): Promise<SaveFile | null> {
    const data = await this.asyncStorage.get<string>('gameState');
    if (!data) return null;

    return this.config.useCompression
      ? CompressionUtils.decompressObject<SaveFile>(data)
      : JSON.parse(data);
  }

  private async loadFromSQLite(): Promise<SaveFile | null> {
    if (!this.sqliteStorage) {
      return null;
    }

    const data = await this.sqliteStorage.get<string>('gameState');
    if (!data) return null;

    return this.config.useCompression
      ? CompressionUtils.decompressObject<SaveFile>(data)
      : JSON.parse(data);
  }

  private createSaveMetadata(gameState: GameState): SaveMetadata {
    const jsonSize = JSON.stringify(gameState).length;

    return {
      version: CURRENT_SAVE_VERSION,
      timestamp: Date.now(),
      compressed: this.config.useCompression,
      size: jsonSize,
      checksum: this.generateChecksum(gameState),
    };
  }

  private generateChecksum(gameState: GameState): string {
    // Simple checksum - in production, use a proper hash function
    const str = JSON.stringify(gameState);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  private async validateSaveFile(saveFile: SaveFile): Promise<boolean> {
    try {
      // Check required fields
      if (!saveFile.metadata || !saveFile.gameState) return false;

      // Validate checksum
      const expectedChecksum = this.generateChecksum(saveFile.gameState);
      if (saveFile.metadata.checksum !== expectedChecksum) {
        this.log('Checksum validation failed');
        return false;
      }

      // Validate version compatibility
      if (saveFile.metadata.version > CURRENT_SAVE_VERSION) {
        this.log('Save file version is newer than supported');
        return false;
      }

      return true;
    } catch (error) {
      this.logError('Save file validation error', error);
      return false;
    }
  }

  private async getBackupKeys(): Promise<string[]> {
    const keys = await this.asyncStorage.getAllKeys();
    return keys
      .filter(key => key.startsWith('backup_'))
      .sort((a, b) => {
        const timeA = parseInt(a.split('_')[1]);
        const timeB = parseInt(b.split('_')[1]);
        return timeA - timeB;
      });
  }

  private async cleanupOldBackups(): Promise<void> {
    try {
      const backupKeys = await this.getBackupKeys();

      if (backupKeys.length > this.config.maxBackups) {
        const keysToDelete = backupKeys.slice(
          0,
          backupKeys.length - this.config.maxBackups
        );

        for (const key of keysToDelete) {
          await this.asyncStorage.remove(key);
        }

        this.log(`Cleaned up ${keysToDelete.length} old backups`);
      }
    } catch (error) {
      this.logError('Failed to cleanup old backups', error);
    }
  }

  private createNewGameState(): GameState {
    const now = Date.now();
    const playerId = `player_${now}`;

    const player: Player = {
      id: playerId,
      name: 'Commander',
      level: 1,
      experience: 0,
      createdAt: now,
      lastActiveAt: now,
      settings: { ...DEFAULT_PLAYER_SETTINGS },
      statistics: { ...DEFAULT_PLAYER_STATISTICS },
    };

    return {
      version: CURRENT_SAVE_VERSION,
      player,
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

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new StorageError(
        'SaveManager not initialized',
        'SAVE_MANAGER_NOT_INITIALIZED'
      );
    }
  }

  private log(message: string): void {
    if (this.config.enableLogging) {
      console.log(`[SaveManager] ${message}`);
    }
  }

  private logError(message: string, error: unknown): void {
    if (this.config.enableLogging) {
      console.error(`[SaveManager] ${message}:`, error);
    }
  }
}
