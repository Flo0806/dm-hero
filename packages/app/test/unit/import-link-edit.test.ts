import { describe, it, expect, beforeEach } from 'vitest'
import type Database from 'better-sqlite3'
import { getTestDb } from '../utils/test-db'
import { parseExistingId, mergeMetadata } from '../../server/utils/importRefs'

/**
 * Covers the AI import/update additions:
 *  - parseExistingId / mergeMetadata (the real pure helpers)
 *  - linking new entities to EXISTING ones via "existing:<id>" (bulk commit)
 *  - editing existing entities (update commit: metadata merge, tags replace, folder)
 *  - the search query backing GET /api/import/entities
 *
 * Pure helpers are imported directly; the DB-bound logic mirrors the endpoints'
 * SQL against the real migrated schema. Live behaviour is verified via the MCP.
 */

function insertEntity(db: Database.Database, campaignId: number, type: string, name: string, metadata?: Record<string, unknown>, folder?: string) {
  const typeId = (db.prepare('SELECT id FROM entity_types WHERE name = ?').get(type) as { id: number }).id
  let folderId: number | null = null
  if (folder) {
    folderId = Number(db.prepare('INSERT INTO entity_folders (campaign_id, entity_type, name) VALUES (?, ?, ?)')
      .run(campaignId, type.toLowerCase(), folder).lastInsertRowid)
  }
  return Number(db.prepare('INSERT INTO entities (type_id, campaign_id, name, metadata, folder_id) VALUES (?, ?, ?, ?, ?)')
    .run(typeId, campaignId, name, metadata ? JSON.stringify(metadata) : null, folderId).lastInsertRowid)
}

describe('parseExistingId', () => {
  it('parses "existing:<id>" to a number', () => {
    expect(parseExistingId('existing:123')).toBe(123)
  })
  it('returns null for payload refs and junk', () => {
    expect(parseExistingId('npc:1')).toBeNull()
    expect(parseExistingId('existing:')).toBeNull()
    expect(parseExistingId('existing:12x')).toBeNull()
    expect(parseExistingId(undefined)).toBeNull()
  })
})

describe('mergeMetadata', () => {
  it('overwrites provided keys, keeps the rest', () => {
    expect(mergeMetadata({ race: 'human', class: 'wizard' }, { class: 'cleric' }))
      .toEqual({ race: 'human', class: 'cleric' })
  })
  it('removes a key when the patch sets it to null', () => {
    expect(mergeMetadata({ race: 'human', age: 40 }, { age: null }))
      .toEqual({ race: 'human' })
  })
  it('adds new keys', () => {
    expect(mergeMetadata({ race: 'human' }, { gender: 'female' }))
      .toEqual({ race: 'human', gender: 'female' })
  })
})

describe('import: link to existing entities', () => {
  let db: Database.Database
  let campaignId: number

  beforeEach(() => {
    db = getTestDb()
    campaignId = Number(db.prepare('INSERT INTO campaigns (name) VALUES (?)').run('Link').lastInsertRowid)
  })

  it('resolves a relation end of "existing:<id>" to that id', () => {
    const town = insertEntity(db, campaignId, 'Location', 'Eichwald')

    // New NPC linked to the existing Location.
    const insRel = db.prepare('INSERT OR IGNORE INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)')
    const refToId = new Map<string, number>([['npc:1', insertEntity(db, campaignId, 'NPC', 'Hane')]])

    const r = { from: 'npc:1', to: `existing:${town}`, type: 'livesIn' }
    const fromId = parseExistingId(r.from) ?? refToId.get(r.from)
    const toId = parseExistingId(r.to) ?? refToId.get(r.to)
    insRel.run(fromId, toId, r.type)

    const rel = db.prepare('SELECT from_entity_id, to_entity_id, relation_type FROM entity_relations').get() as { from_entity_id: number, to_entity_id: number, relation_type: string }
    expect(rel.from_entity_id).toBe(refToId.get('npc:1'))
    expect(rel.to_entity_id).toBe(town)
    expect(rel.relation_type).toBe('livesIn')
  })

  it('only counts existing ids that belong to the campaign', () => {
    const other = Number(db.prepare('INSERT INTO campaigns (name) VALUES (?)').run('Other').lastInsertRowid)
    const foreign = insertEntity(db, other, 'NPC', 'Stranger')
    const mine = insertEntity(db, campaignId, 'NPC', 'Local')

    const found = db.prepare('SELECT id FROM entities WHERE id IN (?, ?) AND campaign_id = ? AND deleted_at IS NULL')
      .all(foreign, mine, campaignId) as { id: number }[]
    const ids = new Set(found.map(r => r.id))
    expect(ids.has(mine)).toBe(true)
    expect(ids.has(foreign)).toBe(false) // would be a validation error
  })
})

