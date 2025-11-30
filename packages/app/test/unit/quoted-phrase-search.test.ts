import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getDb } from '../../server/utils/db'
import { normalizeText } from '../../server/utils/normalize'
import { parseSearchQuery } from '../../server/utils/search-query-parser'
import type Database from 'better-sqlite3'

/**
 * CRITICAL: Quoted Phrase Search Tests
 *
 * These tests ensure that quoted phrases ("exact match") work correctly across ALL entity types.
 * Quoted phrases should:
 * 1. Match EXACTLY (no fuzzy/Levenshtein matching)
 * 2. Still work with Unicode normalization (é → e, ü → u)
 * 3. Work in combination with AND/OR operators
 * 4. Support cross-entity search (find Locations via NPC names, NPCs via Lore names, etc.)
 *
 * REGRESSION PREVENTION:
 * - Before the fix, "Bernhard von Berg" found ALL NPCs with "von" or "Berg" (fuzzy matches)
 * - After the fix, "Bernhard von Berg" finds ONLY exact matches
 */

let db: Database.Database
let testCampaignId: number
let npcTypeId: number
let itemTypeId: number
let locationTypeId: number
let factionTypeId: number
let _loreTypeId: number

beforeAll(() => {
  db = getDb()

  // Get entity type IDs
  npcTypeId = (
    db.prepare('SELECT id FROM entity_types WHERE name = ?').get('NPC') as { id: number }
  ).id
  itemTypeId = (
    db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Item') as { id: number }
  ).id
  locationTypeId = (
    db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Location') as { id: number }
  ).id
  factionTypeId = (
    db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Faction') as { id: number }
  ).id
  _loreTypeId = (
    db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Lore') as { id: number }
  ).id

  // Create test campaign
  const campaign = db
    .prepare('INSERT INTO campaigns (name, description) VALUES (?, ?)')
    .run('Quoted Phrase Test Campaign', 'Testing exact search')
  testCampaignId = Number(campaign.lastInsertRowid)
})

afterAll(() => {
  // Clean up test data
  if (db) {
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(testCampaignId)
    db.prepare('DELETE FROM entities WHERE campaign_id = ?').run(testCampaignId)
  }
})

beforeEach(() => {
  // Clean up entities before each test
  db.prepare('DELETE FROM entities WHERE campaign_id = ?').run(testCampaignId)
  db.prepare(
    'DELETE FROM entity_relations WHERE from_entity_id IN (SELECT id FROM entities WHERE campaign_id = ?)',
  ).run(testCampaignId)
})

describe('Quoted Phrase Search - Parser Tests', () => {
  it('should parse quoted phrase as single term with preserved quotes in FTS5 query', () => {
    const parsed = parseSearchQuery('"Bernhard von Berg"')

    expect(parsed.hasOperators).toBe(true)
    expect(parsed.fts5Query).toBe('"Bernhard von Berg"')
    // IMPORTANT: terms should be split for cross-entity search
    expect(parsed.terms).toEqual(['Bernhard', 'von', 'Berg'])
  })

  it('should handle normalized quoted phrases (accents removed)', () => {
    const searchTerm = normalizeText('André Müller')
    const parsed = parseSearchQuery(`"${searchTerm}"`)

    expect(parsed.fts5Query).toBe('"andre muller"')
    expect(parsed.terms).toEqual(['andre', 'muller'])
  })

  it('should parse quoted phrase with AND operator', () => {
    const parsed = parseSearchQuery('"Bernhard von Berg" AND human')

    expect(parsed.hasOperators).toBe(true)
    expect(parsed.terms).toEqual(['Bernhard von Berg', 'human'])
    expect(parsed.fts5Query).toContain('"Bernhard von Berg"')
    expect(parsed.fts5Query).toContain('AND')
    expect(parsed.fts5Query).toContain('human*')
  })

  it('should NOT add wildcard to quoted phrases', () => {
    const parsed = parseSearchQuery('"Exact Match"')

    // Quoted phrase should NOT have wildcard
    expect(parsed.fts5Query).toBe('"Exact Match"')
    expect(parsed.fts5Query).not.toContain('*')
  })
})

