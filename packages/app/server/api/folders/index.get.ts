import { getDb } from '../../utils/db'
import { createApiError, ErrorCodes } from '../../utils/errors'
import { FOLDER_ENTITY_TYPES, type EntityFolderType, type EntityFolderWithCount } from '../../../types/folder'

export default defineEventHandler((event): EntityFolderWithCount[] => {
  const query = getQuery(event)
  const campaignId = Number(query.campaignId)
  const entityType = String(query.entityType ?? '') as EntityFolderType

  if (!Number.isFinite(campaignId) || campaignId <= 0) {
    throw createApiError({ statusCode: 400, code: ErrorCodes.CAMPAIGN_ID_REQUIRED })
  }
  if (!(FOLDER_ENTITY_TYPES as readonly string[]).includes(entityType)) {
    throw createApiError({ statusCode: 400, code: ErrorCodes.VALIDATION_FAILED, message: 'invalid entityType' })
  }

  const db = getDb()

  // Count via entity_id NOT NULL so soft-deleted entities don't inflate the
  // number. parent_folder_id ordering puts roots first; phase 2 caller can
  // build the tree from this flat list.
  return db.prepare(`
    SELECT
      f.id,
      f.campaign_id,
      f.entity_type,
      f.name,
      f.parent_folder_id,
      f.color,
      f.icon,
      f.easter_egg,
      f.created_at,
      f.updated_at,
      COUNT(e.id) AS entity_count
    FROM entity_folders f
    LEFT JOIN entities e ON e.folder_id = f.id AND e.deleted_at IS NULL
    WHERE f.campaign_id = ? AND f.entity_type = ? AND f.deleted_at IS NULL
    GROUP BY f.id
    ORDER BY f.name COLLATE NOCASE
  `).all(campaignId, entityType) as EntityFolderWithCount[]
})
