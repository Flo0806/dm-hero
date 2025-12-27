/**
 * Campaign Export/Import Types
 *
 * Format: .dmhero (ZIP archive)
 * - manifest.json (this structure)
 * - images/entities/*.{png,jpg,webp}
 * - images/maps/*.{png,jpg,webp}
 * - images/sessions/*.{png,jpg,webp}
 * - documents/*.{md,pdf}
 * - audio/*.{mp3,wav,ogg}
 */

// =============================================================================
// EXPORT FORMAT VERSION & COMPATIBILITY
// =============================================================================

export const EXPORT_FORMAT_VERSION = '1.1' as const

/**
 * Version Compatibility Table
 *
 * Maps export format versions to the minimum app version required to import them.
 * When we make breaking changes to the export format, we increment the format version
 * and add an entry here.
 *
 * Format: { formatVersion: minAppVersion }
 *
 * Breaking changes that require version bump:
 * - Removing required fields from manifest
 * - Changing field types in incompatible ways
 * - Changing ID reference format
 * - Adding new entity types (import would fail to map)
 */
export const VERSION_COMPATIBILITY: Record<string, string> = {
  '1.0': '1.0.0-beta.1', // Initial format - hardcoded type_ids
  '1.1': '1.0.0-beta.2', // Added entityTypes mapping, type_name field
}

/**
 * Check if an export can be imported by the current app version
 * @param exportVersion The format version from the export manifest
 * @param appVersion The current app version
 * @returns true if compatible, false if migration needed
 */
export function isExportCompatible(exportVersion: string, appVersion: string): boolean {
  const minVersion = VERSION_COMPATIBILITY[exportVersion]
  if (!minVersion) {
    // Unknown format version - try anyway but warn
    return true
  }
  return compareVersions(appVersion, minVersion) >= 0
}

/**
 * Compare two semver versions
 * @returns -1 if a < b, 0 if equal, 1 if a > b
 */
function compareVersions(a: string, b: string): number {
  // Strip pre-release suffix for comparison (1.0.0-beta.1 -> 1.0.0.1)
  const normalize = (v: string) => {
    const splitParts = v.split('-')
    const base = splitParts[0] || v
    const pre = splitParts[1]
    const parts = base.split('.').map(Number)
    if (pre) {
      // Extract number from pre-release (beta.1 -> 1)
      const preNum = parseInt(pre.replace(/\D/g, '')) || 0
      parts.push(preNum)
    }
    return parts
  }

  const aParts = normalize(a)
  const bParts = normalize(b)

  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aVal = aParts[i] || 0
    const bVal = bParts[i] || 0
    if (aVal < bVal) return -1
    if (aVal > bVal) return 1
  }
  return 0
}

// =============================================================================
// ENTITY TYPE MAPPING (from database)
// =============================================================================

/**
 * Entity type as stored in the database.
 * Exported to ensure imports can map correctly even if IDs differ.
 */
export interface ExportEntityType {
  id: number
  name: string // 'NPC', 'Location', 'Item', 'Faction', 'Quest', 'Lore', 'Player'
  icon?: string
  color?: string
}

// =============================================================================
// MAIN MANIFEST STRUCTURE
// =============================================================================

export interface CampaignExportManifest {
  // Format info
  version: string // Format version (e.g., '1.1')
  exportedAt: string // ISO timestamp
  generator: 'dm-hero'
  generatorVersion: string // App version that created this

  // Export type
  exportType: 'full' | 'partial'

  // Store adventure identifier (set when downloading from store)
  sourceAdventureSlug?: string

  // Store adventure version (set when downloading from store)
  sourceVersion?: number

  // Entity type mapping from source database
  // Import uses this to map type_name -> local type_id
  entityTypes?: ExportEntityType[]

  // Meta for Store display (optional, mainly for full exports)
  meta?: ExportMeta

  // Campaign base data
  campaign: ExportCampaign

  // Core content - always present if entities exist
  entities?: ExportEntity[]
  relations?: ExportRelation[]

  // Entity extras
  entityImages?: ExportEntityImage[]
  entityDocuments?: ExportEntityDocument[]

