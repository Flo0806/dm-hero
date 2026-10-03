// A ping as the player app shows it. The protocol itself (map, fog, ping
// contents + checks) lives in @dm-hero/seal, shared with DM Hero.
import type { TablePingContent } from '@dm-hero/seal'

/** A ping on screen: who + where, gone after the pulse */
export interface TablePing extends TablePingContent {
  id: number
  /** Player id, or 'dm' */
  from: string
  name: string
}
