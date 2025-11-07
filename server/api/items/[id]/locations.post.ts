import { getDb } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const itemId = getRouterParam(event, 'id')

  if (!itemId) {
    throw createError({
      statusCode: 400,
      message: 'Item ID is required',
    })
  }

  const body = await readBody(event)
  const { locationId, relationType, quantity } = body as {
    locationId: number
    relationType: string
    quantity?: number
  }

  if (!locationId || !relationType) {
    throw createError({
      statusCode: 400,
      message: 'Location ID and relation type are required',
    })
  }

  // Create relation FROM Location TO item
  const notes: Record<string, unknown> = {}
  if (quantity) notes.quantity = quantity

  const result = db
    .prepare(
      `
    INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type, notes)
    VALUES (?, ?, ?, ?)
  `,
    )
    .run(
      locationId,
      itemId,
      relationType,
      Object.keys(notes).length > 0 ? JSON.stringify(notes) : null,
    )

  return {
    id: result.lastInsertRowid,
    from_entity_id: locationId,
    to_entity_id: Number(itemId),
    relation_type: relationType,
    notes: Object.keys(notes).length > 0 ? notes : null,
  }
})