  // Sessions - only in full export
  sessions?: ExportSession[]
  sessionMentions?: ExportSessionMention[]
  sessionAttendance?: ExportSessionAttendance[]
  sessionImages?: ExportSessionImage[]
  sessionAudio?: ExportSessionAudio[]
  audioMarkers?: ExportAudioMarker[]

  // Calendar - only in full export
  calendar?: ExportCalendar

  // Maps - only in full export
  maps?: ExportMap[]
  mapMarkers?: ExportMapMarker[]
  mapAreas?: ExportMapArea[]

  // Campaign features - only in full export
  currencies?: ExportCurrency[]
  notes?: ExportNote[]
  pinboard?: ExportPinboardItem[]

  // Custom races & classes - exported if NPCs use them
  // These are GLOBAL (not campaign-scoped), so import may cause conflicts
  races?: ExportRace[]
  classes?: ExportClass[]
}

// =============================================================================
// META (for Store)
// =============================================================================

export interface ExportMeta {
  title?: string
  description?: string
  author?: string
  tags?: string[]
  difficulty?: 'beginner' | 'intermediate' | 'advanced' | 'deadly'
  playerCount?: string // "3-5", "4-6", etc.
  estimatedDuration?: string // "2-3 hours", "One evening", etc.
  // Thumbnail stored as images/thumbnail.{png,jpg}
}

// =============================================================================
// CAMPAIGN
// =============================================================================

export interface ExportCampaign {
  name: string
  description?: string
}

// =============================================================================
// ENTITIES
// =============================================================================

export interface ExportEntity {
  _exportId: string // Stable ID for references: "entity:1", "entity:2", etc.
  type_id: number // Numeric ID from source DB (for backwards compat with v1.0)
  type_name: string // Type name: 'NPC', 'Location', 'Item', 'Faction', 'Quest', 'Lore', 'Player'
  name: string
  description?: string
  metadata?: Record<string, unknown>
  image_url?: string // Relative path: "images/entities/npc-1.png"
  location_id?: string // Reference: "entity:5" (remapped on import)
  parent_entity_id?: string // Reference: "entity:3" (for hierarchical locations)
  created_at?: string
  updated_at?: string
}

export interface ExportRelation {
  from_entity: string // "entity:1"
  to_entity: string // "entity:5"
  relation_type: string // e.g., "ally", "livesIn", "owns"
  notes?: string
}

export interface ExportEntityImage {
  entity: string // "entity:1"
  image_url: string // Relative: "images/entities/npc-1-gallery-1.png"
  caption?: string
  is_primary: boolean
  display_order: number
}

export interface ExportEntityDocument {
  _exportId: string // "document:1"
  entity: string // "entity:1"
  title: string
  content?: string // For markdown
  file_path?: string // Relative: "documents/npc-1-backstory.pdf"
  file_type: 'markdown' | 'pdf'
  date?: string
  sort_order: number
}

// =============================================================================
// SESSIONS
// =============================================================================

export interface ExportSession {
  _exportId: string // "session:1"
  session_number: number
  title?: string
  date?: string
  summary?: string
  notes?: string
  in_game_date_start?: string
  in_game_date_end?: string
  in_game_day_start?: number
  in_game_day_end?: number
  duration_minutes?: number
  calendar_event?: string // Reference: "event:1"
  created_at?: string
  updated_at?: string
}

export interface ExportSessionMention {
  session: string // "session:1"
  entity: string // "entity:5"
  context?: string
}

export interface ExportSessionAttendance {
  session: string // "session:1"
  player: string // "entity:10" (Player entity)
  character?: string // "entity:3" (NPC they played)
  attended: boolean
  notes?: string
}

export interface ExportSessionImage {
  session: string // "session:1"
  image_url: string // Relative: "images/sessions/session-1-cover.png"
  caption?: string
  is_primary: boolean
  display_order: number
}

export interface ExportSessionAudio {
  _exportId: string // "audio:1"
  session: string // "session:1"
  audio_url: string // Relative: "audio/session-1-recording.mp3"
  title?: string
  description?: string
  duration_seconds?: number
  mime_type?: string
  display_order: number
}

