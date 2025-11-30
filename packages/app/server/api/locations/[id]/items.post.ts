import { getDb } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const locationId = getRouterParam(event, 'id')

  if (!locationId) {
    throw createError({
      statusCode: 400,
      message: 'Location ID is required',
    })
  }

  const body = await readBody(event)
  const { itemId, relationType, quantity } = body as {
    itemId: number
    relationType: string
    quantity?: number
  }

  if (!itemId || !relationType) {
    throw createError({
      statusCode: 400,
      message: 'Item ID and relation type are required',
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
    from_entity_id: Number(locationId),
    to_entity_id: itemId,
    relation_type: relationType,
    notes: Object.keys(notes).length > 0 ? notes : null,
  }
})
