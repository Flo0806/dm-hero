/**
 * Types for campaign notes/todos feature
 */

export interface CampaignNote {
  id: number
  campaign_id: number
  content: string
  completed: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface CampaignNoteDbRow {
  id: number
  campaign_id: number
  content: string
  completed: number // SQLite stores as 0/1
  sort_order: number
  created_at: string
  updated_at: string
}

export interface CreateNoteRequest {
  campaignId: number
  content: string
}

export interface UpdateNoteRequest {
  content?: string
  completed?: boolean
}

export interface ReorderNotesRequest {
  noteIds: number[]
}

export interface NoteResponse {
  success: boolean
  note?: CampaignNote
}
