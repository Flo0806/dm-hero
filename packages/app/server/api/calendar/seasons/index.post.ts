import { getDb } from '../../../utils/db'

interface SeasonInput {
  campaignId: number
  name: string
  startMonth: number
  startDay: number
  backgroundImage?: string | null
  color?: string | null
  icon?: string | null
  sortOrder?: number
  weatherType?: string // 'winter' | 'spring' | 'summer' | 'autumn'
}

export default defineEventHandler(async (event) => {
  const db = getDb()
  const body = await readBody<SeasonInput>(event)

  if (!body.campaignId || !body.name || body.startMonth === undefined || body.startDay === undefined) {
    throw createError({
      statusCode: 400,
      message: 'Campaign ID, name, start month, and start day are required',
    })
  }

  const result = db
    .prepare(
      `
    INSERT INTO calendar_seasons (campaign_id, name, start_month, start_day, background_image, color, icon, sort_order, weather_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    )
    .run(
      body.campaignId,
      body.name,
      body.startMonth,
      body.startDay,
      body.backgroundImage || null,
      body.color || null,
      body.icon || null,
      body.sortOrder ?? 0,
      body.weatherType || 'summer',
    )

  return {
    success: true,
    id: result.lastInsertRowid,
  }
})