export interface ExportAudioMarker {
  audio: string // "audio:1"
  timestamp_seconds: number
  label: string
  description?: string
  color?: string
}

// =============================================================================
// CALENDAR
// =============================================================================

export interface ExportCalendar {
  config?: ExportCalendarConfig
  months?: ExportCalendarMonth[]
  weekdays?: ExportCalendarWeekday[]
  moons?: ExportCalendarMoon[]
  seasons?: ExportCalendarSeason[]
  events?: ExportCalendarEvent[]
  eventEntities?: ExportCalendarEventEntity[]
  weather?: ExportCalendarWeather[]
}

export interface ExportCalendarConfig {
  current_year: number
  current_month: number
  current_day: number
  year_zero_name?: string
  era_name?: string
  leap_year_interval?: number
  leap_year_month?: number
  leap_year_extra_days?: number
}

export interface ExportCalendarMonth {
  name: string
  days: number
  sort_order: number
}

export interface ExportCalendarWeekday {
  name: string
  sort_order: number
}

export interface ExportCalendarMoon {
  name: string
  cycle_days: number
  full_moon_duration?: number
  new_moon_duration?: number
  phase_offset?: number
}

export interface ExportCalendarSeason {
  name: string
  start_month: number
  start_day: number
  background_image?: string // Relative path or null
  color?: string
  icon?: string
  weather_type?: 'winter' | 'spring' | 'summer' | 'autumn'
  sort_order: number
}

export interface ExportCalendarEvent {
  _exportId: string // "event:1"
  title: string
  description?: string
  event_type?: string
  year?: number // null = recurring every year
  month: number
  day: number
  is_recurring: boolean
  color?: string
  entity?: string // Legacy single entity: "entity:5"
}

export interface ExportCalendarEventEntity {
  event: string // "event:1"
  entity: string // "entity:5"
  entity_type: string
}

export interface ExportCalendarWeather {
  year: number
  month: number
  day: number
  weather_type: string
  temperature?: number
  notes?: string
}

// =============================================================================
// MAPS
// =============================================================================

export interface ExportMap {
  _exportId: string // "map:1"
  name: string
  description?: string
  image_url: string // Relative: "images/maps/worldmap.png"
  parent_map?: string // Reference: "map:2" (for variants)
  version_name?: string
  default_zoom?: number
  min_zoom?: number
  max_zoom?: number
  scale_value?: number
  scale_unit?: string
  created_at?: string
  updated_at?: string
}

export interface ExportMapMarker {
  map: string // "map:1"
  entity: string // "entity:5"
  x: number // 0-100%
  y: number // 0-100%
  custom_icon?: string
  custom_color?: string
  custom_label?: string
  notes?: string
}

export interface ExportMapArea {
  map: string // "map:1"
  location: string // "entity:2" (must be Location type)
  center_x: number // 0-100%
  center_y: number // 0-100%
  radius: number // percentage
  color?: string
}

// =============================================================================
// CAMPAIGN FEATURES
// =============================================================================

export interface ExportCurrency {
  code: string // "GP", "SP", etc.
  name: string // i18n key or custom name
  symbol?: string
  exchange_rate: number
  sort_order: number
  is_default: boolean
}

export interface ExportNote {
  content: string
  completed: boolean
  sort_order: number
  created_at?: string
  updated_at?: string
}

export interface ExportPinboardItem {
  entity: string // "entity:1"
  display_order: number
}

// =============================================================================
// CUSTOM RACES & CLASSES (global, not campaign-scoped)
// =============================================================================

/**
 * Custom race for export.
 * Only custom races are exported - standard races (human, elf, etc.) have fixed i18n keys.
 * On import, races are matched by KEY (name field), not by translations.
 */
export interface ExportRace {
  name: string // Key (e.g., "halfdragon") - PRIMARY identifier for conflict detection
  name_de?: string // German display name
  name_en?: string // English display name
  description?: string
}

/**
 * Custom class for export.
 * Only custom classes are exported - standard classes (wizard, fighter, etc.) have fixed i18n keys.
 * On import, classes are matched by KEY (name field), not by translations.
 */
