// Game table: the live game players join via the player app (one per campaign)

export interface GameTablePlayer {
  id: number
  game_table_id: number
  name: string
  pin: string
  player_entity_id: number | null
  // Joined from the linked Player entity (if any)
  player_entity_name: string | null
  player_entity_image_url: string | null
  created_at: string
}

export interface GameTable {
  id: number
  campaign_id: number
  code: string
  /** The one map the players see right now */
  shown_map_id: number | null
  created_at: string
  players: GameTablePlayer[]
}

/** Length of a player's PIN */
export const GAME_PIN_LENGTH = 6

/** A player's new device waiting for the DM's approval */
export interface PendingDevice {
  playerId: number
  publicKey: string
  /** Three symbols the player sees too - compare them at the table */
  fingerprint: string[]
}

/** Live status from the player relay */
export interface GameTablePresence {
  /** Player server reachable */
  connected: boolean
  /** Ids of players that are online */
  online: number[]
  /** New devices waiting for approval */
  pending: PendingDevice[]
}
