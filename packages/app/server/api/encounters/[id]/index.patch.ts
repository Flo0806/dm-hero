import { getDb } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Encounter ID is required',
    })
  }

  const { name, status, session_id, round, current_turn_index, finished_at } = body

  db.prepare(
    `
    UPDATE encounters
    SET
      name = COALESCE(?, name),
      status = COALESCE(?, status),
      session_id = ?,
      round = COALESCE(?, round),
      current_turn_index = COALESCE(?, current_turn_index),
      finished_at = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND deleted_at IS NULL
  `,
  ).run(
    name,
    status,
    session_id,
    round,
    current_turn_index,
    finished_at,
    id,
  )

  const encounter = db
    .prepare(
      `
    SELECT * FROM encounters WHERE id = ? AND deleted_at IS NULL
  `,
    )
    .get(id)

  if (!encounter) {
    throw createError({
      statusCode: 404,
      message: 'Encounter not found',
    })
  }

  return encounter
})
