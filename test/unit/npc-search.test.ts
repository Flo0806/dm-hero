import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getDb } from '../../server/utils/db'
import { normalizeText } from '../../server/utils/normalize'
import { getRaceKey, getClassKey } from '../../server/utils/i18n-lookup'
import { parseSearchQuery } from '../../server/utils/search-query-parser'
import { distance } from 'fastest-levenshtein'
import type Database from 'better-sqlite3'

// NPC Search API Tests - Testing the complex search logic
// This tests the database queries directly (not HTTP endpoints)
let db: Database.Database
let testCampaignId: number
let npcTypeId: number
let factionTypeId: number
let locationTypeId: number

beforeAll(() => {
  db = getDb()

  // Get entity type IDs
  const npcType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('NPC') as {
    id: number
  }
  const factionType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Faction') as {
    id: number
  }
  const locationType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Location') as {
    id: number
  }

  npcTypeId = npcType.id
  factionTypeId = factionType.id
  locationTypeId = locationType.id

  // Create test campaign
  const campaign = db
    .prepare('INSERT INTO campaigns (name, description) VALUES (?, ?)')
    .run('Test Campaign', 'Test description')
  testCampaignId = Number(campaign.lastInsertRowid)

  // Add test races and classes
  db.prepare('INSERT OR IGNORE INTO races (name, name_de, name_en) VALUES (?, ?, ?)').run(
    'human',
    'Mensch',
    'Human',
  )
  db.prepare('INSERT OR IGNORE INTO races (name, name_de, name_en) VALUES (?, ?, ?)').run(
    'elf',
    'Elf',
    'Elf',
  )
  db.prepare('INSERT OR IGNORE INTO classes (name, name_de, name_en) VALUES (?, ?, ?)').run(
    'wizard',
    'Zauberer',
    'Wizard',
  )
  db.prepare('INSERT OR IGNORE INTO classes (name, name_de, name_en) VALUES (?, ?, ?)').run(
    'fighter',
    'Kämpfer',
    'Fighter',
  )
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

describe('NPC Search - Basic Functionality', () => {
  it('should return all NPCs when no search query is provided', () => {
    // Create test NPCs
    db.prepare(
      'INSERT INTO entities (type_id, campaign_id, name, description) VALUES (?, ?, ?, ?)',
    ).run(npcTypeId, testCampaignId, 'Gandalf', 'A wise wizard')
    db.prepare(
      'INSERT INTO entities (type_id, campaign_id, name, description) VALUES (?, ?, ?, ?)',
    ).run(npcTypeId, testCampaignId, 'Frodo', 'A brave hobbit')

    const npcs = db
      .prepare(
        `
      SELECT e.id, e.name, e.description, e.metadata
      FROM entities e
      WHERE e.type_id = ? AND e.campaign_id = ? AND e.deleted_at IS NULL
      ORDER BY e.name ASC
    `,
      )
      .all(npcTypeId, testCampaignId)

    expect(npcs).toHaveLength(2)
    expect(npcs[0]).toHaveProperty('name', 'Frodo')
    expect(npcs[1]).toHaveProperty('name', 'Gandalf')
  })

  it('should not return soft-deleted NPCs', () => {
    // Create NPC and soft-delete it
    const result = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name, description) VALUES (?, ?, ?, ?)')
      .run(npcTypeId, testCampaignId, 'Deleted NPC', 'Should not appear')
    db.prepare('UPDATE entities SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(
      result.lastInsertRowid,
    )

    const npcs = db
      .prepare(
        `
      SELECT e.id, e.name
      FROM entities e
      WHERE e.type_id = ? AND e.campaign_id = ? AND e.deleted_at IS NULL
    `,
      )
      .all(npcTypeId, testCampaignId)

    expect(npcs).toHaveLength(0)
  })

  it('should filter NPCs by campaign ID', () => {
    // Create another campaign
    const campaign2 = db.prepare('INSERT INTO campaigns (name) VALUES (?)').run('Campaign 2')
    const campaign2Id = Number(campaign2.lastInsertRowid)

    // Create NPCs in different campaigns
    db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)').run(
      npcTypeId,
      testCampaignId,
      'NPC in Campaign 1',
    )
    db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)').run(
      npcTypeId,
      campaign2Id,
      'NPC in Campaign 2',
    )

    const npcs = db
      .prepare(
        `
      SELECT e.id, e.name
      FROM entities e
      WHERE e.type_id = ? AND e.campaign_id = ? AND e.deleted_at IS NULL
    `,
      )
      .all(npcTypeId, testCampaignId)

    expect(npcs).toHaveLength(1)
    expect(npcs[0].name).toBe('NPC in Campaign 1')

    // Cleanup
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(campaign2Id)
    db.prepare('DELETE FROM entities WHERE campaign_id = ?').run(campaign2Id)
  })
})

