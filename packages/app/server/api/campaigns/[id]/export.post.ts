import { existsSync } from 'fs'
import { join, basename } from 'path'
import archiver from 'archiver'
import { PassThrough } from 'stream'
import { getDb } from '~~/server/utils/db'
import { getUploadPath } from '~~/server/utils/paths'
import { STANDARD_RACE_KEYS, STANDARD_CLASS_KEYS } from '~~/server/utils/i18n-lookup'
import type {
  CampaignExportManifest,
  ExportOptions,
  ExportEntity,
  ExportRelation,
  ExportEntityImage,
  ExportEntityDocument,
  ExportSession,
  ExportSessionMention,
  ExportSessionAttendance,
  ExportSessionImage,
  ExportSessionAudio,
  ExportAudioMarker,
  ExportCalendar,
  ExportMap,
  ExportMapMarker,
  ExportMapArea,
  ExportCurrency,
  ExportNote,
  ExportPinboardItem,
  ExportEntityType,
  ExportRace,
  ExportClass,
} from '~~/types/export'
import { EXPORT_FORMAT_VERSION } from '~~/types/export'

// Get app version from package.json
import pkg from '~~/package.json'

interface FileToInclude {
  sourcePath: string
  archivePath: string
}

export default defineEventHandler(async (event) => {
  const campaignId = Number(getRouterParam(event, 'id'))

  if (!campaignId || isNaN(campaignId)) {
    throw createError({ statusCode: 400, message: 'Invalid campaign ID' })
  }

  const body = await readBody<ExportOptions>(event)
  const mode = body?.mode || 'full'
  const selectedEntityIds = body?.entityIds || []
  const meta = body?.meta

  const db = getDb()

  // Verify campaign exists
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ? AND deleted_at IS NULL').get(campaignId) as {
    id: number
    name: string
    description: string | null
  } | undefined

  if (!campaign) {
    throw createError({ statusCode: 404, message: 'Campaign not found' })
  }

  // Read entity types from database for mapping
  const entityTypes = db.prepare('SELECT id, name, icon, color FROM entity_types').all() as Array<{
    id: number
    name: string
    icon: string | null
    color: string | null
  }>

  const exportEntityTypes: ExportEntityType[] = entityTypes.map((t) => ({
    id: t.id,
    name: t.name,
    icon: t.icon || undefined,
    color: t.color || undefined,
  }))

  // Build type_id -> type_name lookup
  const typeIdToName = new Map<number, string>(entityTypes.map((t) => [t.id, t.name]))

  // Collect files to include in ZIP
  const filesToInclude: FileToInclude[] = []
  const uploadPath = getUploadPath()

  // Helper to add file to ZIP
  const addFile = (dbPath: string | null | undefined, archiveFolder: string): string | undefined => {
    if (!dbPath) return undefined

    // Handle various path formats stored in DB
    let sourcePath: string
    if (dbPath.startsWith('/api/uploads/')) {
      // API route path like /api/uploads/entities/xxx.png -> uploadPath/entities/xxx.png
      sourcePath = join(uploadPath, dbPath.replace('/api/uploads/', ''))
    } else if (dbPath.startsWith('/') || dbPath.startsWith('C:')) {
      // Absolute path
      sourcePath = dbPath
    } else {
      // Relative path
      sourcePath = join(uploadPath, dbPath)
    }

    if (!existsSync(sourcePath)) {
      console.warn(`[Export] File not found: ${sourcePath}`)
      return undefined
    }

    const fileName = basename(sourcePath)
    const archivePath = `${archiveFolder}/${fileName}`

    filesToInclude.push({ sourcePath, archivePath })
    return archivePath
  }

  // ==========================================================================
  // FETCH ALL DATA
  // ==========================================================================

  // Entities
  let entitiesQuery = `
    SELECT id, type_id, name, description, metadata, image_url, location_id, parent_entity_id, created_at, updated_at
    FROM entities
    WHERE campaign_id = ? AND deleted_at IS NULL
  `
  const entitiesParams: (number | number[])[] = [campaignId]

  if (mode === 'partial' && selectedEntityIds.length > 0) {
    const placeholders = selectedEntityIds.map(() => '?').join(',')
    entitiesQuery += ` AND id IN (${placeholders})`
    entitiesParams.push(...selectedEntityIds)
  }

  const entities = db.prepare(entitiesQuery).all(...entitiesParams) as Array<{
    id: number
    type_id: number
    name: string
    description: string | null
    metadata: string | null
    image_url: string | null
    location_id: number | null
    parent_entity_id: number | null
    created_at: string
    updated_at: string
  }>

  const entityIdSet = new Set(entities.map((e) => e.id))

  // Create export ID mapping
  const entityExportIdMap = new Map<number, string>()
  entities.forEach((e, i) => {
    entityExportIdMap.set(e.id, `entity:${i + 1}`)
  })

  // Transform entities
  const exportEntities: ExportEntity[] = entities.map((e) => {
    const exportId = entityExportIdMap.get(e.id)!
    const imageArchivePath = addFile(e.image_url, 'images/entities')

    return {
      _exportId: exportId,
      type_id: e.type_id,
      type_name: typeIdToName.get(e.type_id) || 'Unknown',
      name: e.name,
      description: e.description || undefined,
      metadata: e.metadata ? JSON.parse(e.metadata) : undefined,
      image_url: imageArchivePath,
      location_id: e.location_id && entityIdSet.has(e.location_id) ? entityExportIdMap.get(e.location_id) : undefined,
      parent_entity_id:
        e.parent_entity_id && entityIdSet.has(e.parent_entity_id)
          ? entityExportIdMap.get(e.parent_entity_id)
          : undefined,
      created_at: e.created_at,
      updated_at: e.updated_at,
    }
  })

  // Relations (only between exported entities)
  const relations = db
    .prepare(
      `
    SELECT from_entity_id, to_entity_id, relation_type, notes
    FROM entity_relations
    WHERE from_entity_id IN (SELECT id FROM entities WHERE campaign_id = ? AND deleted_at IS NULL)
  `,
    )
    .all(campaignId) as Array<{
    from_entity_id: number
    to_entity_id: number
    relation_type: string
    notes: string | null
  }>

  const exportRelations: ExportRelation[] = relations
    .filter((r) => entityIdSet.has(r.from_entity_id) && entityIdSet.has(r.to_entity_id))
    .map((r) => ({
      from_entity: entityExportIdMap.get(r.from_entity_id)!,
      to_entity: entityExportIdMap.get(r.to_entity_id)!,
      relation_type: r.relation_type,
      notes: r.notes || undefined,
    }))

  // Entity Images
  const entityImages = db
    .prepare(
      `
    SELECT ei.entity_id, ei.image_url, ei.caption, ei.is_primary, ei.display_order
    FROM entity_images ei
    JOIN entities e ON ei.entity_id = e.id
    WHERE e.campaign_id = ? AND e.deleted_at IS NULL
  `,
    )
    .all(campaignId) as Array<{
    entity_id: number
    image_url: string
    caption: string | null
    is_primary: number
    display_order: number
  }>

  const exportEntityImages: ExportEntityImage[] = entityImages
    .filter((img) => entityIdSet.has(img.entity_id))
    .map((img) => {
      const archivePath = addFile(img.image_url, 'images/entities')
      return {
        entity: entityExportIdMap.get(img.entity_id)!,
        image_url: archivePath || img.image_url,
        caption: img.caption || undefined,
        is_primary: img.is_primary === 1,
        display_order: img.display_order,
      }
    })
    .filter((img) => img.image_url)

  // Entity Documents
  const entityDocs = db
    .prepare(
      `
    SELECT ed.id, ed.entity_id, ed.title, ed.content, ed.file_path, ed.file_type, ed.date, ed.sort_order
    FROM entity_documents ed
    JOIN entities e ON ed.entity_id = e.id
    WHERE e.campaign_id = ? AND e.deleted_at IS NULL
  `,
    )
    .all(campaignId) as Array<{
    id: number
    entity_id: number
    title: string
    content: string | null
    file_path: string | null
    file_type: string
    date: string | null
    sort_order: number
  }>

  const documentExportIdMap = new Map<number, string>()
  let docIndex = 1

  const exportEntityDocuments: ExportEntityDocument[] = entityDocs
    .filter((doc) => entityIdSet.has(doc.entity_id))
    .map((doc) => {
      const exportId = `document:${docIndex++}`
      documentExportIdMap.set(doc.id, exportId)
      const archivePath = doc.file_path ? addFile(doc.file_path, 'documents') : undefined

      return {
        _exportId: exportId,
        entity: entityExportIdMap.get(doc.entity_id)!,
        title: doc.title,
        content: doc.content || undefined,
        file_path: archivePath,
        file_type: doc.file_type as 'markdown' | 'pdf',
        date: doc.date || undefined,
        sort_order: doc.sort_order,
      }
    })

  // ==========================================================================
  // FULL EXPORT ONLY - Sessions, Calendar, Maps, etc.
  // ==========================================================================

  let exportSessions: ExportSession[] = []
  let exportSessionMentions: ExportSessionMention[] = []
  let exportSessionAttendance: ExportSessionAttendance[] = []
  let exportSessionImages: ExportSessionImage[] = []
  let exportSessionAudio: ExportSessionAudio[] = []
  let exportAudioMarkers: ExportAudioMarker[] = []
  let exportCalendar: ExportCalendar | undefined
  let exportMaps: ExportMap[] = []
  let exportMapMarkers: ExportMapMarker[] = []
  let exportMapAreas: ExportMapArea[] = []
  let exportCurrencies: ExportCurrency[] = []
  let exportNotes: ExportNote[] = []
  let exportPinboard: ExportPinboardItem[] = []

  const sessionExportIdMap = new Map<number, string>()
  const eventExportIdMap = new Map<number, string>()
  const mapExportIdMap = new Map<number, string>()
  const audioExportIdMap = new Map<number, string>()

  if (mode === 'full') {
    // Sessions
    const sessions = db
      .prepare(
        `
      SELECT id, session_number, title, date, summary, notes,
             in_game_date_start, in_game_date_end, in_game_day_start, in_game_day_end,
             duration_minutes, calendar_event_id, created_at, updated_at
      FROM sessions
      WHERE campaign_id = ? AND deleted_at IS NULL
      ORDER BY session_number ASC
    `,
      )
      .all(campaignId) as Array<{
      id: number
      session_number: number
      title: string | null
      date: string | null
      summary: string | null
      notes: string | null
      in_game_date_start: string | null
      in_game_date_end: string | null
      in_game_day_start: number | null
      in_game_day_end: number | null
      duration_minutes: number | null
      calendar_event_id: number | null
      created_at: string
      updated_at: string
    }>

    sessions.forEach((s, i) => {
      sessionExportIdMap.set(s.id, `session:${i + 1}`)
    })

    exportSessions = sessions.map((s) => ({
      _exportId: sessionExportIdMap.get(s.id)!,
      session_number: s.session_number,
      title: s.title || undefined,
      date: s.date || undefined,
      summary: s.summary || undefined,
      notes: s.notes || undefined,
      in_game_date_start: s.in_game_date_start || undefined,
      in_game_date_end: s.in_game_date_end || undefined,
      in_game_day_start: s.in_game_day_start || undefined,
      in_game_day_end: s.in_game_day_end || undefined,
      duration_minutes: s.duration_minutes || undefined,
      calendar_event: s.calendar_event_id ? eventExportIdMap.get(s.calendar_event_id) : undefined,
      created_at: s.created_at,
      updated_at: s.updated_at,
    }))

    // Session Mentions
    const sessionMentions = db
      .prepare(
        `
      SELECT sm.session_id, sm.entity_id, sm.context
      FROM session_mentions sm
      JOIN sessions s ON sm.session_id = s.id
      WHERE s.campaign_id = ? AND s.deleted_at IS NULL
    `,
      )
      .all(campaignId) as Array<{
      session_id: number
      entity_id: number
      context: string | null
    }>

    exportSessionMentions = sessionMentions
      .filter((m) => sessionExportIdMap.has(m.session_id) && entityIdSet.has(m.entity_id))
      .map((m) => ({
        session: sessionExportIdMap.get(m.session_id)!,
        entity: entityExportIdMap.get(m.entity_id)!,
        context: m.context || undefined,
      }))

    // Session Attendance
    const sessionAttendance = db
      .prepare(
        `
      SELECT sa.session_id, sa.player_id, sa.character_id, sa.attended, sa.notes
      FROM session_attendance sa
      JOIN sessions s ON sa.session_id = s.id
      WHERE s.campaign_id = ? AND s.deleted_at IS NULL
    `,
      )
      .all(campaignId) as Array<{
      session_id: number
      player_id: number
      character_id: number | null
      attended: number
      notes: string | null
    }>

    exportSessionAttendance = sessionAttendance
      .filter((a) => sessionExportIdMap.has(a.session_id) && entityIdSet.has(a.player_id))
      .map((a) => ({
        session: sessionExportIdMap.get(a.session_id)!,
        player: entityExportIdMap.get(a.player_id)!,
        character: a.character_id && entityIdSet.has(a.character_id) ? entityExportIdMap.get(a.character_id) : undefined,
        attended: a.attended === 1,
        notes: a.notes || undefined,
      }))

    // Session Images
    const sessionImages = db
      .prepare(
        `
      SELECT si.session_id, si.image_url, si.caption, si.is_primary, si.display_order
      FROM session_images si
      JOIN sessions s ON si.session_id = s.id
      WHERE s.campaign_id = ? AND s.deleted_at IS NULL
    `,
      )
      .all(campaignId) as Array<{
      session_id: number
      image_url: string
      caption: string | null
      is_primary: number
      display_order: number
    }>

    exportSessionImages = sessionImages
      .filter((img) => sessionExportIdMap.has(img.session_id))
      .map((img) => {
        const archivePath = addFile(img.image_url, 'images/sessions')
        return {
          session: sessionExportIdMap.get(img.session_id)!,
          image_url: archivePath || img.image_url,
          caption: img.caption || undefined,
          is_primary: img.is_primary === 1,
          display_order: img.display_order,
        }
      })
      .filter((img) => img.image_url)

    // Session Audio
    const sessionAudio = db
      .prepare(
        `
      SELECT sa.id, sa.session_id, sa.audio_url, sa.title, sa.description,
             sa.duration_seconds, sa.mime_type, sa.display_order
      FROM session_audio sa
      JOIN sessions s ON sa.session_id = s.id
      WHERE s.campaign_id = ? AND s.deleted_at IS NULL
    `,
      )
      .all(campaignId) as Array<{
      id: number
      session_id: number
      audio_url: string
      title: string | null
      description: string | null
      duration_seconds: number | null
      mime_type: string | null
      display_order: number
    }>

    let audioIndex = 1
    exportSessionAudio = sessionAudio
      .filter((a) => sessionExportIdMap.has(a.session_id))
      .map((a) => {
        const exportId = `audio:${audioIndex++}`
        audioExportIdMap.set(a.id, exportId)
        const archivePath = addFile(a.audio_url, 'audio')
        return {
          _exportId: exportId,
          session: sessionExportIdMap.get(a.session_id)!,
          audio_url: archivePath || a.audio_url,
          title: a.title || undefined,
          description: a.description || undefined,
          duration_seconds: a.duration_seconds || undefined,
          mime_type: a.mime_type || undefined,
          display_order: a.display_order,
        }
      })

    // Audio Markers
    const audioMarkers = db
      .prepare(
        `
      SELECT am.audio_id, am.timestamp_seconds, am.label, am.description, am.color
      FROM audio_markers am
      JOIN session_audio sa ON am.audio_id = sa.id
      JOIN sessions s ON sa.session_id = s.id
      WHERE s.campaign_id = ? AND s.deleted_at IS NULL
    `,
      )
      .all(campaignId) as Array<{
      audio_id: number
      timestamp_seconds: number
      label: string
      description: string | null
      color: string | null
    }>

    exportAudioMarkers = audioMarkers
      .filter((m) => audioExportIdMap.has(m.audio_id))
      .map((m) => ({
        audio: audioExportIdMap.get(m.audio_id)!,
        timestamp_seconds: m.timestamp_seconds,
        label: m.label,
        description: m.description || undefined,
        color: m.color || undefined,
      }))

    // Calendar
    const calendarConfig = db.prepare('SELECT * FROM calendar_config WHERE campaign_id = ?').get(campaignId) as {
      current_year: number
      current_month: number
      current_day: number
      year_zero_name: string | null
      era_name: string | null
      leap_year_interval: number | null
      leap_year_month: number | null
      leap_year_extra_days: number | null
    } | null

    const calendarMonths = db
      .prepare('SELECT name, days, sort_order FROM calendar_months WHERE campaign_id = ? ORDER BY sort_order')
      .all(campaignId) as Array<{ name: string; days: number; sort_order: number }>

    const calendarWeekdays = db
      .prepare('SELECT name, sort_order FROM calendar_weekdays WHERE campaign_id = ? ORDER BY sort_order')
      .all(campaignId) as Array<{ name: string; sort_order: number }>

    const calendarMoons = db.prepare('SELECT * FROM calendar_moons WHERE campaign_id = ?').all(campaignId) as Array<{
      name: string
      cycle_days: number
      full_moon_duration: number | null
      new_moon_duration: number | null
      phase_offset: number | null
    }>

    const calendarSeasons = db
      .prepare('SELECT * FROM calendar_seasons WHERE campaign_id = ? ORDER BY sort_order')
      .all(campaignId) as Array<{
      name: string
      start_month: number
      start_day: number
      background_image: string | null
      color: string | null
      icon: string | null
      weather_type: string | null
      sort_order: number
    }>

    const calendarEvents = db
      .prepare('SELECT * FROM calendar_events WHERE campaign_id = ?')
      .all(campaignId) as Array<{
      id: number
      title: string
      description: string | null
      event_type: string | null
      year: number | null
      month: number
      day: number
      is_recurring: number
      color: string | null
      entity_id: number | null
    }>

    let eventIndex = 1
    calendarEvents.forEach((e) => {
      eventExportIdMap.set(e.id, `event:${eventIndex++}`)
    })

    const calendarEventEntities = db
      .prepare(
        `
      SELECT cee.event_id, cee.entity_id, cee.entity_type
      FROM calendar_event_entities cee
      JOIN calendar_events ce ON cee.event_id = ce.id
      WHERE ce.campaign_id = ?
    `,
      )
      .all(campaignId) as Array<{
      event_id: number
      entity_id: number
      entity_type: string
    }>

    const calendarWeather = db
      .prepare('SELECT year, month, day, weather_type, temperature, notes FROM calendar_weather WHERE campaign_id = ?')
      .all(campaignId) as Array<{
      year: number
      month: number
      day: number
      weather_type: string
      temperature: number | null
      notes: string | null
    }>

    if (calendarConfig || calendarMonths.length > 0) {
      exportCalendar = {
        config: calendarConfig
          ? {
            current_year: calendarConfig.current_year,
            current_month: calendarConfig.current_month,
            current_day: calendarConfig.current_day,
            year_zero_name: calendarConfig.year_zero_name || undefined,
            era_name: calendarConfig.era_name || undefined,
            leap_year_interval: calendarConfig.leap_year_interval || undefined,
            leap_year_month: calendarConfig.leap_year_month || undefined,
            leap_year_extra_days: calendarConfig.leap_year_extra_days || undefined,
          }
          : undefined,
        months: calendarMonths,
        weekdays: calendarWeekdays,
        moons: calendarMoons.map((m) => ({
          name: m.name,
          cycle_days: m.cycle_days,
          full_moon_duration: m.full_moon_duration || undefined,
          new_moon_duration: m.new_moon_duration || undefined,
          phase_offset: m.phase_offset || undefined,
        })),
        seasons: calendarSeasons.map((s) => ({
          name: s.name,
          start_month: s.start_month,
          start_day: s.start_day,
          background_image: s.background_image || undefined,
          color: s.color || undefined,
          icon: s.icon || undefined,
          weather_type: (s.weather_type as 'winter' | 'spring' | 'summer' | 'autumn') || undefined,
          sort_order: s.sort_order,
        })),
        events: calendarEvents.map((e) => ({
          _exportId: eventExportIdMap.get(e.id)!,
          title: e.title,
          description: e.description || undefined,
          event_type: e.event_type || undefined,
          year: e.year || undefined,
          month: e.month,
          day: e.day,
          is_recurring: e.is_recurring === 1,
          color: e.color || undefined,
          entity: e.entity_id && entityIdSet.has(e.entity_id) ? entityExportIdMap.get(e.entity_id) : undefined,
        })),
        eventEntities: calendarEventEntities
          .filter((ee) => eventExportIdMap.has(ee.event_id) && entityIdSet.has(ee.entity_id))
          .map((ee) => ({
            event: eventExportIdMap.get(ee.event_id)!,
            entity: entityExportIdMap.get(ee.entity_id)!,
            entity_type: ee.entity_type,
          })),
        weather: calendarWeather.map((w) => ({
          year: w.year,
          month: w.month,
          day: w.day,
          weather_type: w.weather_type,
          temperature: w.temperature || undefined,
          notes: w.notes || undefined,
        })),
      }
    }

    // Maps
    const maps = db
      .prepare(
        `
      SELECT id, name, description, image_url, parent_map_id, version_name,
             default_zoom, min_zoom, max_zoom, scale_value, scale_unit, created_at, updated_at
      FROM campaign_maps
      WHERE campaign_id = ? AND deleted_at IS NULL
    `,
      )
      .all(campaignId) as Array<{
      id: number
      name: string
      description: string | null
      image_url: string
      parent_map_id: number | null
      version_name: string | null
      default_zoom: number | null
      min_zoom: number | null
      max_zoom: number | null
      scale_value: number | null
      scale_unit: string | null
      created_at: string
      updated_at: string
    }>

    maps.forEach((m, i) => {
      mapExportIdMap.set(m.id, `map:${i + 1}`)
    })

    exportMaps = maps.map((m) => {
      const archivePath = addFile(m.image_url, 'images/maps')
      return {
        _exportId: mapExportIdMap.get(m.id)!,
        name: m.name,
        description: m.description || undefined,
        image_url: archivePath || m.image_url,
        parent_map: m.parent_map_id && mapExportIdMap.has(m.parent_map_id) ? mapExportIdMap.get(m.parent_map_id) : undefined,
        version_name: m.version_name || undefined,
        default_zoom: m.default_zoom || undefined,
        min_zoom: m.min_zoom || undefined,
        max_zoom: m.max_zoom || undefined,
        scale_value: m.scale_value || undefined,
        scale_unit: m.scale_unit || undefined,
        created_at: m.created_at,
        updated_at: m.updated_at,
      }
    })

    // Map Markers
    const mapMarkers = db
      .prepare(
        `
      SELECT mm.map_id, mm.entity_id, mm.x, mm.y, mm.custom_icon, mm.custom_color, mm.custom_label, mm.notes
      FROM map_markers mm
      JOIN campaign_maps cm ON mm.map_id = cm.id
      WHERE cm.campaign_id = ? AND cm.deleted_at IS NULL
    `,
      )
      .all(campaignId) as Array<{
      map_id: number
      entity_id: number
      x: number
      y: number
      custom_icon: string | null
      custom_color: string | null
      custom_label: string | null
      notes: string | null
    }>

    exportMapMarkers = mapMarkers
      .filter((m) => mapExportIdMap.has(m.map_id) && entityIdSet.has(m.entity_id))
      .map((m) => ({
        map: mapExportIdMap.get(m.map_id)!,
        entity: entityExportIdMap.get(m.entity_id)!,
        x: m.x,
        y: m.y,
        custom_icon: m.custom_icon || undefined,
        custom_color: m.custom_color || undefined,
        custom_label: m.custom_label || undefined,
        notes: m.notes || undefined,
      }))

    // Map Areas
    const mapAreas = db
      .prepare(
        `
      SELECT ma.map_id, ma.location_id, ma.center_x, ma.center_y, ma.radius, ma.color
      FROM map_areas ma
      JOIN campaign_maps cm ON ma.map_id = cm.id
      WHERE cm.campaign_id = ? AND cm.deleted_at IS NULL
    `,
      )
      .all(campaignId) as Array<{
      map_id: number
      location_id: number
      center_x: number
      center_y: number
      radius: number
      color: string | null
    }>

    exportMapAreas = mapAreas
      .filter((a) => mapExportIdMap.has(a.map_id) && entityIdSet.has(a.location_id))
      .map((a) => ({
        map: mapExportIdMap.get(a.map_id)!,
        location: entityExportIdMap.get(a.location_id)!,
        center_x: a.center_x,
        center_y: a.center_y,
        radius: a.radius,
        color: a.color || undefined,
      }))

    // Currencies
    const currencies = db
      .prepare(
        'SELECT code, name, symbol, exchange_rate, sort_order, is_default FROM currencies WHERE campaign_id = ? ORDER BY sort_order',
      )
      .all(campaignId) as Array<{
      code: string
      name: string
      symbol: string | null
      exchange_rate: number
      sort_order: number
      is_default: number
    }>

    exportCurrencies = currencies.map((c) => ({
      code: c.code,
      name: c.name,
      symbol: c.symbol || undefined,
      exchange_rate: c.exchange_rate,
      sort_order: c.sort_order,
      is_default: c.is_default === 1,
    }))

    // Notes
    const notes = db
      .prepare('SELECT content, completed, sort_order, created_at, updated_at FROM campaign_notes WHERE campaign_id = ? ORDER BY sort_order')
      .all(campaignId) as Array<{
      content: string
      completed: number
      sort_order: number
      created_at: string
      updated_at: string
    }>

    exportNotes = notes.map((n) => ({
      content: n.content,
      completed: n.completed === 1,
      sort_order: n.sort_order,
      created_at: n.created_at,
      updated_at: n.updated_at,
    }))

    // Pinboard
    const pinboard = db
      .prepare(
        `
      SELECT p.entity_id, p.display_order
      FROM pinboard p
      WHERE p.campaign_id = ?
      ORDER BY p.display_order
    `,
      )
      .all(campaignId) as Array<{
      entity_id: number
      display_order: number
    }>

    exportPinboard = pinboard
      .filter((p) => entityIdSet.has(p.entity_id))
      .map((p) => ({
        entity: entityExportIdMap.get(p.entity_id)!,
        display_order: p.display_order,
      }))
  }

  // ==========================================================================
  // CUSTOM RACES & CLASSES (from NPC metadata)
  // ==========================================================================

  const customRaceKeys = new Set<string>()
  const customClassKeys = new Set<string>()
  const npcTypeId = entityTypes.find((t) => t.name === 'NPC')?.id

  for (const entity of exportEntities) {
    if (entity.type_id !== npcTypeId) continue
    const metadata = entity.metadata as Record<string, unknown> | undefined
    if (!metadata) continue

    if (typeof metadata.race === 'string' && metadata.race) {
      const raceKey = metadata.race.toLowerCase().replace(/\s+/g, '')
      if (!STANDARD_RACE_KEYS.has(raceKey)) {
        customRaceKeys.add(raceKey)
      }
    }
    if (typeof metadata.class === 'string' && metadata.class) {
      const classKey = metadata.class.toLowerCase().replace(/\s+/g, '')
      if (!STANDARD_CLASS_KEYS.has(classKey)) {
        customClassKeys.add(classKey)
      }
    }
  }

  let exportRaces: ExportRace[] = []
  if (customRaceKeys.size > 0) {
    const placeholders = Array.from(customRaceKeys).map(() => '?').join(',')
    const races = db.prepare(`SELECT name, name_de, name_en, description FROM races WHERE LOWER(name) IN (${placeholders}) AND deleted_at IS NULL`).all(...customRaceKeys) as Array<{ name: string; name_de: string | null; name_en: string | null; description: string | null }>
    exportRaces = races.map((r) => ({ name: r.name, name_de: r.name_de || undefined, name_en: r.name_en || undefined, description: r.description || undefined }))
  }

  let exportClasses: ExportClass[] = []
  if (customClassKeys.size > 0) {
    const placeholders = Array.from(customClassKeys).map(() => '?').join(',')
    const classes = db.prepare(`SELECT name, name_de, name_en, description FROM classes WHERE LOWER(name) IN (${placeholders}) AND deleted_at IS NULL`).all(...customClassKeys) as Array<{ name: string; name_de: string | null; name_en: string | null; description: string | null }>
    exportClasses = classes.map((c) => ({ name: c.name, name_de: c.name_de || undefined, name_en: c.name_en || undefined, description: c.description || undefined }))
  }

  // ==========================================================================
  // BUILD MANIFEST
  // ==========================================================================

  const manifest: CampaignExportManifest = {
    version: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    generator: 'dm-hero',
    generatorVersion: pkg.version,
    exportType: mode,
    entityTypes: exportEntityTypes,
    meta: meta || undefined,
    campaign: {
      name: campaign.name,
      description: campaign.description || undefined,
    },
    entities: exportEntities.length > 0 ? exportEntities : undefined,
    relations: exportRelations.length > 0 ? exportRelations : undefined,
    entityImages: exportEntityImages.length > 0 ? exportEntityImages : undefined,
    entityDocuments: exportEntityDocuments.length > 0 ? exportEntityDocuments : undefined,
    sessions: exportSessions.length > 0 ? exportSessions : undefined,
    sessionMentions: exportSessionMentions.length > 0 ? exportSessionMentions : undefined,
    sessionAttendance: exportSessionAttendance.length > 0 ? exportSessionAttendance : undefined,
    sessionImages: exportSessionImages.length > 0 ? exportSessionImages : undefined,
    sessionAudio: exportSessionAudio.length > 0 ? exportSessionAudio : undefined,
    audioMarkers: exportAudioMarkers.length > 0 ? exportAudioMarkers : undefined,
    calendar: exportCalendar,
    maps: exportMaps.length > 0 ? exportMaps : undefined,
    mapMarkers: exportMapMarkers.length > 0 ? exportMapMarkers : undefined,
    mapAreas: exportMapAreas.length > 0 ? exportMapAreas : undefined,
    currencies: exportCurrencies.length > 0 ? exportCurrencies : undefined,
    notes: exportNotes.length > 0 ? exportNotes : undefined,
    pinboard: exportPinboard.length > 0 ? exportPinboard : undefined,
    races: exportRaces.length > 0 ? exportRaces : undefined,
    classes: exportClasses.length > 0 ? exportClasses : undefined,
  }

  // ==========================================================================
  // CREATE ZIP
  // ==========================================================================

  const archive = archiver('zip', { zlib: { level: 9 } })
  const passthrough = new PassThrough()

  archive.pipe(passthrough)

  // Add manifest
  archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' })

  // Add files
  for (const file of filesToInclude) {
    if (existsSync(file.sourcePath)) {
      archive.file(file.sourcePath, { name: file.archivePath })
    }
  }

  // Finalize
  archive.finalize()

  // Set response headers
  const fileName = `${campaign.name.replace(/[^a-zA-Z0-9-_]/g, '-')}.dmhero`
  setHeader(event, 'Content-Type', 'application/zip')
  setHeader(event, 'Content-Disposition', `attachment; filename="${fileName}"`)

  return passthrough
})
