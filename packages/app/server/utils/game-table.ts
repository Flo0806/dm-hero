import { randomInt } from 'node:crypto'
import type Database from 'better-sqlite3'
import { GAME_PIN_LENGTH, type GameTable, type GameTablePlayer } from '~~/types/game-table'

/** 6-digit PIN that is not yet used at this table */
export function generateUniquePin(db: Database.Database, tableId: number): string {
  const taken = new Set(
    (db.prepare('SELECT pin FROM game_table_players WHERE game_table_id = ?').all(tableId) as Array<{ pin: string }>)
      .map(r => r.pin),
  )
  let pin: string
  do {
    pin = String(randomInt(10 ** GAME_PIN_LENGTH)).padStart(GAME_PIN_LENGTH, '0')
  } while (taken.has(pin))
  return pin
}

export function getTablePlayers(db: Database.Database, tableId: number): GameTablePlayer[] {
  return db.prepare(`
    SELECT p.id, p.game_table_id, p.name, p.pin, p.player_entity_id, p.created_at,
      e.name AS player_entity_name, e.image_url AS player_entity_image_url
    FROM game_table_players p
    LEFT JOIN entities e ON e.id = p.player_entity_id AND e.deleted_at IS NULL
    WHERE p.game_table_id = ?
    ORDER BY p.created_at, p.id
  `).all(tableId) as GameTablePlayer[]
}

export function getGameTableByCampaign(db: Database.Database, campaignId: number): GameTable | null {
  const table = db.prepare('SELECT id, campaign_id, code, created_at FROM game_tables WHERE campaign_id = ?')
    .get(campaignId) as Omit<GameTable, 'players'> | undefined
  return table ? { ...table, players: getTablePlayers(db, table.id) } : null
}

export function getGameTableById(db: Database.Database, tableId: number): GameTable | null {
  const table = db.prepare('SELECT id, campaign_id, code, created_at FROM game_tables WHERE id = ?')
    .get(tableId) as Omit<GameTable, 'players'> | undefined
  return table ? { ...table, players: getTablePlayers(db, table.id) } : null
}

/** A linked entity must be a (not deleted) Player of the table's campaign */
export function assertPlayerEntity(db: Database.Database, tableId: number, entityId: number | null | undefined) {
  if (entityId == null) return
  const ok = db.prepare(`
    SELECT 1 FROM entities e
    JOIN entity_types t ON t.id = e.type_id AND t.name = 'Player'
    JOIN game_tables g ON g.campaign_id = e.campaign_id AND g.id = ?
    WHERE e.id = ? AND e.deleted_at IS NULL
  `).get(tableId, entityId)
  if (!ok) throw createError({ statusCode: 400, message: 'Linked entity must be a Player of this campaign' })
}

export function requireNumericParam(value: string | undefined, name: string): number {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) throw createError({ statusCode: 400, message: `Invalid ${name}` })
  return id
}
