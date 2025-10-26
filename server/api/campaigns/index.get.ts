import { getDb } from '../../utils/db'

export default defineEventHandler(() => {
  const db = getDb()

  // Get all non-deleted campaigns
  const campaigns = db.prepare(`
    SELECT
      id,
      name,
      description,
      created_at,
      updated_at
    FROM campaigns
    WHERE deleted_at IS NULL
    ORDER BY updated_at DESC
  `).all()

  return campaigns
})
