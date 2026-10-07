import { isValidMusicUrl, type SessionMusicLink } from './session-music'

// The DM's campaign manager: a free tree of story nodes, GM-only (never shared to the table)

export const STORY_NODE_KINDS = ['arc', 'chapter', 'scene', 'note'] as const
export type StoryNodeKind = (typeof STORY_NODE_KINDS)[number]

export const STORY_NODE_STATUSES = ['idea', 'planned', 'ready', 'played', 'skipped'] as const
export type StoryNodeStatus = (typeof STORY_NODE_STATUSES)[number]

/** Prep texts besides the main body (entities.description) - all markdown with {{type:id}} mentions */
export const STORY_NODE_TEXT_FIELDS = ['hook', 'readAloud', 'secrets', 'outcomes'] as const
export type StoryNodeTextField = (typeof STORY_NODE_TEXT_FIELDS)[number]

export const STORY_NODE_KIND_ICONS: Record<StoryNodeKind, string> = {
  arc: 'mdi-book-open-page-variant-outline',
  chapter: 'mdi-bookmark-outline',
  scene: 'mdi-movie-open-outline',
  note: 'mdi-note-text-outline',
}

export const STORY_NODE_STATUS_COLORS: Record<StoryNodeStatus, string> = {
  idea: 'grey',
  planned: 'blue-grey',
  ready: 'primary',
  played: 'success',
  skipped: 'warning',
}

/** Icon and badge color of each {{type:id}} mention type */
export const MENTION_STYLES: Record<string, { icon: string, color: string }> = {
  npc: { icon: 'mdi-account', color: '#D4A574' },
  location: { icon: 'mdi-map-marker', color: '#8B7355' },
  item: { icon: 'mdi-sword', color: '#CC8844' },
  faction: { icon: 'mdi-shield', color: '#7B92AB' },
  lore: { icon: 'mdi-book-open-variant', color: '#9C6B98' },
  player: { icon: 'mdi-account-star', color: '#4CAF50' },
  session: { icon: 'mdi-calendar', color: '#1976D2' },
}

/** Longest allowed name and text (in characters) */
export const STORY_NAME_MAX = 200
export const STORY_TEXT_MAX = 100_000

/** Default kind of a new entry by its depth in the tree: arc, chapter, then scenes. */
export function defaultKindForDepth(depth: number): StoryNodeKind {
  return (['arc', 'chapter'] as const)[depth] ?? 'scene'
}

export interface StoryNodeMetadata extends Partial<Record<StoryNodeTextField, string>> {
  kind?: StoryNodeKind
  status?: StoryNodeStatus
  musicLinks?: SessionMusicLink[]
}

/** A node as listed in the tree (light: no texts) */
export interface StoryNodeListItem {
  id: number
  name: string
  parent_id: number | null
  sort_order: number
  kind: StoryNodeKind
  status: StoryNodeStatus
  session_count: number
  encounter_count: number
  map_count: number
}

export interface StoryNodeLinkedSession {
  id: number
  title: string
  session_number: number | null
  date: string | null
}

export interface StoryNodeLinkedEncounter {
  id: number
  name: string
  status: string
}

export interface StoryNodeLinkedMap {
  id: number
  name: string
}

/** An entity mentioned via {{type:id}} in any of the node's texts */
export interface StoryNodeMention {
  id: number
  name: string
  type: string
}

export interface StoryNode {
  id: number
  name: string
  description: string | null
  parent_id: number | null
  sort_order: number
  metadata: StoryNodeMetadata
  created_at: string
  updated_at: string
  sessions: StoryNodeLinkedSession[]
  encounters: StoryNodeLinkedEncounter[]
  maps: StoryNodeLinkedMap[]
  mentions: StoryNodeMention[]
}

export interface StoryNodeLinks {
  sessionIds?: number[]
  encounterIds?: number[]
  mapIds?: number[]
}

/**
 * Stored metadata in a known shape, whatever is in the database (it may come from an
 * imported archive): kind/status default to scene/idea, texts are strings, music links valid.
 */
export function normalizeStoryMetadata(raw: unknown): StoryNodeMetadata & { kind: StoryNodeKind, status: StoryNodeStatus } {
  const m = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const result: StoryNodeMetadata & { kind: StoryNodeKind, status: StoryNodeStatus } = {
    kind: STORY_NODE_KINDS.includes(m.kind as StoryNodeKind) ? m.kind as StoryNodeKind : 'scene',
    status: STORY_NODE_STATUSES.includes(m.status as StoryNodeStatus) ? m.status as StoryNodeStatus : 'idea',
  }
  for (const field of STORY_NODE_TEXT_FIELDS) {
    if (typeof m[field] === 'string') result[field] = m[field] as string
  }
  if (Array.isArray(m.musicLinks)) {
    result.musicLinks = (m.musicLinks as SessionMusicLink[]).filter(l =>
      l && typeof l.label === 'string' && typeof l.url === 'string' && isValidMusicUrl(l.url))
  }
  return result
}
