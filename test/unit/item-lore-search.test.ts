import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getDb } from '../../server/utils/db'
import { normalizeText } from '../../server/utils/normalize'
import { distance } from 'fastest-levenshtein'
import type Database from 'better-sqlite3'

// Item-Lore Cross-Search Tests
// This tests the ability to find Items by searching for linked Lore names
let db: Database.Database
let testCampaignId: number
let itemTypeId: number
let loreTypeId: number
let npcTypeId: number

// Type definitions for query results
interface ItemWithLoreNames {
  id: number
  name: string
  description?: string | null
  metadata?: string | null
  linked_lore_names?: string | null
}

interface ItemWithOwnerAndLore {
  id: number
  name: string
  description?: string | null
  owner_names?: string | null
  linked_lore_names?: string | null
}

interface ScoredItem extends ItemWithLoreNames {
  _score: number
}

beforeAll(() => {
  db = getDb()

  // Get entity type IDs
  const itemType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Item') as {
    id: number
  }
  const loreType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Lore') as {
    id: number
  }
  const npcType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('NPC') as {
    id: number
  }

  itemTypeId = itemType.id
  loreTypeId = loreType.id
  npcTypeId = npcType.id

  // Create test campaign
  const campaign = db
    .prepare('INSERT INTO campaigns (name, description) VALUES (?, ?)')
    .run('Test Campaign - Items', 'Item-Lore linking and search tests')
  testCampaignId = Number(campaign.lastInsertRowid)

  // Add test item types and rarities
  db.prepare('INSERT OR IGNORE INTO item_types (name, name_de, name_en) VALUES (?, ?, ?)').run(
    'potion',
    'Trank',
    'Potion',
  )
  db.prepare('INSERT OR IGNORE INTO item_types (name, name_de, name_en) VALUES (?, ?, ?)').run(
    'weapon',
    'Waffe',
    'Weapon',
  )
  db.prepare('INSERT OR IGNORE INTO item_rarities (name, name_de, name_en) VALUES (?, ?, ?)').run(
    'common',
    'Gewöhnlich',
    'Common',
  )
  db.prepare(
    'INSERT OR IGNORE INTO item_rarities (name, name_de, name_en) VALUES (?, ?, ?)',
  ).run('legendary', 'Legendär', 'Legendary')
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
  db.prepare(
    'DELETE FROM entity_relations WHERE to_entity_id IN (SELECT id FROM entities WHERE campaign_id = ?)',
  ).run(testCampaignId)
})

describe('Item-Lore Linking', () => {
  it('should link Item to Lore with relation type', () => {
    // Create Item
    const item = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(itemTypeId, testCampaignId, 'Antigifte Phiole')
    const itemId = Number(item.lastInsertRowid)

    // Create Lore
    const lore = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(loreTypeId, testCampaignId, 'Böser Frosch')
    const loreId = Number(lore.lastInsertRowid)

    // Link Item to Lore (Item → Lore)
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(itemId, loreId, 'bezieht sich auf')

    // Query linked Lore (like /api/items/[id]/lore.get.ts)
    const linkedLore = db
      .prepare(
        `
      SELECT
        lore.id,
        lore.name,
        lore.description,
        lore.image_url
      FROM entity_relations er
      INNER JOIN entities lore ON lore.id = er.to_entity_id
      INNER JOIN entity_types lt ON lt.id = lore.type_id
      WHERE er.from_entity_id = ?
        AND lt.name = 'Lore'
        AND lore.deleted_at IS NULL
      ORDER BY lore.name ASC
    `,
      )
      .all(itemId)

    expect(linkedLore).toHaveLength(1)
    expect(linkedLore[0]).toMatchObject({
      id: loreId,
      name: 'Böser Frosch',
    })
  })

  it('should find Items by linked Lore (reverse query)', () => {
    // Create Lore
    const lore = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(loreTypeId, testCampaignId, 'Der Ring der Macht')
    const loreId = Number(lore.lastInsertRowid)

    // Create Items linked to this Lore
    const item1 = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(itemTypeId, testCampaignId, 'Frodos Umhang')
    const item1Id = Number(item1.lastInsertRowid)

    const item2 = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(itemTypeId, testCampaignId, 'Gandalfs Stab')
    const item2Id = Number(item2.lastInsertRowid)

    // Link Items to Lore
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(item1Id, loreId, 'bezieht sich auf')
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(item2Id, loreId, 'bezieht sich auf')

    // Query Items by Lore (like /api/lore/[id]/items.get.ts)
    const linkedItems = db
      .prepare(
        `
      SELECT
        item.id,
        item.name,
        item.description,
        item.image_url
      FROM entity_relations er
      INNER JOIN entities item ON item.id = er.from_entity_id
      INNER JOIN entity_types it ON it.id = item.type_id
      WHERE er.to_entity_id = ?
        AND it.name = 'Item'
        AND item.deleted_at IS NULL
      ORDER BY item.name ASC
    `,
      )
      .all(loreId)

    expect(linkedItems).toHaveLength(2)
    expect(linkedItems[0]).toMatchObject({
      id: item1Id,
      name: 'Frodos Umhang',
    })
    expect(linkedItems[1]).toMatchObject({
      id: item2Id,
      name: 'Gandalfs Stab',
    })
  })
})

