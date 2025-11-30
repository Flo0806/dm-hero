import { getDb } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const npcId = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!npcId) {
    throw createError({
      statusCode: 400,
      message: 'NPC ID is required',
    })
  }

  const { itemId, relationType, quantity, equipped } = body as {
    itemId: number
    relationType: string
    quantity?: number
    equipped?: boolean
  }

  if (!itemId || !relationType) {
    throw createError({
      statusCode: 400,
      message: 'Item ID and relation type are required',
    })
  }

  // Create relation FROM NPC TO item
  const notes: Record<string, unknown> = {}
  if (quantity) notes.quantity = quantity
  if (equipped !== undefined) notes.equipped = equipped

  const result = db
    .prepare(
      `
    INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type, notes)
    VALUES (?, ?, ?, ?)
  `,
    )
    .run(npcId, itemId, relationType, Object.keys(notes).length > 0 ? JSON.stringify(notes) : null)

  return { id: result.lastInsertRowid, success: true }
})
