import { getDb } from '../../../utils/db'
import { createApiError, ErrorCodes } from '../../../utils/errors'

interface Body {
  zone_id: number | null
}

/**
 * Set or clear `campaigns.active_climate_zone_id`. The weather generator
 * consults this to decide whether to use a zone profile or the legacy
 * season-only behaviour. `null` clears the pointer.
 */
export default defineEventHandler(async (event): Promise<{ active_climate_zone_id: number | null }> => {
  const campaignId = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(campaignId) || campaignId <= 0) {
    throw createApiError({ statusCode: 400, code: ErrorCodes.CAMPAIGN_ID_REQUIRED })
  }
  const body = await readBody<Body>(event)
  if (!body || !Object.hasOwn(body, 'zone_id')) {
    throw createApiError({ statusCode: 400, code: ErrorCodes.VALIDATION_FAILED, message: 'zone_id required' })
  }
  const zoneId = body.zone_id

  const db = getDb()
  if (zoneId !== null) {
    const zone = db.prepare(
      'SELECT id FROM climate_zones WHERE id = ? AND campaign_id = ? AND deleted_at IS NULL',
    ).get(zoneId, campaignId) as { id: number } | undefined
    if (!zone) {
      throw createApiError({ statusCode: 400, code: ErrorCodes.VALIDATION_FAILED, message: 'invalid zone for this campaign' })
    }
  }

  db.prepare('UPDATE campaigns SET active_climate_zone_id = ? WHERE id = ?').run(zoneId, campaignId)
  return { active_climate_zone_id: zoneId }
})
