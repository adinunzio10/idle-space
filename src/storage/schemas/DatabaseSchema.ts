import { SQLiteAdapter } from '../adapters/SQLiteAdapter';

export class DatabaseSchema {
  private sqliteAdapter: SQLiteAdapter;

  constructor(sqliteAdapter: SQLiteAdapter) {
    this.sqliteAdapter = sqliteAdapter;
  }

  async initializeSchema(): Promise<void> {
    await this.createGameStateTables();
    await this.createIndexes();
  }

  private async createGameStateTables(): Promise<void> {
    // Players table
    await this.sqliteAdapter.query(`
      CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        level INTEGER DEFAULT 1,
        experience INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        last_active_at INTEGER NOT NULL,
        settings TEXT NOT NULL,
        statistics TEXT NOT NULL
      )
    `);

    // Resources table
    await this.sqliteAdapter.query(`
      CREATE TABLE IF NOT EXISTS resources (
        player_id TEXT PRIMARY KEY,
        quantum_data REAL DEFAULT 0,
        stellar_essence REAL DEFAULT 0,
        void_fragments REAL DEFAULT 0,
        chronos_particles REAL DEFAULT 0,
        last_updated INTEGER NOT NULL,
        FOREIGN KEY (player_id) REFERENCES players (id)
      )
    `);

    // Beacons table
    await this.sqliteAdapter.query(`
      CREATE TABLE IF NOT EXISTS beacons (
        id TEXT PRIMARY KEY,
        player_id TEXT NOT NULL,
        x REAL NOT NULL,
        y REAL NOT NULL,
        z REAL DEFAULT 0,
        level INTEGER DEFAULT 1,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        connections TEXT DEFAULT '[]',
        created_at INTEGER NOT NULL,
        last_upgraded INTEGER NOT NULL,
        production_rate REAL DEFAULT 0,
        efficiency REAL DEFAULT 1,
        FOREIGN KEY (player_id) REFERENCES players (id)
      )
    `);

    // Probes table
    await this.sqliteAdapter.query(`
      CREATE TABLE IF NOT EXISTS probes (
        id TEXT PRIMARY KEY,
        player_id TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        source_beacon_id TEXT NOT NULL,
        target_x REAL NOT NULL,
        target_y REAL NOT NULL,
        launched_at INTEGER NOT NULL,
        estimated_arrival INTEGER NOT NULL,
        speed REAL NOT NULL,
        payload TEXT NOT NULL,
        FOREIGN KEY (player_id) REFERENCES players (id),
        FOREIGN KEY (source_beacon_id) REFERENCES beacons (id)
      )
    `);

    // Galaxy table
    await this.sqliteAdapter.query(`
      CREATE TABLE IF NOT EXISTS galaxy (
        id TEXT PRIMARY KEY,
        player_id TEXT NOT NULL,
        discovered_sectors INTEGER DEFAULT 0,
        total_sectors INTEGER DEFAULT 1000,
        center_x REAL DEFAULT 0,
        center_y REAL DEFAULT 0,
        zoom REAL DEFAULT 1,
        last_explored INTEGER NOT NULL,
        FOREIGN KEY (player_id) REFERENCES players (id)
      )
    `);

    // Galaxy sectors table
    await this.sqliteAdapter.query(`
      CREATE TABLE IF NOT EXISTS galaxy_sectors (
        id TEXT PRIMARY KEY,
        galaxy_id TEXT NOT NULL,
        x INTEGER NOT NULL,
        y INTEGER NOT NULL,
        status TEXT NOT NULL,
        beacon_ids TEXT DEFAULT '[]',
        stars TEXT NOT NULL,
        discovered_at INTEGER NOT NULL,
        threat_level REAL DEFAULT 0,
        FOREIGN KEY (galaxy_id) REFERENCES galaxy (id)
      )
    `);

    // Game metadata table
    await this.sqliteAdapter.query(`
      CREATE TABLE IF NOT EXISTS game_metadata (
        player_id TEXT PRIMARY KEY,
        version INTEGER NOT NULL,
        game_time INTEGER DEFAULT 0,
        last_saved INTEGER NOT NULL,
        save_count INTEGER DEFAULT 0,
        checksum TEXT,
        FOREIGN KEY (player_id) REFERENCES players (id)
      )
    `);
  }

  private async createIndexes(): Promise<void> {
    // Performance indexes
    await this.sqliteAdapter.query(`
      CREATE INDEX IF NOT EXISTS idx_beacons_player_id ON beacons (player_id)
    `);
    
    await this.sqliteAdapter.query(`
      CREATE INDEX IF NOT EXISTS idx_beacons_position ON beacons (x, y)
    `);
    
    await this.sqliteAdapter.query(`
      CREATE INDEX IF NOT EXISTS idx_beacons_status ON beacons (status)
    `);
    
    await this.sqliteAdapter.query(`
      CREATE INDEX IF NOT EXISTS idx_probes_player_id ON probes (player_id)
    `);
    
    await this.sqliteAdapter.query(`
      CREATE INDEX IF NOT EXISTS idx_probes_status ON probes (status)
    `);
    
    await this.sqliteAdapter.query(`
      CREATE INDEX IF NOT EXISTS idx_galaxy_sectors_galaxy_id ON galaxy_sectors (galaxy_id)
    `);
    
    await this.sqliteAdapter.query(`
      CREATE INDEX IF NOT EXISTS idx_galaxy_sectors_position ON galaxy_sectors (x, y)
    `);
  }

  async dropAllTables(): Promise<void> {
    const tables = [
      'game_metadata',
      'galaxy_sectors', 
      'galaxy',
      'probes',
      'beacons',
      'resources',
      'players',
    ];

    for (const table of tables) {
      await this.sqliteAdapter.query(`DROP TABLE IF EXISTS ${table}`);
    }
  }
}