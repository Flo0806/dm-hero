import type { SaveEntityStatsPayload, EntityStatsDbRow } from '~~/types/stat-template'

// Save entity stats (create or update).
// Uses INSERT OR REPLACE since entity_id has a UNIQUE constraint.
export default defineEventHandler(async (event) => {
  const db = getDb()
  const entityId = Number(getRouterParam(event, 'entityId'))
  const body = await readBody<SaveEntityStatsPayload>(event)

  if (!body.template_id) {
    throw createError({ statusCode: 400, message: 'template_id is required' })
  }

  // Verify template exists
  const template = getStatTemplateById(body.template_id)
  if (!template) {
    throw createError({ statusCode: 404, message: 'Template not found' })
  }

  const valuesJson = JSON.stringify(body.values || {})

  db.prepare(`
    INSERT INTO entity_stats (entity_id, template_id, values_json)
    VALUES (?, ?, ?)
    ON CONFLICT(entity_id) DO UPDATE SET
      template_id = excluded.template_id,
      values_json = excluded.values_json,
      updated_at = datetime('now')
  `).run(entityId, body.template_id, valuesJson)

  const row = db
    .prepare<unknown[], EntityStatsDbRow>(
      'SELECT * FROM entity_stats WHERE entity_id = ?',
    )
    .get(entityId)!

  return {
    id: row.id,
    entity_id: row.entity_id,
    template_id: row.template_id,
    values: JSON.parse(row.values_json || '{}'),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
})
