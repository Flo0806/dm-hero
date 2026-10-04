import type Database from 'better-sqlite3'
import { readJsonSetting, writeSetting } from '../settings'

// Ticked fields per share type, remembered globally for the DM (settings table)
const KEY = 'share_defaults'

export function getShareDefaults(db: Database.Database): Record<string, string[]> {
  return readJsonSetting<Record<string, string[]>>(db, KEY, {})
}

export function saveShareDefaults(db: Database.Database, defaults: Record<string, string[]>) {
  writeSetting(db, KEY, JSON.stringify(defaults))
}
