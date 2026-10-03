import { describe, it, expect, beforeEach } from 'vitest'
import type Database from 'better-sqlite3'
import { getTestDb } from '../utils/test-db'

// Migration 55: game_tables + game_table_players
let db: Database.Database
let campaignId: number

function createTable(code = 'K7RX2M') {
  return Number(db.prepare('INSERT INTO game_tables (campaign_id, code) VALUES (?, ?)').run(campaignId, code).lastInsertRowid)
}

function addPlayer(tableId: number, name: string, pin: string, entityId: number | null = null) {
  return db.prepare('INSERT INTO game_table_players (game_table_id, name, pin, player_entity_id) VALUES (?, ?, ?, ?)')
    .run(tableId, name, pin, entityId)
}

beforeEach(() => {
  db = getTestDb()
  campaignId = Number(db.prepare('INSERT INTO campaigns (name) VALUES (?)').run('Table Test').lastInsertRowid)
})

describe('game_tables migration', () => {
  it('allows only one game per campaign', () => {
    createTable('AAAAAA')
    expect(() => createTable('BBBBBB')).toThrow(/UNIQUE/)
  })

  it('keeps game codes unique across campaigns', () => {
    createTable('SAME01')
    const other = Number(db.prepare('INSERT INTO campaigns (name) VALUES (?)').run('Other').lastInsertRowid)
    expect(() => db.prepare('INSERT INTO game_tables (campaign_id, code) VALUES (?, ?)').run(other, 'SAME01')).toThrow(/UNIQUE/)
  })

  it('keeps PINs unique per game', () => {
    const tableId = createTable()
    addPlayer(tableId, 'Anna', '123456')
    expect(() => addPlayer(tableId, 'Bernd', '123456')).toThrow(/UNIQUE/)
  })

  it('closing a game removes its players', () => {
    const tableId = createTable()
    addPlayer(tableId, 'Anna', '123456')
    addPlayer(tableId, 'Bernd', '654321')
    db.prepare('DELETE FROM game_tables WHERE id = ?').run(tableId)
    expect(db.prepare('SELECT COUNT(*) AS n FROM game_table_players').get()).toEqual({ n: 0 })
  })

  it('unlinks a player when the linked Player entity is removed', () => {
    const typeId = (db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Player') as { id: number }).id
    const entityId = Number(db.prepare('INSERT INTO entities (type_id, name, campaign_id) VALUES (?, ?, ?)').run(typeId, 'Anna Entity', campaignId).lastInsertRowid)
    const tableId = createTable()
    addPlayer(tableId, 'Anna', '123456', entityId)

    db.prepare('DELETE FROM entities WHERE id = ?').run(entityId)
    expect(db.prepare('SELECT name, player_entity_id FROM game_table_players').get()).toEqual({ name: 'Anna', player_entity_id: null })
  })

  it('approved devices go away with their player', () => {
    const tableId = createTable()
    const playerId = Number(addPlayer(tableId, 'Anna', '123456').lastInsertRowid)
    db.prepare('INSERT INTO game_table_devices (game_table_id, player_id, public_key) VALUES (?, ?, ?)').run(tableId, playerId, 'pk-1')
    expect(() => db.prepare('INSERT INTO game_table_devices (game_table_id, player_id, public_key) VALUES (?, ?, ?)').run(tableId, playerId, 'pk-1')).toThrow(/UNIQUE/)

    db.prepare('DELETE FROM game_table_players WHERE id = ?').run(playerId)
    expect(db.prepare('SELECT COUNT(*) AS n FROM game_table_devices').get()).toEqual({ n: 0 })
  })
})
