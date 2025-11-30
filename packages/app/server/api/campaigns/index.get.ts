import { getDb } from '../../utils/db'
import type { CampaignRow } from '../../types/database'

export default defineEventHandler(() => {
  const db = getDb()

  // Get all non-deleted campaigns
  const campaigns = db
    .prepare<unknown[], CampaignRow>(
      `
    SELECT
      id,
      name,
      description,
      created_at,
      updated_at
    FROM campaigns
    WHERE deleted_at IS NULL
    ORDER BY updated_at DESC
  `,
    )
    .all()

  return campaigns
})
