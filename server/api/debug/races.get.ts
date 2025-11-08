import { getDb } from '../../utils/db'

export default defineEventHandler(async () => {
  const db = getDb()

  const races = db
    .prepare(
      `
    SELECT id, name, key, name_de, name_en, description
    FROM races
    WHERE deleted_at IS NULL
    ORDER BY name ASC
  `,
    )
    .all()

  return races
})
