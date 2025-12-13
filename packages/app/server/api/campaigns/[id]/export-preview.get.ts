import { getDb } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  const campaignId = Number(getRouterParam(event, 'id'))

  if (!campaignId || isNaN(campaignId)) {
    throw createError({ statusCode: 400, message: 'Invalid campaign ID' })
  }

  const db = getDb()

  // Read entity types from database for dynamic mapping
  const entityTypes = db.prepare('SELECT id, name FROM entity_types').all() as Array<{
    id: number
    name: string
  }>
  const TYPE_NAMES = new Map<number, string>(entityTypes.map((t) => [t.id, t.name]))

  // Fetch all entities for this campaign
  const entities = db
    .prepare(
      `
    SELECT id, type_id, name
    FROM entities
    WHERE campaign_id = ? AND deleted_at IS NULL
    ORDER BY type_id, name
  `,
    )
    .all(campaignId) as Array<{
    id: number
    type_id: number
    name: string
  }>

  // Fetch all relations for this campaign's entities
  const entityIds = entities.map((e) => e.id)
  const placeholders = entityIds.map(() => '?').join(',')

  const relations =
    entityIds.length > 0
      ? (db
        .prepare(
          `
    SELECT from_entity_id, to_entity_id
    FROM entity_relations
    WHERE from_entity_id IN (${placeholders}) OR to_entity_id IN (${placeholders})
  `,
        )
        .all(...entityIds, ...entityIds) as Array<{
          from_entity_id: number
          to_entity_id: number
        }>)
      : []

  // Build entity lookup
  const entityMap = new Map(entities.map((e) => [e.id, e]))

  // Build linked entities for each entity
  const linkedMap = new Map<number, Set<number>>()
  for (const rel of relations) {
    // Add bidirectional links
    if (!linkedMap.has(rel.from_entity_id)) {
      linkedMap.set(rel.from_entity_id, new Set())
    }
    if (!linkedMap.has(rel.to_entity_id)) {
      linkedMap.set(rel.to_entity_id, new Set())
    }
    linkedMap.get(rel.from_entity_id)!.add(rel.to_entity_id)
    linkedMap.get(rel.to_entity_id)!.add(rel.from_entity_id)
  }

  // Build response
  const entitiesWithLinks = entities.map((e) => {
    const linkedIds = linkedMap.get(e.id) || new Set()
    const linkedEntities = Array.from(linkedIds)
      .map((id) => {
        const linked = entityMap.get(id)
        if (!linked) return null
        return {
          id: linked.id,
          name: linked.name,
          type: TYPE_NAMES.get(linked.type_id) || 'Unknown',
        }
      })
      .filter(Boolean)
      .slice(0, 10) // Limit to 10 linked entities for UI

    return {
      id: e.id,
      name: e.name,
      type: TYPE_NAMES.get(e.type_id) || 'Unknown',
      type_id: e.type_id,
      linkedEntities,
    }
  })

  // Count sessions and maps
  const sessionCount =
    (
      db
        .prepare('SELECT COUNT(*) as count FROM sessions WHERE campaign_id = ? AND deleted_at IS NULL')
        .get(campaignId) as { count: number }
    )?.count || 0

  const mapCount =
    (
      db
        .prepare('SELECT COUNT(*) as count FROM campaign_maps WHERE campaign_id = ? AND deleted_at IS NULL')
        .get(campaignId) as { count: number }
    )?.count || 0

  return {
    entities: entitiesWithLinks,
    sessionCount,
    mapCount,
  }
})
