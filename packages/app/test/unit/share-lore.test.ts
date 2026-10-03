import { describe, it, expect } from 'vitest'
import { getTestDb } from '../utils/test-db'
import { loreShareKind } from '../../server/utils/share/kinds/lore'

// What players get when the DM shares lore
describe('lore share content', () => {
  it('shares type in all languages and the date as entered', () => {
    const db = getTestDb()
    const campaignId = Number(db.prepare('INSERT INTO campaigns (name) VALUES (?)').run('Lore').lastInsertRowid)
    const typeId = (db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Lore') as { id: number }).id
    const loreId = Number(db.prepare('INSERT INTO entities (type_id, name, description, metadata, campaign_id) VALUES (?, ?, ?, ?, ?)')
      .run(typeId, 'Brief des Königs', 'Kommt **sofort**.', JSON.stringify({ type: 'letter', date: '12. Frostmond 1247' }), campaignId).lastInsertRowid)

    const built = loreShareKind.build(db, loreId, ['type', 'date', 'description'], { tableId: 0 })!
    const byKey = Object.fromEntries(built.fields.map(f => [f.key, f]))
    expect((byKey.type as { value: unknown }).value).toMatchObject({ de: 'Brief', en: 'Letter' })
    expect((byKey.date as { value: unknown }).value).toBe('12. Frostmond 1247')
    expect(byKey.description!.format).toBe('markdown')
    expect(loreShareKind.fields).toEqual(['image', 'description', 'type', 'date'])
  })
})
