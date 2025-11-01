import { getDb } from '../utils/db'
import { createLevenshtein } from '../utils/levenshtein'

const levenshtein = createLevenshtein()

interface EntityResult {
  id: number
  name: string
  description: string | null
  type: string
  icon: string
  color: string
  linked_entities?: string | null
  _score?: number
}

export default defineEventHandler((event) => {
  const db = getDb()
  const query = getQuery(event)
  const searchQuery = query.q as string
  const campaignId = query.campaignId as string

  if (!searchQuery || !campaignId) {
    return []
  }

  const searchTerm = searchQuery.trim().toLowerCase()

  // Get all entity types
  const entityTypes = db.prepare(`
    SELECT id, name, icon, color FROM entity_types
  `).all() as Array<{ id: number, name: string, icon: string, color: string }>

  let allResults: EntityResult[] = []

  // Search each entity type with cross-entity relations
  for (const type of entityTypes) {
    let typeResults: EntityResult[]

    if (type.name === 'Location') {
      // Locations: Include linked NPCs and Items
      typeResults = db.prepare(`
        SELECT
          e.id,
          e.name,
          e.description,
          ? as type,
          ? as icon,
          ? as color,
          GROUP_CONCAT(DISTINCT npc.name || '|' || item.name) as linked_entities
        FROM entities e
        LEFT JOIN entity_relations npc_rel ON npc_rel.to_entity_id = e.id
        LEFT JOIN entities npc ON npc.id = npc_rel.from_entity_id
          AND npc.deleted_at IS NULL
          AND npc.type_id = (SELECT id FROM entity_types WHERE name = 'NPC')
        LEFT JOIN entity_relations item_rel ON item_rel.to_entity_id = e.id
        LEFT JOIN entities item ON item.id = item_rel.from_entity_id
          AND item.deleted_at IS NULL
          AND item.type_id = (SELECT id FROM entity_types WHERE name = 'Item')
        WHERE e.type_id = ?
          AND e.campaign_id = ?
          AND e.deleted_at IS NULL
        GROUP BY e.id
      `).all(type.name, type.icon, type.color, type.id, campaignId) as EntityResult[]
    }
    else if (type.name === 'NPC') {
      // NPCs: Include linked Locations
      typeResults = db.prepare(`
        SELECT
          e.id,
          e.name,
          e.description,
          ? as type,
          ? as icon,
          ? as color,
          GROUP_CONCAT(DISTINCT loc.name) as linked_entities
        FROM entities e
        LEFT JOIN entity_relations loc_rel ON loc_rel.from_entity_id = e.id
        LEFT JOIN entities loc ON loc.id = loc_rel.to_entity_id
          AND loc.deleted_at IS NULL
          AND loc.type_id = (SELECT id FROM entity_types WHERE name = 'Location')
        WHERE e.type_id = ?
          AND e.campaign_id = ?
          AND e.deleted_at IS NULL
        GROUP BY e.id
      `).all(type.name, type.icon, type.color, type.id, campaignId) as EntityResult[]
    }
    else if (type.name === 'Item') {
      // Items: Include owner NPCs and Locations
      typeResults = db.prepare(`
        SELECT
          e.id,
          e.name,
          e.description,
          ? as type,
          ? as icon,
          ? as color,
          GROUP_CONCAT(DISTINCT npc.name || '|' || loc.name) as linked_entities
        FROM entities e
        LEFT JOIN entity_relations owner_rel ON owner_rel.to_entity_id = e.id
        LEFT JOIN entities npc ON npc.id = owner_rel.from_entity_id
          AND npc.deleted_at IS NULL
          AND npc.type_id = (SELECT id FROM entity_types WHERE name = 'NPC')
        LEFT JOIN entity_relations loc_rel ON loc_rel.to_entity_id = e.id
        LEFT JOIN entities loc ON loc.id = loc_rel.from_entity_id
          AND loc.deleted_at IS NULL
          AND loc.type_id = (SELECT id FROM entity_types WHERE name = 'Location')
        WHERE e.type_id = ?
          AND e.campaign_id = ?
          AND e.deleted_at IS NULL
        GROUP BY e.id
      `).all(type.name, type.icon, type.color, type.id, campaignId) as EntityResult[]
    }
    else {
      // Other types: Simple query without relations
      typeResults = db.prepare(`
        SELECT
          e.id,
          e.name,
          e.description,
          ? as type,
          ? as icon,
          ? as color,
          NULL as linked_entities
        FROM entities e
        WHERE e.type_id = ?
          AND e.campaign_id = ?
          AND e.deleted_at IS NULL
      `).all(type.name, type.icon, type.color, type.id, campaignId) as EntityResult[]
    }

    allResults = allResults.concat(typeResults)
  }

  // Apply Levenshtein filtering and scoring
  const maxDist = searchTerm.length <= 3 ? 2 : searchTerm.length <= 6 ? 3 : 4

  const scoredResults = allResults
    .map(result => {
      const nameLower = result.name.toLowerCase()
      const descriptionLower = (result.description || '').toLowerCase()
      const linkedEntitiesLower = (result.linked_entities || '').toLowerCase()

      let score = 1000 // Start with high score, reduce for better matches

      // Check name match
      if (nameLower === searchTerm) {
        score -= 500 // Exact match: best
        return { ...result, _score: score }
      }
      if (nameLower.includes(searchTerm)) {
        score -= 200 // Contains match: very good
        return { ...result, _score: score }
      }

      // Check description match
      if (descriptionLower.includes(searchTerm)) {
        score -= 50
        return { ...result, _score: score }
      }

      // Check linked entities match
      if (linkedEntitiesLower.includes(searchTerm)) {
        score -= 100 // Cross-entity match: good
        return { ...result, _score: score }
      }

      // Levenshtein on name words
      const nameWords = nameLower.split(/\s+/)
      for (const word of nameWords) {
        if (word.length === 0) continue
        const dist = levenshtein(searchTerm, word)
        if (dist <= maxDist) {
          score -= (100 - dist * 10)
          return { ...result, _score: score }
        }
      }

      // Levenshtein on description words (skip short words)
      const descWords = descriptionLower.split(/\s+/)
      for (const word of descWords) {
        if (word.length < 3) continue
        const dist = levenshtein(searchTerm, word)
        if (dist <= maxDist) {
          score -= (50 - dist * 5)
          return { ...result, _score: score }
        }
      }

      // Levenshtein on linked entity names
      if (linkedEntitiesLower.length > 0) {
        const linkedNames = linkedEntitiesLower.split(/[|,]/).map(n => n.trim())
        for (const linkedName of linkedNames) {
          const linkedWords = linkedName.split(/\s+/)
          for (const word of linkedWords) {
            if (word.length === 0) continue
            const dist = levenshtein(searchTerm, word)
            if (dist <= maxDist) {
              score -= (80 - dist * 8)
              return { ...result, _score: score }
            }
          }
        }
      }

      // No match
      return null
    })
    .filter((r): r is EntityResult & { _score: number } => r !== null)
    .sort((a, b) => a._score - b._score)
    .slice(0, 20)

  return scoredResults.map(({ _score, linked_entities, ...result }) => result)
})
