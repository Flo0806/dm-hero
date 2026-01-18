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
  const entityPins = db
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
      WHERE p.campaign_id = ? AND e.deleted_at IS NULL AND p.entity_id IS NOT NULL
      ORDER BY p.display_order ASC, p.created_at ASC
    `,
    )
    .all(campaignId) as PinboardDbRow[]

  // Get all pinned groups for this campaign
  const groupPins = db
    .prepare(
      `
      SELECT
        p.id as pin_id,
        p.display_order,
        p.created_at as pinned_at,
        g.id,
        g.name,
        g.description,
        NULL as image_url,
        NULL as metadata,
        'group' as type,
        g.color,
        g.icon,
        (SELECT COUNT(*) FROM entity_group_members gm
         JOIN entities e ON e.id = gm.entity_id AND e.deleted_at IS NULL
         WHERE gm.group_id = g.id) as member_count
      FROM pinboard p
      JOIN entity_groups g ON p.group_id = g.id
      WHERE p.campaign_id = ? AND g.deleted_at IS NULL AND p.group_id IS NOT NULL
      ORDER BY p.display_order ASC, p.created_at ASC
    `,
    )
    .all(campaignId) as PinboardDbRow[]

  // Parse metadata for entity pins
  const parsedEntityPins: PinboardItem[] = entityPins.map((pin) => ({
    ...pin,
    type: pin.type as PinboardItem['type'],
    metadata: pin.metadata ? JSON.parse(pin.metadata) : {},
  }))

  // Parse group pins (no metadata to parse)
  // Explicitly set all fields to ensure correct types
  const parsedGroupPins: PinboardItem[] = groupPins.map((pin) => ({
    pin_id: pin.pin_id,
    display_order: pin.display_order,
    pinned_at: pin.pinned_at,
    id: pin.id,
    name: pin.name,
    description: pin.description,
    image_url: null,
    metadata: {},
    type: 'group' as const,
    color: pin.color || null,
    icon: pin.icon || null,
    member_count: pin.member_count || 0,
  }))

  // Combine and sort by display_order
  const allPins = [...parsedEntityPins, ...parsedGroupPins].sort((a, b) => {
    if (a.display_order !== b.display_order) {
      return a.display_order - b.display_order
    }
    return new Date(a.pinned_at).getTime() - new Date(b.pinned_at).getTime()
  })

  return allPins
})
