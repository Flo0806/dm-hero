import { getDb } from '../../../utils/db'
import { createApiError, ErrorCodes } from '../../../utils/errors'
import type { ClimateZone } from '../../../../types/climate-zone'

interface PatchBody {
  name?: string
  color?: string | null
  icon?: string | null
}

export default defineEventHandler(async (event): Promise<ClimateZone> => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(id)) {
    throw createApiError({ statusCode: 400, code: ErrorCodes.VALIDATION_FAILED, message: 'invalid id' })
  }
  const body = await readBody<PatchBody>(event)

  const db = getDb()
  const existing = db.prepare(
    'SELECT id FROM climate_zones WHERE id = ? AND deleted_at IS NULL',
  ).get(id) as { id: number } | undefined
  if (!existing) {
    throw createApiError({ statusCode: 404, code: ErrorCodes.NOT_FOUND, message: 'zone not found' })
  }

  const updates: string[] = []
  const params: unknown[] = []
  if (body?.name !== undefined) {
    const trimmed = body.name.trim()
    if (!trimmed) {
      throw createApiError({ statusCode: 400, code: ErrorCodes.VALIDATION_FAILED, message: 'name empty' })
    }
    updates.push('name = ?')
    params.push(trimmed)
  }
  if (body?.color !== undefined) {
    updates.push('color = ?')
    params.push(body.color ?? null)
  }
  if (body?.icon !== undefined) {
    updates.push('icon = ?')
    params.push(body.icon ?? null)
  }

  if (updates.length > 0) {
    updates.push('updated_at = datetime(\'now\')')
    params.push(id)
    db.prepare(`UPDATE climate_zones SET ${updates.join(', ')} WHERE id = ?`).run(...params)
  }
  return db.prepare('SELECT * FROM climate_zones WHERE id = ?').get(id) as ClimateZone
})
