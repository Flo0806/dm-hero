import { getDb } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const factionId = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!factionId) {
    throw createError({
      statusCode: 400,
      message: 'Faction ID is required',
    })
  }

  const { npcId, membershipType, rank } = body as {
    npcId: number
    membershipType: string
    rank?: string
  }

  if (!npcId || !membershipType) {
    throw createError({
      statusCode: 400,
      message: 'NPC ID and membership type are required',
    })
  }

  // Create relation FROM NPC TO faction
  const notes = rank ? { rank } : null
  const result = db
    .prepare(
      `
    INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type, notes)
    VALUES (?, ?, ?, ?)
  `,
    )
    .run(npcId, factionId, membershipType, notes ? JSON.stringify(notes) : null)

  return { id: result.lastInsertRowid, success: true }
})
