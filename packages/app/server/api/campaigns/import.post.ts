import { createWriteStream, mkdirSync, existsSync } from 'fs'
import { readFile, rm } from 'fs/promises'
import { join, dirname, extname } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { pipeline } from 'stream/promises'
import { getDb } from '~~/server/utils/db'
import { getUploadPath } from '~~/server/utils/paths'
import { STANDARD_RACE_KEYS, STANDARD_CLASS_KEYS } from '~~/server/utils/i18n-lookup'
import type {
  RaceClassConflict,
  CampaignExportManifest,
  ImportOptions,
  ImportResult,
  IdMapping,
  ExportEntity,
  ImportConflictInfo,
  ImportTracking,
} from '~~/types/export'
import { isExportCompatible } from '~~/types/export'

// Get app version from package.json
import pkg from '~~/package.json'

// Dynamic import for unzipper (ESM)
let unzipper: typeof import('unzipper')

async function getUnzipper() {
  if (!unzipper) {
    unzipper = await import('unzipper')
  }
  return unzipper
}

export default defineEventHandler(async (event) => {
  const formData = await readMultipartFormData(event)

  if (!formData || formData.length === 0) {
    throw createError({ statusCode: 400, message: 'No file uploaded' })
  }

  // Find the file and options
  let fileBuffer: Buffer | null = null
  let options: ImportOptions = { mode: 'new' }

  for (const part of formData) {
    if (part.name === 'file' && part.data) {
      fileBuffer = part.data
    } else if (part.name === 'options' && part.data) {
      try {
        options = JSON.parse(part.data.toString())
      } catch {
        // Use defaults
      }
    }
  }

  if (!fileBuffer) {
    throw createError({ statusCode: 400, message: 'No .dmhero file provided' })
  }

  const db = getDb()
  const uploadPath = getUploadPath()

  // Create temp directory for extraction
  const tempDir = join(tmpdir(), `dmhero-import-${randomUUID()}`)
  mkdirSync(tempDir, { recursive: true })

  const stats: ImportResult['stats'] = {
    entitiesImported: 0,
    relationsImported: 0,
    sessionsImported: 0,
    mapsImported: 0,
    imagesImported: 0,
    documentsImported: 0,
    racesImported: 0,
    classesImported: 0,
    skipped: 0,
    warnings: [],
    entitiesDeleted: 0,
  }

  const idMapping: IdMapping = {
    entities: new Map(),
    sessions: new Map(),
    documents: new Map(),
    events: new Map(),
    maps: new Map(),
    audio: new Map(),
  }

  let campaignId: number = 0
  let manifest: CampaignExportManifest

  try {
    // Extract ZIP
    const uz = await getUnzipper()
    const directory = await uz.Open.buffer(fileBuffer)

    // Extract all files to temp dir
    for (const file of directory.files) {
      if (file.type === 'File') {
        const targetPath = join(tempDir, file.path)
        mkdirSync(dirname(targetPath), { recursive: true })
        const writeStream = createWriteStream(targetPath)
        await pipeline(file.stream(), writeStream)
      }
    }

    // Read manifest
    const manifestPath = join(tempDir, 'manifest.json')
    if (!existsSync(manifestPath)) {
      throw createError({ statusCode: 400, message: 'Invalid .dmhero file: manifest.json not found' })
    }

    const manifestContent = await readFile(manifestPath, 'utf-8')
    manifest = JSON.parse(manifestContent) as CampaignExportManifest

    // Validate generator
    if (manifest.generator !== 'dm-hero') {
      throw createError({ statusCode: 400, message: 'Invalid .dmhero file: unknown generator' })
    }

    // Check version compatibility
    if (!isExportCompatible(manifest.version, pkg.version)) {
      throw createError({
        statusCode: 400,
        message: `Export format v${manifest.version} requires app version ${manifest.generatorVersion} or later. Please update DM Hero.`,
      })
    }

    // Build type_name -> local type_id mapping
    const localEntityTypes = db.prepare('SELECT id, name FROM entity_types').all() as Array<{
      id: number
      name: string
    }>
    const typeNameToLocalId = new Map<string, number>(localEntityTypes.map((t) => [t.name, t.id]))

    // For v1.0 exports that don't have entityTypes, use a fallback (hardcoded for backwards compat)
    // v1.1+ exports include entityTypes and type_name on each entity
    const fallbackTypeIdToName: Record<number, string> = {
      1: 'NPC',
      2: 'Location',
      3: 'Item',
      4: 'Faction',
      5: 'Quest',
      6: 'Lore',
      7: 'Player',
    }

    // Helper to resolve entity type_id for import
    const resolveTypeId = (entity: ExportEntity): number => {
      // v1.1+: Use type_name if available
      if (entity.type_name) {
        const localId = typeNameToLocalId.get(entity.type_name)
        if (localId) return localId
        stats.warnings.push(`Unknown entity type "${entity.type_name}" for ${entity.name}, using original type_id`)
      }

      // v1.0 or fallback: Map source type_id to type_name, then to local type_id
      const typeName = fallbackTypeIdToName[entity.type_id]
      if (typeName) {
        const localId = typeNameToLocalId.get(typeName)
        if (localId) return localId
      }

      // Last resort: use the original type_id (assumes same DB structure)
      return entity.type_id
    }

    // ==========================================================================
    // CREATE OR MERGE CAMPAIGN
    // ==========================================================================

    if (options.mode === 'new') {
      // Create new campaign
      const campaignName = options.campaignName || manifest.campaign.name
      const result = db
        .prepare('INSERT INTO campaigns (name, description, created_at, updated_at) VALUES (?, ?, datetime(), datetime())')
        .run(campaignName, manifest.campaign.description || null)
      campaignId = result.lastInsertRowid as number
    } else if (options.mode === 'merge' && options.targetCampaignId) {
      // Verify target campaign exists
      const existing = db.prepare('SELECT id FROM campaigns WHERE id = ? AND deleted_at IS NULL').get(options.targetCampaignId)
      if (!existing) {
        throw createError({ statusCode: 404, message: 'Target campaign not found' })
      }
      campaignId = options.targetCampaignId
    } else {
      throw createError({ statusCode: 400, message: 'Invalid import options' })
    }

    // ==========================================================================
    // CONFLICT DETECTION (for merge mode only)
    // ==========================================================================

    const conflictInfo: ImportConflictInfo = {
      isStoreUpdate: false,
      existingCount: 0,
      duplicates: [],
    }

    // Get sourceAdventureSlug from manifest or options
    const sourceAdventureSlug = options.sourceAdventureSlug || manifest.sourceAdventureSlug

    if (options.mode === 'merge' && manifest.entities && manifest.entities.length > 0) {
      // Check 1: Store-Update scenario (same adventure slug)
      if (sourceAdventureSlug) {
        const existingFromSameAdventure = db
          .prepare(
            `
          SELECT id, name FROM entities
          WHERE campaign_id = ?
          AND deleted_at IS NULL
          AND json_extract(metadata, '$._importTracking.sourceAdventureSlug') = ?
        `,
          )
          .all(campaignId, sourceAdventureSlug) as Array<{ id: number; name: string }>

        if (existingFromSameAdventure.length > 0) {
          conflictInfo.isStoreUpdate = true
          conflictInfo.sourceAdventureSlug = sourceAdventureSlug
          conflictInfo.existingCount = existingFromSameAdventure.length
        }
      }

      // Check 2: Name+Type duplicates (only if not a store update)
      if (!conflictInfo.isStoreUpdate) {
        for (const entity of manifest.entities) {
          const localTypeId = resolveTypeId(entity)
          const typeName = entity.type_name || fallbackTypeIdToName[entity.type_id] || 'Unknown'

          const existing = db
            .prepare(
              `
            SELECT id, name FROM entities
            WHERE campaign_id = ?
            AND type_id = ?
            AND LOWER(name) = LOWER(?)
            AND deleted_at IS NULL
          `,
            )
            .get(campaignId, localTypeId, entity.name) as { id: number; name: string } | undefined

          if (existing) {
            conflictInfo.duplicates.push({
              name: entity.name,
              typeName,
              existingId: existing.id,
            })
          }
        }
      }
    }

    // ==========================================================================
    // RACE/CLASS CONFLICT DETECTION (global, always checked)
    // ==========================================================================

    const raceClassConflicts: RaceClassConflict[] = []

    // Check races from manifest
    if (manifest.races && manifest.races.length > 0) {
      for (const race of manifest.races) {
        const key = race.name.toLowerCase().replace(/\s+/g, '')

        // Standard races are already in the DB - skip silently (no conflict)
        if (STANDARD_RACE_KEYS.has(key)) {
          continue
        }

        // Check if key exists in user's races table (not soft-deleted)
        const existing = db.prepare('SELECT name, name_de, name_en, description FROM races WHERE name = ? AND deleted_at IS NULL').get(key) as {
          name: string
          name_de: string | null
          name_en: string | null
          description: string | null
        } | undefined

        if (existing) {
          // Custom race exists → show conflict dialog
          raceClassConflicts.push({
            type: 'race',
            key,
            imported: { name_de: race.name_de, name_en: race.name_en, description: race.description },
            existing: { name_de: existing.name_de || undefined, name_en: existing.name_en || undefined, description: existing.description || undefined },
            isStandard: false,
          })
        }
      }
    }

    // Check classes from manifest
    if (manifest.classes && manifest.classes.length > 0) {
      for (const cls of manifest.classes) {
        const key = cls.name.toLowerCase().replace(/\s+/g, '')

        // Standard classes are already in the DB - skip silently (no conflict)
        if (STANDARD_CLASS_KEYS.has(key)) {
          continue
        }

        // Check if key exists in user's classes table (not soft-deleted)
        const existing = db.prepare('SELECT name, name_de, name_en, description FROM classes WHERE name = ? AND deleted_at IS NULL').get(key) as {
          name: string
          name_de: string | null
          name_en: string | null
          description: string | null
        } | undefined

        if (existing) {
          // Custom class exists → show conflict dialog
          raceClassConflicts.push({
            type: 'class',
            key,
            imported: { name_de: cls.name_de, name_en: cls.name_en, description: cls.description },
            existing: { name_de: existing.name_de || undefined, name_en: existing.name_en || undefined, description: existing.description || undefined },
            isStandard: false,
          })
        }
      }
    }

    if (raceClassConflicts.length > 0) {
      conflictInfo.raceClassConflicts = raceClassConflicts
    }

    // Check if user has provided resolutions for all race/class conflicts
    // Only check conflicts that actually exist - don't require both raceResolutions AND classResolutions
    const hasUnresolvedRaceClassConflicts = raceClassConflicts.length > 0 &&
      raceClassConflicts.some((c) => {
        const resolutions = c.type === 'race' ? options.raceResolutions : options.classResolutions
        return !resolutions || !(c.key in resolutions)
      })

    // Race/class conflicts apply to ALL modes (they are global, not campaign-scoped)
    if (hasUnresolvedRaceClassConflicts) {
      // Clean up temp directory
      await rm(tempDir, { recursive: true, force: true })

      return {
        success: false,
        campaignId,
        stats,
        conflictInfo,
        requiresConfirmation: true,
      } as ImportResult
    }

    if (options.mode === 'merge' && manifest.entities && manifest.entities.length > 0) {
      // If entity conflicts detected and user hasn't confirmed, return early
      const hasEntityConflicts = conflictInfo.isStoreUpdate || conflictInfo.duplicates.length > 0
      if (hasEntityConflicts && !options.confirmedOverwrite) {
        // Clean up temp directory
        await rm(tempDir, { recursive: true, force: true })

        return {
          success: false,
          campaignId,
          stats,
          conflictInfo,
          requiresConfirmation: true,
        } as ImportResult
      }

      // User confirmed: soft-delete conflicting entities
      if (hasEntityConflicts && options.confirmedOverwrite) {
        const softDelete = db.prepare(`
          UPDATE entities SET deleted_at = datetime('now') WHERE id = ?
        `)

        if (conflictInfo.isStoreUpdate && sourceAdventureSlug) {
          // Delete ALL entities from the same adventure
          const toDelete = db
            .prepare(
              `
            SELECT id FROM entities
            WHERE campaign_id = ?
            AND deleted_at IS NULL
            AND json_extract(metadata, '$._importTracking.sourceAdventureSlug') = ?
          `,
            )
            .all(campaignId, sourceAdventureSlug) as Array<{ id: number }>

          for (const entity of toDelete) {
            softDelete.run(entity.id)
          }
          stats.entitiesDeleted = toDelete.length
        } else {
          // Delete only duplicates by name+type
          for (const dup of conflictInfo.duplicates) {
            softDelete.run(dup.existingId)
          }
          stats.entitiesDeleted = conflictInfo.duplicates.length
        }
      }
    }

    // Determine import version for tracking
    let importVersion = 1
    if (sourceAdventureSlug && options.mode === 'merge') {
      // Check if we've imported this adventure before (get max version)
      const maxVersion = db
        .prepare(
          `
        SELECT MAX(CAST(json_extract(metadata, '$._importTracking.importVersion') AS INTEGER)) as maxVer
        FROM entities
        WHERE campaign_id = ?
        AND json_extract(metadata, '$._importTracking.sourceAdventureSlug') = ?
      `,
        )
        .get(campaignId, sourceAdventureSlug) as { maxVer: number | null } | undefined

      if (maxVersion?.maxVer) {
        importVersion = maxVersion.maxVer + 1
      }
    }

    // Build import tracking object
    const importTracking: ImportTracking = {
      sourceAdventureSlug: sourceAdventureSlug || undefined,
      sourceVersion: manifest.sourceVersion || undefined,
      importedAt: new Date().toISOString(),
      importVersion,
    }

    // Helper to copy file from temp to data directory
    const copyFile = async (archivePath: string | undefined, targetFolder: string): Promise<string | null> => {
      if (!archivePath) return null

      const sourcePath = join(tempDir, archivePath)
      if (!existsSync(sourcePath)) {
        stats.warnings.push(`File not found in archive: ${archivePath}`)
        return null
      }

      const fileName = `${randomUUID()}${extname(archivePath)}`
      const targetDir = join(uploadPath, targetFolder)
      mkdirSync(targetDir, { recursive: true })

      const targetPath = join(targetDir, fileName)
      const content = await readFile(sourcePath)

      // Write file with proper completion handling
      await new Promise<void>((resolve, reject) => {
        const writeStream = createWriteStream(targetPath)
        writeStream.on('finish', resolve)
        writeStream.on('error', reject)
        writeStream.write(content)
        writeStream.end()
      })

      return `/api/uploads/${targetFolder}/${fileName}`
    }

    // ==========================================================================
    // IMPORT ENTITIES
    // ==========================================================================

    if (manifest.entities && manifest.entities.length > 0) {
      const insertEntity = db.prepare(`
        INSERT INTO entities (campaign_id, type_id, name, description, metadata, image_url, location_id, parent_entity_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      // First pass: insert all entities without references (location_id, parent_entity_id)
      for (const entity of manifest.entities) {
        const imageUrl = await copyFile(entity.image_url, 'entities')
        if (entity.image_url && imageUrl) stats.imagesImported++

        // Resolve type_id from type_name (v1.1+) or use fallback mapping (v1.0)
        const localTypeId = resolveTypeId(entity)

        // Merge import tracking into metadata
        const metadataWithTracking = {
          ...(entity.metadata || {}),
          _importTracking: importTracking,
        }

        const result = insertEntity.run(
          campaignId,
          localTypeId,
          entity.name,
          entity.description || null,
          JSON.stringify(metadataWithTracking),
          imageUrl,
          null, // location_id - set in second pass
          null, // parent_entity_id - set in second pass
          entity.created_at || new Date().toISOString(),
          entity.updated_at || new Date().toISOString(),
        )

        idMapping.entities.set(entity._exportId, result.lastInsertRowid as number)
        stats.entitiesImported++
      }

      // Second pass: update references
      const updateRefs = db.prepare(`
        UPDATE entities SET location_id = ?, parent_entity_id = ? WHERE id = ?
      `)

      for (const entity of manifest.entities) {
        const newId = idMapping.entities.get(entity._exportId)
        if (!newId) continue

        const locationId = entity.location_id ? idMapping.entities.get(entity.location_id) : null
        const parentId = entity.parent_entity_id ? idMapping.entities.get(entity.parent_entity_id) : null

        if (locationId || parentId) {
          updateRefs.run(locationId || null, parentId || null, newId)
        }
      }
    }

    // ==========================================================================
    // IMPORT RELATIONS
    // ==========================================================================

    if (manifest.relations && manifest.relations.length > 0) {
      const insertRelation = db.prepare(`
        INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type, notes)
        VALUES (?, ?, ?, ?)
      `)

      for (const relation of manifest.relations) {
        const fromId = idMapping.entities.get(relation.from_entity)
        const toId = idMapping.entities.get(relation.to_entity)

        if (fromId && toId) {
          insertRelation.run(fromId, toId, relation.relation_type, relation.notes || null)
          stats.relationsImported++
        } else {
          stats.warnings.push('Skipped relation: missing entity reference')
          stats.skipped++
        }
      }
    }

    // ==========================================================================
    // IMPORT ENTITY IMAGES
    // ==========================================================================

    if (manifest.entityImages && manifest.entityImages.length > 0) {
      const insertImage = db.prepare(`
        INSERT INTO entity_images (entity_id, image_url, caption, is_primary, display_order)
        VALUES (?, ?, ?, ?, ?)
      `)

      for (const img of manifest.entityImages) {
        const entityId = idMapping.entities.get(img.entity)
        if (!entityId) {
          stats.skipped++
          continue
        }

        const imageUrl = await copyFile(img.image_url, 'entities')
        if (imageUrl) {
          insertImage.run(entityId, imageUrl, img.caption || null, img.is_primary ? 1 : 0, img.display_order)
          stats.imagesImported++
        }
      }
    }

    // ==========================================================================
    // IMPORT ENTITY DOCUMENTS
    // ==========================================================================

    if (manifest.entityDocuments && manifest.entityDocuments.length > 0) {
      const insertDoc = db.prepare(`
        INSERT INTO entity_documents (entity_id, title, content, file_path, file_type, date, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)

      for (const doc of manifest.entityDocuments) {
        const entityId = idMapping.entities.get(doc.entity)
        if (!entityId) {
          stats.skipped++
          continue
        }

        const filePath = await copyFile(doc.file_path, 'documents')

        const result = insertDoc.run(
          entityId,
          doc.title,
          doc.content || null,
          filePath,
          doc.file_type,
          doc.date || null,
          doc.sort_order,
        )

        idMapping.documents.set(doc._exportId, result.lastInsertRowid as number)
        stats.documentsImported++
      }
    }

    // ==========================================================================
    // IMPORT SESSIONS (full export only)
    // ==========================================================================

    if (manifest.sessions && manifest.sessions.length > 0) {
      const insertSession = db.prepare(`
        INSERT INTO sessions (campaign_id, session_number, title, date, summary, notes,
          in_game_date_start, in_game_date_end, in_game_day_start, in_game_day_end,
          duration_minutes, calendar_event_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      for (const session of manifest.sessions) {
        // calendar_event will be linked after events are imported
        const result = insertSession.run(
          campaignId,
          session.session_number,
          session.title || null,
          session.date || null,
          session.summary || null,
          session.notes || null,
          session.in_game_date_start || null,
          session.in_game_date_end || null,
          session.in_game_day_start || null,
          session.in_game_day_end || null,
          session.duration_minutes || null,
          null, // calendar_event_id - set later
          session.created_at || new Date().toISOString(),
          session.updated_at || new Date().toISOString(),
        )

        idMapping.sessions.set(session._exportId, result.lastInsertRowid as number)
        stats.sessionsImported++
      }
    }

    // ==========================================================================
    // IMPORT SESSION MENTIONS
    // ==========================================================================

    if (manifest.sessionMentions && manifest.sessionMentions.length > 0) {
      const insertMention = db.prepare(`
        INSERT INTO session_mentions (session_id, entity_id, context)
        VALUES (?, ?, ?)
      `)

      for (const mention of manifest.sessionMentions) {
        const sessionId = idMapping.sessions.get(mention.session)
        const entityId = idMapping.entities.get(mention.entity)

        if (sessionId && entityId) {
          insertMention.run(sessionId, entityId, mention.context || null)
        } else {
          stats.skipped++
        }
      }
    }

    // ==========================================================================
    // IMPORT SESSION ATTENDANCE
    // ==========================================================================

    if (manifest.sessionAttendance && manifest.sessionAttendance.length > 0) {
      const insertAttendance = db.prepare(`
        INSERT INTO session_attendance (session_id, player_id, character_id, attended, notes)
        VALUES (?, ?, ?, ?, ?)
      `)

      for (const attendance of manifest.sessionAttendance) {
        const sessionId = idMapping.sessions.get(attendance.session)
        const playerId = idMapping.entities.get(attendance.player)
        const characterId = attendance.character ? idMapping.entities.get(attendance.character) : null

        if (sessionId && playerId) {
          insertAttendance.run(sessionId, playerId, characterId || null, attendance.attended ? 1 : 0, attendance.notes || null)
        } else {
          stats.skipped++
        }
      }
    }

    // ==========================================================================
    // IMPORT SESSION IMAGES
    // ==========================================================================

    if (manifest.sessionImages && manifest.sessionImages.length > 0) {
      const insertImage = db.prepare(`
        INSERT INTO session_images (session_id, image_url, caption, is_primary, display_order)
        VALUES (?, ?, ?, ?, ?)
      `)

      for (const img of manifest.sessionImages) {
        const sessionId = idMapping.sessions.get(img.session)
        if (!sessionId) {
          stats.skipped++
          continue
        }

        const imageUrl = await copyFile(img.image_url, 'sessions')
        if (imageUrl) {
          insertImage.run(sessionId, imageUrl, img.caption || null, img.is_primary ? 1 : 0, img.display_order)
          stats.imagesImported++
        }
      }
    }

    // ==========================================================================
    // IMPORT SESSION AUDIO
    // ==========================================================================

    if (manifest.sessionAudio && manifest.sessionAudio.length > 0) {
      const insertAudio = db.prepare(`
        INSERT INTO session_audio (session_id, audio_url, title, description, duration_seconds, mime_type, display_order)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)

      for (const audio of manifest.sessionAudio) {
        const sessionId = idMapping.sessions.get(audio.session)
        if (!sessionId) {
          stats.skipped++
          continue
        }

        const audioUrl = await copyFile(audio.audio_url, 'audio')
        if (audioUrl) {
          const result = insertAudio.run(
            sessionId,
            audioUrl,
            audio.title || null,
            audio.description || null,
            audio.duration_seconds || null,
            audio.mime_type || null,
            audio.display_order,
          )
          idMapping.audio.set(audio._exportId, result.lastInsertRowid as number)
        }
      }
    }

    // ==========================================================================
    // IMPORT AUDIO MARKERS
    // ==========================================================================

    if (manifest.audioMarkers && manifest.audioMarkers.length > 0) {
      const insertMarker = db.prepare(`
        INSERT INTO audio_markers (audio_id, timestamp_seconds, label, description, color)
        VALUES (?, ?, ?, ?, ?)
      `)

      for (const marker of manifest.audioMarkers) {
        const audioId = idMapping.audio.get(marker.audio)
        if (audioId) {
          insertMarker.run(audioId, marker.timestamp_seconds, marker.label, marker.description || null, marker.color || null)
        } else {
          stats.skipped++
        }
      }
    }

    // ==========================================================================
    // IMPORT CALENDAR
    // ==========================================================================

    if (manifest.calendar) {
      const cal = manifest.calendar

      // Calendar Config
      if (cal.config) {
        db.prepare(`
          INSERT OR REPLACE INTO calendar_config (campaign_id, current_year, current_month, current_day,
            year_zero_name, era_name, leap_year_interval, leap_year_month, leap_year_extra_days)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          campaignId,
          cal.config.current_year,
          cal.config.current_month,
          cal.config.current_day,
          cal.config.year_zero_name || null,
          cal.config.era_name || null,
          cal.config.leap_year_interval || null,
          cal.config.leap_year_month || null,
          cal.config.leap_year_extra_days || null,
        )
      }

      // Months
      if (cal.months && cal.months.length > 0) {
        const insertMonth = db.prepare(`
          INSERT INTO calendar_months (campaign_id, name, days, sort_order)
          VALUES (?, ?, ?, ?)
        `)
        for (const month of cal.months) {
          insertMonth.run(campaignId, month.name, month.days, month.sort_order)
        }
      }

      // Weekdays
      if (cal.weekdays && cal.weekdays.length > 0) {
        const insertWeekday = db.prepare(`
          INSERT INTO calendar_weekdays (campaign_id, name, sort_order)
          VALUES (?, ?, ?)
        `)
        for (const weekday of cal.weekdays) {
          insertWeekday.run(campaignId, weekday.name, weekday.sort_order)
        }
      }

      // Moons
      if (cal.moons && cal.moons.length > 0) {
        const insertMoon = db.prepare(`
          INSERT INTO calendar_moons (campaign_id, name, cycle_days, full_moon_duration, new_moon_duration, phase_offset)
          VALUES (?, ?, ?, ?, ?, ?)
        `)
        for (const moon of cal.moons) {
          insertMoon.run(
            campaignId,
            moon.name,
            moon.cycle_days,
            moon.full_moon_duration || null,
            moon.new_moon_duration || null,
            moon.phase_offset || null,
          )
        }
      }

      // Seasons
      if (cal.seasons && cal.seasons.length > 0) {
        const insertSeason = db.prepare(`
          INSERT INTO calendar_seasons (campaign_id, name, start_month, start_day, background_image, color, icon, weather_type, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        for (const season of cal.seasons) {
          insertSeason.run(
            campaignId,
            season.name,
            season.start_month,
            season.start_day,
            season.background_image || null,
            season.color || null,
            season.icon || null,
            season.weather_type || null,
            season.sort_order,
          )
        }
      }

      // Events
      if (cal.events && cal.events.length > 0) {
        const insertEvent = db.prepare(`
          INSERT INTO calendar_events (campaign_id, title, description, event_type, year, month, day, is_recurring, color, entity_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        for (const evt of cal.events) {
          const entityId = evt.entity ? idMapping.entities.get(evt.entity) : null
          const result = insertEvent.run(
            campaignId,
            evt.title,
            evt.description || null,
            evt.event_type || null,
            evt.year || null,
            evt.month,
            evt.day,
            evt.is_recurring ? 1 : 0,
            evt.color || null,
            entityId || null,
          )
          idMapping.events.set(evt._exportId, result.lastInsertRowid as number)
        }
      }

      // Event Entities (many-to-many)
      if (cal.eventEntities && cal.eventEntities.length > 0) {
        const insertEventEntity = db.prepare(`
          INSERT INTO calendar_event_entities (event_id, entity_id, entity_type)
          VALUES (?, ?, ?)
        `)
        for (const ee of cal.eventEntities) {
          const eventId = idMapping.events.get(ee.event)
          const entityId = idMapping.entities.get(ee.entity)
          if (eventId && entityId) {
            insertEventEntity.run(eventId, entityId, ee.entity_type)
          }
        }
      }

      // Weather
      if (cal.weather && cal.weather.length > 0) {
        const insertWeather = db.prepare(`
          INSERT INTO calendar_weather (campaign_id, year, month, day, weather_type, temperature, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        for (const w of cal.weather) {
          insertWeather.run(campaignId, w.year, w.month, w.day, w.weather_type, w.temperature || null, w.notes || null)
        }
      }

      // Link sessions to calendar events
      if (manifest.sessions) {
        const updateSession = db.prepare('UPDATE sessions SET calendar_event_id = ? WHERE id = ?')
        for (const session of manifest.sessions) {
          if (session.calendar_event) {
            const sessionId = idMapping.sessions.get(session._exportId)
            const eventId = idMapping.events.get(session.calendar_event)
            if (sessionId && eventId) {
              updateSession.run(eventId, sessionId)
            }
          }
        }
      }
    }

    // ==========================================================================
    // IMPORT MAPS
    // ==========================================================================

    if (manifest.maps && manifest.maps.length > 0) {
      const insertMap = db.prepare(`
        INSERT INTO campaign_maps (campaign_id, name, description, image_url, parent_map_id, version_name,
          default_zoom, min_zoom, max_zoom, scale_value, scale_unit, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      // First pass: insert without parent_map
      for (const map of manifest.maps) {
        const imageUrl = await copyFile(map.image_url, 'maps')
        if (!imageUrl) {
          stats.warnings.push(`Map ${map.name}: image not found`)
          continue
        }

        const result = insertMap.run(
          campaignId,
          map.name,
          map.description || null,
          imageUrl,
          null, // parent_map_id - set in second pass
          map.version_name || null,
          map.default_zoom || null,
          map.min_zoom || null,
          map.max_zoom || null,
          map.scale_value || null,
          map.scale_unit || null,
          map.created_at || new Date().toISOString(),
          map.updated_at || new Date().toISOString(),
        )

        idMapping.maps.set(map._exportId, result.lastInsertRowid as number)
        stats.mapsImported++
      }

      // Second pass: update parent_map references
      const updateParent = db.prepare('UPDATE campaign_maps SET parent_map_id = ? WHERE id = ?')
      for (const map of manifest.maps) {
        if (map.parent_map) {
          const mapId = idMapping.maps.get(map._exportId)
          const parentId = idMapping.maps.get(map.parent_map)
          if (mapId && parentId) {
            updateParent.run(parentId, mapId)
          }
        }
      }
    }

    // ==========================================================================
    // IMPORT MAP MARKERS
    // ==========================================================================

    if (manifest.mapMarkers && manifest.mapMarkers.length > 0) {
      const insertMarker = db.prepare(`
        INSERT INTO map_markers (map_id, entity_id, x, y, custom_icon, custom_color, custom_label, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)

      for (const marker of manifest.mapMarkers) {
        const mapId = idMapping.maps.get(marker.map)
        const entityId = idMapping.entities.get(marker.entity)

        if (mapId && entityId) {
          insertMarker.run(
            mapId,
            entityId,
            marker.x,
            marker.y,
            marker.custom_icon || null,
            marker.custom_color || null,
            marker.custom_label || null,
            marker.notes || null,
          )
        } else {
          stats.skipped++
        }
      }
    }

    // ==========================================================================
    // IMPORT MAP AREAS
    // ==========================================================================

    if (manifest.mapAreas && manifest.mapAreas.length > 0) {
      const insertArea = db.prepare(`
        INSERT INTO map_areas (map_id, location_id, center_x, center_y, radius, color)
        VALUES (?, ?, ?, ?, ?, ?)
      `)

      for (const area of manifest.mapAreas) {
        const mapId = idMapping.maps.get(area.map)
        const locationId = idMapping.entities.get(area.location)

        if (mapId && locationId) {
          insertArea.run(mapId, locationId, area.center_x, area.center_y, area.radius, area.color || null)
        } else {
          stats.skipped++
        }
      }
    }

    // ==========================================================================
    // IMPORT CURRENCIES
    // ==========================================================================

    if (manifest.currencies && manifest.currencies.length > 0) {
      const insertCurrency = db.prepare(`
        INSERT INTO currencies (campaign_id, code, name, symbol, exchange_rate, sort_order, is_default)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)

      for (const currency of manifest.currencies) {
        insertCurrency.run(
          campaignId,
          currency.code,
          currency.name,
          currency.symbol || null,
          currency.exchange_rate,
          currency.sort_order,
          currency.is_default ? 1 : 0,
        )
      }
    }

    // ==========================================================================
    // IMPORT NOTES
    // ==========================================================================

    if (manifest.notes && manifest.notes.length > 0) {
      const insertNote = db.prepare(`
        INSERT INTO campaign_notes (campaign_id, content, completed, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `)

      for (const note of manifest.notes) {
        insertNote.run(
          campaignId,
          note.content,
          note.completed ? 1 : 0,
          note.sort_order,
          note.created_at || new Date().toISOString(),
          note.updated_at || new Date().toISOString(),
        )
      }
    }

    // ==========================================================================
    // IMPORT PINBOARD
    // ==========================================================================

    if (manifest.pinboard && manifest.pinboard.length > 0) {
      const insertPin = db.prepare(`
        INSERT INTO pinboard (campaign_id, entity_id, display_order)
        VALUES (?, ?, ?)
      `)

      for (const pin of manifest.pinboard) {
        const entityId = idMapping.entities.get(pin.entity)
        if (entityId) {
          insertPin.run(campaignId, entityId, pin.display_order)
        } else {
          stats.skipped++
        }
      }
    }

    // ==========================================================================
    // IMPORT RACES (global, not campaign-scoped)
    // ==========================================================================

    if (manifest.races && manifest.races.length > 0) {
      for (const race of manifest.races) {
        const key = race.name.toLowerCase().replace(/\s+/g, '')

        // Standard races - skip
        if (STANDARD_RACE_KEYS.has(key)) {
          continue
        }

        // Check if race exists at all (including soft-deleted)
        const existing = db.prepare('SELECT id, deleted_at FROM races WHERE name = ?').get(key) as { id: number; deleted_at: string | null } | undefined

        if (existing && existing.deleted_at) {
          // Soft-deleted: restore it with new data
          db.prepare('UPDATE races SET name_de = ?, name_en = ?, description = ?, deleted_at = NULL WHERE name = ?')
            .run(race.name_de || null, race.name_en || null, race.description || null, key)
          stats.racesImported++
        } else if (existing) {
          // Active: check if conflict resolution provided
          const resolution = options.raceResolutions?.[key]
          if (resolution === 'overwrite') {
            db.prepare('UPDATE races SET name_de = ?, name_en = ?, description = ? WHERE name = ?')
              .run(race.name_de || null, race.name_en || null, race.description || null, key)
            stats.racesImported++
          }
          // 'keep' or identical = do nothing, already exists
        } else {
          // Doesn't exist: insert new
          db.prepare('INSERT INTO races (name, name_de, name_en, description) VALUES (?, ?, ?, ?)')
            .run(key, race.name_de || null, race.name_en || null, race.description || null)
          stats.racesImported++
        }
      }
    }

    // ==========================================================================
    // IMPORT CLASSES (global, not campaign-scoped)
    // ==========================================================================

    if (manifest.classes && manifest.classes.length > 0) {
      for (const cls of manifest.classes) {
        const key = cls.name.toLowerCase().replace(/\s+/g, '')

        // Standard classes - skip
        if (STANDARD_CLASS_KEYS.has(key)) {
          continue
        }

        // Check if class exists at all (including soft-deleted)
        const existing = db.prepare('SELECT id, deleted_at FROM classes WHERE name = ?').get(key) as { id: number; deleted_at: string | null } | undefined

        if (existing && existing.deleted_at) {
          // Soft-deleted: restore it with new data
          db.prepare('UPDATE classes SET name_de = ?, name_en = ?, description = ?, deleted_at = NULL WHERE name = ?')
            .run(cls.name_de || null, cls.name_en || null, cls.description || null, key)
          stats.classesImported++
        } else if (existing) {
          // Active: check if conflict resolution provided
          const resolution = options.classResolutions?.[key]
          if (resolution === 'overwrite') {
            db.prepare('UPDATE classes SET name_de = ?, name_en = ?, description = ? WHERE name = ?')
              .run(cls.name_de || null, cls.name_en || null, cls.description || null, key)
            stats.classesImported++
          }
          // 'keep' or identical = do nothing, already exists
        } else {
          // Doesn't exist: insert new
          db.prepare('INSERT INTO classes (name, name_de, name_en, description) VALUES (?, ?, ?, ?)')
            .run(key, cls.name_de || null, cls.name_en || null, cls.description || null)
          stats.classesImported++
        }
      }
    }

    // Clean up temp directory
    await rm(tempDir, { recursive: true, force: true })

    return {
      success: true,
      campaignId,
      stats,
    } as ImportResult
  } catch (error) {
    // Clean up temp directory on error
    try {
      await rm(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }

    // If we created a campaign but failed, clean it up
    if (campaignId && options.mode === 'new') {
      try {
        db.prepare('DELETE FROM campaigns WHERE id = ?').run(campaignId)
      } catch {
        // Ignore cleanup errors
      }
    }

    if (error instanceof Error) {
      throw createError({
        statusCode: 500,
        message: `Import failed: ${error.message}`,
      })
    }
    throw error
  }
})
