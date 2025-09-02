import { Migration } from './Migration';
import { GameState, DEFAULT_PLAYER_SETTINGS } from '../GameState';

// Example migration from version 1 to 2 (for future use)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const migration_v2: Migration = {
  version: 2,
  description: 'Add new player settings and fix legacy data',
  up(gameState: GameState): GameState {
    // Example: Add new settings that might be added in the future
    const migratedState = { ...gameState };

    // Ensure all required player settings exist
    if (!migratedState.player.settings) {
      migratedState.player.settings = { ...DEFAULT_PLAYER_SETTINGS };
    } else {
      // Add any new settings that might have been added
      migratedState.player.settings = {
        ...DEFAULT_PLAYER_SETTINGS,
        ...migratedState.player.settings,
      };
    }

    // Example: Fix any legacy data structures
    if (!migratedState.player.statistics) {
      migratedState.player.statistics = {
        totalPlayTime: 0,
        beaconsPlaced: 0,
        probesLaunched: 0,
        starsReignited: 0,
        quantumDataEarned: 0,
        totalSaveCount: migratedState.saveCount || 0,
      };
    }

    return migratedState;
  },

  down(gameState: GameState): GameState {
    // Downgrade migration (optional, for testing)
    const downgradedState = { ...gameState };
    // Remove features that were added in v2
    return downgradedState;
  },
};

// Export all migrations
export const ALL_MIGRATIONS: Migration[] = [
  // migration_v2, // Uncomment when we need to migrate to version 2
];

// Helper function to register all migrations with a MigrationManager
export function registerAllMigrations(migrationManager: any): void {
  ALL_MIGRATIONS.forEach(migration => {
    migrationManager.registerMigration(migration);
  });
}
