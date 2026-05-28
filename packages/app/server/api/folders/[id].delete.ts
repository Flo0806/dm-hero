import { getDb } from '../../utils/db'
import { createApiError, ErrorCodes } from '../../utils/errors'

export default defineEventHandler((event): { success: true } => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(id)) {
    throw createApiError({ statusCode: 400, code: ErrorCodes.VALIDATION_FAILED, message: 'invalid id' })
  }

  const db = getDb()

  // Soft-delete the folder and detach its entities (they fall back to root).
  // Child folders (phase 2) likewise become roots — ON DELETE SET NULL on
  // parent_folder_id only fires on hard-delete, so do it explicitly here.
  db.exec('BEGIN')
  try {
    db.prepare('UPDATE entities SET folder_id = NULL WHERE folder_id = ?').run(id)
    db.prepare('UPDATE entity_folders SET parent_folder_id = NULL WHERE parent_folder_id = ?').run(id)
    db.prepare('UPDATE entity_folders SET deleted_at = datetime(\'now\') WHERE id = ?').run(id)
    db.exec('COMMIT')
  }
  catch (err) {
    db.exec('ROLLBACK')
    throw err
  }

  return { success: true }
})
