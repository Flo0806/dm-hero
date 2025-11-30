import { getDb } from '../../utils/db'
import { convertMetadataToKeys } from '../../utils/i18n-lookup'
import type { NpcMetadata } from '../../../types/npc'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const body = await readBody(event)

  const { name, description, metadata, campaignId } = body as {
    name: string
    description?: string
    metadata?: NpcMetadata
    campaignId: number
  }

  if (!name || !campaignId) {
    throw createError({
      statusCode: 400,
      message: 'Name and Campaign ID are required',
    })
  }

  // Get NPC entity type ID
  const entityType = db
    .prepare<unknown[], { id: number }>('SELECT id FROM entity_types WHERE name = ?')
    .get('NPC')

  if (!entityType) {
    throw createError({
      statusCode: 500,
      message: 'NPC entity type not found',
    })
  }

  // Convert localized race/class names to keys before saving
  const metadataWithKeys = await convertMetadataToKeys(metadata, 'npc')

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
      metadataWithKeys ? JSON.stringify(metadataWithKeys) : null,
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

  const npc = db
    .prepare<unknown[], DbEntity>(
      `
    SELECT * FROM entities WHERE id = ?
  `,
    )
    .get(result.lastInsertRowid)

  if (!npc) {
    throw createError({
      statusCode: 500,
      message: 'Failed to create NPC',
    })
  }

  return {
    ...npc,
    metadata: npc.metadata ? (JSON.parse(npc.metadata) as NpcMetadata) : null,
  }
})
