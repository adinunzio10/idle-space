import * as SQLite from 'expo-sqlite';
import {
  SQLStorageAdapter,
  SQLTransaction,
  StorageError,
} from './StorageAdapter';

interface SQLiteTransaction {
  executeSql<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
}

class SQLiteTransactionWrapper implements SQLTransaction {
  constructor(private tx: SQLiteTransaction) {}

  async executeSql<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
    try {
      return await this.tx.executeSql(sql, params);
    } catch (error) {
      throw new StorageError(
        `SQL execution failed: ${sql}`,
        'SQLITE_EXECUTION_ERROR',
        error as Error
      );
    }
  }
}

export class SQLiteAdapter implements SQLStorageAdapter {
  private db: SQLite.SQLiteDatabase | null = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    try {
      this.db = await SQLite.openDatabaseAsync('signal_garden.db');

      await this.createKeyValueTable();
      await this.createVersionTable();

      this.isInitialized = true;
    } catch (error) {
      throw new StorageError(
        'Failed to initialize SQLite database',
        'SQLITE_INIT_ERROR',
        error as Error
      );
    }
  }

  private async createKeyValueTable(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS key_value_store (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `;
    await this.executeSql(sql);
  }

  private async createVersionTable(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `;
    await this.executeSql(sql);

    try {
      await this.executeSql('INSERT INTO schema_version (version) VALUES (1)');
    } catch {
      // Version already exists
    }
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    this.ensureInitialized();
    try {
      const results = await this.executeSql<{ value: string }>(
        'SELECT value FROM key_value_store WHERE key = ?',
        [key]
      );
      return results.length > 0 ? JSON.parse(results[0].value) : null;
    } catch (error) {
      throw new StorageError(
        `Failed to get item: ${key}`,
        'SQLITE_GET_ERROR',
        error as Error
      );
    }
  }

  async set<T = unknown>(key: string, value: T): Promise<void> {
    this.ensureInitialized();
    try {
      await this.executeSql(
        `INSERT OR REPLACE INTO key_value_store (key, value, updated_at) 
         VALUES (?, ?, strftime('%s', 'now'))`,
        [key, JSON.stringify(value)]
      );
    } catch (error) {
      throw new StorageError(
        `Failed to set item: ${key}`,
        'SQLITE_SET_ERROR',
        error as Error
      );
    }
  }

  async remove(key: string): Promise<void> {
    this.ensureInitialized();
    try {
      await this.executeSql('DELETE FROM key_value_store WHERE key = ?', [key]);
    } catch (error) {
      throw new StorageError(
        `Failed to remove item: ${key}`,
        'SQLITE_REMOVE_ERROR',
        error as Error
      );
    }
  }

  async clear(): Promise<void> {
    this.ensureInitialized();
    try {
      await this.executeSql('DELETE FROM key_value_store');
    } catch (error) {
      throw new StorageError(
        'Failed to clear SQLite storage',
        'SQLITE_CLEAR_ERROR',
        error as Error
      );
    }
  }

  async getAllKeys(): Promise<string[]> {
    this.ensureInitialized();
    try {
      const results = await this.executeSql<{ key: string }>(
        'SELECT key FROM key_value_store'
      );
      return results.map(row => row.key);
    } catch (error) {
      throw new StorageError(
        'Failed to get all keys',
        'SQLITE_KEYS_ERROR',
        error as Error
      );
    }
  }

  async query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
    this.ensureInitialized();
    return this.executeSql<T>(sql, params);
  }

  async transaction<T>(
    callback: (tx: SQLTransaction) => Promise<T>
  ): Promise<T> {
    this.ensureInitialized();

    // For now, simulate transaction with regular queries
    // This is a simplified implementation - in production you'd use proper transactions
    try {
      const wrapper = new SQLiteTransactionWrapper({
        executeSql: this.executeSql.bind(this),
      } as SQLiteTransaction);
      return await callback(wrapper);
    } catch (error) {
      throw new StorageError(
        'Transaction failed',
        'SQLITE_TRANSACTION_ERROR',
        error as Error
      );
    }
  }

  private async executeSql<T = unknown>(
    sql: string,
    params?: unknown[]
  ): Promise<T[]> {
    if (!this.db) {
      throw new StorageError(
        'Database not initialized',
        'SQLITE_NOT_INITIALIZED'
      );
    }

    try {
      const bindParams = (params || []).map(param => {
        if (param === null || param === undefined) return null;
        if (
          typeof param === 'string' ||
          typeof param === 'number' ||
          typeof param === 'boolean'
        ) {
          return param;
        }
        return String(param);
      });

      // For SELECT queries, we need to use getAllAsync
      if (sql.trim().toLowerCase().startsWith('select')) {
        return (await this.db.getAllAsync(sql, bindParams)) as T[];
      }
      // For other queries, run the query and return empty array
      await this.db.runAsync(sql, bindParams);
      return [] as T[];
    } catch (error) {
      throw new StorageError(
        `SQL execution failed: ${sql}`,
        'SQLITE_EXECUTION_ERROR',
        error as Error
      );
    }
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new StorageError(
        'SQLiteAdapter not initialized',
        'SQLITE_NOT_INITIALIZED'
      );
    }
  }

  async getSchemaVersion(): Promise<number> {
    this.ensureInitialized();
    try {
      const results = await this.executeSql<{ version: number }>(
        'SELECT version FROM schema_version ORDER BY version DESC LIMIT 1'
      );
      return results.length > 0 ? results[0].version : 0;
    } catch (error) {
      throw new StorageError(
        'Failed to get schema version',
        'SQLITE_VERSION_ERROR',
        error as Error
      );
    }
  }

  async setSchemaVersion(version: number): Promise<void> {
    this.ensureInitialized();
    try {
      await this.executeSql('INSERT INTO schema_version (version) VALUES (?)', [
        version,
      ]);
    } catch (error) {
      throw new StorageError(
        `Failed to set schema version: ${version}`,
        'SQLITE_VERSION_SET_ERROR',
        error as Error
      );
    }
  }
}
