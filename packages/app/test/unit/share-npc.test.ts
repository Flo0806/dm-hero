import { describe, it, expect, beforeEach } from 'vitest'
import type Database from 'better-sqlite3'
import { getTestDb } from '../utils/test-db'
import { npcShareKind } from '../../server/utils/share/kinds/npc'

// What players get when the DM shares an NPC
let db: Database.Database
let npcId: number

const field = (fields: Array<{ key: string }>, key: string) => fields.find(f => f.key === key) as Record<string, unknown> | undefined

beforeEach(() => {
  db = getTestDb()
  const campaignId = Number(db.prepare('INSERT INTO campaigns (name) VALUES (?)').run('NPC Share').lastInsertRowid)
  const typeId = (name: string) => (db.prepare('SELECT id FROM entity_types WHERE name = ?').get(name) as { id: number }).id
  const metadata = { race: 'elf', class: ['wizard', 'Runenschmied'], status: 'alive', relationship: 'Schuldet der Gruppe Geld', age: 312 }
  npcId = Number(db.prepare('INSERT INTO entities (type_id, name, description, metadata, campaign_id) VALUES (?, ?, ?, ?, ?)')
    .run(typeId('NPC'), 'Elrond', 'Herr von Bruchtal', JSON.stringify(metadata), campaignId).lastInsertRowid)
  const factionId = Number(db.prepare('INSERT INTO entities (type_id, name, campaign_id) VALUES (?, ?, ?)').run(typeId('Faction'), 'Weißer Rat', campaignId).lastInsertRowid)
  db.prepare('INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)').run(factionId, npcId, 'member')
})

describe('NPC share content', () => {
  it('translates standard values into every language and keeps the DM\'s own words', () => {
    const built = npcShareKind.build(db, npcId, ['race', 'class', 'status', 'description'], { tableId: 0 })!
    expect(built.title).toBe('Elrond')
    expect(field(built.fields, 'race')!.value).toMatchObject({ de: 'Elf', en: 'Elf' })
    expect(field(built.fields, 'status')!.label).toMatchObject({ de: 'Status', en: 'Status' })
    // Standard class translated, the DM's custom class stays as written
    expect((field(built.fields, 'class')!.value as Record<string, string>).en).toBe('Wizard, Runenschmied')
    expect(field(built.fields, 'description')!.value).toBe('Herr von Bruchtal')
  })

  it('never shares private fields, even if asked for', () => {
    const built = npcShareKind.build(db, npcId, ['relationship', 'age'], { tableId: 0 })!
    expect(built.fields.map(f => f.key)).toEqual(['age'])
    expect(JSON.stringify(built)).not.toContain('Schuldet')
  })

  it('includes factions linked in either direction', () => {
    const built = npcShareKind.build(db, npcId, ['faction'], { tableId: 0 })!
    expect(field(built.fields, 'faction')!.value).toBe('Weißer Rat')
  })

  it('returns null for a deleted NPC (share gets withdrawn)', () => {
    db.prepare('UPDATE entities SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(npcId)
    expect(npcShareKind.build(db, npcId, ['description'], { tableId: 0 })).toBeNull()
  })

  it('turns entity links into plain names (deleted links vanish)', () => {
    const typeId = (db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Location') as { id: number }).id
    const campaignId = (db.prepare('SELECT campaign_id FROM entities WHERE id = ?').get(npcId) as { campaign_id: number }).campaign_id
    const cityId = Number(db.prepare('INSERT INTO entities (type_id, name, campaign_id) VALUES (?, ?, ?)').run(typeId, 'Bruchtal', campaignId).lastInsertRowid)
    db.prepare('UPDATE entities SET description = ? WHERE id = ?')
      .run(`Lebt in {{location:${cityId}}}, kennt [Gandalf](npc:999) und {{npc:999999}}.`, npcId)

    const built = npcShareKind.build(db, npcId, ['description'], { tableId: 0 })!
    expect(field(built.fields, 'description')!.value).toBe('Lebt in Bruchtal, kennt Gandalf und .')
  })
})
