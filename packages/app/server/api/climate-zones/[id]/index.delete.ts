import { getDb } from '../../../utils/db'
import { createApiError, ErrorCodes } from '../../../utils/errors'

export default defineEventHandler((event): { success: true } => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(id)) {
    throw createApiError({ statusCode: 400, code: ErrorCodes.VALIDATION_FAILED, message: 'invalid id' })
  }

  const db = getDb()
  // Soft-delete the zone. If it was the active zone of any campaign, clear
  // the pointer so the generator falls back to legacy behaviour next tick.
  // Profiles stay attached via FK — they're harmless on a soft-deleted zone.
  db.exec('BEGIN')
  try {
    db.prepare('UPDATE campaigns SET active_climate_zone_id = NULL WHERE active_climate_zone_id = ?').run(id)
    db.prepare('UPDATE climate_zones SET deleted_at = datetime(\'now\') WHERE id = ?').run(id)
    db.exec('COMMIT')
  }
  catch (err) {
    db.exec('ROLLBACK')
    throw err
  }

  return { success: true }
})
