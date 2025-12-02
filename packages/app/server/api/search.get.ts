import { getDb } from '../utils/db'
import { createLevenshtein } from '../utils/levenshtein'
import { normalizeText } from '../utils/normalize'

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

  const searchTerm = normalizeText(searchQuery.trim())

  // Get all entity types
  const entityTypes = db
    .prepare(
      `
    SELECT id, name, icon, color FROM entity_types
  `,
    )
    .all() as Array<{ id: number; name: string; icon: string; color: string }>

  let allResults: EntityResult[] = []

  // Search each entity type with cross-entity relations
  for (const type of entityTypes) {
    let typeResults: EntityResult[]

    // All entity types use bidirectional relation queries (checking both from_entity_id and to_entity_id)
    // This ensures linked entities are found regardless of which direction the relation was created

    if (type.name === 'Location') {
      // Locations: Include linked NPCs, Items, Lore, Factions, Players (bidirectional)
      typeResults = db
        .prepare(
          `
        SELECT
          e.id,
          e.name,
          e.description,
          ? as type,
          ? as icon,
          ? as color,
          (
            SELECT GROUP_CONCAT(linked.name, '|')
            FROM (
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.from_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'NPC')
              WHERE r.to_entity_id = e.id
              UNION ALL
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.to_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'NPC')
              WHERE r.from_entity_id = e.id
              UNION ALL
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.from_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'Item')
              WHERE r.to_entity_id = e.id
              UNION ALL
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.to_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'Item')
              WHERE r.from_entity_id = e.id
              UNION ALL
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.from_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'Lore')
              WHERE r.to_entity_id = e.id
              UNION ALL
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.to_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'Lore')
              WHERE r.from_entity_id = e.id
              UNION ALL
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.from_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'Faction')
              WHERE r.to_entity_id = e.id
              UNION ALL
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.to_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'Faction')
              WHERE r.from_entity_id = e.id
              UNION ALL
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.from_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'Player')
              WHERE r.to_entity_id = e.id
              UNION ALL
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.to_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'Player')
              WHERE r.from_entity_id = e.id
            ) linked
          ) as linked_entities
        FROM entities e
        WHERE e.type_id = ?
          AND e.campaign_id = ?
          AND e.deleted_at IS NULL
      `,
        )
        .all(type.name, type.icon, type.color, type.id, campaignId) as EntityResult[]
    } else if (type.name === 'NPC') {
      // NPCs: Include linked Locations, Items, Lore, Factions, Players (bidirectional)
      typeResults = db
        .prepare(
          `
        SELECT
          e.id,
          e.name,
          e.description,
          ? as type,
          ? as icon,
          ? as color,
          (
            SELECT GROUP_CONCAT(linked.name, '|')
            FROM (
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.from_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'Location')
              WHERE r.to_entity_id = e.id
              UNION ALL
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.to_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'Location')
              WHERE r.from_entity_id = e.id
              UNION ALL
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.from_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'Item')
              WHERE r.to_entity_id = e.id
              UNION ALL
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.to_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'Item')
              WHERE r.from_entity_id = e.id
              UNION ALL
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.from_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'Lore')
              WHERE r.to_entity_id = e.id
              UNION ALL
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.to_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'Lore')
              WHERE r.from_entity_id = e.id
              UNION ALL
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.from_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'Faction')
              WHERE r.to_entity_id = e.id
              UNION ALL
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.to_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'Faction')
              WHERE r.from_entity_id = e.id
              UNION ALL
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.from_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'Player')
              WHERE r.to_entity_id = e.id
              UNION ALL
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.to_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'Player')
              WHERE r.from_entity_id = e.id
            ) linked
          ) as linked_entities
        FROM entities e
        WHERE e.type_id = ?
          AND e.campaign_id = ?
          AND e.deleted_at IS NULL
      `,
        )
        .all(type.name, type.icon, type.color, type.id, campaignId) as EntityResult[]
    } else if (type.name === 'Item') {
      // Items: Include linked NPCs, Locations, Lore, Factions, Players (bidirectional)
      typeResults = db
        .prepare(
          `
        SELECT
          e.id,
          e.name,
          e.description,
          ? as type,
          ? as icon,
          ? as color,
          (
            SELECT GROUP_CONCAT(linked.name, '|')
            FROM (
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.from_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'NPC')
              WHERE r.to_entity_id = e.id
              UNION ALL
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.to_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'NPC')
              WHERE r.from_entity_id = e.id
              UNION ALL
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.from_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'Location')
              WHERE r.to_entity_id = e.id
              UNION ALL
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.to_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'Location')
              WHERE r.from_entity_id = e.id
              UNION ALL
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.from_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'Lore')
              WHERE r.to_entity_id = e.id
              UNION ALL
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.to_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'Lore')
              WHERE r.from_entity_id = e.id
              UNION ALL
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.from_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'Faction')
              WHERE r.to_entity_id = e.id
              UNION ALL
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.to_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'Faction')
              WHERE r.from_entity_id = e.id
              UNION ALL
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.from_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'Player')
              WHERE r.to_entity_id = e.id
              UNION ALL
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.to_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'Player')
              WHERE r.from_entity_id = e.id
            ) linked
          ) as linked_entities
        FROM entities e
        WHERE e.type_id = ?
          AND e.campaign_id = ?
          AND e.deleted_at IS NULL
      `,
        )
        .all(type.name, type.icon, type.color, type.id, campaignId) as EntityResult[]
    } else if (type.name === 'Faction') {
      // Factions: Include linked NPCs, Items, Locations, Lore, Players (bidirectional)
      typeResults = db
        .prepare(
          `
        SELECT
          e.id,
          e.name,
          e.description,
          ? as type,
          ? as icon,
          ? as color,
          (
            SELECT GROUP_CONCAT(linked.name, '|')
            FROM (
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.from_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'NPC')
              WHERE r.to_entity_id = e.id
              UNION ALL
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.to_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'NPC')
              WHERE r.from_entity_id = e.id
              UNION ALL
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.from_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'Item')
              WHERE r.to_entity_id = e.id
              UNION ALL
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.to_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'Item')
              WHERE r.from_entity_id = e.id
              UNION ALL
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.from_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'Location')
              WHERE r.to_entity_id = e.id
              UNION ALL
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.to_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'Location')
              WHERE r.from_entity_id = e.id
              UNION ALL
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.from_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'Lore')
              WHERE r.to_entity_id = e.id
              UNION ALL
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.to_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'Lore')
              WHERE r.from_entity_id = e.id
              UNION ALL
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.from_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'Player')
              WHERE r.to_entity_id = e.id
              UNION ALL
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.to_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'Player')
              WHERE r.from_entity_id = e.id
            ) linked
          ) as linked_entities
        FROM entities e
        WHERE e.type_id = ?
          AND e.campaign_id = ?
          AND e.deleted_at IS NULL
      `,
        )
        .all(type.name, type.icon, type.color, type.id, campaignId) as EntityResult[]
    } else if (type.name === 'Player') {
      // Players: Include linked NPCs, Items, Locations, Factions, Lore (bidirectional)
      typeResults = db
        .prepare(
          `
        SELECT
          e.id,
          e.name,
          e.description,
          ? as type,
          ? as icon,
          ? as color,
          (
            SELECT GROUP_CONCAT(linked.name, '|')
            FROM (
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.from_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'NPC')
              WHERE r.to_entity_id = e.id
              UNION ALL
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.to_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'NPC')
              WHERE r.from_entity_id = e.id
              UNION ALL
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.from_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'Item')
              WHERE r.to_entity_id = e.id
              UNION ALL
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.to_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'Item')
              WHERE r.from_entity_id = e.id
              UNION ALL
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.from_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'Location')
              WHERE r.to_entity_id = e.id
              UNION ALL
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.to_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'Location')
              WHERE r.from_entity_id = e.id
              UNION ALL
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.from_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'Faction')
              WHERE r.to_entity_id = e.id
              UNION ALL
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.to_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'Faction')
              WHERE r.from_entity_id = e.id
              UNION ALL
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.from_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'Lore')
              WHERE r.to_entity_id = e.id
              UNION ALL
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.to_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'Lore')
              WHERE r.from_entity_id = e.id
            ) linked
          ) as linked_entities
        FROM entities e
        WHERE e.type_id = ?
          AND e.campaign_id = ?
          AND e.deleted_at IS NULL
      `,
        )
        .all(type.name, type.icon, type.color, type.id, campaignId) as EntityResult[]
    } else if (type.name === 'Lore') {
      // Lore: Include linked NPCs, Items, Locations, Factions, Players (bidirectional)
      typeResults = db
        .prepare(
          `
        SELECT
          e.id,
          e.name,
          e.description,
          ? as type,
          ? as icon,
          ? as color,
          (
            SELECT GROUP_CONCAT(linked.name, '|')
            FROM (
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.from_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'NPC')
              WHERE r.to_entity_id = e.id
              UNION ALL
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.to_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'NPC')
              WHERE r.from_entity_id = e.id
              UNION ALL
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.from_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'Item')
              WHERE r.to_entity_id = e.id
              UNION ALL
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.to_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'Item')
              WHERE r.from_entity_id = e.id
              UNION ALL
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.from_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'Location')
              WHERE r.to_entity_id = e.id
              UNION ALL
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.to_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'Location')
              WHERE r.from_entity_id = e.id
              UNION ALL
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.from_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'Faction')
              WHERE r.to_entity_id = e.id
              UNION ALL
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.to_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'Faction')
              WHERE r.from_entity_id = e.id
              UNION ALL
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.from_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'Player')
              WHERE r.to_entity_id = e.id
              UNION ALL
              SELECT x.name FROM entity_relations r
              JOIN entities x ON x.id = r.to_entity_id AND x.deleted_at IS NULL
                AND x.type_id = (SELECT id FROM entity_types WHERE name = 'Player')
              WHERE r.from_entity_id = e.id
            ) linked
          ) as linked_entities
        FROM entities e
        WHERE e.type_id = ?
          AND e.campaign_id = ?
          AND e.deleted_at IS NULL
      `,
        )
        .all(type.name, type.icon, type.color, type.id, campaignId) as EntityResult[]
    } else {
      // Other unknown types: Simple query without relations
      typeResults = db
        .prepare(
          `
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
      `,
        )
        .all(type.name, type.icon, type.color, type.id, campaignId) as EntityResult[]
    }

    allResults = allResults.concat(typeResults)
  }

  // Apply Levenshtein filtering and scoring
  const maxDist = searchTerm.length <= 3 ? 2 : searchTerm.length <= 6 ? 3 : 4

  const scoredResults = allResults
    .map((result) => {
      const nameNormalized = normalizeText(result.name)
      const descriptionNormalized = normalizeText(result.description || '')
      const linkedEntitiesNormalized = normalizeText(result.linked_entities || '')

      let score = 1000 // Start with high score, reduce for better matches

      // Check name match
      if (nameNormalized === searchTerm) {
        score -= 500 // Exact match: best
        return { ...result, _score: score }
      }
      if (nameNormalized.includes(searchTerm)) {
        score -= 200 // Contains match: very good
        return { ...result, _score: score }
      }

      // Check description match
      if (descriptionNormalized.includes(searchTerm)) {
        score -= 50
        return { ...result, _score: score }
      }

      // Check linked entities match
      if (linkedEntitiesNormalized.includes(searchTerm)) {
        score -= 100 // Cross-entity match: good
        return { ...result, _score: score }
      }

      // Levenshtein on full name (for single-word names or close matches)
      const fullNameDist = levenshtein(searchTerm, nameNormalized)
      if (fullNameDist <= maxDist) {
        score -= 100 - fullNameDist * 10
        return { ...result, _score: score }
      }

      // Levenshtein on name words (for multi-word names)
      const nameWords = nameNormalized.split(/\s+/)
      for (const word of nameWords) {
        if (word.length === 0) continue
        const dist = levenshtein(searchTerm, word)
        if (dist <= maxDist) {
          score -= 90 - dist * 10 // Slightly lower than full name match
          return { ...result, _score: score }
        }
      }

      // Levenshtein on description words (skip short words)
      const descWords = descriptionNormalized.split(/\s+/)
      for (const word of descWords) {
        if (word.length < 3) continue
        const dist = levenshtein(searchTerm, word)
        if (dist <= maxDist) {
          score -= 50 - dist * 5
          return { ...result, _score: score }
        }
      }

      // Levenshtein on linked entity names
      if (linkedEntitiesNormalized.length > 0) {
        const linkedNames = linkedEntitiesNormalized.split(/[|,]/).map((n) => n.trim())
        for (const linkedName of linkedNames) {
          const linkedWords = linkedName.split(/\s+/)
          for (const word of linkedWords) {
            if (word.length === 0) continue
            const dist = levenshtein(searchTerm, word)
            if (dist <= maxDist) {
              score -= 80 - dist * 8
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

  // Parse linked_entities into clean array and return
  return scoredResults.map(({ _score, linked_entities, ...result }) => {
    // Parse linked_entities string into unique, non-empty names
    const linkedNames: string[] = []
    if (linked_entities) {
      const names = linked_entities.split(/[|,]/).map((n) => n.trim())
      for (const name of names) {
        if (name && name.length > 0 && !linkedNames.includes(name)) {
          linkedNames.push(name)
        }
      }
    }
    return {
      ...result,
      linkedEntities: linkedNames.slice(0, 5), // Limit to 5 for UI
    }
  })
})
