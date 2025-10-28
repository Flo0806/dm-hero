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
  {
    version: 2,
    name: 'add_campaigns',
    up: (db) => {
      // Campaigns table
      db.exec(`
        CREATE TABLE IF NOT EXISTS campaigns (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          deleted_at TEXT
        )
      `)

      // Add campaign_id to entities
      db.exec(`
        ALTER TABLE entities ADD COLUMN campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE
      `)

      // Add campaign_id to sessions
      db.exec(`
        ALTER TABLE sessions ADD COLUMN campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE
      `)

      // Add deleted_at to entities for soft-delete
      db.exec(`
        ALTER TABLE entities ADD COLUMN deleted_at TEXT
      `)

      // Add deleted_at to sessions for soft-delete
      db.exec(`
        ALTER TABLE sessions ADD COLUMN deleted_at TEXT
      `)

      // Add deleted_at to tags for soft-delete
      db.exec(`
        ALTER TABLE tags ADD COLUMN deleted_at TEXT
      `)

      // Create a default campaign for existing data
      const insertCampaign = db.prepare('INSERT INTO campaigns (name, description) VALUES (?, ?)')
      const result = insertCampaign.run('Meine Kampagne', 'Standard-Kampagne')
      const defaultCampaignId = result.lastInsertRowid

      // Update existing entities to belong to default campaign
      db.exec(`UPDATE entities SET campaign_id = ${defaultCampaignId} WHERE campaign_id IS NULL`)
      db.exec(`UPDATE sessions SET campaign_id = ${defaultCampaignId} WHERE campaign_id IS NULL`)

      console.log('✅ Migration 2: Campaigns and soft-delete added')
    },
  },
  {
    version: 3,
    name: 'add_reference_data',
    up: (db) => {
      // Reference data for races
      db.exec(`
        CREATE TABLE IF NOT EXISTS races (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          deleted_at TEXT
        )
      `)

      // Reference data for classes
      db.exec(`
        CREATE TABLE IF NOT EXISTS classes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          deleted_at TEXT
        )
      `)

      // Seed D&D 5e races
      const insertRace = db.prepare('INSERT INTO races (name, description) VALUES (?, ?)')
      const races = [
        ['Mensch', 'Vielseitig und anpassungsfähig'],
        ['Elf', 'Langlebig, elegant und magisch begabt'],
        ['Zwerg', 'Zäh, handwerklich begabt und traditionsbewusst'],
        ['Halbling', 'Klein, wendig und glücklich'],
        ['Gnom', 'Neugierig, erfinderisch und lebhaft'],
        ['Halbelf', 'Verbindet menschliche Vielseitigkeit mit elfischer Anmut'],
        ['Halbork', 'Stark, ausdauernd und entschlossen'],
        ['Tiefling', 'Infernalisches Erbe, charismatisch und misstrauisch betrachtet'],
        ['Drachenblütiger', 'Drachenabstammung mit Atemwaffe'],
        ['Zwergelf (Drow)', 'Dunkelelfen aus der Unterwelt'],
        ['Waldelf', 'Schnell und im Einklang mit der Natur'],
        ['Hochelf', 'Intellektuell und magisch begabt'],
        ['Bergzwerg', 'Robust und widerstandsfähig'],
        ['Hügelzwerg', 'Scharfsinnig und wahrnehmungsstark'],
        ['Leichtfuß-Halbling', 'Besonders unauffällig'],
        ['Robuster Halbling', 'Widerstandsfähig gegen Gift'],
      ]

      for (const [name, description] of races) {
        insertRace.run(name, description)
      }

      // Seed D&D 5e classes
      const insertClass = db.prepare('INSERT INTO classes (name, description) VALUES (?, ?)')
      const classes = [
        ['Barbar', 'Wilder Krieger mit unbändiger Wut'],
        ['Barde', 'Musiker und Geschichtenerzähler mit Magie'],
        ['Druide', 'Naturverbundener Zauberwirker und Gestaltwandler'],
        ['Hexenmeister', 'Erhält Macht durch einen Pakt mit mächtiger Entität'],
        ['Kämpfer', 'Meister der Waffen und Kampftechniken'],
        ['Kleriker', 'Göttlicher Zauberwirker und Heiler'],
        ['Magier', 'Studierter Arkaner Zauberwirker'],
        ['Mönch', 'Meister der waffenlosen Kampfkunst und Ki-Energie'],
        ['Paladin', 'Heiliger Krieger mit göttlicher Macht'],
        ['Schurke', 'Meisterdieb und Schatten-Experte'],
        ['Waldläufer', 'Jäger und Spurenleser der Wildnis'],
        ['Zauberer', 'Angeborene magische Begabung'],
      ]

      for (const [name, description] of classes) {
        insertClass.run(name, description)
      }

      console.log('✅ Migration 3: Reference data (races & classes) added')
    },
  },
  {
    version: 4,
    name: 'add_image_support',
    up: (db) => {
      // Add image_url column to entities
      db.exec(`
        ALTER TABLE entities ADD COLUMN image_url TEXT
      `)

      console.log('✅ Migration 4: Image support added to entities')
    },
  },
  {
    version: 5,
    name: 'add_entity_images_table',
    up: (db) => {
      // Create entity_images table for multiple images per entity
      db.exec(`
        CREATE TABLE IF NOT EXISTS entity_images (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entity_id INTEGER NOT NULL,
          image_url TEXT NOT NULL,
          caption TEXT,
          is_primary INTEGER NOT NULL DEFAULT 0,
          display_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
        )
      `)

      // Create index for faster lookups
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_entity_images_entity_id ON entity_images(entity_id)
      `)

      // Migrate existing image_url data to entity_images table
      db.exec(`
        INSERT INTO entity_images (entity_id, image_url, is_primary, display_order)
        SELECT id, image_url, 1, 0
        FROM entities
        WHERE image_url IS NOT NULL
      `)

      console.log('✅ Migration 5: Entity images table created and data migrated')
    },
  },
  {
    version: 6,
    name: 'add_caption_to_entity_images',
    up: (db) => {
      // Check if caption column already exists
      const tableInfo = db.prepare('PRAGMA table_info(entity_images)').all() as Array<{ name: string }>
      const hasCaptionColumn = tableInfo.some(col => col.name === 'caption')

      if (!hasCaptionColumn) {
        db.exec(`ALTER TABLE entity_images ADD COLUMN caption TEXT`)
        console.log('✅ Migration 6: Caption column added to entity_images')
      }
      else {
        console.log('✅ Migration 6: Caption column already exists, skipping')
      }
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

  // Backup before migrations
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
