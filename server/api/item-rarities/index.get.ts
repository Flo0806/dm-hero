import { getDb } from '../../utils/db'

export default defineEventHandler(async () => {
  const db = getDb()

  const itemRarities = db
    .prepare(
      `
    SELECT * FROM item_rarities
    WHERE deleted_at IS NULL
    ORDER BY
      CASE name
        WHEN 'common' THEN 1
        WHEN 'uncommon' THEN 2
        WHEN 'rare' THEN 3
        WHEN 'very_rare' THEN 4
        WHEN 'legendary' THEN 5
        WHEN 'artifact' THEN 6
        ELSE 99
      END ASC
  `,
    )
    .all()

  return itemRarities
})
