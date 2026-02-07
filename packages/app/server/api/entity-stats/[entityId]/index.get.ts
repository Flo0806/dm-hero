import type { EntityStatsDbRow } from '~~/types/stat-template'

// Get entity stats with the linked template structure.
// Returns null (not 404) if no stats are assigned yet.
export default defineEventHandler((event) => {
  const db = getDb()
  const entityId = Number(getRouterParam(event, 'entityId'))

  const row = db
    .prepare<unknown[], EntityStatsDbRow>(
      'SELECT * FROM entity_stats WHERE entity_id = ?',
    )
    .get(entityId)

  if (!row) return null

  const template = getStatTemplateById(row.template_id)

  return {
    stats: {
      id: row.id,
      entity_id: row.entity_id,
      template_id: row.template_id,
      values: JSON.parse(row.values_json || '{}'),
      created_at: row.created_at,
      updated_at: row.updated_at,
    },
    template,
  }
})
