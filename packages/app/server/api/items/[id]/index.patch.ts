import { getDb } from '../../../utils/db'
import { convertMetadataToKeys } from '../../../utils/i18n-lookup'
import type { ItemMetadata } from '~~/types/item'
import type { EntityRow } from '../../../types/database'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Item ID is required',
    })
  }

  const { name, description, metadata } = body as {
    name?: string
    description?: string
    metadata?: ItemMetadata
  }

  // Convert localized type/rarity names to keys (e.g., "waffe" → "weapon")
  const convertedMetadata = metadata ? await convertMetadataToKeys(metadata, 'item') : null

  db.prepare(
    `
    UPDATE entities
    SET
      name = COALESCE(?, name),
      description = COALESCE(?, description),
      metadata = COALESCE(?, metadata),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND deleted_at IS NULL
  `,
  ).run(name, description, convertedMetadata ? JSON.stringify(convertedMetadata) : null, id)

  const item = db
    .prepare<[string], EntityRow>(
      `
    SELECT * FROM entities WHERE id = ? AND deleted_at IS NULL
  `,
    )
    .get(id)

  if (!item) {
    throw createError({
      statusCode: 404,
      message: 'Item not found',
    })
  }

  return {
    ...item,
    metadata: item.metadata ? JSON.parse(item.metadata as string) : null,
  }
})