describe('update: edit existing entities', () => {
  let db: Database.Database
  let campaignId: number

  beforeEach(() => {
    db = getTestDb()
    campaignId = Number(db.prepare('INSERT INTO campaigns (name) VALUES (?)').run('Edit').lastInsertRowid)
  })

  it('merges metadata (null removes) and updates name/description', () => {
    const id = insertEntity(db, campaignId, 'NPC', 'Old Name', { race: 'human', class: 'wizard', age: 40 })

    const existing = JSON.parse((db.prepare('SELECT metadata FROM entities WHERE id = ?').get(id) as { metadata: string }).metadata)
    const merged = mergeMetadata(existing, { class: 'cleric', age: null })
    db.prepare('UPDATE entities SET name = ?, description = ?, metadata = ? WHERE id = ?')
      .run('New Name', 'A wise cleric', JSON.stringify(merged), id)

    const row = db.prepare('SELECT name, description, metadata FROM entities WHERE id = ?').get(id) as { name: string, description: string, metadata: string }
    expect(row.name).toBe('New Name')
    expect(row.description).toBe('A wise cleric')
    expect(JSON.parse(row.metadata)).toEqual({ race: 'human', class: 'cleric' })
  })

  it('replaces the tag set', () => {
    const id = insertEntity(db, campaignId, 'NPC', 'Tagged')
    const tagA = Number(db.prepare('INSERT INTO tags (name, color) VALUES (?, ?)').run('old', '#fff').lastInsertRowid)
    db.prepare('INSERT INTO entity_tags (entity_id, tag_id) VALUES (?, ?)').run(id, tagA)

    // Replace: clear, then attach "new".
    db.prepare('DELETE FROM entity_tags WHERE entity_id = ?').run(id)
    const tagB = Number(db.prepare('INSERT INTO tags (name, color) VALUES (?, ?)').run('new', '#000').lastInsertRowid)
    db.prepare('INSERT OR IGNORE INTO entity_tags (entity_id, tag_id) VALUES (?, ?)').run(id, tagB)

    const names = (db.prepare('SELECT t.name FROM entity_tags et JOIN tags t ON t.id = et.tag_id WHERE et.entity_id = ?').all(id) as { name: string }[]).map(r => r.name)
    expect(names).toEqual(['new'])
  })
})

describe('search: GET /api/import/entities query', () => {
  let db: Database.Database
  let campaignId: number

  beforeEach(() => {
    db = getTestDb()
    campaignId = Number(db.prepare('INSERT INTO campaigns (name) VALUES (?)').run('Search').lastInsertRowid)
    insertEntity(db, campaignId, 'Location', 'Eichwald')
    insertEntity(db, campaignId, 'Location', 'Eichweiler')
    insertEntity(db, campaignId, 'NPC', 'Eberhart')
  })

  const search = (where: string[], params: unknown[]) =>
    db.prepare(`
      SELECT e.id, t.name AS type, e.name
      FROM entities e JOIN entity_types t ON t.id = e.type_id
      WHERE ${['e.campaign_id = ?', 'e.deleted_at IS NULL', ...where].join(' AND ')}
      ORDER BY e.name COLLATE NOCASE
    `).all(campaignId, ...params) as { id: number, type: string, name: string }[]

  it('substring-matches by name (case-insensitive)', () => {
    const rows = search(['e.name LIKE ?'], ['%eich%'])
    expect(rows.map(r => r.name)).toEqual(['Eichwald', 'Eichweiler'])
  })

  it('filters by type', () => {
    const rows = search(['t.name = ?'], ['NPC'])
    expect(rows.map(r => r.name)).toEqual(['Eberhart'])
  })
})
