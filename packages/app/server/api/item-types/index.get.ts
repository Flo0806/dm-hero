import { getDb } from '../../utils/db'

export default defineEventHandler(async () => {
  const db = getDb()

  const itemTypes = db
    .prepare(
      `
    SELECT * FROM item_types
    WHERE deleted_at IS NULL
    ORDER BY name ASC
  `,
    )
    .all()

  return itemTypes
})
