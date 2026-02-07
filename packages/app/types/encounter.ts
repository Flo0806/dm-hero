export const ENCOUNTER_STATUSES = ['setup', 'initiative', 'active', 'paused', 'finished'] as const
export type EncounterStatus = (typeof ENCOUNTER_STATUSES)[number]

export interface Encounter {
  id: number
  campaign_id: number
  session_id: number | null
  name: string
  status: EncounterStatus
  round: number
  current_turn_index: number
  created_at: string
  updated_at: string
  finished_at: string | null
  deleted_at: string | null
  _participantCount?: number
}

export interface EncounterParticipant {
  id: number
  encounter_id: number
  entity_id: number
  display_name: string
  duplicate_index: number
  initiative: number | null
  current_hp: number
  max_hp: number
  temp_hp: number
  sort_order: number
  is_ko: boolean
  notes: string | null
  entity_type?: string
  entity_image?: string | null
}

export interface EncounterWithParticipants extends Encounter {
  participants: EncounterParticipant[]
}
