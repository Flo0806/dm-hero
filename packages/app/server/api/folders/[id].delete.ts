import { getDb } from '../../utils/db'
import { createApiError, ErrorCodes } from '../../utils/errors'

export default defineEventHandler((event): { success: true } => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(id)) {
    throw createApiError({ statusCode: 400, code: ErrorCodes.VALIDATION_FAILED, message: 'invalid id' })
  }

  const db = getDb()

  // Phase 1 UI only creates root-level folders, but the schema (and POST
  // endpoint) accept arbitrary parent_folder_id. To stay correct under that
  // future, soft-delete the WHOLE subtree rooted at `id` and detach every
  // entity that lived in any folder of the subtree. A recursive CTE walks the
  // tree in one statement; `ON DELETE SET NULL` only fires on hard-delete so
  // we mirror it manually.
  db.exec('BEGIN')
  try {
    const subtreeCte = `
      WITH RECURSIVE folder_subtree(id) AS (
        SELECT id FROM entity_folders WHERE id = ?
        UNION ALL
        SELECT f.id FROM entity_folders f
        JOIN folder_subtree s ON f.parent_folder_id = s.id
        WHERE f.deleted_at IS NULL
      )
    `
    db.prepare(
      `${subtreeCte} UPDATE entities SET folder_id = NULL WHERE folder_id IN (SELECT id FROM folder_subtree)`,
    ).run(id)
    db.prepare(
      `${subtreeCte} UPDATE entity_folders SET deleted_at = datetime('now') WHERE id IN (SELECT id FROM folder_subtree)`,
    ).run(id)
    db.exec('COMMIT')
  }
  catch (err) {
    db.exec('ROLLBACK')
    throw err
  }

  return { success: true }
})
