import { getDb } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const itemId = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!itemId) {
    throw createError({
      statusCode: 400,
      message: 'Item ID is required',
    })
  }

  const { npcId, relationType, quantity, equipped } = body as {
    npcId: number
    relationType: string
    quantity?: number
    equipped?: boolean
  }

  if (!npcId || !relationType) {
    throw createError({
      statusCode: 400,
      message: 'NPC ID and relation type are required',
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
