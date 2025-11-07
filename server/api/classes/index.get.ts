import { getDb } from '../../utils/db'

export default defineEventHandler(async () => {
  const db = getDb()

  const classes = db
    .prepare(
      `
    SELECT * FROM classes
    WHERE deleted_at IS NULL
    ORDER BY name ASC
  `,
    )
    .all()

  return classes
})
