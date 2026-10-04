// Protocol of the shown map between DM Hero and the player app: what goes into
// the encrypted envelopes, and how both sides check and draw it. One source for both.
// Coordinates are percent of the map (x of width, y of height), radius percent of width.

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

/** An encrypted file on the relay - key + iv travel inside the signed envelope */
export interface TableFileRef {
  fileId: string
  key: string
  iv: string
  mime: string
}

/** Slot "map": the map the players see. kind ties the content to its slot. */
export interface TableMapContent {
  kind: 'map'
  mapId: number
  name: string
  image: TableFileRef
  width: number
  height: number
}

/** Slot "fog": its fog of war - a fog of another mapId means "all covered" */
export interface TableFogContent {
  kind: 'fog'
  mapId: number
  fog: MapFog
}

/** Every weather a DM can set in DM Hero's calendar - one list for DM Hero and the player app */
export const TABLE_WEATHER_TYPES = [
  'sunny', 'partlyCloudy', 'cloudy', 'rain', 'heavyRain', 'thunderstorm', 'snow', 'heavySnow', 'fog', 'windy', 'hail',
] as const
export type TableWeatherType = typeof TABLE_WEATHER_TYPES[number]

export const TABLE_WEATHER_ICONS: Record<TableWeatherType, string> = {
  sunny: '☀️',
  partlyCloudy: '⛅',
  cloudy: '☁️',
  rain: '🌧️',
  heavyRain: '🌧️',
  thunderstorm: '⛈️',
  snow: '🌨️',
  heavySnow: '❄️',
  fog: '🌫️',
  windy: '💨',
  hail: '🧊',
}

/** Today's in-game weather (temperature without unit, as DM Hero shows it) */
export interface TableWeather {
  type: TableWeatherType
  temperature: number | null
}

/** A known weather, or nothing - an odd value (import, old data) never breaks anything else */
export function parseTableWeather(value: unknown): TableWeather | undefined {
  const w = value as { type?: unknown, temperature?: unknown } | null | undefined
  if (!w || !(TABLE_WEATHER_TYPES as readonly unknown[]).includes(w.type)) return undefined
  const temperature = typeof w.temperature === 'number' && Number.isFinite(w.temperature) ? w.temperature : null
  return { type: w.type as TableWeatherType, temperature }
}

/** Slot "info": about the game itself - shown to joined players */
export interface TableInfoContent {
  kind: 'info'
  campaignName: string
  /** Missing = no calendar or no weather for today. Receivers read it with parseTableWeather - an odd one is ignored, not fatal */
  weather?: TableWeather
}

export const CAMPAIGN_NAME_MAX = 200

export function isTableInfoContent(value: unknown): value is TableInfoContent {
  const i = value as TableInfoContent
  return !!i && i.kind === 'info' && typeof i.campaignName === 'string' && i.campaignName.length <= CAMPAIGN_NAME_MAX
}

/**
 * A handout (letter, note, PDF) for chosen players. Sealed per device with the
 * DM<->device pair key: only the recipients can open it, the relay can't.
 */
export interface HandoutContent {
  kind: 'handout'
  handoutId: string
  title: string
  format: 'markdown' | 'pdf'
  /** markdown: the text */
  text?: string
  /** pdf: the encrypted file on the relay */
  file?: TableFileRef & { size: number }
  sharedAt: string
}

/** Keeps a relay from being flooded: text size, file size, handouts per game */
export const HANDOUT_TEXT_MAX = 100_000
export const HANDOUT_FILE_MAX = 2 * 1024 * 1024 - 1024
export const HANDOUTS_PER_GAME = 100

export function isHandoutContent(value: unknown): value is HandoutContent {
  const h = value as HandoutContent
  if (!h || h.kind !== 'handout' || typeof h.handoutId !== 'string' || typeof h.title !== 'string' || typeof h.sharedAt !== 'string') return false
  if (h.format === 'markdown') return typeof h.text === 'string' && h.text.length <= HANDOUT_TEXT_MAX
  return h.format === 'pdf' && typeof h.file?.fileId === 'string' && typeof h.file.key === 'string'
    && typeof h.file.iv === 'string' && Number.isFinite(h.file.size) && h.file.size <= HANDOUT_FILE_MAX
}

/** One private message between the DM and a player */
export interface ChatMessage {
  id: string
  from: 'dm' | 'player'
  text: string
  sentAt: string
}

/**
 * The whole conversation with one player (newest last), sealed per device of
 * that player by DM Hero - which keeps the conversation and sends it on change.
 */
export interface ChatThreadContent {
  kind: 'thread'
  messages: ChatMessage[]
}

/** What a player writes: sealed with the sending device's pair key, for DM Hero only */
export interface ChatPostContent {
  kind: 'chat'
  id: string
  text: string
}

export const CHAT_TEXT_MAX = 1000
/** Only the newest messages travel to the players */
export const CHAT_THREAD_MAX = 100

const isChatText = (text: unknown) => typeof text === 'string' && text.trim().length > 0 && text.length <= CHAT_TEXT_MAX

export function isChatPostContent(value: unknown): value is ChatPostContent {
  const c = value as ChatPostContent
  return !!c && c.kind === 'chat' && typeof c.id === 'string' && /^[\w-]{1,64}$/.test(c.id) && isChatText(c.text)
}

