import { describe, it, expect } from 'vitest'
import { getTestDb } from '../utils/test-db'
import { factionShareKind } from '../../server/utils/share/kinds/faction'

// What players get when the DM shares a faction
describe('faction share content', () => {
  it('shares type + alignment in all languages, goals only if ticked, never notes', () => {
    const db = getTestDb()
    const campaignId = Number(db.prepare('INSERT INTO campaigns (name) VALUES (?)').run('Fac').lastInsertRowid)
    const typeId = (name: string) => (db.prepare('SELECT id FROM entity_types WHERE name = ?').get(name) as { id: number }).id
    const hqId = Number(db.prepare('INSERT INTO entities (type_id, name, campaign_id) VALUES (?, ?, ?)').run(typeId('Location'), 'Unterstadt', campaignId).lastInsertRowid)
    const meta = { type: 'guild', alignment: 'lawfulGood', headquarters: 'Alte Mühle', goals: 'Den König stürzen', notes: 'Spitzel im Rat' }
    const id = Number(db.prepare('INSERT INTO entities (type_id, name, metadata, location_id, campaign_id) VALUES (?, ?, ?, ?, ?)')
      .run(typeId('Faction'), 'Schattengilde', JSON.stringify(meta), hqId, campaignId).lastInsertRowid)

    const without = factionShareKind.build(db, id, ['type', 'alignment', 'location', 'notes'], { tableId: 0 })!
    const byKey = Object.fromEntries(without.fields.map(f => [f.key, f])) as Record<string, { value: unknown, label: unknown }>
    expect(byKey.type!.value).toMatchObject({ de: 'Gilde', en: 'Guild' })
    expect(byKey.alignment!.value).toMatchObject({ en: 'Lawful Good' })
    expect(byKey.location!.label).toMatchObject({ de: 'Aktueller Standort' })
    expect(byKey.location!.value).toBe('Unterstadt')
    expect(JSON.stringify(without)).not.toContain('König')
    expect(JSON.stringify(without)).not.toContain('Spitzel')

    const withGoals = factionShareKind.build(db, id, ['goals'], { tableId: 0 })!
    expect(withGoals.fields[0]).toMatchObject({ key: 'goals', value: 'Den König stürzen' })
  })
})