describe('Quoted Phrase Search - NPCs', () => {
  it('should find NPCs with exact name match ONLY', () => {
    // Create NPCs with similar names
    db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)').run(
      npcTypeId,
      testCampaignId,
      'Bernhard von Berg',
    )
    db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)').run(
      npcTypeId,
      testCampaignId,
      'Bernhard',
    )
    db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)').run(
      npcTypeId,
      testCampaignId,
      'von Berg',
    )
    db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)').run(
      npcTypeId,
      testCampaignId,
      'Bernhard vom Berg',
    )

    // FTS5 exact phrase search
    const npcs = db
      .prepare(
        `
      SELECT e.id, e.name
      FROM entities_fts fts
      INNER JOIN entities e ON fts.rowid = e.id
      WHERE entities_fts MATCH ?
        AND e.type_id = ?
        AND e.campaign_id = ?
        AND e.deleted_at IS NULL
    `,
      )
      .all('"Bernhard von Berg"', npcTypeId, testCampaignId) as Array<{ id: number; name: string }>

    // Should find ONLY the exact match
    expect(npcs).toHaveLength(1)
    expect(npcs[0].name).toBe('Bernhard von Berg')
  })

  it('should NOT find NPCs with partial matches in quoted phrase search', () => {
    // Create NPC
    db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)').run(
      npcTypeId,
      testCampaignId,
      'Bernhard',
    )

    // Search for multi-word phrase
    const npcs = db
      .prepare(
        `
      SELECT e.id, e.name
      FROM entities_fts fts
      INNER JOIN entities e ON fts.rowid = e.id
      WHERE entities_fts MATCH ?
        AND e.type_id = ?
        AND e.campaign_id = ?
        AND e.deleted_at IS NULL
    `,
      )
      .all('"Bernhard von Berg"', npcTypeId, testCampaignId)

    // Should find NOTHING (partial match not allowed)
    expect(npcs).toHaveLength(0)
  })

  it('should work with Unicode normalization (accents)', () => {
    // Create NPC with accented name
    db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)').run(
      npcTypeId,
      testCampaignId,
      'André Müller',
    )

    // Search with normalized text (without accents)
    const normalizedSearch = normalizeText('André Müller')
    const npcs = db
      .prepare(
        `
      SELECT e.id, e.name
      FROM entities_fts fts
      INNER JOIN entities e ON fts.rowid = e.id
      WHERE entities_fts MATCH ?
        AND e.type_id = ?
        AND e.campaign_id = ?
        AND e.deleted_at IS NULL
    `,
      )
      .all(`"${normalizedSearch}"`, npcTypeId, testCampaignId) as Array<{ id: number; name: string }>

    // Should find the NPC (é → e, ü → u)
    expect(npcs).toHaveLength(1)
    expect(npcs[0].name).toBe('André Müller')
  })
})

