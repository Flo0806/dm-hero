import type Database from 'better-sqlite3'
import { decrypt, encrypt } from './encryption'

// The settings table: one encrypted value per key (like every setting).
// Unreadable values (e.g. a changed ENCRYPTION_SECRET) count as "not set".

export function readSetting(db: Database.Database, key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  if (!row) return null
  try {
    return decrypt(row.value)
  }
  catch {
    return null
  }
}

export function writeSetting(db: Database.Database, key: string, value: string) {
  db.prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `).run(key, encrypt(value))
}

/** A JSON setting, or the fallback if missing/unreadable */
export function readJsonSetting<T>(db: Database.Database, key: string, fallback: T): T {
  const value = readSetting(db, key)
  if (value === null) return fallback
  try {
    return JSON.parse(value) as T
  }
  catch {
    return fallback
  }
}
