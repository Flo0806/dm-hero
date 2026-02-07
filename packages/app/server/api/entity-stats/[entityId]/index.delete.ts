// Remove entity stats assignment
export default defineEventHandler((event) => {
  const db = getDb()
  const entityId = Number(getRouterParam(event, 'entityId'))

  db.prepare('DELETE FROM entity_stats WHERE entity_id = ?').run(entityId)

  return { success: true }
})