describe('Item Cross-Search via Lore Names', () => {
  it('should find Item by exact Lore name match', () => {
    // Create Lore
    const lore = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(loreTypeId, testCampaignId, 'Böser Frosch')
    const loreId = Number(lore.lastInsertRowid)

    // Create Item linked to Lore
    const item = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(itemTypeId, testCampaignId, 'Antigifte Phiole')
    const itemId = Number(item.lastInsertRowid)

    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(itemId, loreId, 'bezieht sich auf')

    // Search query: "Böser Frosch" (exact Lore name)
    const searchTerm = 'böser frosch'

    // Load all items with linked Lore names (like /api/items/index.get.ts Fallback 2)
    const items = db
      .prepare(
        `
      SELECT
        e.id,
        e.name,
        e.description,
        e.metadata,
        GROUP_CONCAT(DISTINCT owner_npc.name) as owner_names,
        GROUP_CONCAT(DISTINCT lore.name) as linked_lore_names
      FROM entities e
      LEFT JOIN entity_relations owner_rel ON owner_rel.to_entity_id = e.id
      LEFT JOIN entities owner_npc ON owner_npc.id = owner_rel.from_entity_id
        AND owner_npc.deleted_at IS NULL
        AND owner_npc.type_id = ?
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
      .all(npcTypeId, loreTypeId, itemTypeId, testCampaignId) as ItemWithLoreNames[]

    // Filter by Lore name match (normalized)
    const matchedItems = items.filter((item: ItemWithLoreNames) => {
      if (!item.linked_lore_names) return false
      const loreNamesNormalized = normalizeText(item.linked_lore_names)
      return loreNamesNormalized.includes(normalizeText(searchTerm))
    })

    expect(matchedItems).toHaveLength(1)
    expect(matchedItems[0]).toMatchObject({
      id: itemId,
      name: 'Antigifte Phiole',
    })
    expect(matchedItems[0].linked_lore_names).toBe('Böser Frosch')
  })

  it('should find Item by Lore name with word-level Levenshtein (typo tolerance)', () => {
    // Create Lore with multi-word name
    const lore = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(loreTypeId, testCampaignId, 'Der Ring der Macht')
    const loreId = Number(lore.lastInsertRowid)

    // Create Item linked to Lore
    const item = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(itemTypeId, testCampaignId, 'Frodos Umhang')
    const itemId = Number(item.lastInsertRowid)

    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(itemId, loreId, 'bezieht sich auf')

    // Search query with typo: "Rng" instead of "Ring"
    const searchTerm = 'rng'

    // Load all items with linked Lore names
    const items = db
      .prepare(
        `
      SELECT
        e.id,
        e.name,
        e.description,
        e.metadata,
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
      .all(loreTypeId, itemTypeId, testCampaignId) as ItemWithLoreNames[]

    // Filter by word-level Levenshtein (like items/index.get.ts filter logic)
    const maxDist = searchTerm.length <= 3 ? 2 : searchTerm.length <= 6 ? 3 : 4
    const matchedItems = items.filter((item: ItemWithLoreNames) => {
      if (!item.linked_lore_names) return false
      const loreNamesNormalized = normalizeText(item.linked_lore_names)
      const loreNames = loreNamesNormalized.split(',').map((n: string) => n.trim())

      for (const loreName of loreNames) {
        if (loreName.length === 0) continue
        // Word-level matching for multi-word names
        const loreWords = loreName.split(/\s+/)
        for (const word of loreWords) {
          if (word.length < 3) continue
          const levDist = distance(normalizeText(searchTerm), word)
          if (levDist <= maxDist) {
            return true
          }
        }
      }
      return false
    })

    expect(matchedItems).toHaveLength(1)
    expect(matchedItems[0]).toMatchObject({
      id: itemId,
      name: 'Frodos Umhang',
    })
    expect(matchedItems[0].linked_lore_names).toBe('Der Ring der Macht')
  })

  it('should rank Items with Lore name matches higher (scoring logic)', () => {
    // Create Lore
    const lore = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(loreTypeId, testCampaignId, 'Drachenfeuer')
    const loreId = Number(lore.lastInsertRowid)

    // Create Item 1: Matches in Lore name
    const item1 = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(itemTypeId, testCampaignId, 'Schild des Helden')
    const item1Id = Number(item1.lastInsertRowid)

    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(item1Id, loreId, 'bezieht sich auf')

    // Create Item 2: Matches in description (lower priority)
    db.prepare(
      'INSERT INTO entities (type_id, campaign_id, name, description) VALUES (?, ?, ?, ?)',
    ).run(itemTypeId, testCampaignId, 'Schwert der Könige', 'Schmiedet mit Drachenfeuer')

    // Search query: "drachenfeuer"
    const searchTerm = 'drachenfeuer'

    // Load all items with linked Lore names
    const items = db
      .prepare(
        `
      SELECT
        e.id,
        e.name,
        e.description,
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
      .all(loreTypeId, itemTypeId, testCampaignId) as ItemWithLoreNames[]

    // Apply scoring logic (like items/index.get.ts)
    const scoredItems = items.map((item: ItemWithLoreNames): ScoredItem => {
      const descriptionNormalized = item.description ? normalizeText(item.description) : ''
      const loreNamesNormalized = item.linked_lore_names
        ? normalizeText(item.linked_lore_names)
        : ''

      const isDescriptionMatch = descriptionNormalized.includes(normalizeText(searchTerm))
      const isLoreMatch = loreNamesNormalized.includes(normalizeText(searchTerm))

      let score = 0
      if (isLoreMatch) score -= 30 // Lore matches are very good
      if (isDescriptionMatch) score -= 10 // Description matches are ok

      return { ...item, _score: score }
    })

    // Sort by score (lower is better)
    scoredItems.sort((a: ScoredItem, b: ScoredItem) => a._score - b._score)

    expect(scoredItems).toHaveLength(2)
    // Item 1 with Lore match should rank first (score: -30)
    expect(scoredItems[0]).toMatchObject({
      id: item1Id,
      name: 'Schild des Helden',
      _score: -30,
    })
    // Item 2 with description match should rank second (score: -10)
    expect(scoredItems[1]).toMatchObject({
      name: 'Schwert der Könige',
      _score: -10,
    })
  })

  it('should handle Items with multiple Lore links', () => {
    // Create multiple Lore entries
    const lore1 = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(loreTypeId, testCampaignId, 'Geschichte der Zwerge')
    const lore1Id = Number(lore1.lastInsertRowid)

    const lore2 = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(loreTypeId, testCampaignId, 'Mithril Legenden')
    const lore2Id = Number(lore2.lastInsertRowid)

    // Create Item linked to both Lore entries
    const item = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(itemTypeId, testCampaignId, 'Mithril Rüstung')
    const itemId = Number(item.lastInsertRowid)

    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(itemId, lore1Id, 'bezieht sich auf')
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(itemId, lore2Id, 'bezieht sich auf')

    // Load item with all linked Lore names (GROUP_CONCAT creates comma-separated list)
    const items = db
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
      .all(loreTypeId, itemTypeId, testCampaignId) as ItemWithLoreNames[]

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      id: itemId,
      name: 'Mithril Rüstung',
    })

    // Verify both Lore names are in the result (comma-separated)
    const loreNames = items[0].linked_lore_names.split(',').map((n: string) => n.trim())
    expect(loreNames).toHaveLength(2)
    expect(loreNames).toContain('Geschichte der Zwerge')
    expect(loreNames).toContain('Mithril Legenden')
  })

  it('should find Item by searching for any of the linked Lore names', () => {
    // Create Lore entries
    const lore1 = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(loreTypeId, testCampaignId, 'Altes Wissen')
    const lore1Id = Number(lore1.lastInsertRowid)

    const lore2 = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(loreTypeId, testCampaignId, 'Verbotene Magie')
    const lore2Id = Number(lore2.lastInsertRowid)

    // Create Item linked to both
    const item = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(itemTypeId, testCampaignId, 'Uraltes Grimoire')
    const itemId = Number(item.lastInsertRowid)

    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(itemId, lore1Id, 'bezieht sich auf')
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(itemId, lore2Id, 'bezieht sich auf')

    // Search for second Lore name
    const searchTerm = 'verbotene magie'

    const items = db
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
      .all(loreTypeId, itemTypeId, testCampaignId) as ItemWithLoreNames[]

    // Filter by Lore name match
    const matchedItems = items.filter((item: ItemWithLoreNames) => {
      if (!item.linked_lore_names) return false
      const loreNamesNormalized = normalizeText(item.linked_lore_names)
      return loreNamesNormalized.includes(normalizeText(searchTerm))
    })

    expect(matchedItems).toHaveLength(1)
    expect(matchedItems[0]).toMatchObject({
      id: itemId,
      name: 'Uraltes Grimoire',
    })
  })
})

describe('Item Cross-Search with Owner Names and Lore Names', () => {
  it('should find Item by Owner name OR Lore name', () => {
    // Create NPC (Owner)
    const npc = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(npcTypeId, testCampaignId, 'Gandalf')
    const npcId = Number(npc.lastInsertRowid)

    // Create Lore
    const lore = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(loreTypeId, testCampaignId, 'Istari Orden')
    const loreId = Number(lore.lastInsertRowid)

    // Create Item owned by NPC and linked to Lore
    const item = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(itemTypeId, testCampaignId, 'Zauberstab des Weisen')
    const itemId = Number(item.lastInsertRowid)

    // Link Owner (NPC → Item)
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(npcId, itemId, 'besitzt')

    // Link Lore (Item → Lore)
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(itemId, loreId, 'bezieht sich auf')

    // Load item with both owner and lore names
    const items = db
      .prepare(
        `
      SELECT
        e.id,
        e.name,
        GROUP_CONCAT(DISTINCT owner_npc.name) as owner_names,
        GROUP_CONCAT(DISTINCT lore.name) as linked_lore_names
      FROM entities e
      LEFT JOIN entity_relations owner_rel ON owner_rel.to_entity_id = e.id
      LEFT JOIN entities owner_npc ON owner_npc.id = owner_rel.from_entity_id
        AND owner_npc.deleted_at IS NULL
        AND owner_npc.type_id = ?
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
      .all(npcTypeId, loreTypeId, itemTypeId, testCampaignId) as ItemWithOwnerAndLore[]

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      id: itemId,
      name: 'Zauberstab des Weisen',
      owner_names: 'Gandalf',
      linked_lore_names: 'Istari Orden',
    })

    // Test search by owner name
    const searchByOwner = items.filter((item: ItemWithOwnerAndLore) => {
      const ownerNamesNormalized = item.owner_names ? normalizeText(item.owner_names) : ''
      return ownerNamesNormalized.includes(normalizeText('gandalf'))
    })
    expect(searchByOwner).toHaveLength(1)

    // Test search by lore name
    const searchByLore = items.filter((item: ItemWithOwnerAndLore) => {
      const loreNamesNormalized = item.linked_lore_names
        ? normalizeText(item.linked_lore_names)
        : ''
      return loreNamesNormalized.includes(normalizeText('istari'))
    })
    expect(searchByLore).toHaveLength(1)
  })
})
