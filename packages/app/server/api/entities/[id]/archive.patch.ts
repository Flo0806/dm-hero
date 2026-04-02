import { getDb } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody(event)
  const archive = body.archive !== false // default: archive

  if (isNaN(id)) {
    throw createError({ statusCode: 400, message: 'Invalid entity ID' })
  }

  const entity = db.prepare('SELECT id, archived_at FROM entities WHERE id = ? AND deleted_at IS NULL').get(id) as { id: number, archived_at: string | null } | undefined

  if (!entity) {
    throw createError({ statusCode: 404, message: 'Entity not found' })
  }

  if (archive) {
    db.prepare('UPDATE entities SET archived_at = datetime(\'now\') WHERE id = ?').run(id)
  }
  else {
    db.prepare('UPDATE entities SET archived_at = NULL WHERE id = ?').run(id)
  }

  return { success: true, archived: archive }
})
