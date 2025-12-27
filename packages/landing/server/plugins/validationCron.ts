/**
 * Validation CRON Job
 *
 * Runs every 10 minutes to validate pending adventure versions
 */

import { query, queryOne } from '../utils/db'
import { validateAdventure } from '../utils/validateAdventure'
import { sendValidationNotificationEmail } from '../utils/email'

interface PendingVersion {
  id: number
  adventure_id: number
  version_number: number
  title: string
  description: string | null
  short_description: string | null
  language: string
  created_at: Date | string
  // From adventure
  slug: string
  // From user
  author_email: string
  author_name: string
}

interface VersionFile {
  file_path: string
  version_number: number
  original_filename: string | null
}

// 30 seconds in dev, 10 minutes in production
const isDev = process.env.NODE_ENV !== 'production'
const VALIDATION_INTERVAL = isDev ? 30 * 1000 : 10 * 60 * 1000

export default defineNitroPlugin((_nitroApp) => {
  // Don't run during build or prerender
  if (process.env.NUXT_BUILD || process.env.NITRO_PRERENDER || import.meta.prerender) {
    console.log('[ValidationCron] Skipping during build/prerender')
    return
  }

  const now = new Date().toLocaleString('de-DE')
  console.log(`[ValidationCron] Starting validation scheduler... (${now})`)
  console.log(`[ValidationCron] Interval: ${VALIDATION_INTERVAL / 1000} seconds`)

  // Run immediately on start (after a short delay to let server fully initialize)
  setTimeout(async () => {
    console.log('[ValidationCron] Initial run starting...')
    try {
      await runValidation()
    } catch (error) {
      console.error('[ValidationCron] Initial run failed:', error)
    }
  }, 5000)

  // Then run every 10 minutes
  const intervalId = setInterval(async () => {
    try {
      await runValidation()
    } catch (error) {
      console.error('[ValidationCron] Scheduled run failed:', error)
    }
  }, VALIDATION_INTERVAL)

  console.log(`[ValidationCron] Interval ID: ${intervalId}`)
})

async function runValidation() {
  const now = new Date().toLocaleString('de-DE')
  console.log(`[ValidationCron] Checking for pending versions... (${now})`)

  try {
    // Get all adventure versions with status 'pending_review'
    const pendingVersions = await query<PendingVersion[]>(
      `SELECT
        av.id, av.adventure_id, av.version_number, av.title, av.description,
        av.short_description, av.language, av.created_at,
        a.slug,
        u.email as author_email, COALESCE(u.display_name, u.email) as author_name
       FROM adventure_versions av
       JOIN adventures a ON av.adventure_id = a.id
       JOIN users u ON a.author_id = u.id
       WHERE av.status = 'pending_review'
       ORDER BY av.created_at ASC
       LIMIT 10`,
    )

    if (pendingVersions.length === 0) {
      console.log('[ValidationCron] No pending versions')
      return
    }

    console.log(`[ValidationCron] Found ${pendingVersions.length} pending version(s)`)

    for (const version of pendingVersions) {
      await validateSingleVersion(version)
    }

    console.log('[ValidationCron] Validation run complete')
  } catch (error) {
    console.error('[ValidationCron] Error during validation:', error)
  }
}

async function validateSingleVersion(version: PendingVersion) {
  console.log(`[ValidationCron] Validating: ${version.title} (Version ID: ${version.id}, v${version.version_number})`)

  try {
    // Get the file for this version
    const file = await queryOne<VersionFile>(
      `SELECT file_path, version_number, original_filename FROM adventure_files
       WHERE version_id = ?
       ORDER BY version_number DESC
       LIMIT 1`,
      [version.id],
    )

    if (!file) {
      // No file uploaded - reject
      await updateVersionStatus(version.id, version.adventure_id, 'rejected', {
        errors: [{
          type: 'structure',
          message: version.language === 'de'
            ? 'Keine .dmhero Datei hochgeladen'
            : 'No .dmhero file uploaded',
        }],
        warnings: [],
      })
      console.log(`[ValidationCron] ✗ Rejected (no file): ${version.title}`)
      return
    }

    console.log(`[ValidationCron] Validating file v${file.version_number} for version ${version.id}`)

    // Get the full file path
    const config = useRuntimeConfig()
    const uploadsDir = config.uploadsDir || './uploads'
    const relativePath = file.file_path.replace('/api/uploads/', '')
    const filePath = `${uploadsDir}/${relativePath}`

    // Run validation
    const result = await validateAdventure(
      filePath,
      {
        title: version.title,
        description: version.description || undefined,
        shortDescription: version.short_description || undefined,
      },
      version.language || 'en',
      file.original_filename || undefined,
    )

    // Prepare timestamps for email
    const tzOptions = { timeZone: 'Europe/Berlin' }
    const validatedAt = new Date().toLocaleString('de-DE', tzOptions)
    const createdAtDate = version.created_at instanceof Date
      ? version.created_at
      : new Date(String(version.created_at).replace(' ', 'T') + 'Z')
    const uploadedAt = createdAtDate.toLocaleString('de-DE', tzOptions)

    if (result.valid) {
      await updateVersionStatus(version.id, version.adventure_id, 'published', {
        errors: [],
        warnings: result.warnings,
      })
      console.log(`[ValidationCron] ✓ Published: ${version.title} (v${version.version_number})`)

      // Send email notification
      await sendValidationNotificationEmail({
        adventureTitle: version.title,
        adventureId: version.adventure_id,
        authorEmail: version.author_email,
        authorName: version.author_name,
        uploadedAt,
        validatedAt,
        status: 'published',
        warnings: result.warnings,
      })
    } else {
      await updateVersionStatus(version.id, version.adventure_id, 'rejected', {
        errors: result.errors,
        warnings: result.warnings,
      })
      console.log(`[ValidationCron] ✗ Rejected: ${version.title} (v${version.version_number}, ${result.errors.length} errors)`)

      // Send email notification
      await sendValidationNotificationEmail({
        adventureTitle: version.title,
        adventureId: version.adventure_id,
        authorEmail: version.author_email,
        authorName: version.author_name,
        uploadedAt,
        validatedAt,
        status: 'rejected',
        errors: result.errors,
        warnings: result.warnings,
      })
    }
  } catch (error) {
    console.error(`[ValidationCron] Error validating version ${version.id}:`, error)

    // Mark as rejected with error
    await updateVersionStatus(version.id, version.adventure_id, 'rejected', {
      errors: [{
        type: 'structure',
        message: 'Internal validation error - please try uploading again',
      }],
      warnings: [],
    })
  }
}

/**
 * Update version status and optionally update adventure's published_version_id
 */
async function updateVersionStatus(
  versionId: number,
  adventureId: number,
  status: 'published' | 'rejected',
  validationResult: { errors: unknown[]; warnings: unknown[] },
): Promise<void> {
  // Update version status
  await query(
    `UPDATE adventure_versions
     SET status = ?,
         validation_result = ?,
         validated_at = NOW(),
         published_at = IF(? = 'published', NOW(), published_at)
     WHERE id = ?`,
    [status, JSON.stringify(validationResult), status, versionId],
  )

  // If published, update adventure's published_version_id
  if (status === 'published') {
    await query(
      `UPDATE adventures
       SET published_version_id = ?
       WHERE id = ?`,
      [versionId, adventureId],
    )

    // Archive previous published versions (optional - keep history clean)
    await query(
      `UPDATE adventure_versions
       SET status = 'archived'
       WHERE adventure_id = ? AND id != ? AND status = 'published'`,
      [adventureId, versionId],
    )
  }
}
