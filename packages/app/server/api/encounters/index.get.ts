import { getDb } from '../../utils/db'

interface EncounterRow {
  id: number
  campaign_id: number
  session_id: number | null
  name: string
  status: string
  round: number
  current_turn_index: number
  created_at: string
  updated_at: string
  finished_at: string | null
  _participantCount: number
}

export default defineEventHandler((event) => {
  const db = getDb()
  const query = getQuery(event)
  const campaignId = query.campaignId as string

  if (!campaignId) {
    throw createError({
      statusCode: 400,
      message: 'Campaign ID is required',
    })
  }

  const encounters = db
    .prepare(
      `
    SELECT
      e.id,
      e.campaign_id,
      e.session_id,
      e.name,
      e.status,
      e.round,
      e.current_turn_index,
      e.created_at,
      e.updated_at,
      e.finished_at,
      (SELECT COUNT(*) FROM encounter_participants WHERE encounter_id = e.id) as _participantCount
    FROM encounters e
    WHERE e.campaign_id = ?
      AND e.deleted_at IS NULL
    ORDER BY e.updated_at DESC
  `,
    )
    .all(campaignId) as EncounterRow[]

  return encounters
})
