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
