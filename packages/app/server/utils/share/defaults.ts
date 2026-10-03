import type Database from 'better-sqlite3'
import { decrypt, encrypt } from '../encryption'

// Ticked fields per share type, remembered globally for the DM (settings table)
const KEY = 'share_defaults'

export function getShareDefaults(db: Database.Database): Record<string, string[]> {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(KEY) as { value: string } | undefined
  if (!row) return {}
  try {
    return JSON.parse(decrypt(row.value)) as Record<string, string[]>
  }
  catch {
    return {}
  }
}

export function saveShareDefaults(db: Database.Database, defaults: Record<string, string[]>) {
  db.prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `).run(KEY, encrypt(JSON.stringify(defaults)))
}
