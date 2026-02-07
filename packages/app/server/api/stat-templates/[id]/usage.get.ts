// Get entities using this stat template, grouped by entity type
export default defineEventHandler((event) => {
  const db = getDb()
  const id = Number(getRouterParam(event, 'id'))

  const rows = db
    .prepare<unknown[], { entity_id: number, entity_name: string, type_name: string }>(
      `SELECT e.id as entity_id, e.name as entity_name, et.name as type_name
       FROM entity_stats es
       JOIN entities e ON es.entity_id = e.id
       JOIN entity_types et ON e.type_id = et.id
       WHERE es.template_id = ? AND e.deleted_at IS NULL
       ORDER BY et.name ASC, e.name ASC`,
    )
    .all(id)

  return rows
})
