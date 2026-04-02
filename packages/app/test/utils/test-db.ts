import Database from 'better-sqlite3'
import { migrations } from '../../server/utils/migrations'
import { getCurrentVersion, setVersion } from '../../server/utils/db'

/**
 * Creates an isolated in-memory SQLite database with all migrations applied.
 * Use this instead of getDb() in tests to avoid touching the dev database.
 */
export function getTestDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // Run all migrations
  const currentVersion = getCurrentVersion(db)
  const pendingMigrations = migrations.filter(m => m.version > currentVersion)

  for (const migration of pendingMigrations) {
    migration.up(db)
    setVersion(db, migration.version)
  }

  return db
}
