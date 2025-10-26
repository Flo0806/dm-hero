import type Database from 'better-sqlite3'
import { createBackup, getCurrentVersion, setVersion } from './db'

export interface Migration {
  version: number
  name: string
  up: (db: Database.Database) => void
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    up: (db) => {
      // Version tracking
      db.exec(`
        CREATE TABLE IF NOT EXISTS schema_version (
          version INTEGER PRIMARY KEY,
          applied_at TEXT NOT NULL
        )
      `)

      // Entity types: NPCs, Locations, Items, Factions, Sessions
      db.exec(`
        CREATE TABLE IF NOT EXISTS entity_types (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          icon TEXT,
          color TEXT
        )
      `)

      // Main entities table
      db.exec(`
        CREATE TABLE IF NOT EXISTS entities (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          metadata TEXT, -- JSON for flexible fields (HP, AC, etc.)
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (type_id) REFERENCES entity_types(id) ON DELETE CASCADE
        )
      `)

      // Relations between entities (NPC -> Location, NPC -> Faction, etc.)
      db.exec(`
        CREATE TABLE IF NOT EXISTS entity_relations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          from_entity_id INTEGER NOT NULL,
          to_entity_id INTEGER NOT NULL,
          relation_type TEXT NOT NULL, -- e.g. "lives_in", "member_of", "owns"
          notes TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (from_entity_id) REFERENCES entities(id) ON DELETE CASCADE,
          FOREIGN KEY (to_entity_id) REFERENCES entities(id) ON DELETE CASCADE,
          UNIQUE(from_entity_id, to_entity_id, relation_type)
        )
      `)

      // Tags for flexible categorization
      db.exec(`
        CREATE TABLE IF NOT EXISTS tags (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          color TEXT
        )
      `)

      db.exec(`
        CREATE TABLE IF NOT EXISTS entity_tags (
          entity_id INTEGER NOT NULL,
          tag_id INTEGER NOT NULL,
          PRIMARY KEY (entity_id, tag_id),
          FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE,
          FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
        )
      `)

      // Session logs
      db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_number INTEGER,
          title TEXT NOT NULL,
          date TEXT,
          summary TEXT,
          notes TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `)

      // Entity mentions in sessions
      db.exec(`
        CREATE TABLE IF NOT EXISTS session_mentions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id INTEGER NOT NULL,
          entity_id INTEGER NOT NULL,
          context TEXT, -- What happened in this session?
          FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
          FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
        )
      `)

      // Full-text search index
      db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS entities_fts USING fts5(
          name,
          description,
          content='entities',
          content_rowid='id'
        )
      `)

      // Triggers for FTS index
      db.exec(`
        CREATE TRIGGER IF NOT EXISTS entities_ai AFTER INSERT ON entities BEGIN
          INSERT INTO entities_fts(rowid, name, description) VALUES (new.id, new.name, new.description);
        END;
      `)

      db.exec(`
        CREATE TRIGGER IF NOT EXISTS entities_ad AFTER DELETE ON entities BEGIN
          DELETE FROM entities_fts WHERE rowid = old.id;
        END;
      `)

      db.exec(`
        CREATE TRIGGER IF NOT EXISTS entities_au AFTER UPDATE ON entities BEGIN
          UPDATE entities_fts SET name = new.name, description = new.description WHERE rowid = new.id;
        END;
      `)

      // Insert default entity types
      const insertType = db.prepare('INSERT INTO entity_types (name, icon, color) VALUES (?, ?, ?)')
      insertType.run('NPC', 'mdi-account', '#D4A574')
      insertType.run('Location', 'mdi-map-marker', '#8B7355')
      insertType.run('Item', 'mdi-sword', '#CC8844')
      insertType.run('Faction', 'mdi-shield', '#7B92AB')
      insertType.run('Quest', 'mdi-script-text', '#B8935F')

      console.log('✅ Migration 1: Initial schema created')
    },
  },
]

export async function runMigrations(db: Database.Database) {
  const currentVersion = getCurrentVersion(db)
  const pendingMigrations = migrations.filter(m => m.version > currentVersion)

  if (pendingMigrations.length === 0) {
    console.log('✅ Database is up to date (version:', currentVersion, ')')
    return
  }

  console.log(`🔄 Running ${pendingMigrations.length} migration(s)...`)

  // Backup vor Migrations
  createBackup()

  for (const migration of pendingMigrations) {
    console.log(`  📦 Applying migration ${migration.version}: ${migration.name}`)

    try {
      db.exec('BEGIN TRANSACTION')
      migration.up(db)
      setVersion(db, migration.version)
      db.exec('COMMIT')
      console.log(`  ✅ Migration ${migration.version} applied successfully`)
    }
    catch (error) {
      db.exec('ROLLBACK')
      console.error(`  ❌ Migration ${migration.version} failed:`, error)
      throw error
    }
  }

  console.log('✅ All migrations completed successfully')
}
