import type { SharedFileRef } from './share'

// Fog of war on a map shown to the players.
// Coordinates are percent of the map (x of width, y of height) like markers;
// the brush radius is percent of the map width.

export type FogMode = 'reveal' | 'cover'

/** One brush stroke - a single point is a dab */
export interface FogStroke {
  mode: FogMode
  radius: number
  points: Array<[number, number]>
}

export interface MapFog {
  /** Starting state before any stroke: everything covered or everything visible */
  base: 'covered' | 'clear'
  strokes: FogStroke[]
}

export const EMPTY_FOG: MapFog = { base: 'covered', strokes: [] }

/** Brush sizes offered in the toolbar (percent of map width) */
export const FOG_BRUSH_SIZES = { small: 1.5, medium: 4, large: 9 } as const
export type FogBrushSize = keyof typeof FOG_BRUSH_SIZES

/** Upper bounds - keeps a fog small enough to send live */
export const FOG_MAX_STROKES = 2000
export const FOG_MAX_POINTS = 2000

export function isMapFog(value: unknown): value is MapFog {
  const fog = value as MapFog
  if (!fog || (fog.base !== 'covered' && fog.base !== 'clear') || !Array.isArray(fog.strokes)) return false
  if (fog.strokes.length > FOG_MAX_STROKES) return false
  const isNum = (n: unknown) => typeof n === 'number' && Number.isFinite(n)
  return fog.strokes.every(s =>
    (s.mode === 'reveal' || s.mode === 'cover')
    && isNum(s.radius) && s.radius > 0 && s.radius <= 50
    && Array.isArray(s.points) && s.points.length > 0 && s.points.length <= FOG_MAX_POINTS
    && s.points.every(p => Array.isArray(p) && p.length === 2 && isNum(p[0]) && isNum(p[1])))
}

// ---------------------------------------------------------------------------
// Protocol to the player app (mirrored in packages/staging/app/utils/tableMap.ts)
// ---------------------------------------------------------------------------

/** The map shown to the players (slot "map") */
export interface TableMapContent {
  mapId: number
  name: string
  image: SharedFileRef
  width: number
  height: number
}

/** Its fog of war (slot "fog") - mapId ties it to the map, a mismatch means "all covered" */
export interface TableFogContent {
  mapId: number
  fog: MapFog
}

/** A ping on the shown map (encrypted content, percent coordinates) */
export interface TablePingContent {
  mapId: number
  x: number
  y: number
}

/** A ping as the DM sees it: who (player id, or 'dm') + where */
export interface TablePing extends TablePingContent {
  from: number | 'dm'
  name: string
}

export const isPingContent = (value: unknown): value is TablePingContent => {
  const p = value as TablePingContent
  const inMap = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100
  return !!p && Number.isInteger(p.mapId) && inMap(p.x) && inMap(p.y)
}
