import { getDb } from '../../../utils/db'

interface SeasonInput {
  name?: string
  startMonth?: number
  startDay?: number
  backgroundImage?: string | null
  color?: string | null
  icon?: string | null
  sortOrder?: number
  weatherType?: string // 'winter' | 'spring' | 'summer' | 'autumn'
}

export default defineEventHandler(async (event) => {
  const db = getDb()
  const id = getRouterParam(event, 'id')
  const body = await readBody<SeasonInput>(event)

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Season ID is required',
    })
  }

  const updates: string[] = []
  const values: (string | number | null)[] = []

  if (body.name !== undefined) {
    updates.push('name = ?')
    values.push(body.name)
  }
  if (body.startMonth !== undefined) {
    updates.push('start_month = ?')
    values.push(body.startMonth)
  }
  if (body.startDay !== undefined) {
    updates.push('start_day = ?')
    values.push(body.startDay)
  }
  if (body.backgroundImage !== undefined) {
    updates.push('background_image = ?')
    values.push(body.backgroundImage)
  }
  if (body.color !== undefined) {
    updates.push('color = ?')
    values.push(body.color)
  }
  if (body.icon !== undefined) {
    updates.push('icon = ?')
    values.push(body.icon)
  }
  if (body.sortOrder !== undefined) {
    updates.push('sort_order = ?')
    values.push(body.sortOrder)
  }
  if (body.weatherType !== undefined) {
    updates.push('weather_type = ?')
    values.push(body.weatherType)
  }

  if (updates.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'No fields to update',
    })
  }

  updates.push('updated_at = CURRENT_TIMESTAMP')
  values.push(Number(id))

  db.prepare(
    `
    UPDATE calendar_seasons
    SET ${updates.join(', ')}
    WHERE id = ?
  `,
  ).run(...values)

  return { success: true }
})
