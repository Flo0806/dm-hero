import { getDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const body = await readBody(event)

  const { campaignId, name, session_id } = body

  if (!campaignId || !name) {
    throw createError({
      statusCode: 400,
      message: 'Campaign ID and name are required',
    })
  }

  const result = db
    .prepare(
      `
    INSERT INTO encounters (campaign_id, session_id, name, status, round, current_turn_index)
    VALUES (?, ?, ?, 'setup', 0, 0)
  `,
    )
    .run(campaignId, session_id || null, name)

  const encounter = db
    .prepare(
      `
    SELECT
      id, campaign_id, session_id, name, status, round, current_turn_index,
      created_at, updated_at, finished_at
    FROM encounters
    WHERE id = ?
  `,
    )
    .get(result.lastInsertRowid)

  return encounter
})
