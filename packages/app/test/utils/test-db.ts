import Database from 'better-sqlite3'
import { migrations } from '../../server/utils/migrations'
import { getCurrentVersion, setVersion } from '../../server/utils/db'

/**
 * Creates an isolated in-memory SQLite database with all migrations applied.
 * Use this instead of getDb() in tests to avoid touching the dev database.
 */
export function getTestDb(): Database.Database {
  const db = new Database(':memory:')
  // No journal_mode=WAL — WAL needs a real file and breaks FTS5 on :memory:.
  db.pragma('foreign_keys = ON')

  // Run all migrations
  const currentVersion = getCurrentVersion(db)
  const pendingMigrations = migrations.filter(m => m.version > currentVersion)

  for (const migration of pendingMigrations) {
    migration.up(db)
    setVersion(db, migration.version)
  }

  // Seed a default campaign + a handful of entities so legacy tests that assumed
  // the dev DB had some content (campaigns, NPCs, items, etc.) keep working.
  seedDemoData(db)

  return db
}

/**
 * Inserts one campaign and a couple of entities per type. Kept intentionally small —
 * tests that need specific data should still create their own.
 */
function seedDemoData(db: Database.Database) {
  const campaignId = Number(
    db.prepare('INSERT INTO campaigns (name, description) VALUES (?, ?)').run(
      'Test Campaign',
      'Default test campaign',
    ).lastInsertRowid,
  )

  const typeRow = (name: string) =>
    db.prepare('SELECT id FROM entity_types WHERE name = ?').get(name) as { id: number } | undefined

  const seed = (typeName: string, names: string[]) => {
    const t = typeRow(typeName)
    if (!t) return
    const insert = db.prepare(
      'INSERT INTO entities (type_id, campaign_id, name, description) VALUES (?, ?, ?, ?)',
    )
    for (const n of names) insert.run(t.id, campaignId, n, `${typeName} ${n} description`)
  }

  seed('NPC', ['Demo NPC Alpha', 'Demo NPC Beta'])
  seed('Item', ['Demo Sword', 'Demo Potion'])
  seed('Location', ['Demo Tavern', 'Demo Forest'])
  seed('Faction', ['Demo Guild'])
  seed('Lore', ['Demo Legend'])
  seed('Player', ['Demo Player'])
}
