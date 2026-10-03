import type Database from 'better-sqlite3'
import { createLevenshtein } from './levenshtein'
import { normalizeText } from './normalize'

const levenshtein = createLevenshtein()

// Names of all locations linked to entity `e`: current location (location_id)
// plus entity_relations in BOTH directions. Use as a correlated subquery.
export const LINKED_LOCATION_NAMES_SQL = `(
  SELECT GROUP_CONCAT(DISTINCT loc.name) FROM entities loc
  WHERE loc.deleted_at IS NULL
    AND loc.campaign_id = e.campaign_id
    AND loc.type_id = (SELECT id FROM entity_types WHERE name = 'Location')
    AND (
      loc.id = e.location_id
      OR loc.id IN (SELECT to_entity_id FROM entity_relations WHERE from_entity_id = e.id)
      OR loc.id IN (SELECT from_entity_id FROM entity_relations WHERE to_entity_id = e.id)
    )
)`

// True if any location in the campaign matches the (normalized) search term
// by substring or Levenshtein (full name or single word)
export function locationNameMatchesSearch(db: Database.Database, campaignId: number | string, searchTerm: string): boolean {
  if (!searchTerm) return false

  const locations = db
    .prepare(
      `
      SELECT name FROM entities
      WHERE type_id = (SELECT id FROM entity_types WHERE name = 'Location')
        AND campaign_id = ?
        AND deleted_at IS NULL
    `,
    )
    .all(campaignId) as Array<{ name: string }>

  const maxDist = searchTerm.length <= 3 ? 1 : searchTerm.length <= 6 ? 2 : 3
  return locations.some(({ name }) => {
    const nameNormalized = normalizeText(name)
    if (nameNormalized.includes(searchTerm)) return true
    if (levenshtein(searchTerm, nameNormalized) <= maxDist) return true
    return nameNormalized.split(/\s+/).some(word => word.length >= 3 && levenshtein(searchTerm, word) <= maxDist)
  })
}
