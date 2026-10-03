import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type Database from 'better-sqlite3'
import { getTestDb } from '../utils/test-db'

// Runs the REAL handlers (NPC search + chaos graph connections) against an
// in-memory DB to verify that NPCs placed at a location are found by the
// location name, regardless of how they were linked.

let db: Database.Database

vi.mock('../../server/utils/db', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../server/utils/db')>()
  return { ...original, getDb: () => db }
})

const STUBBED_KEYS = ['defineEventHandler', 'getQuery', 'getRouterParam', 'createError'] as const
const originalGlobals = new Map<string, { had: boolean, value: unknown }>()
let currentQuery: Record<string, string> = {}
let currentParam: string | undefined

let campaignId: number
let cityId: number
const ids: Record<string, number> = {}

type Handler = (event: unknown) => unknown
const fakeEvent = { node: { req: { headers: {} } } }

function insertEntity(typeName: string, name: string, extra: { description?: string, locationId?: number, campaign?: number } = {}): number {
  const typeId = (db.prepare('SELECT id FROM entity_types WHERE name = ?').get(typeName) as { id: number }).id
  return Number(
    db.prepare('INSERT INTO entities (type_id, name, description, campaign_id, location_id) VALUES (?, ?, ?, ?, ?)')
      .run(typeId, name, extra.description ?? null, extra.campaign ?? campaignId, extra.locationId ?? null).lastInsertRowid,
  )
}

function link(fromId: number, toId: number) {
  db.prepare('INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)')
    .run(fromId, toId, 'lives_in')
}

async function searchNpcs(search: string): Promise<string[]> {
  currentQuery = { campaignId: String(campaignId), search }
  const handler = (await import('../../server/api/npcs/index.get.ts')).default as unknown as Handler
  const result = await handler(fakeEvent) as Array<{ name: string }>
  return result.map(n => n.name).sort()
}

beforeAll(() => {
  db = getTestDb()

  const g = globalThis as Record<string, unknown>
  for (const key of STUBBED_KEYS) originalGlobals.set(key, { had: Object.hasOwn(g, key), value: g[key] })
  g.defineEventHandler = (handler: unknown) => handler
  g.getQuery = () => currentQuery
  g.getRouterParam = () => currentParam
  g.createError = (opts: { message?: string }) => new Error(opts?.message ?? 'error')

  campaignId = Number(db.prepare('INSERT INTO campaigns (name) VALUES (?)').run('Location Search').lastInsertRowid)
  cityId = insertEntity('Location', 'Düsseldorf')
  const cologneId = insertEntity('Location', 'Köln')
  const harborId = insertEntity('Location', 'Hafenviertel')

  ids.viaLocationId = insertEntity('NPC', 'Anna Standort', { locationId: cityId })
  ids.viaOutgoing = insertEntity('NPC', 'Bernd Ausgehend')
  link(ids.viaOutgoing, cityId)
  ids.viaIncoming = insertEntity('NPC', 'Clara Eingehend')
  link(cityId, ids.viaIncoming)
  // Mentions the city in its text -> FTS5 hit that used to hide the others
  insertEntity('NPC', 'Dieter Text', { description: 'Reist oft nach Düsseldorf' })
  insertEntity('NPC', 'Erik Unbeteiligt')
  // Linked to two locations -> GROUP_CONCAT yields "Köln,Hafenviertel"
  ids.twoLocations = insertEntity('NPC', 'Fritz Zweiorte')
  link(ids.twoLocations, cologneId)
  link(ids.twoLocations, harborId)

  // Location of another campaign must not count as linked location
  const otherCampaignId = Number(db.prepare('INSERT INTO campaigns (name) VALUES (?)').run('Other').lastInsertRowid)
  const foreignCity = insertEntity('Location', 'Leuchtturm', { campaign: otherCampaignId })
  insertEntity('NPC', 'Gustav Fremdort', { locationId: foreignCity })
})

afterAll(() => {
  const g = globalThis as Record<string, unknown>
  for (const [key, snapshot] of originalGlobals) {
    if (snapshot.had) g[key] = snapshot.value
    else Reflect.deleteProperty(g, key)
  }
  db.close()
})

describe('NPC search by location name', () => {
  it('finds NPCs via current location, both relation directions and text mention', async () => {
    expect(await searchNpcs('Düsseldorf')).toEqual(['Anna Standort', 'Bernd Ausgehend', 'Clara Eingehend', 'Dieter Text'])
  })

  it('finds them with a typo in the location name', async () => {
    expect(await searchNpcs('Dusseldorf')).toEqual(['Anna Standort', 'Bernd Ausgehend', 'Clara Eingehend', 'Dieter Text'])
  })

  it('finds linked NPCs with a real typo in the location name', async () => {
    // Dieter only mentions the city in his description, which has no typo tolerance
    expect(await searchNpcs('Düseldorf')).toEqual(['Anna Standort', 'Bernd Ausgehend', 'Clara Eingehend'])
  })

  it('finds an NPC linked to two locations by either location, also with typo', async () => {
    expect(await searchNpcs('Köln')).toEqual(['Fritz Zweiorte'])
    expect(await searchNpcs('Hafenvirtel')).toEqual(['Fritz Zweiorte'])
  })

  it('ignores locations of other campaigns', async () => {
    expect(await searchNpcs('Leuchtturm')).toEqual([])
  })

  it('still finds NPCs by name', async () => {
    expect(await searchNpcs('Erik')).toEqual(['Erik Unbeteiligt'])
  })
})

describe('chaos graph connections with current location', () => {
  async function connectionsOf(id: number) {
    currentParam = String(id)
    const handler = (await import('../../server/api/entities/[id]/connections.get.ts')).default as unknown as Handler
    const result = await handler(fakeEvent) as { connections: Array<{ entityName: string, relationType: string }> }
    return result.connections
  }

  it('shows entities located at a location as residents', async () => {
    const residents = (await connectionsOf(cityId)).filter(c => c.relationType === 'locatedHere')
    expect(residents.map(c => c.entityName)).toEqual(['Anna Standort'])
  })

  it('does not show residents from another campaign', async () => {
    const otherCampaignId = Number(db.prepare('INSERT INTO campaigns (name) VALUES (?)').run('Other 2').lastInsertRowid)
    insertEntity('NPC', 'Hans Andere Kampagne', { campaign: otherCampaignId, locationId: cityId })
    const residents = (await connectionsOf(cityId)).filter(c => c.relationType === 'locatedHere')
    expect(residents.map(c => c.entityName)).toEqual(['Anna Standort'])
  })

  it('shows the current location on the entity itself', async () => {
    const located = (await connectionsOf(ids.viaLocationId!)).filter(c => c.relationType === 'locatedAt')
    expect(located.map(c => c.entityName)).toEqual(['Düsseldorf'])
  })
})
