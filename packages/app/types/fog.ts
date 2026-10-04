// Fog of war + pings on the map shown to the players.
// The protocol (contents, checks, drawing) lives in @dm-hero/seal - shared with the player app.
import type { TablePingContent } from '@dm-hero/seal'

export {
  clampPercent,
  EMPTY_FOG,
  FOG_MAX_BYTES,
  FOG_MAX_POINTS,
  FOG_MAX_STROKES,
  FOG_SOFT_LIMIT_BYTES,
  NOTE_MS,
  PING_MS,
  PING_TEXT_MAX,
  fogStrokePath,
  isMapFog,
  isPingContent,
  normalizeFog,
  pingColor,
  simplifyStroke,
  type FogMode,
  type FogStroke,
  type MapFog,
  type TableFogContent,
  type TableMapContent,
  type TablePingContent,
} from '@dm-hero/seal'

/** Brush sizes offered in the toolbar (percent of map width) */
export const FOG_BRUSH_SIZES = { small: 1.5, medium: 4, large: 9 } as const
export type FogBrushSize = keyof typeof FOG_BRUSH_SIZES

/** A ping as the DM sees it: who (player id, or 'dm') + where */
export interface TablePing extends TablePingContent {
  from: number | 'dm'
  name: string
}
