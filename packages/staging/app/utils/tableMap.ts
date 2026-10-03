// The map the DM shows + its fog of war, as it arrives (decrypted) from DM Hero.
// Mirrors packages/app/types/fog.ts - this is the protocol between both apps.

export interface FogStroke {
  mode: 'reveal' | 'cover'
  /** Percent of the map width */
  radius: number
  /** Percent of the map (x of width, y of height) */
  points: Array<[number, number]>
}

export interface MapFog {
  base: 'covered' | 'clear'
  strokes: FogStroke[]
}

export interface TableMapContent {
  mapId: number
  name: string
  image: SharedFileRef
  width: number
  height: number
}

export interface TableFogContent {
  mapId: number
  fog: MapFog
}

/** SVG path of a stroke in the map's pixel space (a single point = a dot) */
export function fogStrokePath(stroke: FogStroke, width: number, height: number) {
  return stroke.points
    .map(([x, y], i) => `${i ? 'L' : 'M'}${(x * width / 100).toFixed(1)} ${(y * height / 100).toFixed(1)}`)
    .join(' ') + (stroke.points.length === 1 ? ' l0 0' : '')
}

/** A ping on the shown map (percent coordinates) */
export interface TablePingContent {
  mapId: number
  x: number
  y: number
  /** DM only: a short note shown with the ping for a few seconds */
  text?: string
}

/** A ping on screen: who + where, gone after the pulse */
export interface TablePing extends TablePingContent {
  id: number
  /** Player id, or 'dm' */
  from: string
  name: string
}

export const isPingContent = (value: unknown): value is TablePingContent => {
  const p = value as TablePingContent
  const inMap = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100
  const text = p?.text === undefined || (typeof p.text === 'string' && p.text.length <= 80)
  return !!p && Number.isInteger(p.mapId) && inMap(p.x) && inMap(p.y) && text
}

/** How long a ping stays on screen (3 pulses) */
export const PING_MS = 2600
/** A DM note stays longer - time to read it */
export const NOTE_MS = 8000