export function isChatThreadContent(value: unknown): value is ChatThreadContent {
  const t = value as ChatThreadContent
  return !!t && t.kind === 'thread' && Array.isArray(t.messages) && t.messages.length <= CHAT_THREAD_MAX
    && t.messages.every(m => typeof m?.id === 'string' && (m.from === 'dm' || m.from === 'player') && isChatText(m.text) && typeof m.sentAt === 'string')
}

/** A ping on the shown map. text: a short DM note, shown a few seconds. */
export interface TablePingContent {
  mapId: number
  x: number
  y: number
  text?: string
}

export const PING_TEXT_MAX = 80
/** On screen: a ping pulses three times, a note stays long enough to read */
export const PING_MS = 2600
export const NOTE_MS = 8000
export const DM_PING_COLOR = '#d4a574'
const PLAYER_PING_COLORS = ['#4fc3f7', '#81c784', '#ff8a65', '#ba68c8', '#fff176', '#f06292']

/** Same color for a player in DM Hero and on every player's device */
export const pingColor = (from: string | number) =>
  from === 'dm' ? DM_PING_COLOR : PLAYER_PING_COLORS[Math.abs(Number(from) || 0) % PLAYER_PING_COLORS.length]!

const inMap = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100

export function isPingContent(value: unknown): value is TablePingContent {
  const p = value as TablePingContent
  if (!p || !Number.isInteger(p.mapId) || !inMap(p.x) || !inMap(p.y)) return false
  return p.text === undefined || (typeof p.text === 'string' && p.text.length <= PING_TEXT_MAX)
}

// Fog limits: a fog must stay small enough for the relay (1 MB per envelope;
// encrypted + base64 makes ~1.35x of the JSON size)
export const FOG_MAX_STROKES = 1500
/** Points per stroke - longer strokes are split while painting */
export const FOG_MAX_POINTS = 500
/** JSON size where DM Hero warns that the fog gets big */
export const FOG_SOFT_LIMIT_BYTES = 500 * 1024
/** JSON size DM Hero refuses to go beyond - "reveal/cover all" starts fresh */
export const FOG_MAX_BYTES = 700 * 1024

export function isMapFog(value: unknown): value is MapFog {
  const fog = value as MapFog
  if (!fog || (fog.base !== 'covered' && fog.base !== 'clear') || !Array.isArray(fog.strokes)) return false
  if (fog.strokes.length > FOG_MAX_STROKES) return false
  return fog.strokes.every(s =>
    (s.mode === 'reveal' || s.mode === 'cover')
    && typeof s.radius === 'number' && Number.isFinite(s.radius) && s.radius > 0 && s.radius <= 50
    && Array.isArray(s.points) && s.points.length > 0 && s.points.length <= FOG_MAX_POINTS
    && s.points.every(p => Array.isArray(p) && p.length === 2 && inMap(p[0]) && inMap(p[1])))
}

/** Percent into the map (painting past the edge ends at the edge) */
export const clampPercent = (n: number) => Math.min(100, Math.max(0, n))

/**
 * Brings points into 0-100 (strokes painted past the map edge). Applied wherever
 * a fog is loaded, saved or sent - leaves anything malformed to isMapFog.
 */
export function normalizeFog<T>(value: T): T {
  const fog = value as unknown as MapFog
  if (!fog || !Array.isArray(fog.strokes)) return value
  return {
    ...fog,
    strokes: fog.strokes.map(s => !s || !Array.isArray(s.points)
      ? s
      : {
          ...s,
          points: s.points.map(p => Array.isArray(p) && p.length === 2 && typeof p[0] === 'number' && typeof p[1] === 'number'
            ? [clampPercent(p[0]), clampPercent(p[1])] as [number, number]
            : p),
        }),
  } as unknown as T
}

export function isTableMapContent(value: unknown): value is TableMapContent {
  const m = value as TableMapContent
  return !!m && m.kind === 'map' && Number.isInteger(m.mapId) && typeof m.name === 'string'
    && Number.isFinite(m.width) && m.width > 0 && Number.isFinite(m.height) && m.height > 0
    && typeof m.image?.fileId === 'string' && typeof m.image.key === 'string' && typeof m.image.iv === 'string'
}

export function isTableFogContent(value: unknown): value is TableFogContent {
  const f = value as TableFogContent
  return !!f && f.kind === 'fog' && Number.isInteger(f.mapId) && isMapFog(f.fog)
}

/** Fewer points, same look: drops points closer than `tolerance` to the line (Ramer-Douglas-Peucker) */
export function simplifyStroke(points: Array<[number, number]>, tolerance: number): Array<[number, number]> {
  if (points.length < 3) return points
  const [ax, ay] = points[0]!
  const [bx, by] = points.at(-1)!
  const length = Math.hypot(bx - ax, by - ay)
  let farthest = 0
  let index = 0
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i]!
    const distance = length === 0
      ? Math.hypot(px - ax, py - ay)
      : Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / length
    if (distance > farthest) {
      farthest = distance
      index = i
    }
  }
  if (farthest <= tolerance) return [points[0]!, points.at(-1)!]
  return [...simplifyStroke(points.slice(0, index + 1), tolerance).slice(0, -1), ...simplifyStroke(points.slice(index), tolerance)]
}

/** SVG path of a stroke in the map's own pixel space (a single point = a round dot) */
export function fogStrokePath(stroke: FogStroke, width: number, height: number) {
  return stroke.points
    .map(([x, y], i) => `${i ? 'L' : 'M'}${(x * width / 100).toFixed(1)} ${(y * height / 100).toFixed(1)}`)
    .join(' ') + (stroke.points.length === 1 ? ' l0 0' : '')
}
