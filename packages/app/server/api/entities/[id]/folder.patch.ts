import { getDb } from '../../../utils/db'
import { createApiError, ErrorCodes } from '../../../utils/errors'
import { entityTypeToFolderType } from '../../../utils/folders'

interface Body {
  folder_id: number | null
}

export default defineEventHandler(async (event): Promise<{ id: number, folder_id: number | null }> => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(id)) {
    throw createApiError({ statusCode: 400, code: ErrorCodes.VALIDATION_FAILED, message: 'invalid id' })
  }
  const body = await readBody<Body>(event)
  // Require `folder_id` to be present in the payload — null is a valid
  // value (= remove from folder), but a missing key is a client bug we
  // shouldn't silently treat as "unassign".
  if (!body || !Object.hasOwn(body, 'folder_id')) {
    throw createApiError({ statusCode: 400, code: ErrorCodes.VALIDATION_FAILED, message: 'folder_id required' })
  }
  const targetFolderId = body.folder_id ?? null

  const db = getDb()
  const entity = db.prepare(
    'SELECT id, campaign_id, type_id FROM entities WHERE id = ? AND deleted_at IS NULL',
  ).get(id) as { id: number, campaign_id: number, type_id: number } | undefined
  if (!entity) {
    throw createApiError({ statusCode: 404, code: ErrorCodes.NOT_FOUND, message: 'entity not found' })
  }

  if (targetFolderId !== null) {
    // Folder must belong to the same campaign. We allow cross-type folder
    // assignment via entity_types lookup so we can validate it cheaply.
    const folder = db.prepare(
      'SELECT id, entity_type FROM entity_folders WHERE id = ? AND campaign_id = ? AND deleted_at IS NULL',
    ).get(targetFolderId, entity.campaign_id) as { id: number, entity_type: string } | undefined
    if (!folder) {
      throw createApiError({ statusCode: 400, code: ErrorCodes.VALIDATION_FAILED, message: 'invalid folder_id' })
    }
    const typeRow = db.prepare('SELECT name FROM entity_types WHERE id = ?').get(entity.type_id) as { name: string } | undefined
    const folderTypeKey = entityTypeToFolderType(typeRow?.name)
    if (!folderTypeKey || folder.entity_type !== folderTypeKey) {
      throw createApiError({ statusCode: 400, code: ErrorCodes.VALIDATION_FAILED, message: 'folder type mismatch' })
    }
  }

  db.prepare('UPDATE entities SET folder_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(targetFolderId, id)

  return { id, folder_id: targetFolderId }
})
