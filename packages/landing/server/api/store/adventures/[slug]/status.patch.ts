import { query, queryOne } from '../../../../utils/db'
import { requireAuth } from '../../../../utils/requireAuth'
import { ADVENTURE_STATUS } from '../../../../utils/adventureStatus'

interface AdventureRow {
  id: number
  author_id: number
  published_version_id: number | null
}

interface VersionRow {
  id: number
  version_number: number
  status: string
  title: string
  description: string | null
  short_description: string | null
  cover_image_url: string | null
  system: string
  difficulty: number
  players_min: number
  players_max: number
  level_min: number
  level_max: number
  duration_hours: number
  highlights: string
  tags: string
  price_cents: number
  currency: string
  language: string
  author_name: string | null
  author_discord: string | null
}

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = Number(getRouterParam(event, 'slug'))

  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: 'Invalid adventure ID' })
  }

  const body = await readBody<{ action: 'unpublish' | 'republish' }>(event)

  if (!body?.action || !['unpublish', 'republish'].includes(body.action)) {
    throw createError({ statusCode: 400, message: 'Invalid action. Must be "unpublish" or "republish"' })
  }

  // Fetch adventure
  const adventure = await queryOne<AdventureRow>(
    'SELECT id, author_id, published_version_id FROM adventures WHERE id = ?',
    [id],
  )

  if (!adventure) {
    throw createError({ statusCode: 404, message: 'Adventure not found' })
  }

  // Check ownership
  if (adventure.author_id !== user.id) {
    throw createError({ statusCode: 403, message: 'You can only manage your own adventures' })
  }

  // Get latest version with all fields
  const latestVersion = await queryOne<VersionRow>(
    `SELECT id, version_number, status, title, description, short_description, cover_image_url,
            \`system\`, difficulty, players_min, players_max, level_min, level_max, duration_hours,
            highlights, tags, price_cents, currency, language, author_name, author_discord
     FROM adventure_versions
     WHERE adventure_id = ?
     ORDER BY version_number DESC
     LIMIT 1`,
    [adventure.id],
  )

  if (!latestVersion) {
    throw createError({ statusCode: 404, message: 'No version found for this adventure' })
  }

  if (body.action === 'unpublish') {
    // Just change status to draft - don't create new version
    // Keep validated_at as marker that this was previously published
    await query(
      'UPDATE adventure_versions SET status = ? WHERE id = ?',
      [ADVENTURE_STATUS.DRAFT, latestVersion.id],
    )

    // Clear published_version_id
    await query(
      'UPDATE adventures SET published_version_id = NULL WHERE id = ?',
      [adventure.id],
    )

    return {
      success: true,
      status: ADVENTURE_STATUS.DRAFT,
      versionNumber: latestVersion.version_number,
      message: 'Adventure unpublished successfully',
    }
  } else {
    // Republish: set to pending_review for re-validation
    await query(
      'UPDATE adventure_versions SET status = ? WHERE id = ?',
      [ADVENTURE_STATUS.PENDING_REVIEW, latestVersion.id],
    )

    return {
      success: true,
      status: ADVENTURE_STATUS.PENDING_REVIEW,
      message: 'Adventure submitted for review',
    }
  }
})
