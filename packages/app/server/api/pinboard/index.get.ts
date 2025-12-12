import { getDb } from '~~/server/utils/db'
import type { PinboardDbRow, PinboardItem } from '~~/types/pinboard'

export default defineEventHandler(async (event): Promise<PinboardItem[]> => {
  const query = getQuery(event)
  const campaignId = Number(query.campaignId)

  if (!campaignId || isNaN(campaignId)) {
    throw createError({ statusCode: 400, message: 'Campaign ID is required' })
  }

  const db = getDb()

  // Get all pinned entities for this campaign with entity details
  const pins = db
    .prepare(
      `
      SELECT
        p.id as pin_id,
        p.display_order,
        p.created_at as pinned_at,
        e.id,
        e.name,
        e.description,
        e.image_url,
        e.metadata,
        et.name as type
      FROM pinboard p
      JOIN entities e ON p.entity_id = e.id
      JOIN entity_types et ON e.type_id = et.id
      WHERE p.campaign_id = ? AND e.deleted_at IS NULL
      ORDER BY p.display_order ASC, p.created_at ASC
    `,
    )
    .all(campaignId) as PinboardDbRow[]

  // Parse metadata for each pin
  const parsedPins: PinboardItem[] = pins.map((pin) => ({
    ...pin,
    type: pin.type as PinboardItem['type'],
    metadata: pin.metadata ? JSON.parse(pin.metadata) : {},
  }))

  return parsedPins
})
