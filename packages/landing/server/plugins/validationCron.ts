/**
 * Validation CRON Job
 *
 * Runs every 10 minutes to validate pending adventures
 */

import { query, queryOne } from '../utils/db'
import { validateAdventure } from '../utils/validateAdventure'
import { sendValidationNotificationEmail } from '../utils/email'

interface PendingAdventure {
  id: number
  slug: string
  title: string
  description: string | null
  short_description: string | null
  language: string
  version_number: number
  created_at: Date | string
  author_email: string
  author_name: string
}

interface AdventureFile {
  file_path: string
  version_number: number
  original_filename: string | null
}

const VALIDATION_INTERVAL = 10 * 60 * 1000 // 10 minutes

export default defineNitroPlugin((_nitroApp) => {
  // Don't run during build
  if (process.env.NUXT_BUILD) {
    console.log('[ValidationCron] Skipping during build')
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
  console.log(`[ValidationCron] Checking for pending adventures... (${now})`)

  try {
    // Get all adventures with status 'pending_review'
    // Include version_number for optimistic locking + author info for email
    const pendingAdventures = await query<PendingAdventure[]>(
      `SELECT a.id, a.slug, a.title, a.description, a.short_description, a.language, a.version_number, a.created_at,
              u.email as author_email, COALESCE(u.display_name, u.email) as author_name
       FROM adventures a
       JOIN users u ON a.author_id = u.id
       WHERE a.status = 'pending_review'
       ORDER BY a.created_at ASC
       LIMIT 10`,
    )

    if (pendingAdventures.length === 0) {
      console.log('[ValidationCron] No pending adventures')
      return
    }

    console.log(`[ValidationCron] Found ${pendingAdventures.length} pending adventure(s)`)

    for (const adventure of pendingAdventures) {
      await validateSingleAdventure(adventure)
    }

    console.log('[ValidationCron] Validation run complete')
  } catch (error) {
    console.error('[ValidationCron] Error during validation:', error)
  }
}

async function validateSingleAdventure(adventure: PendingAdventure) {
  const expectedVersion = adventure.version_number
  console.log(`[ValidationCron] Validating: ${adventure.title} (ID: ${adventure.id}, v${expectedVersion})`)

  try {
    // Get the latest file for this adventure (with version number and original filename)
    const file = await queryOne<AdventureFile>(
      `SELECT file_path, version_number, original_filename FROM adventure_files
       WHERE adventure_id = ?
       ORDER BY version_number DESC
       LIMIT 1`,
      [adventure.id],
    )

    if (!file) {
      // No file uploaded - reject (with version check)
      const updated = await updateAdventureStatus(adventure.id, expectedVersion, 'rejected', {
        errors: [{
          type: 'structure',
          message: adventure.language === 'de'
            ? 'Keine .dmhero Datei hochgeladen'
            : 'No .dmhero file uploaded',
        }],
        warnings: [],
      })
      if (!updated) {
        console.log(`[ValidationCron] ⏭ Skipped: ${adventure.title} - newer version uploaded during validation`)
      }
      return
    }

    console.log(`[ValidationCron] Validating file v${file.version_number} for adventure v${expectedVersion}`)

    // Get the full file path
    // file_path in DB is URL path like "/api/uploads/adventures/slug-v1.dmhero"
    // We need file system path like "./uploads/adventures/slug-v1.dmhero"
    const config = useRuntimeConfig()
    const uploadsDir = config.uploadsDir || './uploads'
    const relativePath = file.file_path.replace('/api/uploads/', '')
    const filePath = `${uploadsDir}/${relativePath}`

    // Run validation (including original filename check)
    const result = await validateAdventure(
      filePath,
      {
        title: adventure.title,
        description: adventure.description || undefined,
        shortDescription: adventure.short_description || undefined,
      },
      adventure.language || 'en',
      file.original_filename || undefined,
    )

    // Update adventure status based on result (with version check!)
    const tzOptions = { timeZone: 'Europe/Berlin' }
    const validatedAt = new Date().toLocaleString('de-DE', tzOptions)
    // MySQL can return Date object or string - handle both
    const createdAtDate = adventure.created_at instanceof Date
      ? adventure.created_at
      : new Date(adventure.created_at.replace(' ', 'T') + 'Z')
    const uploadedAt = createdAtDate.toLocaleString('de-DE', tzOptions)

    if (result.valid) {
      const updated = await updateAdventureStatus(adventure.id, expectedVersion, 'published', {
        errors: [],
        warnings: result.warnings,
      })
      if (updated) {
        console.log(`[ValidationCron] ✓ Published: ${adventure.title} (v${expectedVersion})`)
        // Send email notification
        await sendValidationNotificationEmail({
          adventureTitle: adventure.title,
          adventureId: adventure.id,
          authorEmail: adventure.author_email,
          authorName: adventure.author_name,
          uploadedAt,
          validatedAt,
          status: 'published',
          warnings: result.warnings,
        })
      } else {
        console.log(`[ValidationCron] ⏭ Skipped: ${adventure.title} - newer version uploaded during validation`)
      }
    } else {
      const updated = await updateAdventureStatus(adventure.id, expectedVersion, 'rejected', {
        errors: result.errors,
        warnings: result.warnings,
      })
      if (updated) {
        console.log(`[ValidationCron] ✗ Rejected: ${adventure.title} (v${expectedVersion}, ${result.errors.length} errors)`)
        // Send email notification
        await sendValidationNotificationEmail({
          adventureTitle: adventure.title,
          adventureId: adventure.id,
          authorEmail: adventure.author_email,
          authorName: adventure.author_name,
          uploadedAt,
          validatedAt,
          status: 'rejected',
          errors: result.errors,
          warnings: result.warnings,
        })
      } else {
        console.log(`[ValidationCron] ⏭ Skipped: ${adventure.title} - newer version uploaded during validation`)
      }
    }
  } catch (error) {
    console.error(`[ValidationCron] Error validating adventure ${adventure.id}:`, error)

    // Mark as rejected with error (with version check)
    const updated = await updateAdventureStatus(adventure.id, expectedVersion, 'rejected', {
      errors: [{
        type: 'structure',
        message: 'Internal validation error - please try uploading again',
      }],
      warnings: [],
    })
    if (!updated) {
      console.log(`[ValidationCron] ⏭ Skipped error update: ${adventure.title} - newer version uploaded`)
    }
  }
}

/**
 * Update adventure status with optimistic locking.
 * Only updates if version_number matches (no newer version was uploaded).
 * @returns true if update succeeded, false if version changed
 */
async function updateAdventureStatus(
  adventureId: number,
  expectedVersion: number,
  status: 'published' | 'rejected',
  validationResult: { errors: unknown[]; warnings: unknown[] },
): Promise<boolean> {
  // MySQL returns ResultSetHeader for UPDATE with affectedRows
  const result = await query<{ affectedRows: number }>(
    `UPDATE adventures
     SET status = ?,
         validation_result = ?,
         validated_at = NOW(),
         published_at = IF(? = 'published', NOW(), published_at)
     WHERE id = ? AND version_number = ?`,
    [status, JSON.stringify(validationResult), status, adventureId, expectedVersion],
  )

  // If 0 rows affected, the version changed during validation
  return result.affectedRows > 0
}