describe('Quoted Phrase Search - Items', () => {
  it('should find Items with exact name match ONLY', () => {
    // Create items with similar names
    db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)').run(
      itemTypeId,
      testCampaignId,
      'Antigifte Phiole',
    )
    db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)').run(
      itemTypeId,
      testCampaignId,
      'Phiole',
    )
    db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)').run(
      itemTypeId,
      testCampaignId,
      'Antigifte Trank',
    )

    // FTS5 exact phrase search
    const items = db
      .prepare(
        `
      SELECT e.id, e.name
      FROM entities_fts fts
      INNER JOIN entities e ON fts.rowid = e.id
      WHERE entities_fts MATCH ?
        AND e.type_id = ?
        AND e.campaign_id = ?
        AND e.deleted_at IS NULL
    `,
      )
      .all('"Antigifte Phiole"', itemTypeId, testCampaignId) as Array<{ id: number; name: string }>

    expect(items).toHaveLength(1)
    expect(items[0].name).toBe('Antigifte Phiole')
  })

  it('should find Items via owner NPC name (cross-entity search)', () => {
    // Create NPC
    const npc = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(npcTypeId, testCampaignId, 'Bernhard von Berg')
    const npcId = Number(npc.lastInsertRowid)

    // Create Items
    const item1 = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(itemTypeId, testCampaignId, 'Schwert')
    const item2 = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(itemTypeId, testCampaignId, 'Schild')
    const _item3 = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(itemTypeId, testCampaignId, 'Bogen')

    // Link items to NPC (NPC owns items)
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(npcId, item1.lastInsertRowid, 'besitzt')
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(npcId, item2.lastInsertRowid, 'besitzt')

    // Query items with owner names
    const items = db
      .prepare(
        `
      SELECT
        e.id,
        e.name,
        GROUP_CONCAT(DISTINCT owner_npc.name) as owner_names
      FROM entities e
      LEFT JOIN entity_relations owner_rel ON owner_rel.to_entity_id = e.id
      LEFT JOIN entities owner_npc ON owner_npc.id = owner_rel.from_entity_id
        AND owner_npc.deleted_at IS NULL
        AND owner_npc.type_id = ?
      WHERE e.type_id = ?
        AND e.campaign_id = ?
        AND e.deleted_at IS NULL
      GROUP BY e.id
    `,
      )
      .all(npcTypeId, itemTypeId, testCampaignId) as Array<{
      id: number
      name: string
      owner_names: string | null
    }>

    // Filter items with exact owner name match
    const exactPhrase = normalizeText('Bernhard von Berg')
    const matchedItems = items.filter((item) => {
      if (!item.owner_names) return false
      const ownerNamesNormalized = normalizeText(item.owner_names)
      return ownerNamesNormalized.includes(exactPhrase)
    })

    expect(matchedItems).toHaveLength(2)
    expect(matchedItems.map((i) => i.name).sort()).toEqual(['Schild', 'Schwert'])
  })
})

describe('Quoted Phrase Search - Locations', () => {
  it('should find Locations with exact name match ONLY', () => {
    // Create locations
    db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)').run(
      locationTypeId,
      testCampaignId,
      'Schmïede des Brün Eisenfaust',
    )
    db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)').run(
      locationTypeId,
      testCampaignId,
      'Schmïede',
    )
    db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)').run(
      locationTypeId,
      testCampaignId,
      'Eisenfaust Taverne',
    )

    // FTS5 exact phrase search (normalized)
    const normalizedSearch = normalizeText('Schmïede des Brün Eisenfaust')
    const locations = db
      .prepare(
        `
      SELECT e.id, e.name
      FROM entities_fts fts
      INNER JOIN entities e ON fts.rowid = e.id
      WHERE entities_fts MATCH ?
        AND e.type_id = ?
        AND e.campaign_id = ?
        AND e.deleted_at IS NULL
    `,
      )
      .all(`"${normalizedSearch}"`, locationTypeId, testCampaignId) as Array<{
      id: number
      name: string
    }>

    expect(locations).toHaveLength(1)
    expect(locations[0].name).toBe('Schmïede des Brün Eisenfaust')
  })

  it('should find Locations via linked NPC name (cross-entity search)', () => {
    // Create NPC
    const npc = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)').run(
        npcTypeId,
        testCampaignId,
        'Günther Müller',
      )
    const npcId = Number(npc.lastInsertRowid)

    // Create Locations
    const location1 = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)').run(
        locationTypeId,
        testCampaignId,
        'Taverne zum Goldenen Drachen',
      )
    const _location2 = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)').run(
        locationTypeId,
        testCampaignId,
        'Marktplatz',
      )

    // Link NPC to Location
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(npcId, location1.lastInsertRowid, 'arbeitet bei')

    // Query locations with linked NPCs
    const locations = db
      .prepare(
        `
      SELECT
        e.id,
        e.name,
        GROUP_CONCAT(DISTINCT npc.name) as linked_npc_names
      FROM entities e
      LEFT JOIN entity_relations npc_rel ON npc_rel.to_entity_id = e.id
      LEFT JOIN entities npc ON npc.id = npc_rel.from_entity_id
        AND npc.deleted_at IS NULL
        AND npc.type_id = ?
      WHERE e.type_id = ?
        AND e.campaign_id = ?
        AND e.deleted_at IS NULL
      GROUP BY e.id
    `,
      )
      .all(npcTypeId, locationTypeId, testCampaignId) as Array<{
      id: number
      name: string
      linked_npc_names: string | null
    }>

    // Filter with exact NPC name match
    const exactPhrase = normalizeText('Günther Müller')
    const matchedLocations = locations.filter((loc) => {
      if (!loc.linked_npc_names) return false
      const npcNamesNormalized = normalizeText(loc.linked_npc_names)
      return npcNamesNormalized.includes(exactPhrase)
    })

    expect(matchedLocations).toHaveLength(1)
    expect(matchedLocations[0].name).toBe('Taverne zum Goldenen Drachen')
  })
})

