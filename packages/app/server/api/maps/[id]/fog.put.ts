import { getDb } from '~~/server/utils/db'
import { syncMapFog } from '~~/server/utils/share/map'
import { FOG_MAX_BYTES, isMapFog, normalizeFog } from '~~/types/fog'

// Saves the whole fog of a map (the DM paints, the client sends the new state)
export default defineEventHandler(async (event) => {
  const mapId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(mapId)) throw createError({ statusCode: 400, message: 'Invalid map id' })
  const fog = normalizeFog(await readBody(event))
  if (!isMapFog(fog)) throw createError({ statusCode: 400, message: 'Invalid fog' })
  // Must still fit the relay once encrypted
  if (JSON.stringify(fog).length > FOG_MAX_BYTES) throw createError({ statusCode: 413, message: 'Fog too large' })

  const db = getDb()
  if (!db.prepare('SELECT 1 FROM campaign_maps WHERE id = ? AND deleted_at IS NULL').get(mapId)) {
    throw createError({ statusCode: 404, message: 'Map not found' })
  }
  db.prepare(`
    INSERT INTO map_fog (map_id, fog, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(map_id) DO UPDATE SET fog = excluded.fog, updated_at = CURRENT_TIMESTAMP
  `).run(mapId, JSON.stringify({ base: fog.base, strokes: fog.strokes }))
  // Shown to players? They see the change right away
  await syncMapFog(db, mapId)
  return { success: true }
})
