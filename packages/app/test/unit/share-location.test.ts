import { describe, it, expect, beforeEach } from 'vitest'
import type Database from 'better-sqlite3'
import { getTestDb } from '../utils/test-db'
import { locationShareKind } from '../../server/utils/share/kinds/location'

// What players get when the DM shares a location
let db: Database.Database
let tavernId: number

const field = (fields: Array<{ key: string }>, key: string) => fields.find(f => f.key === key) as Record<string, unknown> | undefined

beforeEach(() => {
  db = getTestDb()
  const campaignId = Number(db.prepare('INSERT INTO campaigns (name) VALUES (?)').run('Loc Share').lastInsertRowid)
  const typeId = (db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Location') as { id: number }).id
  const cityId = Number(db.prepare('INSERT INTO entities (type_id, name, campaign_id) VALUES (?, ?, ?)').run(typeId, 'Silbermond', campaignId).lastInsertRowid)
  tavernId = Number(db.prepare('INSERT INTO entities (type_id, name, description, metadata, parent_entity_id, campaign_id) VALUES (?, ?, ?, ?, ?, ?)')
    .run(typeId, 'Zum tänzelnden Pony', 'Gemütlich.', JSON.stringify({ type: 'tavern', region: 'Breeland', notes: 'Der Wirt ist ein Spion' }), cityId, campaignId).lastInsertRowid)
})

describe('location share content', () => {
  it('shares type (all languages), region and where it lies', () => {
    const built = locationShareKind.build(db, tavernId, ['type', 'region', 'parent', 'description'], { tableId: 0 })!
    expect(built.title).toBe('Zum tänzelnden Pony')
    expect(field(built.fields, 'type')!.value).toMatchObject({ de: 'Taverne', en: 'Tavern' })
    expect(field(built.fields, 'region')!.value).toBe('Breeland')
    expect(field(built.fields, 'parent')!.value).toBe('Silbermond')
    expect(field(built.fields, 'parent')!.label).toMatchObject({ de: 'Liegt in', en: 'Lies in' })
  })

  it('never shares notes', () => {
    const built = locationShareKind.build(db, tavernId, ['notes', 'region'], { tableId: 0 })!
    expect(built.fields.map(f => f.key)).toEqual(['region'])
    expect(JSON.stringify(built)).not.toContain('Spion')
  })
})