describe('Quoted Phrase Search - Factions', () => {
  it('should find Factions with exact name match ONLY', () => {
    // Create factions
    db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)').run(
      factionTypeId,
      testCampaignId,
      'Die Harpers',
    )
    db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)').run(
      factionTypeId,
      testCampaignId,
      'Harpers Guild',
    )
    db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)').run(
      factionTypeId,
      testCampaignId,
      'Die Zhentarim',
    )

    // FTS5 exact phrase search
    const factions = db
      .prepare(
        `
      SELECT e.id, e.name
      FROM entities_fts fts
      INNER JOIN entities e ON fts.rowid = e.id
      WHERE entities_fts MATCH ?
        AND e.type_id = ?
        AND e.campaign_id = ?
        AND e.deleted_at IS NULL
    `,
      )
      .all('"Die Harpers"', factionTypeId, testCampaignId) as Array<{ id: number; name: string }>

    expect(factions).toHaveLength(1)
    expect(factions[0].name).toBe('Die Harpers')
  })
})

describe('Quoted Phrase Search - Combined with AND/OR Operators', () => {
  it('should combine quoted phrase with AND operator', () => {
    const parsed = parseSearchQuery('"Schmïede des Brün Eisenfaust" AND Gün')

    expect(parsed.hasOperators).toBe(true)
    expect(parsed.terms).toEqual(['Schmïede des Brün Eisenfaust', 'Gün'])
    expect(parsed.fts5Query).toContain('"Schmïede des Brün Eisenfaust"')
    expect(parsed.fts5Query).toContain('AND')
    expect(parsed.fts5Query).toContain('Gün*')
  })

  it('should find Location with exact name AND linked NPC (fuzzy)', () => {
    // Create NPC
    const npc = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(npcTypeId, testCampaignId, 'Günther')
    const npcId = Number(npc.lastInsertRowid)

    // Create Location
    const location = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(locationTypeId, testCampaignId, 'Schmïede des Brün Eisenfaust')
    const locationId = Number(location.lastInsertRowid)

    // Link NPC to Location
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(npcId, locationId, 'arbeitet bei')

    // Query: Exact location name + fuzzy NPC name
    const locations = db
      .prepare(
        `
      SELECT
        e.id,
        e.name,
        GROUP_CONCAT(DISTINCT npc.name) as linked_npc_names
      FROM entities e
      LEFT JOIN entity_relations npc_rel ON npc_rel.to_entity_id = e.id
      LEFT JOIN entities npc ON npc.id = npc_rel.from_entity_id
        AND npc.deleted_at IS NULL
        AND npc.type_id = ?
      WHERE e.type_id = ?
        AND e.campaign_id = ?
        AND e.deleted_at IS NULL
      GROUP BY e.id
    `,
      )
      .all(npcTypeId, locationTypeId, testCampaignId) as Array<{
      id: number
      name: string
      linked_npc_names: string | null
    }>

    // Simulate AND filter: exact location name + fuzzy NPC match
    const exactLocationPhrase = normalizeText('Schmïede des Brün Eisenfaust')
    const fuzzyNpcTerm = normalizeText('Gün') // Typo for "Günther"

    const matchedLocations = locations.filter((loc) => {
      const nameNormalized = normalizeText(loc.name)
      const npcNamesNormalized = normalizeText(loc.linked_npc_names || '')

      // Term 1: Exact location name match
      const locationMatches = nameNormalized.includes(exactLocationPhrase)

      // Term 2: Fuzzy NPC name match (substring or Levenshtein)
      const npcMatches = npcNamesNormalized.includes(fuzzyNpcTerm)

      return locationMatches && npcMatches
    })

    expect(matchedLocations).toHaveLength(1)
    expect(matchedLocations[0].name).toBe('Schmïede des Brün Eisenfaust')
  })
})