describe('NPC Search - FTS5 Full-Text Search', () => {
  it('should find NPCs by exact name match', () => {
    db.prepare(
      'INSERT INTO entities (type_id, campaign_id, name, description) VALUES (?, ?, ?, ?)',
    ).run(npcTypeId, testCampaignId, 'Gandalf', 'A wizard')
    db.prepare(
      'INSERT INTO entities (type_id, campaign_id, name, description) VALUES (?, ?, ?, ?)',
    ).run(npcTypeId, testCampaignId, 'Frodo', 'A hobbit')

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
      .all('gandalf*', npcTypeId, testCampaignId)

    expect(npcs).toHaveLength(1)
    expect(npcs[0].name).toBe('Gandalf')
  })

  it('should find NPCs by prefix match (FTS5 wildcard)', () => {
    db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)').run(
      npcTypeId,
      testCampaignId,
      'Gandalf',
    )
    db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)').run(
      npcTypeId,
      testCampaignId,
      'Gandor',
    )

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
      ORDER BY e.name ASC
    `,
      )
      .all('gand*', npcTypeId, testCampaignId)

    expect(npcs).toHaveLength(2)
    expect(npcs[0].name).toBe('Gandalf')
    expect(npcs[1].name).toBe('Gandor')
  })

  it('should find NPCs by description match', () => {
    db.prepare(
      'INSERT INTO entities (type_id, campaign_id, name, description) VALUES (?, ?, ?, ?)',
    ).run(npcTypeId, testCampaignId, 'Merlin', 'A powerful wizard from ancient times')
    db.prepare(
      'INSERT INTO entities (type_id, campaign_id, name, description) VALUES (?, ?, ?, ?)',
    ).run(npcTypeId, testCampaignId, 'Arthur', 'A brave knight')

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
      .all('wizard*', npcTypeId, testCampaignId)

    expect(npcs).toHaveLength(1)
    expect(npcs[0].name).toBe('Merlin')
  })

  it('should find NPCs by metadata (race/class)', () => {
    // Create NPC with race metadata
    db.prepare(
      'INSERT INTO entities (type_id, campaign_id, name, metadata) VALUES (?, ?, ?, ?)',
    ).run(npcTypeId, testCampaignId, 'Legolas', JSON.stringify({ race: 'elf', class: 'fighter' }))
    db.prepare(
      'INSERT INTO entities (type_id, campaign_id, name, metadata) VALUES (?, ?, ?, ?)',
    ).run(npcTypeId, testCampaignId, 'Gimli', JSON.stringify({ race: 'dwarf', class: 'fighter' }))

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
      .all('elf*', npcTypeId, testCampaignId)

    expect(npcs).toHaveLength(1)
    expect(npcs[0].name).toBe('Legolas')
  })
})

describe('NPC Search - Levenshtein Distance (Typo Tolerance)', () => {
  it('should calculate correct distance for 1 character typo', () => {
    const searchTerm = 'gandlf' // Missing 'a'
    const npcName = 'gandalf'

    const levDistance = distance(searchTerm.toLowerCase(), npcName.toLowerCase())

    expect(levDistance).toBe(1)
  })

  it('should prioritize exact matches (distance 0) over fuzzy matches', () => {
    const searchTerm = 'bernard'

    const exactDist = distance(searchTerm, 'bernard')
    const fuzzyDist = distance(searchTerm, 'bernhard')

    expect(exactDist).toBe(0)
    expect(fuzzyDist).toBeGreaterThan(0)
  })

  it('should normalize accents/umlauts for matching', () => {
    // André → andre
    const normalized1 = normalizeText('André')
    const normalized2 = normalizeText('andre')
    expect(normalized1).toBe(normalized2)

    // Müller → muller
    const normalized3 = normalizeText('Müller')
    const normalized4 = normalizeText('muller')
    expect(normalized3).toBe(normalized4)
  })
})

describe('NPC Search - Race/Class i18n Lookup', () => {
  it('should find race key by German name ("Mensch" → "human")', async () => {
    const raceKey = await getRaceKey('mensch', false, 'de')

    expect(raceKey).toBe('human')
  })

  it('should find class key by English name ("Wizard" → "wizard")', async () => {
    const classKey = await getClassKey('wizard', false, 'en')

    expect(classKey).toBe('wizard')
  })

  it('should find race key with fuzzy matching ("mensh" → "human")', async () => {
    // With fuzzy matching enabled (>= 5 chars)
    const raceKey = await getRaceKey('mensh', true, 'de')

    expect(raceKey).toBe('human')
  })
})

describe('NPC Search - Linked Entities (Factions, Locations & Lore)', () => {
  it('should find NPCs linked to a faction', () => {
    // Create faction
    const faction = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(factionTypeId, testCampaignId, 'Die Harpers')
    const factionId = Number(faction.lastInsertRowid)

    // Create NPC
    const npc = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(npcTypeId, testCampaignId, 'Bernhard')
    const npcId = Number(npc.lastInsertRowid)

    // Link NPC to faction
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(npcId, factionId, 'Mitglied')

    // Query with JOIN
    const npcs = db
      .prepare(
        `
      SELECT
        e.id,
        e.name,
        GROUP_CONCAT(DISTINCT faction.name) as linked_faction_names
      FROM entities e
      LEFT JOIN entity_relations faction_rel ON faction_rel.from_entity_id = e.id
      LEFT JOIN entities faction ON faction.id = faction_rel.to_entity_id
        AND faction.deleted_at IS NULL
        AND faction.type_id = ?
      WHERE e.type_id = ?
        AND e.campaign_id = ?
        AND e.deleted_at IS NULL
      GROUP BY e.id
    `,
      )
      .all(factionTypeId, npcTypeId, testCampaignId)

    expect(npcs).toHaveLength(1)
    expect(npcs[0].name).toBe('Bernhard')
    expect(npcs[0].linked_faction_names).toBe('Die Harpers')
  })

  it('should find NPCs linked to a location', () => {
    // Create location
    const location = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(locationTypeId, testCampaignId, 'Taverne zum Goldenen Drachen')
    const locationId = Number(location.lastInsertRowid)

    // Create NPC
    const npc = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(npcTypeId, testCampaignId, 'Günther')
    const npcId = Number(npc.lastInsertRowid)

    // Link NPC to location
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(npcId, locationId, 'arbeitet bei')

    // Query with JOIN
    const npcs = db
      .prepare(
        `
      SELECT
        e.id,
        e.name,
        GROUP_CONCAT(DISTINCT location.name) as linked_location_names
      FROM entities e
      LEFT JOIN entity_relations location_rel ON location_rel.from_entity_id = e.id
      LEFT JOIN entities location ON location.id = location_rel.to_entity_id
        AND location.deleted_at IS NULL
        AND location.type_id = ?
      WHERE e.type_id = ?
        AND e.campaign_id = ?
        AND e.deleted_at IS NULL
      GROUP BY e.id
    `,
      )
      .all(locationTypeId, npcTypeId, testCampaignId)

    expect(npcs).toHaveLength(1)
    expect(npcs[0].name).toBe('Günther')
    expect(npcs[0].linked_location_names).toBe('Taverne zum Goldenen Drachen')
  })

  it('should handle multi-word faction names in search', () => {
    // Create faction with multi-word name
    const faction = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(factionTypeId, testCampaignId, 'Die Grauen Jäger')
    const factionId = Number(faction.lastInsertRowid)

    // Create NPCs linked to faction
    const npc1 = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(npcTypeId, testCampaignId, 'Hans')
    const npc2 = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(npcTypeId, testCampaignId, 'Peter')

    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(npc1.lastInsertRowid, factionId, 'Mitglied')
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(npc2.lastInsertRowid, factionId, 'Mitglied')

    // Search should find both NPCs when searching for faction name parts
    const npcs = db
      .prepare(
        `
      SELECT
        e.id,
        e.name,
        GROUP_CONCAT(DISTINCT faction.name) as linked_faction_names
      FROM entities e
      LEFT JOIN entity_relations faction_rel ON faction_rel.from_entity_id = e.id
      LEFT JOIN entities faction ON faction.id = faction_rel.to_entity_id
        AND faction.deleted_at IS NULL
        AND faction.type_id = ?
      WHERE e.type_id = ?
        AND e.campaign_id = ?
        AND e.deleted_at IS NULL
      GROUP BY e.id
      HAVING linked_faction_names LIKE ?
    `,
      )
      .all(factionTypeId, npcTypeId, testCampaignId, '%Grauen Jäger%')

    expect(npcs).toHaveLength(2)
  })

  it('should find NPCs linked to Lore entries', () => {
    // Get Lore entity type ID
    const loreType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Lore') as {
      id: number
    }
    const loreTypeId = loreType.id

    // Create Lore entry
    const lore = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(loreTypeId, testCampaignId, 'Böser Frosch')
    const loreId = Number(lore.lastInsertRowid)

    // Create NPCs
    const npc1 = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(npcTypeId, testCampaignId, 'Bernhard von Berg')
    const npc2 = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(npcTypeId, testCampaignId, 'André Dubois')
    const _npc3 = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(npcTypeId, testCampaignId, 'Hans Müller')

    // Link NPCs to Lore (NPC → Lore)
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(npc1.lastInsertRowid, loreId, 'kennt')
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(npc2.lastInsertRowid, loreId, 'kennt')

    // Query with JOIN to get linked Lore names
    const npcs = db
      .prepare(
        `
      SELECT
        e.id,
        e.name,
        GROUP_CONCAT(DISTINCT lore.name) as linked_lore_names
      FROM entities e
      LEFT JOIN entity_relations lore_rel ON lore_rel.from_entity_id = e.id
      LEFT JOIN entities lore ON lore.id = lore_rel.to_entity_id
        AND lore.deleted_at IS NULL
        AND lore.type_id = ?
      WHERE e.type_id = ?
        AND e.campaign_id = ?
        AND e.deleted_at IS NULL
      GROUP BY e.id
    `,
      )
      .all(loreTypeId, npcTypeId, testCampaignId)

    // Should find all 3 NPCs, but only 2 have Lore linked
    expect(npcs).toHaveLength(3)

    // Filter NPCs with linked Lore
    const npcsWithLore = npcs.filter(
      (npc: { linked_lore_names: string | null }) => npc.linked_lore_names !== null,
    )
    expect(npcsWithLore).toHaveLength(2)
    expect(npcsWithLore[0].linked_lore_names).toBe('Böser Frosch')
    expect(npcsWithLore[1].linked_lore_names).toBe('Böser Frosch')
  })

  it('should find NPCs via quoted Lore name search (REGRESSION: Quoted multi-word phrases)', () => {
    // CRITICAL TEST: This prevents breaking the cross-search when using quoted phrases
    // BEFORE FIX: "böser frosch" was treated as ONE term → multi-word check skipped → no bonus
    // AFTER FIX: "böser frosch" splits into ["böser", "frosch"] → multi-word check works → -500 bonus

    // Get Lore entity type ID
    const loreType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Lore') as {
      id: number
    }
    const loreTypeId = loreType.id

    // Create Lore entry
    const lore = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(loreTypeId, testCampaignId, 'Böser Frosch')
    const loreId = Number(lore.lastInsertRowid)

    // Create NPCs
    const npc1 = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(npcTypeId, testCampaignId, 'Bernhard von Berg')
    const _npc2 = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(npcTypeId, testCampaignId, 'Franz Böser') // Name contains "Böser" but NOT "Frosch"

    // Link only Bernhard to Lore
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(npc1.lastInsertRowid, loreId, 'kennt')

    // Parse quoted phrase search
    const parsed = parseSearchQuery('"böser frosch"')

    // CRITICAL: terms should be split into words for cross-search
    expect(parsed.terms).toEqual(['böser', 'frosch'])
    expect(parsed.hasOperators).toBe(true)

    // Simulate the cross-search logic
    const npcsWithLore = db
      .prepare(
        `
      SELECT
        e.id,
        e.name,
        GROUP_CONCAT(DISTINCT lore.name) as linked_lore_names
      FROM entities e
      LEFT JOIN entity_relations lore_rel ON lore_rel.from_entity_id = e.id
      LEFT JOIN entities lore ON lore.id = lore_rel.to_entity_id
        AND lore.deleted_at IS NULL
        AND lore.type_id = ?
      WHERE e.type_id = ?
        AND e.campaign_id = ?
        AND e.deleted_at IS NULL
      GROUP BY e.id
    `,
      )
      .all(loreTypeId, npcTypeId, testCampaignId)

    // Check multi-word matching logic
    const linkedLoreMatches = npcsWithLore.filter(
      (npc: { name: string; linked_lore_names: string | null }) => {
        if (!npc.linked_lore_names) return false
        const linkedLoreNormalized = normalizeText(npc.linked_lore_names)

        // ALL terms from parsed.terms must appear in linked Lore name
        const allTermsInLore = parsed.terms.every((term: string) =>
          linkedLoreNormalized.includes(normalizeText(term)),
        )

        return allTermsInLore
      },
    )

    // REGRESSION CHECK: Only Bernhard should match (linked to "Böser Frosch")
    // Franz should NOT match (name contains "Böser" but no Lore link)
    expect(linkedLoreMatches).toHaveLength(1)
    expect(linkedLoreMatches[0].name).toBe('Bernhard von Berg')
  })
})

describe('NPC Search - Search Query Parsing', () => {
  it('should parse AND operator queries', () => {
    const parsed = parseSearchQuery('bernard AND human')

    expect(parsed.hasOperators).toBe(true)
    expect(parsed.terms).toEqual(['bernard', 'human'])
    expect(parsed.fts5Query.toUpperCase()).toContain('AND')
  })

  it('should parse OR operator queries', () => {
    const parsed = parseSearchQuery('bernard OR günther')

    expect(parsed.hasOperators).toBe(true)
    expect(parsed.terms).toEqual(['bernard', 'günther'])
    expect(parsed.fts5Query.toUpperCase()).toContain('OR')
  })

  it('should handle simple queries without operators', () => {
    const parsed = parseSearchQuery('gandalf')

    expect(parsed.hasOperators).toBe(false)
    expect(parsed.terms).toEqual(['gandalf'])
  })

  it('should split quoted phrases into words for cross-entity search (REGRESSION)', () => {
    // CRITICAL: Quoted phrases like "böser frosch" must be split into words
    // This allows multi-word bonus to trigger for Lore/Faction cross-search
    const parsed = parseSearchQuery('"böser frosch"')

    expect(parsed.hasOperators).toBe(true)
    expect(parsed.terms).toEqual(['böser', 'frosch']) // MUST be split!
    expect(parsed.fts5Query).toBe('"böser frosch"') // FTS5 keeps it quoted
  })

  it('should handle multi-word simple queries (no quotes)', () => {
    const parsed = parseSearchQuery('die grauen jäger')

    expect(parsed.hasOperators).toBe(false)
    expect(parsed.terms).toEqual(['die', 'grauen', 'jäger'])
  })
})

describe('NPC Search - Edge Cases & Regression Prevention', () => {
  it('should handle special characters in names (hyphens)', () => {
    db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)').run(
      npcTypeId,
      testCampaignId,
      'Hans-Peter',
    )

    // FTS5 should handle hyphens with quoting
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
      .all('"hans-peter"*', npcTypeId, testCampaignId) as Array<{ id: number; name: string }>

    expect(npcs).toHaveLength(1)
    expect(npcs[0].name).toBe('Hans-Peter')
  })

  it('should throw on invalid FTS5 query syntax', () => {
    expect(() => {
      db.prepare(
        `
        SELECT e.id
        FROM entities_fts fts
        INNER JOIN entities e ON fts.rowid = e.id
        WHERE entities_fts MATCH ?
      `,
      ).all('invalid** query((')
    }).toThrow()
  })

  it('should handle NPCs with null metadata gracefully', () => {
    db.prepare(
      'INSERT INTO entities (type_id, campaign_id, name, metadata) VALUES (?, ?, ?, ?)',
    ).run(npcTypeId, testCampaignId, 'NPC without metadata', null)

    const npcs = db
      .prepare(
        `
      SELECT e.id, e.name, e.metadata
      FROM entities e
      WHERE e.type_id = ? AND e.campaign_id = ? AND e.deleted_at IS NULL
    `,
      )
      .all(npcTypeId, testCampaignId) as Array<{
      id: number
      name: string
      metadata: string | null
    }>

    expect(npcs).toHaveLength(1)
    expect(npcs[0].metadata).toBeNull()
  })

  it('should handle case-insensitive search (FTS5)', () => {
    db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)').run(
      npcTypeId,
      testCampaignId,
      'GANDALF',
    )

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
      .all('gandalf*', npcTypeId, testCampaignId) as Array<{ id: number; name: string }>

    expect(npcs).toHaveLength(1)
    expect(npcs[0].name).toBe('GANDALF')
  })

  it('should respect LIMIT to prevent performance issues', () => {
    // Create 500 NPCs
    const stmt = db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
    for (let i = 0; i < 500; i++) {
      stmt.run(npcTypeId, testCampaignId, `NPC ${i}`)
    }

    // Query with LIMIT (as used in the API route - LIMIT 300)
    const npcs = db
      .prepare(
        `
      SELECT e.id, e.name
      FROM entities e
      WHERE e.type_id = ? AND e.campaign_id = ? AND e.deleted_at IS NULL
      LIMIT 300
    `,
      )
      .all(npcTypeId, testCampaignId)

    expect(npcs).toHaveLength(300)
  })
})
