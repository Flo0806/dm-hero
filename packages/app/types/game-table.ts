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
  created_at: string
  players: GameTablePlayer[]
}

/** Length of the game code players type in */
export const GAME_CODE_LENGTH = 6

/** Length of a player's PIN */
export const GAME_PIN_LENGTH = 6