describe('Quoted Phrase Search - Regression: Prevent Fuzzy Matches', () => {
  it('REGRESSION: Should NOT find all NPCs with "von" when searching "Bernhard von Berg"', () => {
    // Create many NPCs with "von" in different positions
    db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)').run(
      npcTypeId,
      testCampaignId,
      'Bernhard von Berg',
    )
    db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)').run(
      npcTypeId,
      testCampaignId,
      'Hans von Müller',
    )
    db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)').run(
      npcTypeId,
      testCampaignId,
      'Peter von Schmidt',
    )
    db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)').run(
      npcTypeId,
      testCampaignId,
      'Anna Berg',
    )

    // FTS5 exact phrase search
    const npcs = db
      .prepare(
        `
      SELECT e.id, e.name
      FROM entities_fts fts
      INNER JOIN entities e ON fts.rowid = e.id
      WHERE entities_fts MATCH ?
        AND e.type_id = ?
        AND e.campaign_id = ?
        AND e.deleted_at IS NULL
    `,
      )
      .all('"Bernhard von Berg"', npcTypeId, testCampaignId) as Array<{ id: number; name: string }>

    // CRITICAL: Should find ONLY the exact match, not all NPCs with "von"
    expect(npcs).toHaveLength(1)
    expect(npcs[0].name).toBe('Bernhard von Berg')
  })

  it('REGRESSION: Should NOT find Items with partial name matches', () => {
    // Create items
    db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)').run(
      itemTypeId,
      testCampaignId,
      'Antigifte Phiole',
    )
    db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)').run(
      itemTypeId,
      testCampaignId,
      'Antigifte Trank',
    )
    db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)').run(
      itemTypeId,
      testCampaignId,
      'Heilphiole',
    )

    // FTS5 exact phrase search
    const items = db
      .prepare(
        `
      SELECT e.id, e.name
      FROM entities_fts fts
      INNER JOIN entities e ON fts.rowid = e.id
      WHERE entities_fts MATCH ?
        AND e.type_id = ?
        AND e.campaign_id = ?
        AND e.deleted_at IS NULL
    `,
      )
      .all('"Antigifte Phiole"', itemTypeId, testCampaignId) as Array<{ id: number; name: string }>

    expect(items).toHaveLength(1)
    expect(items[0].name).toBe('Antigifte Phiole')
  })

  it('REGRESSION: Typo in exact phrase should find NOTHING', () => {
    // Create NPC
    db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)').run(
      npcTypeId,
      testCampaignId,
      'Schmïede des Brün Eisenfaust',
    )

    // Search with typo (missing 't')
    const normalizedSearch = normalizeText('Schmïede des Brün Eisenfaus')
    const npcs = db
      .prepare(
        `
      SELECT e.id, e.name
      FROM entities_fts fts
      INNER JOIN entities e ON fts.rowid = e.id
      WHERE entities_fts MATCH ?
        AND e.type_id = ?
        AND e.campaign_id = ?
        AND e.deleted_at IS NULL
    `,
      )
      .all(`"${normalizedSearch}"`, npcTypeId, testCampaignId)

    // Exact search with typo should find NOTHING
    expect(npcs).toHaveLength(0)
  })
})
