// Soft-delete a template.
// Without ?confirm=true: only returns linked entity count for confirmation UI.
// With ?confirm=true: actually deletes.
export default defineEventHandler((event) => {
  const db = getDb()
  const id = Number(getRouterParam(event, 'id'))
  const query = getQuery(event)
  const confirm = query.confirm === 'true'

  const exists = db
    .prepare('SELECT id FROM stat_templates WHERE id = ? AND deleted_at IS NULL')
    .get(id)

  if (!exists) {
    throw createError({ statusCode: 404, message: 'Template not found' })
  }

  // Check how many entities use this template
  const usage = db
    .prepare<unknown[], { count: number }>(
      'SELECT COUNT(*) as count FROM entity_stats WHERE template_id = ?',
    )
    .get(id)

  const linkedCount = usage?.count || 0

  // Without confirm: only return check result, never delete
  if (!confirm) {
    return {
      success: false,
      requiresConfirmation: true,
      linkedEntityCount: linkedCount,
    }
  }

  // With confirm: actually delete
  const transaction = db.transaction(() => {
    if (linkedCount > 0) {
      db.prepare('DELETE FROM entity_stats WHERE template_id = ?').run(id)
    }

    db.prepare("UPDATE stat_templates SET deleted_at = datetime('now') WHERE id = ?").run(id)
  })

  transaction()

  return { success: true, deletedEntityStats: linkedCount }
})
