import { getDb } from '~~/server/utils/db'
import type { CampaignMap, CreateMapPayload } from '~~/types/map'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const body = await readBody<CreateMapPayload & { campaignId: number }>(event)

  if (!body.name || !body.campaignId || !body.image_url) {
    throw createError({
      statusCode: 400,
      statusMessage: 'name, campaignId, and image_url are required',
    })
  }

  const result = db
    .prepare(
      `
      INSERT INTO campaign_maps (
        campaign_id, name, description, image_url,
        parent_map_id, version_name,
        default_zoom, min_zoom, max_zoom
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .run(
      body.campaignId,
      body.name,
      body.description || null,
      body.image_url,
      body.parent_map_id || null,
      body.version_name || null,
      body.default_zoom ?? 1.0,
      body.min_zoom ?? 0.5,
      body.max_zoom ?? 3.0,
    )

  const map = db
    .prepare('SELECT * FROM campaign_maps WHERE id = ?')
    .get(result.lastInsertRowid) as CampaignMap

  return map
})
