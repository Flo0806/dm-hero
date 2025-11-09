import { getDb } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const npcId = getRouterParam(event, 'id')

  if (!npcId) {
    throw createError({
      statusCode: 400,
      message: 'NPC ID is required',
    })
  }

  interface DbItem {
    id: number
    from_entity_id: number
    to_entity_id: number
    relation_type: string
    notes: string | null
    created_at: string
    item_name: string
    item_description: string | null
    item_metadata: string | null
    item_image_url: string | null
  }

  // Get the Item entity type ID
  const itemTypeId = db.prepare("SELECT id FROM entity_types WHERE name = 'Item'").get() as
    | { id: number }
    | undefined

  if (!itemTypeId) {
    throw createError({
      statusCode: 500,
      message: 'Item entity type not found',
    })
  }

  // Get all Items that this NPC has a relation TO
  const items = db
    .prepare<unknown[], DbItem>(
      `
    SELECT
      er.id,
      er.from_entity_id,
      er.to_entity_id,
      er.relation_type,
      er.notes,
      er.created_at,
      e.name as item_name,
      e.description as item_description,
      e.metadata as item_metadata,
      e.image_url as item_image_url
    FROM entity_relations er
    INNER JOIN entities e ON er.to_entity_id = e.id
    WHERE er.from_entity_id = ?
      AND e.type_id = ?
      AND e.deleted_at IS NULL
    ORDER BY e.name ASC
  `,
    )
    .all(npcId, itemTypeId.id)

  return items.map((item) => {
    const parsedNotes = item.notes ? JSON.parse(item.notes) : null
    const metadata = item.item_metadata ? JSON.parse(item.item_metadata) : null

    return {
      id: item.to_entity_id,
      relation_id: item.id, // Keep relation ID for editing/deleting
      name: item.item_name,
      description: item.item_description,
      relation_type: item.relation_type,
      quantity: parsedNotes?.quantity || null,
      equipped: parsedNotes?.equipped || false,
      image_url: item.item_image_url,
      rarity: metadata?.rarity || null,
    }
  })
})
