import { getDb } from '../../utils/db'

export default defineEventHandler(async () => {
  const db = getDb()

  const races = db
    .prepare(
      `
    SELECT * FROM races
    WHERE deleted_at IS NULL
    ORDER BY name ASC
  `,
    )
    .all()

  return races
})
