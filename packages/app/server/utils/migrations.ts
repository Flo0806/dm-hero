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

      // Create a default campaign ONLY if there are orphaned entities or sessions
      const orphanedEntities = db
        .prepare('SELECT COUNT(*) as count FROM entities WHERE campaign_id IS NULL')
        .get() as { count: number }

      const orphanedSessions = db
        .prepare('SELECT COUNT(*) as count FROM sessions WHERE campaign_id IS NULL')
        .get() as { count: number }

      if (orphanedEntities.count > 0 || orphanedSessions.count > 0) {
        const insertCampaign = db.prepare('INSERT INTO campaigns (name, description) VALUES (?, ?)')
        const result = insertCampaign.run('Meine Kampagne', 'Standard-Kampagne')
        const defaultCampaignId = result.lastInsertRowid

        // Update existing entities to belong to default campaign
        db.exec(`UPDATE entities SET campaign_id = ${defaultCampaignId} WHERE campaign_id IS NULL`)
        db.exec(`UPDATE sessions SET campaign_id = ${defaultCampaignId} WHERE campaign_id IS NULL`)
      }

      console.log('✅ Migration 2: Campaigns and soft-delete added')
    },
  },
  {
    version: 3,
    name: 'add_reference_data',
    up: (db) => {
      // Reference data for races (with key column from the start)
      db.exec(`
        CREATE TABLE IF NOT EXISTS races (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          key TEXT NOT NULL UNIQUE,
          description TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          deleted_at TEXT
        )
      `)

      // Reference data for classes (with key column from the start)
      db.exec(`
        CREATE TABLE IF NOT EXISTS classes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          key TEXT NOT NULL UNIQUE,
          description TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          deleted_at TEXT
        )
      `)

      // Create indexes for keys
      db.exec('CREATE INDEX idx_races_key ON races(key)')
      db.exec('CREATE INDEX idx_classes_key ON classes(key)')

      // Seed D&D 5e races (with keys)
      const insertRace = db.prepare('INSERT INTO races (name, key, description) VALUES (?, ?, ?)')
      const races = [
        ['Mensch', 'human', 'Vielseitig und anpassungsfähig'],
        ['Elf', 'elf', 'Langlebig, elegant und magisch begabt'],
        ['Zwerg', 'dwarf', 'Zäh, handwerklich begabt und traditionsbewusst'],
        ['Halbling', 'halfling', 'Klein, wendig und glücklich'],
        ['Gnom', 'gnome', 'Neugierig, erfinderisch und lebhaft'],
        ['Halbelf', 'halfelf', 'Verbindet menschliche Vielseitigkeit mit elfischer Anmut'],
        ['Halbork', 'halforc', 'Stark, ausdauernd und entschlossen'],
        ['Tiefling', 'tiefling', 'Infernalisches Erbe, charismatisch und misstrauisch betrachtet'],
        ['Drachenblütiger', 'dragonborn', 'Drachenabstammung mit Atemwaffe'],
        ['Zwergelf (Drow)', 'drow', 'Dunkelelfen aus der Unterwelt'],
        ['Waldelf', 'woodelf', 'Schnell und im Einklang mit der Natur'],
        ['Hochelf', 'highelf', 'Intellektuell und magisch begabt'],
        ['Bergzwerg', 'mountaindwarf', 'Robust und widerstandsfähig'],
        ['Hügelzwerg', 'hilldwarf', 'Scharfsinnig und wahrnehmungsstark'],
        ['Leichtfuß-Halbling', 'lightfoothalfling', 'Besonders unauffällig'],
        ['Robuster Halbling', 'stouthalfling', 'Widerstandsfähig gegen Gift'],
      ]

      for (const [name, key, description] of races) {
        insertRace.run(name, key, description)
      }

      // Seed D&D 5e classes (with keys)
      const insertClass = db.prepare(
        'INSERT INTO classes (name, key, description) VALUES (?, ?, ?)',
      )
      const classes = [
        ['Barbar', 'barbarian', 'Wilder Krieger mit unbändiger Wut'],
        ['Barde', 'bard', 'Musiker und Geschichtenerzähler mit Magie'],
        ['Druide', 'druid', 'Naturverbundener Zauberwirker und Gestaltwandler'],
        ['Hexenmeister', 'warlock', 'Erhält Macht durch einen Pakt mit mächtiger Entität'],
        ['Kämpfer', 'fighter', 'Meister der Waffen und Kampftechniken'],
        ['Kleriker', 'cleric', 'Göttlicher Zauberwirker und Heiler'],
        ['Magier', 'wizard', 'Studierter Arkaner Zauberwirker'],
        ['Mönch', 'monk', 'Meister der waffenlosen Kampfkunst und Ki-Energie'],
        ['Paladin', 'paladin', 'Heiliger Krieger mit göttlicher Macht'],
        ['Schurke', 'rogue', 'Meisterdieb und Schatten-Experte'],
        ['Waldläufer', 'ranger', 'Jäger und Spurenleser der Wildnis'],
        ['Zauberer', 'sorcerer', 'Angeborene magische Begabung'],
      ]

      for (const [name, key, description] of classes) {
        insertClass.run(name, key, description)
      }

      console.log('✅ Migration 3: Reference data (races & classes) added with keys')
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
      const tableInfo = db.prepare('PRAGMA table_info(entity_images)').all() as Array<{
        name: string
      }>
      const hasCaptionColumn = tableInfo.some((col) => col.name === 'caption')

      if (!hasCaptionColumn) {
        db.exec('ALTER TABLE entity_images ADD COLUMN caption TEXT')
        console.log('✅ Migration 6: Caption column added to entity_images')
      } else {
        console.log('✅ Migration 6: Caption column already exists, skipping')
      }
    },
  },
  {
    version: 7,
    name: 'add_entity_documents',
    up: (db) => {
      // Create entity_documents table for markdown documents
      db.exec(`
        CREATE TABLE IF NOT EXISTS entity_documents (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entity_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          content TEXT NOT NULL DEFAULT '',
          date TEXT NOT NULL,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
        )
      `)

      // Create indexes for faster lookups
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_entity_documents_entity_id ON entity_documents(entity_id)
      `)

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_entity_documents_sort_order ON entity_documents(sort_order)
      `)

      console.log('✅ Migration 7: Entity documents table created')
    },
  },
  {
    version: 8,
    name: 'improve_fts5_with_metadata',
    up: (db) => {
      // Drop existing FTS table and triggers
      db.exec('DROP TRIGGER IF EXISTS entities_ai')
      db.exec('DROP TRIGGER IF EXISTS entities_ad')
      db.exec('DROP TRIGGER IF EXISTS entities_au')
      db.exec('DROP TABLE IF EXISTS entities_fts')

      // Create improved FTS5 table with metadata column
      db.exec(`
        CREATE VIRTUAL TABLE entities_fts USING fts5(
          name,
          description,
          metadata,
          content='entities',
          content_rowid='id'
        )
      `)

      // New triggers for improved FTS index (includes metadata)
      db.exec(`
        CREATE TRIGGER entities_ai AFTER INSERT ON entities BEGIN
          INSERT INTO entities_fts(rowid, name, description, metadata)
          VALUES (new.id, new.name, new.description, new.metadata);
        END;
      `)

      db.exec(`
        CREATE TRIGGER entities_ad AFTER DELETE ON entities BEGIN
          DELETE FROM entities_fts WHERE rowid = old.id;
        END;
      `)

      db.exec(`
        CREATE TRIGGER entities_au AFTER UPDATE ON entities BEGIN
          UPDATE entities_fts
          SET name = new.name, description = new.description, metadata = new.metadata
          WHERE rowid = new.id;
        END;
      `)

      // Rebuild FTS index with existing data
      db.exec(`
        INSERT INTO entities_fts(rowid, name, description, metadata)
        SELECT id, name, description, metadata
        FROM entities
        WHERE deleted_at IS NULL
      `)

      console.log('✅ Migration 8: FTS5 improved with metadata search')
    },
  },
  {
    version: 9,
    name: 'bilingual_reference_data',
    up: (db) => {
      // Remove 'key' column from races/classes and add bilingual name columns
      // SQLite doesn't support DROP COLUMN, so we need to recreate the tables

      // Step 1: Recreate races table without 'key' column
      db.prepare(
        `
        CREATE TABLE races_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          name_de TEXT NULL,
          name_en TEXT NULL,
          description TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          deleted_at TEXT
        )
      `,
      ).run()

      // Copy data from old table (existing races don't have name_de/name_en)
      db.prepare(
        `
        INSERT INTO races_new (id, name, description, created_at, deleted_at)
        SELECT id, name, description, created_at, deleted_at
        FROM races
      `,
      ).run()

      // Drop old table and rename new one
      db.prepare('DROP TABLE races').run()
      db.prepare('ALTER TABLE races_new RENAME TO races').run()

      // Step 2: Recreate classes table without 'key' column
      db.prepare(
        `
        CREATE TABLE classes_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          name_de TEXT NULL,
          name_en TEXT NULL,
          description TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          deleted_at TEXT
        )
      `,
      ).run()

      // Copy data from old table
      db.prepare(
        `
        INSERT INTO classes_new (id, name, description, created_at, deleted_at)
        SELECT id, name, description, created_at, deleted_at
        FROM classes
      `,
      ).run()

      // Drop old table and rename new one
      db.prepare('DROP TABLE classes').run()
      db.prepare('ALTER TABLE classes_new RENAME TO classes').run()

      console.log(
        '✅ Migration 9: Removed key column and added bilingual reference data support (name_de, name_en)',
      )
    },
  },
  {
    version: 10,
    name: 'settings_table',
    up: (db) => {
      // Settings table for storing application configuration (API keys, preferences, etc.)
      db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `)

      // Create index for faster lookups
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key)
      `)

      console.log('✅ Migration 10: Created settings table for API keys and preferences')
    },
  },
  {
    version: 11,
    name: 'item_types_and_rarities',
    up: (db) => {
      // Item Types table (like races/classes - bilingual with i18n support)
      db.exec(`
        CREATE TABLE IF NOT EXISTS item_types (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          name_de TEXT,
          name_en TEXT,
          is_standard BOOLEAN DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          deleted_at TEXT
        )
      `)

      // Item Rarities table (D&D 5e standard rarities)
      db.exec(`
        CREATE TABLE IF NOT EXISTS item_rarities (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          name_de TEXT,
          name_en TEXT,
          is_standard BOOLEAN DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          deleted_at TEXT
        )
      `)

      // Seed standard Item Types (D&D 5e + common types)
      const itemTypes = [
        { name: 'weapon', name_de: 'Waffe', name_en: 'Weapon', is_standard: 1 },
        { name: 'armor', name_de: 'Rüstung', name_en: 'Armor', is_standard: 1 },
        { name: 'potion', name_de: 'Trank', name_en: 'Potion', is_standard: 1 },
        { name: 'scroll', name_de: 'Schriftrolle', name_en: 'Scroll', is_standard: 1 },
        { name: 'wand', name_de: 'Zauberstab', name_en: 'Wand', is_standard: 1 },
        { name: 'ring', name_de: 'Ring', name_en: 'Ring', is_standard: 1 },
        { name: 'amulet', name_de: 'Amulett', name_en: 'Amulet', is_standard: 1 },
        { name: 'wondrous', name_de: 'Wundersam', name_en: 'Wondrous Item', is_standard: 1 },
        { name: 'tool', name_de: 'Werkzeug', name_en: 'Tool', is_standard: 1 },
        { name: 'treasure', name_de: 'Schatz', name_en: 'Treasure', is_standard: 1 },
        {
          name: 'consumable',
          name_de: 'Verbrauchsgegenstand',
          name_en: 'Consumable',
          is_standard: 1,
        },
        { name: 'quest_item', name_de: 'Quest-Item', name_en: 'Quest Item', is_standard: 1 },
      ]

      const insertType = db.prepare(`
        INSERT INTO item_types (name, name_de, name_en, is_standard)
        VALUES (?, ?, ?, ?)
      `)

      for (const type of itemTypes) {
        insertType.run(type.name, type.name_de, type.name_en, type.is_standard)
      }

      // Seed standard Item Rarities (D&D 5e)
      const itemRarities = [
        { name: 'common', name_de: 'Gewöhnlich', name_en: 'Common', is_standard: 1 },
        { name: 'uncommon', name_de: 'Ungewöhnlich', name_en: 'Uncommon', is_standard: 1 },
        { name: 'rare', name_de: 'Selten', name_en: 'Rare', is_standard: 1 },
        { name: 'very_rare', name_de: 'Sehr selten', name_en: 'Very Rare', is_standard: 1 },
        { name: 'legendary', name_de: 'Legendär', name_en: 'Legendary', is_standard: 1 },
        { name: 'artifact', name_de: 'Artefakt', name_en: 'Artifact', is_standard: 1 },
      ]

      const insertRarity = db.prepare(`
        INSERT INTO item_rarities (name, name_de, name_en, is_standard)
        VALUES (?, ?, ?, ?)
      `)

      for (const rarity of itemRarities) {
        insertRarity.run(rarity.name, rarity.name_de, rarity.name_en, rarity.is_standard)
      }

      console.log(
        '✅ Migration 11: Created item_types and item_rarities tables with bilingual seed data',
      )
    },
  },
  {
    version: 12,
    name: 'hierarchical_locations',
    up: (db) => {
      // Add parent_entity_id column to entities table for hierarchical locations
      // This allows locations to have parent locations (e.g., Tavern -> District -> City -> Region)
      db.exec(`
        ALTER TABLE entities ADD COLUMN parent_entity_id INTEGER REFERENCES entities(id) ON DELETE SET NULL
      `)

      // Create index for faster parent lookups
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_entities_parent ON entities(parent_entity_id)
      `)

      console.log('✅ Migration 12: Added parent_entity_id for hierarchical locations')
    },
  },
  {
    version: 13,
    name: 'add_lore_entity_type',
    up: (db) => {
      // Add Lore entity type for general campaign knowledge/encyclopedia entries
      const insertType = db.prepare('INSERT INTO entity_types (name, icon, color) VALUES (?, ?, ?)')
      insertType.run('Lore', 'mdi-book-open-variant', '#9C6B98')

      console.log('✅ Migration 13: Added Lore entity type for campaign knowledge')
    },
  },
  {
    version: 14,
    name: 'add_i18n_keys_to_races_and_classes',
    up: (db) => {
      // Add 'key' column to races and classes for i18n lookups
      console.log('  Adding key column to races table...')
      db.exec(`
        CREATE TABLE races_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          key TEXT NULL,
          name_de TEXT NULL,
          name_en TEXT NULL,
          description TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          deleted_at TEXT
        )
      `)
      db.exec(`
        INSERT INTO races_new (id, name, name_de, name_en, description, created_at, deleted_at)
        SELECT id, name, name_de, name_en, description, created_at, deleted_at FROM races
      `)
      db.exec('DROP TABLE races')
      db.exec('ALTER TABLE races_new RENAME TO races')

      console.log('  Adding key column to classes table...')
      db.exec(`
        CREATE TABLE classes_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          key TEXT NULL,
          name_de TEXT NULL,
          name_en TEXT NULL,
          description TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          deleted_at TEXT
        )
      `)
      db.exec(`
        INSERT INTO classes_new (id, name, name_de, name_en, description, created_at, deleted_at)
        SELECT id, name, name_de, name_en, description, created_at, deleted_at FROM classes
      `)
      db.exec('DROP TABLE classes')
      db.exec('ALTER TABLE classes_new RENAME TO classes')

      // Map German names to English i18n keys
      const raceKeyMapping: Record<string, string> = {
        Mensch: 'human',
        Elf: 'elf',
        Zwerg: 'dwarf',
        Halbling: 'halfling',
        Gnom: 'gnome',
        Halbelf: 'halfelf',
        Halbork: 'halforc',
        Tiefling: 'tiefling',
        Drachenblütiger: 'dragonborn',
        Drow: 'drow',
        Waldelf: 'woodelf',
        Hochelf: 'highelf',
        Bergzwerg: 'mountaindwarf',
        Hügelzwerg: 'hilldwarf',
        'Leichtfuß-Halbling': 'lightfoothalfling',
        'Robuster Halbling': 'stouthalfling',
      }

      const classKeyMapping: Record<string, string> = {
        Barbar: 'barbarian',
        Barde: 'bard',
        Druide: 'druid',
        Hexenmeister: 'warlock',
        Kämpfer: 'fighter',
        Kleriker: 'cleric',
        Magier: 'wizard',
        Mönch: 'monk',
        Paladin: 'paladin',
        Schurke: 'rogue',
        Waldläufer: 'ranger',
        Zauberer: 'sorcerer',
      }

      // Update races with i18n keys
      console.log('  Updating races with i18n keys...')
      const updateRace = db.prepare('UPDATE races SET key = ? WHERE name = ?')
      for (const [germanName, key] of Object.entries(raceKeyMapping)) {
        updateRace.run(key, germanName)
      }

      // Update classes with i18n keys
      console.log('  Updating classes with i18n keys...')
      const updateClass = db.prepare('UPDATE classes SET key = ? WHERE name = ?')
      for (const [germanName, key] of Object.entries(classKeyMapping)) {
        updateClass.run(key, germanName)
      }

      console.log('✅ Migration 14: Added i18n keys to races and classes for proper translations')
    },
  },
  {
    version: 15,
    name: 'fix_race_class_names_to_keys',
    up: (db) => {
      console.log('  Fixing race/class names to use i18n keys instead of German names...')

      // First, delete duplicate entries that might have been manually created
      // (entries where name is already a key like "human", "elf", etc.)
      console.log('  Removing duplicate race/class entries...')
      const standardRaceKeys = [
        'human',
        'elf',
        'dwarf',
        'halfling',
        'gnome',
        'halfelf',
        'halforc',
        'tiefling',
        'dragonborn',
        'drow',
        'woodelf',
        'highelf',
        'mountaindwarf',
        'hilldwarf',
        'lightfoothalfling',
        'stouthalfling',
      ]

      // Delete races where name is already a key (these are likely duplicates)
      const deleteRace = db.prepare('DELETE FROM races WHERE name = ? AND key IS NULL')
      for (const key of standardRaceKeys) {
        deleteRace.run(key)
      }

      const standardClassKeys = [
        'barbarian',
        'bard',
        'druid',
        'warlock',
        'fighter',
        'cleric',
        'wizard',
        'monk',
        'paladin',
        'rogue',
        'ranger',
        'sorcerer',
      ]

      // Delete classes where name is already a key (these are likely duplicates)
      const deleteClass = db.prepare('DELETE FROM classes WHERE name = ? AND key IS NULL')
      for (const key of standardClassKeys) {
        deleteClass.run(key)
      }

      // For standard races: name should be the KEY (english lowercase), not the German display name
      // name_de and name_en should contain the localized display names
      const raceMapping: Record<string, { key: string; name_de: string; name_en: string }> = {
        Mensch: { key: 'human', name_de: 'Mensch', name_en: 'Human' },
        Elf: { key: 'elf', name_de: 'Elf', name_en: 'Elf' },
        Zwerg: { key: 'dwarf', name_de: 'Zwerg', name_en: 'Dwarf' },
        Halbling: { key: 'halfling', name_de: 'Halbling', name_en: 'Halfling' },
        Gnom: { key: 'gnome', name_de: 'Gnom', name_en: 'Gnome' },
        Halbelf: { key: 'halfelf', name_de: 'Halbelf', name_en: 'Half-Elf' },
        Halbork: { key: 'halforc', name_de: 'Halbork', name_en: 'Half-Orc' },
        Tiefling: { key: 'tiefling', name_de: 'Tiefling', name_en: 'Tiefling' },
        Drachenblütiger: { key: 'dragonborn', name_de: 'Drachenblütiger', name_en: 'Dragonborn' },
        'Zwergelf (Drow)': { key: 'drow', name_de: 'Dunkelelf', name_en: 'Drow' },
        Waldelf: { key: 'woodelf', name_de: 'Waldelf', name_en: 'Wood Elf' },
        Hochelf: { key: 'highelf', name_de: 'Hochelf', name_en: 'High Elf' },
        Bergzwerg: { key: 'mountaindwarf', name_de: 'Bergzwerg', name_en: 'Mountain Dwarf' },
        Hügelzwerg: { key: 'hilldwarf', name_de: 'Hügelzwerg', name_en: 'Hill Dwarf' },
        'Leichtfuß-Halbling': {
          key: 'lightfoothalfling',
          name_de: 'Leichtfuß-Halbling',
          name_en: 'Lightfoot Halfling',
        },
        'Robuster Halbling': {
          key: 'stouthalfling',
          name_de: 'Robuster Halbling',
          name_en: 'Stout Halfling',
        },
      }

      const classMapping: Record<string, { key: string; name_de: string; name_en: string }> = {
        Barbar: { key: 'barbarian', name_de: 'Barbar', name_en: 'Barbarian' },
        Barde: { key: 'bard', name_de: 'Barde', name_en: 'Bard' },
        Druide: { key: 'druid', name_de: 'Druide', name_en: 'Druid' },
        Hexenmeister: { key: 'warlock', name_de: 'Hexenmeister', name_en: 'Warlock' },
        Kämpfer: { key: 'fighter', name_de: 'Kämpfer', name_en: 'Fighter' },
        Kleriker: { key: 'cleric', name_de: 'Kleriker', name_en: 'Cleric' },
        Magier: { key: 'wizard', name_de: 'Magier', name_en: 'Wizard' },
        Mönch: { key: 'monk', name_de: 'Mönch', name_en: 'Monk' },
        Paladin: { key: 'paladin', name_de: 'Paladin', name_en: 'Paladin' },
        Schurke: { key: 'rogue', name_de: 'Schurke', name_en: 'Rogue' },
        Waldläufer: { key: 'ranger', name_de: 'Waldläufer', name_en: 'Ranger' },
        Zauberer: { key: 'sorcerer', name_de: 'Zauberer', name_en: 'Sorcerer' },
      }

      // Update races: Set name = key, name_de = German name, name_en = English name
      const updateRaceStmt = db.prepare(
        'UPDATE races SET name = ?, key = ?, name_de = ?, name_en = ? WHERE name = ?',
      )
      for (const [germanName, data] of Object.entries(raceMapping)) {
        updateRaceStmt.run(data.key, data.key, data.name_de, data.name_en, germanName)
      }

      // Update classes: Set name = key, name_de = German name, name_en = English name
      const updateClassStmt = db.prepare(
        'UPDATE classes SET name = ?, key = ?, name_de = ?, name_en = ? WHERE name = ?',
      )
      for (const [germanName, data] of Object.entries(classMapping)) {
        updateClassStmt.run(data.key, data.key, data.name_de, data.name_en, germanName)
      }

      // Also need to update NPCs metadata that reference the old German names
      console.log('  Updating NPC metadata to use new race/class keys...')

      // Get all NPCs with metadata
      const npcs = db
        .prepare(
          "SELECT id, metadata FROM entities WHERE type_id = (SELECT id FROM entity_types WHERE name = 'NPC') AND metadata IS NOT NULL",
        )
        .all() as Array<{ id: number; metadata: string }>

      const updateNpcMetadata = db.prepare('UPDATE entities SET metadata = ? WHERE id = ?')

      for (const npc of npcs) {
        const metadata = JSON.parse(npc.metadata)
        let changed = false

        // Update race if it's a German name
        if (metadata.race && raceMapping[metadata.race]) {
          metadata.race = raceMapping[metadata.race]?.key
          changed = true
        }

        // Update class if it's a German name
        if (metadata.class && classMapping[metadata.class]) {
          metadata.class = classMapping[metadata.class]?.key
          changed = true
        }

        if (changed) {
          updateNpcMetadata.run(JSON.stringify(metadata), npc.id)
        }
      }

      console.log(
        '✅ Migration 15: Fixed race/class names to use i18n keys with proper name_de/name_en',
      )
    },
  },
  {
    version: 16,
    name: 'add_pdf_support_to_documents',
    up: (db) => {
      console.log('  Adding PDF support to entity_documents table...')

      // Add file_path column for PDF files
      // If file_path is set, the document is a PDF (not markdown)
      db.exec(`
        ALTER TABLE entity_documents ADD COLUMN file_path TEXT
      `)

      // Add file_type column to distinguish between markdown and PDF
      db.exec(`
        ALTER TABLE entity_documents ADD COLUMN file_type TEXT DEFAULT 'markdown'
      `)

      // Create index for faster file_type lookups
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_entity_documents_file_type ON entity_documents(file_type)
      `)

      console.log('✅ Migration 16: Added PDF support (file_path and file_type columns)')
    },
  },
  {
    version: 17,
    name: 'add_player_entity_type',
    up: (db) => {
      // Add Player entity type for real players at the table
      // Players can be linked to NPCs (their PCs), Items, Locations, Factions, Lore
      const insertType = db.prepare('INSERT INTO entity_types (name, icon, color) VALUES (?, ?, ?)')
      insertType.run('Player', 'mdi-account-star', '#4CAF50')

      console.log('✅ Migration 17: Added Player entity type')
    },
  },
  {
    version: 18,
    name: 'calendar_system',
    up: (db) => {
      // Calendar configuration per campaign
      db.exec(`
        CREATE TABLE IF NOT EXISTS calendar_config (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          campaign_id INTEGER NOT NULL UNIQUE,
          current_year INTEGER DEFAULT 1,
          current_month INTEGER DEFAULT 1,
          current_day INTEGER DEFAULT 1,
          year_zero_name TEXT DEFAULT 'Jahr 0',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
        )
      `)

      // Months definition per campaign
      db.exec(`
        CREATE TABLE IF NOT EXISTS calendar_months (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          campaign_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          days INTEGER NOT NULL DEFAULT 30,
          sort_order INTEGER NOT NULL DEFAULT 0,
          FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
        )
      `)

      // Weekdays definition per campaign
      db.exec(`
        CREATE TABLE IF NOT EXISTS calendar_weekdays (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          campaign_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          sort_order INTEGER NOT NULL DEFAULT 0,
          FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
        )
      `)

      // Moons/celestial bodies per campaign (optional)
      db.exec(`
        CREATE TABLE IF NOT EXISTS calendar_moons (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          campaign_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          cycle_days INTEGER NOT NULL DEFAULT 30,
          full_moon_duration INTEGER DEFAULT 1,
          new_moon_duration INTEGER DEFAULT 1,
          phase_offset INTEGER DEFAULT 0,
          FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
        )
      `)

      // Calendar events (birthdays, holidays, deaths, custom)
      db.exec(`
        CREATE TABLE IF NOT EXISTS calendar_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          campaign_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          event_type TEXT NOT NULL DEFAULT 'custom',
          year INTEGER,
          month INTEGER NOT NULL,
          day INTEGER NOT NULL,
          is_recurring INTEGER DEFAULT 0,
          entity_id INTEGER,
          color TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
          FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE SET NULL
        )
      `)

      // Create indexes for performance
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_calendar_months_campaign ON calendar_months(campaign_id);
        CREATE INDEX IF NOT EXISTS idx_calendar_weekdays_campaign ON calendar_weekdays(campaign_id);
        CREATE INDEX IF NOT EXISTS idx_calendar_moons_campaign ON calendar_moons(campaign_id);
        CREATE INDEX IF NOT EXISTS idx_calendar_events_campaign ON calendar_events(campaign_id);
        CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(campaign_id, year, month, day);
      `)

      console.log('✅ Migration 18: Added calendar system tables')
    },
  },
  {
    version: 19,
    name: 'calendar_enhancements',
    up: (db) => {
      // Add era name and leap year support to calendar_config
      db.exec('ALTER TABLE calendar_config ADD COLUMN era_name TEXT DEFAULT \'\'')
      db.exec('ALTER TABLE calendar_config ADD COLUMN leap_year_interval INTEGER DEFAULT 0')
      db.exec('ALTER TABLE calendar_config ADD COLUMN leap_year_month INTEGER DEFAULT 1')
      db.exec('ALTER TABLE calendar_config ADD COLUMN leap_year_extra_days INTEGER DEFAULT 1')

      console.log('✅ Migration 19: Added era name and leap year support to calendar')
    },
  },
  {
    version: 20,
    name: 'enhanced_sessions',
    up: (db) => {
      // 1. Add in-game date fields to sessions
      db.exec('ALTER TABLE sessions ADD COLUMN in_game_date_start TEXT')
      db.exec('ALTER TABLE sessions ADD COLUMN in_game_date_end TEXT')
      db.exec('ALTER TABLE sessions ADD COLUMN duration_minutes INTEGER')
      db.exec(
        'ALTER TABLE sessions ADD COLUMN calendar_event_id INTEGER REFERENCES calendar_events(id) ON DELETE SET NULL',
      )

      // 2. Create session_attendance table for player attendance tracking
      db.exec(`
        CREATE TABLE IF NOT EXISTS session_attendance (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id INTEGER NOT NULL,
          player_id INTEGER NOT NULL,
          character_id INTEGER,
          attended INTEGER NOT NULL DEFAULT 1,
          notes TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
          FOREIGN KEY (player_id) REFERENCES entities(id) ON DELETE CASCADE,
          FOREIGN KEY (character_id) REFERENCES entities(id) ON DELETE SET NULL,
          UNIQUE(session_id, player_id)
        )
      `)

      // 3. Add unique constraint to session_mentions (prevent duplicate mentions)
      // SQLite doesn't support ADD CONSTRAINT, so we recreate the table
      db.exec(`
        CREATE TABLE session_mentions_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id INTEGER NOT NULL,
          entity_id INTEGER NOT NULL,
          context TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
          FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE,
          UNIQUE(session_id, entity_id)
        )
      `)

      // Copy existing data (if any)
      db.exec(`
        INSERT OR IGNORE INTO session_mentions_new (id, session_id, entity_id, context)
        SELECT id, session_id, entity_id, context FROM session_mentions
      `)

      db.exec('DROP TABLE session_mentions')
      db.exec('ALTER TABLE session_mentions_new RENAME TO session_mentions')

      // 4. Create indexes for performance
      db.exec('CREATE INDEX IF NOT EXISTS idx_session_attendance_session ON session_attendance(session_id)')
      db.exec('CREATE INDEX IF NOT EXISTS idx_session_attendance_player ON session_attendance(player_id)')
      db.exec('CREATE INDEX IF NOT EXISTS idx_session_mentions_session ON session_mentions(session_id)')
      db.exec('CREATE INDEX IF NOT EXISTS idx_session_mentions_entity ON session_mentions(entity_id)')
      db.exec('CREATE INDEX IF NOT EXISTS idx_sessions_calendar_event ON sessions(calendar_event_id)')

      console.log('✅ Migration 20: Enhanced sessions with attendance, in-game dates, and improved mentions')
    },
  },
  {
    version: 21,
    name: 'session_absolute_day',
    up: (db) => {
      // Add absolute day number fields for proper calendar integration
      // These store the total day count from Year 1, Day 1
      // The TEXT fields (in_game_date_start/end) remain for backwards compatibility
      db.exec('ALTER TABLE sessions ADD COLUMN in_game_day_start INTEGER')
      db.exec('ALTER TABLE sessions ADD COLUMN in_game_day_end INTEGER')

      console.log('✅ Migration 21: Added absolute day fields to sessions for calendar integration')
    },
  },
  {
    version: 22,
    name: 'session_images',
    up: (db) => {
      // Create session_images table for session cover images (like entity_images)
      db.exec(`
        CREATE TABLE IF NOT EXISTS session_images (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id INTEGER NOT NULL,
          image_url TEXT NOT NULL,
          caption TEXT,
          is_primary INTEGER NOT NULL DEFAULT 0,
          display_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        )
      `)

      // Create index for faster lookups
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_session_images_session_id ON session_images(session_id)
      `)

      console.log('✅ Migration 22: Session images table created for cover images')
    },
  },
  {
    version: 23,
    name: 'session_audio',
    up: (db) => {
      // Create session_audio table for audio recordings
      db.exec(`
        CREATE TABLE IF NOT EXISTS session_audio (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id INTEGER NOT NULL,
          audio_url TEXT NOT NULL,
          title TEXT,
          description TEXT,
          duration_seconds INTEGER,
          file_size_bytes INTEGER,
          mime_type TEXT,
          display_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        )
      `)

      // Create index for faster lookups
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_session_audio_session_id ON session_audio(session_id)
      `)

      // Create audio_markers table for timestamp markers
      db.exec(`
        CREATE TABLE IF NOT EXISTS audio_markers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          audio_id INTEGER NOT NULL,
          timestamp_seconds REAL NOT NULL,
          label TEXT NOT NULL,
          description TEXT,
          color TEXT DEFAULT '#D4A574',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (audio_id) REFERENCES session_audio(id) ON DELETE CASCADE
        )
      `)

      // Create index for faster marker lookups
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_audio_markers_audio_id ON audio_markers(audio_id)
      `)

      console.log('✅ Migration 23: Session audio and markers tables created')
    },
  },
  {
    version: 24,
    name: 'normalize_relation_types_to_english_keys',
    up: (db) => {
      // Map German relation_type values to English keys
      // This fixes data that was saved with translated values instead of keys

      // NPC relation types (German -> English key)
      const npcRelationMappings: Record<string, string> = {
        'Verbündeter': 'ally',
        'Feind': 'enemy',
        'Enemy': 'enemy',
        'Familie': 'family',
        'Freund': 'friend',
        'Friend': 'friend',
        'Rivale': 'rival',
        'Mentor': 'mentor',
        'Schüler': 'student',
        'Kollege': 'colleague',
        'Vorgesetzter': 'superior',
        'Untergebener': 'subordinate',
        'Erschaffer': 'creator',
        'Erschaffung': 'creation',
        'Diener': 'servant',
        'Herr': 'master',
        'Ehepartner': 'spouse',
        'Elternteil': 'parent',
        'Kind': 'child',
        'Geschwister': 'sibling',
        'Arbeitgeber': 'employer',
        'Angestellter': 'employee',
        'Verräter': 'betrayer',
        'Geliebte/r': 'lover',
        'Lehrling': 'apprentice',
        'Geschäftspartner': 'business_partner',
        'Gleichgesinnter': 'like_minded',
        'Beschützer': 'protector',
        'Schützling': 'ward',
        'Erzfeind': 'nemesis',
        'Kontakt': 'contact',
        'Informant': 'informant',
        'Schuldner': 'debtor',
        'Gläubiger': 'creditor',
      }

      // Location relation types (German -> English key)
      const locationRelationMappings: Record<string, string> = {
        'lebt in': 'livesIn',
        'arbeitet bei': 'worksAt',
        'besucht oft': 'visitsOften',
        'geboren in': 'bornIn',
        'versteckt sich in': 'hidesIn',
        'besitzt': 'owns',
        'sucht nach': 'searchesFor',
        'verbannt aus': 'banishedFrom',
        'bewacht': 'guards',
        'derzeit anwesend': 'currentlyAt',
        'gefangen in': 'imprisonedIn',
        'regiert': 'rulesOver',
        'geflohen aus': 'fledFrom',
        'hat Bezug zu': 'hasConnectionTo',
        'gestorben in': 'diedIn',
        'ausgebildet in': 'trainedIn',
        'patrouilliert in': 'patrolsIn',
        'verkehrt in': 'frequents',
        'meidet': 'avoids',
        'beschützt': 'protects',
        'gereist nach': 'traveledTo',
      }

      // Item relation types (German -> English key)
      const itemRelationMappings: Record<string, string> = {
        'besitzt': 'owns',
        'trägt bei sich': 'carries',
        'führt': 'wields',
        'trägt': 'wears',
        'sucht': 'seeks',
        'bewacht': 'guards',
        'hat gestohlen': 'stole',
        'hat verloren': 'lost',
        'hat erschaffen': 'created',
        'hat zerstört': 'destroyed',
        'hat verkauft': 'sold',
        'hat gekauft': 'bought',
        'hat geliehen': 'borrowed',
        'hat verliehen': 'lent',
        'versteckt': 'hides',
        'hat geerbt': 'inherited',
        'hat geschenkt': 'gifted',
        'hat gefunden': 'found',
        'hat verzaubert': 'enchanted',
        'hat repariert': 'repaired',
      }

      // Faction membership types (German -> English key)
      const membershipMappings: Record<string, string> = {
        'Anführer': 'leader',
        'Mitglied': 'member',
        'Gründer': 'founder',
        'Verbündeter': 'ally',
        'Feind': 'enemy',
        'Ehemaliges Mitglied': 'former',
        'Rekrut': 'recruit',
        'Veteran': 'veteran',
        'Offizier': 'officer',
        'Spion': 'spy',
        'Informant': 'informant',
        'Unterstützer': 'supporter',
        'Söldner': 'mercenary',
        'Berater': 'advisor',
        'Schirmherr': 'patron',
        'Agent': 'agent',
        'Botschafter': 'ambassador',
        'Ehrenmitglied': 'honorary',
        'Verbannter': 'exile',
        'Überläufer': 'defector',
        'Anwärter': 'aspirant',
        'Schüler': 'acolyte',
      }

      // Faction location types (German -> English key)
      const factionLocationMappings: Record<string, string> = {
        'Hauptquartier': 'headquarters',
        'Versteck': 'hideout',
        'Treffpunkt': 'meetingPlace',
        'Territorium': 'territory',
        'Außenposten': 'outpost',
        'Operationsbasis': 'operationsBase',
        'Ressourcengebiet': 'resourceArea',
        'Verbotene Zone': 'forbiddenZone',
        'Historische Stätte': 'historicSite',
        'Rekrutierungsort': 'recruitmentGround',
      }

      // Combine all mappings
      const allMappings: Record<string, string> = {
        ...npcRelationMappings,
        ...locationRelationMappings,
        ...itemRelationMappings,
        ...membershipMappings,
        ...factionLocationMappings,
      }

      // Update entity_relations table
      const updateStmt = db.prepare('UPDATE entity_relations SET relation_type = ? WHERE relation_type = ?')

      let updatedCount = 0
      for (const [germanValue, englishKey] of Object.entries(allMappings)) {
        const result = updateStmt.run(englishKey, germanValue)
        if (result.changes > 0) {
          console.log(`  Updated ${result.changes} relations: "${germanValue}" → "${englishKey}"`)
          updatedCount += result.changes
        }
      }

      // Also update faction alignments in metadata
      const alignmentMappings: Record<string, string> = {
        'Rechtschaffen Gut': 'lawfulGood',
        'Neutral Gut': 'neutralGood',
        'Chaotisch Gut': 'chaoticGood',
        'Rechtschaffen Neutral': 'lawfulNeutral',
        'Neutral': 'trueNeutral',
        'Echt Neutral': 'trueNeutral',
        'Chaotisch Neutral': 'chaoticNeutral',
        'Rechtschaffen Böse': 'lawfulEvil',
        'Neutral Böse': 'neutralEvil',
        'Chaotisch Böse': 'chaoticEvil',
      }

      // Get all factions with metadata
      const factions = db.prepare(`
        SELECT e.id, e.metadata FROM entities e
        JOIN entity_types et ON e.type_id = et.id
        WHERE et.name = 'Faction' AND e.metadata IS NOT NULL AND e.deleted_at IS NULL
      `).all() as Array<{ id: number; metadata: string }>

      const updateMetadataStmt = db.prepare('UPDATE entities SET metadata = ? WHERE id = ?')

      for (const faction of factions) {
        try {
          const metadata = JSON.parse(faction.metadata)
          if (metadata.alignment && alignmentMappings[metadata.alignment]) {
            const oldAlignment = metadata.alignment
            metadata.alignment = alignmentMappings[metadata.alignment]
            updateMetadataStmt.run(JSON.stringify(metadata), faction.id)
            console.log(`  Updated faction ${faction.id} alignment: "${oldAlignment}" → "${metadata.alignment}"`)
            updatedCount++
          }
        } catch {
          // Skip invalid JSON
        }
      }

      console.log(`✅ Migration 24: Normalized ${updatedCount} relation_type values to English keys`)
    },
  },
  {
    version: 25,
    name: 'campaign_maps',
    up: (db) => {
      // Create campaign_maps table for interactive maps
      db.exec(`
        CREATE TABLE IF NOT EXISTS campaign_maps (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          campaign_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          image_url TEXT NOT NULL,
          parent_map_id INTEGER,
          version_name TEXT,
          default_zoom REAL DEFAULT 1.0,
          min_zoom REAL DEFAULT 0.5,
          max_zoom REAL DEFAULT 3.0,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          deleted_at TEXT,
          FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
          FOREIGN KEY (parent_map_id) REFERENCES campaign_maps(id) ON DELETE SET NULL
        )
      `)

      // Create map_markers table for entity markers on maps
      db.exec(`
        CREATE TABLE IF NOT EXISTS map_markers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          map_id INTEGER NOT NULL,
          entity_id INTEGER NOT NULL,
          x REAL NOT NULL,
          y REAL NOT NULL,
          custom_icon TEXT,
          custom_color TEXT,
          custom_label TEXT,
          notes TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (map_id) REFERENCES campaign_maps(id) ON DELETE CASCADE,
          FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
        )
      `)

      // Create indexes for faster lookups
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_campaign_maps_campaign ON campaign_maps(campaign_id);
        CREATE INDEX IF NOT EXISTS idx_map_markers_map_id ON map_markers(map_id);
        CREATE INDEX IF NOT EXISTS idx_map_markers_entity_id ON map_markers(entity_id);
      `)

      console.log('✅ Migration 25: Campaign maps and markers tables created')
    },
  },
  {
    version: 26,
    name: 'location_standort_feature',
    up: (db) => {
      // Add location_id to entities table for current location (Standort)
      // This is separate from relations - it's THE current location for map display
      db.exec(`
        ALTER TABLE entities ADD COLUMN location_id INTEGER REFERENCES entities(id) ON DELETE SET NULL
      `)

      // Create index for faster location lookups
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_entities_location_id ON entities(location_id)
      `)

      // Create map_areas table for location circles/regions on maps
      db.exec(`
        CREATE TABLE IF NOT EXISTS map_areas (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          map_id INTEGER NOT NULL,
          location_id INTEGER NOT NULL,
          center_x REAL NOT NULL,
          center_y REAL NOT NULL,
          radius REAL NOT NULL DEFAULT 5.0,
          color TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (map_id) REFERENCES campaign_maps(id) ON DELETE CASCADE,
          FOREIGN KEY (location_id) REFERENCES entities(id) ON DELETE CASCADE,
          UNIQUE(map_id, location_id)
        )
      `)

      // Create indexes for map_areas
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_map_areas_map_id ON map_areas(map_id);
        CREATE INDEX IF NOT EXISTS idx_map_areas_location_id ON map_areas(location_id);
      `)

      console.log('✅ Migration 26: Location Standort feature - location_id and map_areas created')
    },
  },
  {
    version: 27,
    name: 'Add map scale for measurement tool',
    up: (db: Database.Database) => {
      // Add scale fields to campaign_maps
      // scale_value: the distance value the map width represents (e.g., 100)
      // scale_unit: the unit of measurement (km, miles, m, ft, leagues)
      db.exec(`
        ALTER TABLE campaign_maps ADD COLUMN scale_value REAL DEFAULT NULL;
        ALTER TABLE campaign_maps ADD COLUMN scale_unit TEXT DEFAULT NULL;
      `)

      console.log('✅ Migration 27: Map scale fields added for measurement tool')
    },
  },
  {
    version: 28,
    name: 'Add currencies table for flexible item pricing',
    up: (db: Database.Database) => {
      // Create currencies table
      db.exec(`
        CREATE TABLE IF NOT EXISTS currencies (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          campaign_id INTEGER NOT NULL,
          code TEXT NOT NULL,
          name TEXT NOT NULL,
          symbol TEXT,
          exchange_rate REAL NOT NULL DEFAULT 1,
          sort_order INTEGER NOT NULL DEFAULT 0,
          is_default INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
        )
      `)

      // Add unique constraint for code per campaign
      db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_currencies_campaign_code
        ON currencies(campaign_id, code)
      `)

      // Insert default currencies for all existing campaigns
      // Bronze = 1, Silver = 10, Gold = 100, Platinum = 1000
      const campaigns = db.prepare('SELECT id FROM campaigns').all() as { id: number }[]

      const insertCurrency = db.prepare(`
        INSERT INTO currencies (campaign_id, code, name, symbol, exchange_rate, sort_order, is_default)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)

      for (const campaign of campaigns) {
        // Store keys (copper, silver, gold, platinum) for i18n translation in frontend
        insertCurrency.run(campaign.id, 'CP', 'copper', 'CP', 1, 0, 0)
        insertCurrency.run(campaign.id, 'SP', 'silver', 'SP', 10, 1, 0)
        insertCurrency.run(campaign.id, 'GP', 'gold', 'GP', 100, 2, 1) // Gold is default
        insertCurrency.run(campaign.id, 'PP', 'platinum', 'PP', 1000, 3, 0)
      }

      console.log('✅ Migration 28: Currencies table created with defaults for all campaigns')
    },
  },
  {
    version: 29,
    name: 'Convert currency names to i18n keys',
    up: (db: Database.Database) => {
      // Convert English currency names to lowercase keys for i18n
      const nameMapping: Record<string, string> = {
        Copper: 'copper',
        Silver: 'silver',
        Gold: 'gold',
        Platinum: 'platinum',
      }

      const updateStmt = db.prepare('UPDATE currencies SET name = ? WHERE name = ?')

      for (const [englishName, key] of Object.entries(nameMapping)) {
        const result = updateStmt.run(key, englishName)
        if (result.changes > 0) {
          console.log(`  Converted "${englishName}" → "${key}" (${result.changes} rows)`)
        }
      }

      console.log('✅ Migration 29: Currency names converted to i18n keys')
    },
  },
  {
    version: 30,
    name: 'Calendar seasons and multi-entity events',
    up: (db: Database.Database) => {
      // Create calendar_seasons table for season definitions
      // Seasons are defined by their start month/day and repeat yearly
      db.exec(`
        CREATE TABLE IF NOT EXISTS calendar_seasons (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          campaign_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          start_month INTEGER NOT NULL,
          start_day INTEGER NOT NULL,
          background_image TEXT,
          color TEXT,
          icon TEXT,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
        )
      `)

      // Create calendar_event_entities junction table for multi-entity linking
      // Replaces the single entity_id column on calendar_events
      db.exec(`
        CREATE TABLE IF NOT EXISTS calendar_event_entities (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event_id INTEGER NOT NULL,
          entity_id INTEGER NOT NULL,
          entity_type TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (event_id) REFERENCES calendar_events(id) ON DELETE CASCADE,
          FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE,
          UNIQUE(event_id, entity_id)
        )
      `)

      // Create indexes for performance
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_calendar_seasons_campaign ON calendar_seasons(campaign_id);
        CREATE INDEX IF NOT EXISTS idx_calendar_event_entities_event ON calendar_event_entities(event_id);
        CREATE INDEX IF NOT EXISTS idx_calendar_event_entities_entity ON calendar_event_entities(entity_id);
      `)

      // Migrate existing single entity_id links to the new junction table
      db.exec(`
        INSERT INTO calendar_event_entities (event_id, entity_id, entity_type)
        SELECT ce.id, ce.entity_id, et.name
        FROM calendar_events ce
        JOIN entities e ON ce.entity_id = e.id
        JOIN entity_types et ON e.type_id = et.id
        WHERE ce.entity_id IS NOT NULL
      `)

      // Create default seasons for all campaigns with calendar_config
      // Based on a 12-month calendar: Winter (month 1), Spring (month 4), Summer (month 7), Autumn (month 10)
      const defaultSeasons = [
        { name: 'Winter', start_month: 1, start_day: 1, background_image: '/images/seasons/winter.png', sort_order: 0 },
        { name: 'Frühling', start_month: 4, start_day: 1, background_image: '/images/seasons/spring.png', sort_order: 1 },
        { name: 'Sommer', start_month: 7, start_day: 1, background_image: '/images/seasons/summer.png', sort_order: 2 },
        { name: 'Herbst', start_month: 10, start_day: 1, background_image: '/images/seasons/autumn.png', sort_order: 3 },
      ]

      const campaignsWithCalendar = db.prepare(`
        SELECT DISTINCT campaign_id FROM calendar_config
      `).all() as Array<{ campaign_id: number }>

      const insertSeason = db.prepare(`
        INSERT INTO calendar_seasons (campaign_id, name, start_month, start_day, background_image, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `)

      for (const campaign of campaignsWithCalendar) {
        for (const season of defaultSeasons) {
          insertSeason.run(
            campaign.campaign_id,
            season.name,
            season.start_month,
            season.start_day,
            season.background_image,
            season.sort_order,
          )
        }
      }

      console.log('✅ Migration 30: Calendar seasons and multi-entity events')
    },
  },
  {
    version: 31,
    name: 'Calendar weather system',
    up: (db: Database.Database) => {
      // Create calendar_weather table for daily weather data
      db.exec(`
        CREATE TABLE IF NOT EXISTS calendar_weather (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          campaign_id INTEGER NOT NULL,
          year INTEGER NOT NULL,
          month INTEGER NOT NULL,
          day INTEGER NOT NULL,
          weather_type TEXT NOT NULL,
          temperature INTEGER,
          notes TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
          UNIQUE(campaign_id, year, month, day)
        )
      `)

      // Create index for efficient weather lookups
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_calendar_weather_campaign_date
        ON calendar_weather(campaign_id, year, month, day)
      `)

      console.log('✅ Migration 31: Calendar weather system')
    },
  },
  {
    version: 32,
    name: 'Add weather_type to calendar_seasons',
    up: (db: Database.Database) => {
      // Add weather_type column to calendar_seasons
      // Values: 'winter', 'spring', 'summer', 'autumn'
      db.exec(`
        ALTER TABLE calendar_seasons ADD COLUMN weather_type TEXT DEFAULT 'summer'
      `)

      // Try to auto-detect weather type from existing season names
      const seasons = db.prepare('SELECT id, name FROM calendar_seasons').all() as Array<{
        id: number
        name: string
      }>

      const updateStmt = db.prepare('UPDATE calendar_seasons SET weather_type = ? WHERE id = ?')

      for (const season of seasons) {
        const name = season.name.toLowerCase()
        let weatherType = 'summer' // default

        if (name.includes('winter') || name.includes('kalt')) {
          weatherType = 'winter'
        } else if (name.includes('spring') || name.includes('früh') || name.includes('lenz')) {
          weatherType = 'spring'
        } else if (name.includes('summer') || name.includes('sommer')) {
          weatherType = 'summer'
        } else if (name.includes('autumn') || name.includes('herbst') || name.includes('fall')) {
          weatherType = 'autumn'
        }

        updateStmt.run(weatherType, season.id)
      }

      console.log('✅ Migration 32: Added weather_type to calendar_seasons')
    },
  },
  {
    version: 33,
    name: 'Sync entities.image_url from primary entity_images',
    up: (db: Database.Database) => {
      // Update entities.image_url from primary image in entity_images table
      // This fixes entities where image_url was never set despite having images
      const result = db.prepare(`
        UPDATE entities
        SET image_url = (
          SELECT ei.image_url
          FROM entity_images ei
          WHERE ei.entity_id = entities.id AND ei.is_primary = 1
          LIMIT 1
        )
        WHERE EXISTS (
          SELECT 1 FROM entity_images ei
          WHERE ei.entity_id = entities.id AND ei.is_primary = 1
        )
        AND (entities.image_url IS NULL OR entities.image_url = '')
      `).run()

      console.log(`✅ Migration 33: Synced ${result.changes} entities with their primary image`)
    },
  },
  {
    version: 34,
    name: 'Add pinboard table for quick entity access',
    up: (db: Database.Database) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS pinboard (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          campaign_id INTEGER NOT NULL,
          entity_id INTEGER NOT NULL,
          display_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
          FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE,
          UNIQUE(campaign_id, entity_id)
        )
      `)

      // Index for fast lookups
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_pinboard_campaign_id ON pinboard(campaign_id)
      `)

      console.log('✅ Migration 34: Created pinboard table')
    },
  },
  {
    version: 35,
    name: 'Add campaign_notes table for DM todos',
    up: (db: Database.Database) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS campaign_notes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          campaign_id INTEGER NOT NULL,
          content TEXT NOT NULL,
          completed INTEGER NOT NULL DEFAULT 0,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
        )
      `)

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_campaign_notes_campaign_id ON campaign_notes(campaign_id)
      `)

      console.log('✅ Migration 35: Created campaign_notes table')
    },
  },
  {
    version: 36,
    name: 'Add year/month fields to sessions for calendar recalculation',
    up: (db: Database.Database) => {
      // Add new columns for storing year/month separately
      // This allows recalculating absolute days when calendar config changes (e.g., leap years)
      db.exec('ALTER TABLE sessions ADD COLUMN in_game_year_start INTEGER')
      db.exec('ALTER TABLE sessions ADD COLUMN in_game_month_start INTEGER')
      db.exec('ALTER TABLE sessions ADD COLUMN in_game_year_end INTEGER')
      db.exec('ALTER TABLE sessions ADD COLUMN in_game_month_end INTEGER')

      // Rename existing columns to be clearer (day of month, not absolute day)
      // Note: SQLite doesn't support RENAME COLUMN in older versions, so we keep the names
      // in_game_day_start now represents day-of-month (1-31), not absolute day

      // Convert existing absolute days to year/month/day
      // We need to do this per-campaign since each has its own calendar
      interface SessionRow {
        id: number
        campaign_id: number
        in_game_day_start: number | null
        in_game_day_end: number | null
      }

      interface CalendarConfig {
        current_year: number
        current_month: number
        current_day: number
        leap_year_interval: number
        leap_year_month: number
        leap_year_extra_days: number
      }

      interface CalendarMonth {
        days: number
      }

      const sessions = db
        .prepare(
          `SELECT id, campaign_id, in_game_day_start, in_game_day_end
           FROM sessions
           WHERE in_game_day_start IS NOT NULL`,
        )
        .all() as SessionRow[]

      if (sessions.length === 0) {
        console.log('  No sessions with in_game_day_start to migrate')
        console.log('✅ Migration 36: Added year/month fields to sessions')
        return
      }

      // Group sessions by campaign
      const sessionsByCampaign = new Map<number, SessionRow[]>()
      for (const session of sessions) {
        const list = sessionsByCampaign.get(session.campaign_id) || []
        list.push(session)
        sessionsByCampaign.set(session.campaign_id, list)
      }

      const updateStmt = db.prepare(`
        UPDATE sessions
        SET in_game_year_start = ?,
            in_game_month_start = ?,
            in_game_day_start = ?,
            in_game_year_end = ?,
            in_game_month_end = ?,
            in_game_day_end = ?
        WHERE id = ?
      `)

      // Helper function to convert absolute day to date
      function absoluteDayToDate(
        absoluteDay: number,
        months: CalendarMonth[],
        config: CalendarConfig,
      ): { year: number; month: number; day: number } | null {
        if (absoluteDay <= 0 || months.length === 0) return null

        const getDaysInYear = (year: number): number => {
          let total = months.reduce((sum, m) => sum + m.days, 0)
          if (config.leap_year_interval > 0 && year % config.leap_year_interval === 0) {
            total += config.leap_year_extra_days
          }
          return total
        }

        const getDaysInMonth = (year: number, monthIndex: number): number => {
          const month = months[monthIndex]
          if (!month) return 30
          let days = month.days
          if (
            config.leap_year_interval > 0 &&
            year % config.leap_year_interval === 0 &&
            config.leap_year_month > 0 &&
            monthIndex === config.leap_year_month - 1
          ) {
            days += config.leap_year_extra_days
          }
          return days
        }

        let remainingDays = absoluteDay
        let year = 1

        // Find the year
        while (true) {
          const daysInYear = getDaysInYear(year)
          if (remainingDays <= daysInYear) break
          remainingDays -= daysInYear
          year++
        }

        // Find the month
        let month = 1
        for (let m = 0; m < months.length; m++) {
          const daysInMonth = getDaysInMonth(year, m)
          if (remainingDays <= daysInMonth) {
            month = m + 1
            break
          }
          remainingDays -= daysInMonth
          month = m + 2
        }

        return { year, month, day: remainingDays }
      }

      // Process each campaign
      for (const [campaignId, campaignSessions] of sessionsByCampaign) {
        // Get calendar config for this campaign
        const config = db
          .prepare('SELECT * FROM calendar_config WHERE campaign_id = ?')
          .get(campaignId) as CalendarConfig | undefined

        const months = db
          .prepare('SELECT days FROM calendar_months WHERE campaign_id = ? ORDER BY sort_order')
          .all(campaignId) as CalendarMonth[]

        if (!config || months.length === 0) {
          console.log(`  Skipping campaign ${campaignId}: no calendar configured`)
          continue
        }

        // Convert each session
        for (const session of campaignSessions) {
          const startDate = session.in_game_day_start
            ? absoluteDayToDate(session.in_game_day_start, months, config)
            : null
          const endDate = session.in_game_day_end
            ? absoluteDayToDate(session.in_game_day_end, months, config)
            : null

          updateStmt.run(
            startDate?.year || null,
            startDate?.month || null,
            startDate?.day || null, // Now stores day-of-month instead of absolute day
            endDate?.year || null,
            endDate?.month || null,
            endDate?.day || null,
            session.id,
          )
        }

        console.log(`  Converted ${campaignSessions.length} sessions for campaign ${campaignId}`)
      }

      console.log('✅ Migration 36: Added year/month fields and converted existing sessions')
    },
  },
]

export async function runMigrations(db: Database.Database) {
  const currentVersion = getCurrentVersion(db)
  const pendingMigrations = migrations.filter((m) => m.version > currentVersion)

  if (pendingMigrations.length === 0) {
    console.log(`✅ Database is up to date (version: ${currentVersion})`)
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
    } catch (error) {
      db.exec('ROLLBACK')
      console.error(`  ❌ Migration ${migration.version} failed:`, error)
      throw error
    }
  }

  console.log('✅ All migrations completed successfully')
}
