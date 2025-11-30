import { getDb } from '../../utils/db'
import { convertMetadataToKeys } from '../../utils/i18n-lookup'
import type { ItemMetadata } from '../../../types/item'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const body = await readBody(event)

  const { name, description, metadata, campaignId } = body as {
    name: string
    description?: string
    metadata?: ItemMetadata
    campaignId: number
  }

  if (!name || !campaignId) {
    throw createError({
      statusCode: 400,
      message: 'Name and Campaign ID are required',
    })
  }

  // Get Item entity type ID
  const entityType = db
    .prepare<unknown[], { id: number }>('SELECT id FROM entity_types WHERE name = ?')
    .get('Item')

  if (!entityType) {
    throw createError({
      statusCode: 500,
      message: 'Item entity type not found',
    })
  }

  // Convert localized type/rarity names to keys (e.g., "waffe" → "weapon")
  const convertedMetadata = metadata ? await convertMetadataToKeys(metadata, 'item') : null

  const result = db
    .prepare(
      `
    INSERT INTO entities (type_id, campaign_id, name, description, metadata)
    VALUES (?, ?, ?, ?, ?)
  `,
    )
    .run(
      entityType.id,
      campaignId,
      name,
      description || null,
      convertedMetadata ? JSON.stringify(convertedMetadata) : null,
    )

  interface DbEntity {
    id: number
    type_id: number
    campaign_id: number
    name: string
    description: string | null
    metadata: string | null
    created_at: string
    updated_at: string
    deleted_at: string | null
  }

  const item = db
    .prepare<unknown[], DbEntity>(
      `
    SELECT * FROM entities WHERE id = ?
  `,
    )
    .get(result.lastInsertRowid)

  if (!item) {
    throw createError({
      statusCode: 500,
      message: 'Failed to create item',
    })
  }

  return {
    ...item,
    metadata: item.metadata ? (JSON.parse(item.metadata) as ItemMetadata) : null,
  }
})
