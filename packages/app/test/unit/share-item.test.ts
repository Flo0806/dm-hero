import { describe, it, expect, beforeEach } from 'vitest'
import type Database from 'better-sqlite3'
import { getTestDb } from '../utils/test-db'
import { itemShareKind } from '../../server/utils/share/kinds/item'

// What players get when the DM shares an item
let db: Database.Database
let itemId: number

const field = (fields: Array<{ key: string }>, key: string) => fields.find(f => f.key === key) as Record<string, unknown> | undefined

beforeEach(() => {
  db = getTestDb()
  const campaignId = Number(db.prepare('INSERT INTO campaigns (name) VALUES (?)').run('Item Share').lastInsertRowid)
  const currencyId = Number(db.prepare('INSERT INTO currencies (campaign_id, code, name, symbol) VALUES (?, ?, ?, ?)').run(campaignId, 'GP', 'gold', 'GP').lastInsertRowid)
  const typeId = (db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Item') as { id: number }).id
  const metadata = { rarity: 'rare', value: 250, currency_id: currencyId, attunement: true, armor_class: 2, notes: 'Verflucht!' }
  itemId = Number(db.prepare('INSERT INTO entities (type_id, name, metadata, campaign_id) VALUES (?, ?, ?, ?)')
    .run(typeId, 'Amulett', JSON.stringify(metadata), campaignId).lastInsertRowid)
})

describe('item share content', () => {
  it('shares rarity in all languages and value with currency', () => {
    const built = itemShareKind.build(db, itemId, ['rarity', 'value'], { tableId: 0 })!
    expect(field(built.fields, 'rarity')!.value).toMatchObject({ de: 'Selten', en: 'Rare' })
    expect(field(built.fields, 'value')!.value).toBe('250 GP')
  })

  it('only offers fields DM Hero can edit (legacy fields are never shared)', () => {
    expect(itemShareKind.fields).toEqual(['image', 'description', 'type', 'rarity', 'value', 'weight'])
    const built = itemShareKind.build(db, itemId, ['attunement', 'armor_class', 'rarity'], { tableId: 0 })!
    expect(built.fields.map(f => f.key)).toEqual(['rarity'])
  })

  it('holds the value back if not ticked, and never shares notes', () => {
    const built = itemShareKind.build(db, itemId, ['rarity', 'notes', 'currency_id'], { tableId: 0 })!
    expect(built.fields.map(f => f.key)).toEqual(['rarity'])
    expect(JSON.stringify(built)).not.toContain('Verflucht')
    expect(JSON.stringify(built)).not.toContain('250')
  })
})