export interface ExportClass {
  name: string // Key (e.g., "shadowdancer") - PRIMARY identifier for conflict detection
  name_de?: string // German display name
  name_en?: string // English display name
  description?: string
}

/**
 * Conflict info for a single race or class during import.
 * Shown to user so they can decide: overwrite, keep existing, or abort.
 */
export interface RaceClassConflict {
  type: 'race' | 'class'
  key: string // The conflicting key (e.g., "halfdragon")
  imported: {
    name_de?: string
    name_en?: string
    description?: string
  }
  existing: {
    name_de?: string
    name_en?: string
    description?: string
  }
  isStandard: boolean // True if this is now a standard race/class (no import needed)
}

// =============================================================================
// EXPORT OPTIONS (for API)
// =============================================================================

export interface ExportOptions {
  mode: 'full' | 'partial'

  // For partial export only
  entityIds?: number[]

  // Meta data (mainly for full export / store)
  meta?: ExportMeta
}

// =============================================================================
// IMPORT TRACKING (stored in entity metadata)
// =============================================================================

/**
 * Tracking data stored in entity metadata._importTracking
 * Used to detect re-imports of the same adventure and handle version updates
 */
export interface ImportTracking {
  sourceAdventureSlug?: string // Store adventure slug (e.g., "das-raetsel-um-steinrast")
  sourceVersion?: number // Version from store (e.g., 1, 2, 3)
  importedAt: string // ISO timestamp of import
  importVersion: number // 1, 2, 3... increments on re-import
}

// =============================================================================
// IMPORT CONFLICT INFO (for UI warnings)
// =============================================================================

/**
 * Information about entities that will be overwritten during import
 */
export interface ImportConflictInfo {
  // Store-Update scenario: all entities from same adventure will be replaced
  isStoreUpdate: boolean
  sourceAdventureSlug?: string
  existingCount: number // Number of entities that will be deleted

  // Merge scenario: individual duplicates by name+type
  duplicates: Array<{
    name: string
    typeName: string
    existingId: number
  }>

  // Race/Class conflicts (global data - requires user decision)
  raceClassConflicts?: RaceClassConflict[]
}

// =============================================================================
// IMPORT OPTIONS (for API)
// =============================================================================

export interface ImportOptions {
  mode: 'new' | 'merge'

  // For new mode: override campaign name
  campaignName?: string

  // For merge mode: target campaign
  targetCampaignId?: number

  // Store adventure slug for tracking (from .dmhero manifest or store download)
  sourceAdventureSlug?: string

  // User confirmed they want to proceed despite conflicts
  confirmedOverwrite?: boolean

  // Race/Class conflict resolution (user's decisions)
  // Key = race/class key, Value = 'overwrite' | 'keep' | 'skip'
  // 'overwrite' = replace existing with imported
  // 'keep' = keep existing, don't import
  // 'skip' = skip this race/class (same as keep, but for standard races)
  raceResolutions?: Record<string, 'overwrite' | 'keep' | 'skip'>
  classResolutions?: Record<string, 'overwrite' | 'keep' | 'skip'>
}

// =============================================================================
// IMPORT RESULT
// =============================================================================

export interface ImportResult {
  success: boolean
  campaignId: number
  stats: {
    entitiesImported: number
    relationsImported: number
    sessionsImported: number
    mapsImported: number
    imagesImported: number
    documentsImported: number
    racesImported: number
    classesImported: number
    skipped: number
    warnings: string[]
    entitiesDeleted?: number // How many were soft-deleted before import
  }
  errors?: string[]

  // If conflicts detected and user hasn't confirmed, return this for UI warning
  conflictInfo?: ImportConflictInfo
  requiresConfirmation?: boolean
}

// =============================================================================
// ID MAPPING (internal use during import)
// =============================================================================

export interface IdMapping {
  entities: Map<string, number> // "entity:1" -> 42
  sessions: Map<string, number> // "session:1" -> 5
  documents: Map<string, number> // "document:1" -> 12
  events: Map<string, number> // "event:1" -> 3
  maps: Map<string, number> // "map:1" -> 2
  audio: Map<string, number> // "audio:1" -> 1
}
