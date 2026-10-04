import { getDb } from '~~/server/utils/db'
import { EMPTY_FOG, normalizeFog, type MapFog } from '~~/types/fog'

// Fog of war of a map (all covered until the DM reveals something)
export default defineEventHandler((event): MapFog => {
  const mapId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(mapId)) throw createError({ statusCode: 400, message: 'Invalid map id' })
  const row = getDb().prepare('SELECT fog FROM map_fog WHERE map_id = ?').get(mapId) as { fog: string } | undefined
  return row ? normalizeFog(JSON.parse(row.fog) as MapFog) : EMPTY_FOG
})
