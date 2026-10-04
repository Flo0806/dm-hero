import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

// Built-in node:sqlite - no native module to rebuild or break.
// Stores only what the relay needs: games, players (PIN hashes), sessions and
// encrypted content (shares, the shown map + its fog of war).
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    dm_token_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    dm_signing_public TEXT,
    dm_exchange_public TEXT,
    last_seen_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS players (
    game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    id TEXT NOT NULL,
    name TEXT NOT NULL,
    pin_hash TEXT NOT NULL,
    PRIMARY KEY (game_id, id)
  );
  CREATE TABLE IF NOT EXISTS shares (
    game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    id TEXT NOT NULL,
    envelope TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (game_id, id)
  );
  CREATE TABLE IF NOT EXISTS game_state (
    game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    slot TEXT NOT NULL,
    envelope TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (game_id, slot)
  );
  CREATE TABLE IF NOT EXISTS handouts (
    game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    id TEXT NOT NULL,
    player_id TEXT NOT NULL,
    envelopes TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (game_id, id, player_id)
  );
  CREATE TABLE IF NOT EXISTS threads (
    game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    player_id TEXT NOT NULL,
    envelopes TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (game_id, player_id)
  );
  CREATE TABLE IF NOT EXISTS inbox (
    game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    id TEXT NOT NULL,
    player_id TEXT NOT NULL,
    public_key TEXT NOT NULL,
    envelope TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (game_id, id)
  );
  CREATE TABLE IF NOT EXISTS files (
    game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    id TEXT NOT NULL,
    size INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (game_id, id)
  );
  CREATE TABLE IF NOT EXISTS player_sessions (
    token_hash TEXT PRIMARY KEY,
    game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    player_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    public_key TEXT,
    wrapped_key TEXT,
    last_used_at INTEGER
  );
`

let db: DatabaseSync | null = null

export function useRelayDb(): DatabaseSync {
  if (db) return db
  const path = useRuntimeConfig().databasePath
  mkdirSync(dirname(path), { recursive: true })
  db = new DatabaseSync(path)
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')
  db.exec(SCHEMA)
  addMissingColumns(db, 'games', ['dm_signing_public TEXT', 'dm_exchange_public TEXT', 'last_seen_at INTEGER'])
  addMissingColumns(db, 'player_sessions', ['public_key TEXT', 'wrapped_key TEXT', 'last_used_at INTEGER'])
  return db
}

// Databases created before a column existed get it added (CREATE IF NOT EXISTS doesn't)
function addMissingColumns(db: DatabaseSync, table: string, columns: string[]) {
  const existing = new Set((db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map(c => c.name))
  for (const column of columns) {
    if (!existing.has(column.split(' ')[0]!)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column}`)
  }
}

export interface GameRow {
  id: string
  code: string
  dm_token_hash: string
}

export function findGame(id: string): GameRow | undefined {
  return useRelayDb().prepare('SELECT id, code, dm_token_hash FROM games WHERE id = ?').get(id) as GameRow | undefined
}

// Activity stamps for the cleanup - written at most every few minutes per game/session
const TOUCH_EVERY_MS = 10 * 60 * 1000

/** DM Hero was in contact with this game */
export function touchGame(id: string, now = Date.now()) {
  useRelayDb().prepare('UPDATE games SET last_seen_at = ? WHERE id = ? AND (last_seen_at IS NULL OR last_seen_at < ?)')
    .run(now, id, now - TOUCH_EVERY_MS)
}

/** A player used this session; true = stamp written (cookie worth renewing) */
export function touchSession(tokenHash: string, now = Date.now()) {
  return useRelayDb().prepare('UPDATE player_sessions SET last_used_at = ? WHERE token_hash = ? AND (last_used_at IS NULL OR last_used_at < ?)')
    .run(now, tokenHash, now - TOUCH_EVERY_MS).changes > 0
}
