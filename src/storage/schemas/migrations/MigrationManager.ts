import { GameState, CURRENT_SAVE_VERSION } from '../GameState';
import { Migration, MigrationError } from './Migration';

export class MigrationManager {
  private migrations: Migration[] = [];

  registerMigration(migration: Migration): void {
    // Insert migration in order by version
    const insertIndex = this.migrations.findIndex(m => m.version > migration.version);
    if (insertIndex === -1) {
      this.migrations.push(migration);
    } else {
      this.migrations.splice(insertIndex, 0, migration);
    }
  }

  async migrateGameState(gameState: GameState): Promise<GameState> {
    if (gameState.version === CURRENT_SAVE_VERSION) {
      return gameState;
    }

    if (gameState.version > CURRENT_SAVE_VERSION) {
      throw new MigrationError(
        `Save version ${gameState.version} is newer than supported version ${CURRENT_SAVE_VERSION}`,
        gameState.version,
      );
    }

    let migratedState = { ...gameState };
    const applicableMigrations = this.migrations.filter(
      m => m.version > gameState.version && m.version <= CURRENT_SAVE_VERSION
    );

    console.log(`Migrating save from version ${gameState.version} to ${CURRENT_SAVE_VERSION}`);
    console.log(`Found ${applicableMigrations.length} migrations to apply`);

    for (const migration of applicableMigrations) {
      try {
        console.log(`Applying migration ${migration.version}: ${migration.description}`);
        migratedState = migration.up(migratedState);
        migratedState.version = migration.version;
      } catch (error) {
        throw new MigrationError(
          `Migration ${migration.version} failed: ${migration.description}`,
          migration.version,
          error as Error,
        );
      }
    }

    return migratedState;
  }

  canMigrate(fromVersion: number, toVersion: number = CURRENT_SAVE_VERSION): boolean {
    if (fromVersion === toVersion) return true;
    if (fromVersion > toVersion) return false;

    const requiredMigrations = this.migrations.filter(
      m => m.version > fromVersion && m.version <= toVersion
    );

    // Check if we have all required migrations
    for (let version = fromVersion + 1; version <= toVersion; version++) {
      const migrationExists = requiredMigrations.some(m => m.version === version);
      if (!migrationExists) {
        return false;
      }
    }

    return true;
  }

  getMigrationPath(fromVersion: number, toVersion: number = CURRENT_SAVE_VERSION): Migration[] {
    return this.migrations.filter(
      m => m.version > fromVersion && m.version <= toVersion
    );
  }
}