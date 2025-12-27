import { getDb } from '../../utils/db'
import { copyFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join, dirname, basename, extname } from 'path'
import { getUploadPath } from '../../utils/paths'

interface CopyRequest {
  entityIds: number[]
  targetCampaignId: number
  mode: 'skip' | 'update' | 'duplicate'
}

interface EntityRow {
  id: number
  type_id: number
  campaign_id: number
  name: string
  description: string | null
  metadata: string | null
  image_url: string | null
  location_id: number | null
  parent_entity_id: number | null
  source_entity_id: number | null
}

interface RelationRow {
  id: number
  from_entity_id: number
  to_entity_id: number
  relation_type: string
  notes: string | null
}

interface DocumentRow {
  id: number
  entity_id: number
  title: string
  content: string | null
  file_path: string | null
  file_type: string
  date: string | null
  sort_order: number
}

interface ImageRow {
  id: number
  entity_id: number
  image_url: string
  caption: string | null
  is_primary: number
  display_order: number
}

interface ExistingCopy {
  id: number
  source_entity_id: number
  name: string
  type_name: string
}

interface CopyResult {
  success: boolean
  stats: {
    entitiesCopied: number
    entitiesSkipped: number
    entitiesUpdated: number
    relationsCopied: number
    documentsCopied: number
    imagesCopied: number
  }
  duplicates?: ExistingCopy[]
  requiresConfirmation?: boolean
}

