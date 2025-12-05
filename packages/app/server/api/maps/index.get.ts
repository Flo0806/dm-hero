import { getDb } from '~~/server/utils/db'
import type { CampaignMap } from '~~/types/map'

interface MapRow {
  id: number
  campaign_id: number
  name: string
  description: string | null
  image_url: string
  parent_map_id: number | null
  version_name: string | null
  default_zoom: number
  min_zoom: number
  max_zoom: number
  created_at: string
  updated_at: string
  deleted_at: string | null
  marker_count: number
}

export default defineEventHandler(async (event) => {
  const db = getDb()
  const query = getQuery(event)
  const campaignId = query.campaignId as string

  if (!campaignId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'campaignId is required',
    })
  }

  const maps = db
    .prepare(
      `
      SELECT
        m.*,
        (SELECT COUNT(*) FROM map_markers WHERE map_id = m.id) as marker_count
      FROM campaign_maps m
      WHERE m.campaign_id = ? AND m.deleted_at IS NULL
      ORDER BY m.name ASC
    `,
    )
    .all(Number(campaignId)) as MapRow[]

  return maps.map((m) => ({
    ...m,
    _markerCount: m.marker_count,
  })) as CampaignMap[]
})
