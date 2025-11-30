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

  const { locationId, relationType, notes } = body as {
    locationId: number
    relationType: string
    notes?: Record<string, unknown>
  }

  if (!locationId || !relationType) {
    throw createError({
      statusCode: 400,
      message: 'Location ID and relation type are required',
    })
  }

  // Create relation FROM faction TO location
  const result = db
    .prepare(
      `
    INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type, notes)
    VALUES (?, ?, ?, ?)
  `,
    )
    .run(factionId, locationId, relationType, notes ? JSON.stringify(notes) : null)

  return { id: result.lastInsertRowid, success: true }
})
