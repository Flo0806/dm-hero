import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

// Built-in node:sqlite - no native module to rebuild or break.
// Stores only what the relay needs: games, players (PIN hashes) and sessions.
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    dm_token_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS players (
    game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    id TEXT NOT NULL,
    name TEXT NOT NULL,
    pin_hash TEXT NOT NULL,
    PRIMARY KEY (game_id, id)
  );
  CREATE TABLE IF NOT EXISTS player_sessions (
    token_hash TEXT PRIMARY KEY,
    game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    player_id TEXT NOT NULL,
    created_at INTEGER NOT NULL
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
  return db
}

export interface GameRow {
  id: string
  code: string
  dm_token_hash: string
}

export function findGame(id: string): GameRow | undefined {
  return useRelayDb().prepare('SELECT id, code, dm_token_hash FROM games WHERE id = ?').get(id) as GameRow | undefined
}