export default defineEventHandler(async (event): Promise<CopyResult> => {
  const db = getDb()
  const body = await readBody<CopyRequest>(event)

  const { entityIds, targetCampaignId, mode } = body

  // Validate input
  if (!entityIds || !Array.isArray(entityIds) || entityIds.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'entityIds must be a non-empty array',
    })
  }

  if (!targetCampaignId || typeof targetCampaignId !== 'number') {
    throw createError({
      statusCode: 400,
      message: 'targetCampaignId is required',
    })
  }

  if (!['skip', 'update', 'duplicate'].includes(mode)) {
    throw createError({
      statusCode: 400,
      message: "mode must be 'skip', 'update', or 'duplicate'",
    })
  }

  // Check target campaign exists
  const campaign = db.prepare('SELECT id FROM campaigns WHERE id = ? AND deleted_at IS NULL').get(targetCampaignId)
  if (!campaign) {
    throw createError({
      statusCode: 404,
      message: 'Target campaign not found',
    })
  }

  // Fetch source entities
  const placeholders = entityIds.map(() => '?').join(',')
  const sourceEntities = db
    .prepare<unknown[], EntityRow>(
      `
      SELECT e.*, et.name as type_name
      FROM entities e
      JOIN entity_types et ON e.type_id = et.id
      WHERE e.id IN (${placeholders}) AND e.deleted_at IS NULL
    `,
    )
    .all(...entityIds) as (EntityRow & { type_name: string })[]

  if (sourceEntities.length === 0) {
    throw createError({
      statusCode: 404,
      message: 'No valid entities found',
    })
  }

  // Check for existing copies in target campaign
  const sourceIds = sourceEntities.map((e) => e.id)
  const sourceIdsPlaceholders = sourceIds.map(() => '?').join(',')

  const existingCopies = db
    .prepare<unknown[], ExistingCopy>(
      `
      SELECT e.id, e.source_entity_id, e.name, et.name as type_name
      FROM entities e
      JOIN entity_types et ON e.type_id = et.id
      WHERE e.campaign_id = ?
        AND e.source_entity_id IN (${sourceIdsPlaceholders})
        AND e.deleted_at IS NULL
    `,
    )
    .all(targetCampaignId, ...sourceIds) as ExistingCopy[]

  // Also check if any source entity was itself a copy and already exists
  const originalSourceIds = sourceEntities.filter((e) => e.source_entity_id).map((e) => e.source_entity_id)
  let copiesOfSameOriginal: ExistingCopy[] = []
  if (originalSourceIds.length > 0) {
    const origPlaceholders = originalSourceIds.map(() => '?').join(',')
    copiesOfSameOriginal = db
      .prepare<unknown[], ExistingCopy>(
        `
        SELECT e.id, e.source_entity_id, e.name, et.name as type_name
        FROM entities e
        JOIN entity_types et ON e.type_id = et.id
        WHERE e.campaign_id = ?
          AND e.source_entity_id IN (${origPlaceholders})
          AND e.deleted_at IS NULL
      `,
      )
      .all(targetCampaignId, ...originalSourceIds) as ExistingCopy[]
  }

  const allExistingCopies = [...existingCopies, ...copiesOfSameOriginal]
  const existingSourceIds = new Set(allExistingCopies.map((c) => c.source_entity_id))

  // If we have duplicates and mode wasn't explicitly chosen, return for confirmation
  if (allExistingCopies.length > 0 && mode === 'skip') {
    // Return duplicates info for UI to show
    return {
      success: true,
      stats: {
        entitiesCopied: 0,
        entitiesSkipped: allExistingCopies.length,
        entitiesUpdated: 0,
        relationsCopied: 0,
        documentsCopied: 0,
        imagesCopied: 0,
      },
      duplicates: allExistingCopies,
      requiresConfirmation: true,
    }
  }

  // Begin transaction
  const stats = {
    entitiesCopied: 0,
    entitiesSkipped: 0,
    entitiesUpdated: 0,
    relationsCopied: 0,
    documentsCopied: 0,
    imagesCopied: 0,
  }

  // Map old IDs to new IDs for relation copying
  const idMapping = new Map<number, number>()

  db.exec('BEGIN TRANSACTION')

  try {
    const uploadsPath = getUploadPath()

    for (const entity of sourceEntities) {
      // Determine the original source ID for tracking
      const originalSourceId = entity.source_entity_id || entity.id

      // Check if this entity already exists as a copy
      const isDuplicate = existingSourceIds.has(originalSourceId)

      if (isDuplicate) {
        if (mode === 'skip') {
          stats.entitiesSkipped++
          // Still add to mapping so relations work
          const existingCopy = allExistingCopies.find((c) => c.source_entity_id === originalSourceId)
          if (existingCopy) {
            idMapping.set(entity.id, existingCopy.id)
          }
          continue
        } else if (mode === 'update') {
          // Find and update existing copy
          const existingCopy = allExistingCopies.find((c) => c.source_entity_id === originalSourceId)
          if (existingCopy) {
            // Copy image if different
            let newImageUrl = entity.image_url
            if (entity.image_url) {
              newImageUrl = await copyEntityImage(uploadsPath, entity.image_url, targetCampaignId)
            }

            db.prepare(
              `
              UPDATE entities
              SET name = ?, description = ?, metadata = ?, image_url = ?,
                  location_id = ?, parent_entity_id = ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `,
            ).run(entity.name, entity.description, entity.metadata, newImageUrl, null, null, existingCopy.id)

            idMapping.set(entity.id, existingCopy.id)
            stats.entitiesUpdated++
            continue
          }
        }
        // mode === 'duplicate' - fall through to create new
      }

      // Copy entity image if exists
      let newImageUrl = entity.image_url
      if (entity.image_url) {
        newImageUrl = await copyEntityImage(uploadsPath, entity.image_url, targetCampaignId)
        if (newImageUrl !== entity.image_url) {
          stats.imagesCopied++
        }
      }

      // Insert new entity
      const result = db
        .prepare(
          `
        INSERT INTO entities (
          type_id, campaign_id, name, description, metadata, image_url,
          location_id, parent_entity_id, source_entity_id,
          created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `,
        )
        .run(
          entity.type_id,
          targetCampaignId,
          entity.name,
          entity.description,
          entity.metadata,
          newImageUrl,
          originalSourceId,
        )

      const newEntityId = Number(result.lastInsertRowid)
      idMapping.set(entity.id, newEntityId)
      stats.entitiesCopied++

      // Copy entity images (gallery)
      const entityImages = db
        .prepare<unknown[], ImageRow>('SELECT * FROM entity_images WHERE entity_id = ?')
        .all(entity.id) as ImageRow[]

      for (const img of entityImages) {
        const newImgUrl = await copyEntityImage(uploadsPath, img.image_url, targetCampaignId)
        db.prepare(
          `
          INSERT INTO entity_images (entity_id, image_url, caption, is_primary, display_order)
          VALUES (?, ?, ?, ?, ?)
        `,
        ).run(newEntityId, newImgUrl, img.caption, img.is_primary, img.display_order)
        stats.imagesCopied++
      }

      // Copy entity documents
      const entityDocs = db
        .prepare<unknown[], DocumentRow>('SELECT * FROM entity_documents WHERE entity_id = ?')
        .all(entity.id) as DocumentRow[]

      for (const doc of entityDocs) {
        let newFilePath = doc.file_path
        if (doc.file_path) {
          newFilePath = await copyEntityDocument(uploadsPath, doc.file_path, targetCampaignId)
        }

        db.prepare(
          `
          INSERT INTO entity_documents (entity_id, title, content, file_path, file_type, date, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        ).run(newEntityId, doc.title, doc.content, newFilePath, doc.file_type, doc.date, doc.sort_order)
        stats.documentsCopied++
      }
    }

    // Copy relations (only between copied entities)
    if (idMapping.size > 1) {
      const copiedSourceIds = Array.from(idMapping.keys())
      const relPlaceholders = copiedSourceIds.map(() => '?').join(',')

      const relations = db
        .prepare<unknown[], RelationRow>(
          `
        SELECT * FROM entity_relations
        WHERE from_entity_id IN (${relPlaceholders})
          AND to_entity_id IN (${relPlaceholders})
      `,
        )
        .all(...copiedSourceIds, ...copiedSourceIds) as RelationRow[]

      for (const rel of relations) {
        const newFromId = idMapping.get(rel.from_entity_id)
        const newToId = idMapping.get(rel.to_entity_id)

        if (newFromId && newToId) {
          // Check if relation already exists (for update mode)
          const existingRel = db
            .prepare(
              `
            SELECT id FROM entity_relations
            WHERE from_entity_id = ? AND to_entity_id = ? AND relation_type = ?
          `,
            )
            .get(newFromId, newToId, rel.relation_type)

          if (!existingRel) {
            db.prepare(
              `
              INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type, notes)
              VALUES (?, ?, ?, ?)
            `,
            ).run(newFromId, newToId, rel.relation_type, rel.notes)
            stats.relationsCopied++
          }
        }
      }
    }

    db.exec('COMMIT')

    return {
      success: true,
      stats,
    }
  } catch (error) {
    db.exec('ROLLBACK')
    console.error('Copy to campaign failed:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to copy entities',
    })
  }
})

/**
 * Copy an entity image to a new campaign folder
 */
async function copyEntityImage(
  uploadsPath: string,
  imagePath: string,
  targetCampaignId: number,
): Promise<string> {
  if (!imagePath) return imagePath

  // Image paths are like: campaigns/1/entities/npc-123.png
  const sourcePath = join(uploadsPath, imagePath)
  if (!existsSync(sourcePath)) {
    return imagePath // Keep original path if file doesn't exist
  }

  // Create new path: campaigns/{targetCampaignId}/entities/{filename}
  const filename = basename(imagePath)
  const ext = extname(filename)
  const nameWithoutExt = filename.slice(0, -ext.length)
  const newFilename = `${nameWithoutExt}-copy-${Date.now()}${ext}`

  const newRelativePath = `campaigns/${targetCampaignId}/entities/${newFilename}`
  const newFullPath = join(uploadsPath, newRelativePath)

  // Ensure directory exists
  await mkdir(dirname(newFullPath), { recursive: true })

  // Copy file
  await copyFile(sourcePath, newFullPath)

  return newRelativePath
}

/**
 * Copy an entity document to a new campaign folder
 */
async function copyEntityDocument(
  uploadsPath: string,
  docPath: string,
  targetCampaignId: number,
): Promise<string> {
  if (!docPath) return docPath

  const sourcePath = join(uploadsPath, docPath)
  if (!existsSync(sourcePath)) {
    return docPath
  }

  const filename = basename(docPath)
  const ext = extname(filename)
  const nameWithoutExt = filename.slice(0, -ext.length)
  const newFilename = `${nameWithoutExt}-copy-${Date.now()}${ext}`

  const newRelativePath = `campaigns/${targetCampaignId}/documents/${newFilename}`
  const newFullPath = join(uploadsPath, newRelativePath)

  await mkdir(dirname(newFullPath), { recursive: true })
  await copyFile(sourcePath, newFullPath)

  return newRelativePath
}
