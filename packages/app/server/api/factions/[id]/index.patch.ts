import { getDb } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Faction ID is required',
    })
  }

  const { name, description, metadata } = body as {
    name?: string
    description?: string
    metadata?: Record<string, string | number | boolean | null>
  }

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
  ).run(name, description, metadata ? JSON.stringify(metadata) : null, id)

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

  const faction = db
    .prepare<unknown[], DbEntity>(
      `
    SELECT * FROM entities WHERE id = ? AND deleted_at IS NULL
  `,
    )
    .get(id)

  if (!faction) {
    throw createError({
      statusCode: 404,
      message: 'Faction not found',
    })
  }

  return {
    ...faction,
    metadata: faction.metadata ? JSON.parse(faction.metadata) : null,
  }
})
