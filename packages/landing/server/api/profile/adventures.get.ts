import { query } from '../../utils/db'
import { requireAuth } from '../../utils/requireAuth'

interface AdventureRow {
  id: number
  slug: string
  download_count: number
  published_version_id: number | null
  created_at: Date
}

interface VersionRow {
  id: number
  adventure_id: number
  version_number: number
  title: string
  cover_image_url: string | null
  status: string
  validation_result: string | null
  validated_at: Date | null
  created_at: Date
}

interface RatingRow {
  adventure_id: number
  avg_rating: number
  rating_count: number
}

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  // Get user's adventures (identity only)
  const adventures = await query<AdventureRow[]>(
    `SELECT id, slug, download_count, published_version_id, created_at
     FROM adventures
     WHERE author_id = ?
     ORDER BY created_at DESC`,
    [user.id],
  )

  if (adventures.length === 0) {
    return {
      adventures: [],
      stats: {
        totalAdventures: 0,
        totalDownloads: 0,
        avgRating: 0,
        totalRatings: 0,
      },
    }
  }

  const adventureIds = adventures.map((a) => a.id)

  // Get all versions for these adventures (to show latest + published)
  const versions = await query<VersionRow[]>(
    `SELECT id, adventure_id, version_number, title, cover_image_url,
            status, validation_result, validated_at, created_at
     FROM adventure_versions
     WHERE adventure_id IN (${adventureIds.map(() => '?').join(',')})
     ORDER BY adventure_id, version_number DESC`,
    adventureIds,
  )

  // Get ratings for all adventures
  const ratings = await query<RatingRow[]>(
    `SELECT adventure_id, AVG(rating) as avg_rating, COUNT(*) as rating_count
     FROM adventure_ratings
     WHERE adventure_id IN (${adventureIds.map(() => '?').join(',')})
     GROUP BY adventure_id`,
    adventureIds,
  )

  // Create lookup maps
  const ratingsMap = new Map(ratings.map((r) => [r.adventure_id, r]))

  // Group versions by adventure_id
  const versionsMap = new Map<number, VersionRow[]>()
  for (const v of versions) {
    if (!versionsMap.has(v.adventure_id)) {
      versionsMap.set(v.adventure_id, [])
    }
    versionsMap.get(v.adventure_id)!.push(v)
  }

  // Calculate total stats
  const totalDownloads = adventures.reduce((sum, a) => sum + a.download_count, 0)
  const allRatings = ratings.flatMap((r) => [r])
  const avgRating =
    allRatings.length > 0
      ? allRatings.reduce((sum, r) => sum + Number(r.avg_rating), 0) / allRatings.length
      : 0
  const totalRatings = ratings.reduce((sum, r) => sum + Number(r.rating_count), 0)

  return {
    adventures: adventures.map((a) => {
      const ratingInfo = ratingsMap.get(a.id)
      const adventureVersions = versionsMap.get(a.id) || []

      // Latest version (first in array since ordered DESC)
      const latestVersion = adventureVersions[0] || null

      // Published version
      const publishedVersion = a.published_version_id
        ? adventureVersions.find((v) => v.id === a.published_version_id) || null
        : null

      // Parse validation_result JSON from latest version
      let validationResult = null
      if (latestVersion?.validation_result) {
        if (typeof latestVersion.validation_result === 'string') {
          try {
            validationResult = JSON.parse(latestVersion.validation_result)
          } catch {
            // Ignore parse errors
          }
        } else {
          validationResult = latestVersion.validation_result
        }
      }

      return {
        id: a.id,
        slug: a.slug,
        downloadCount: a.download_count,
        avgRating: ratingInfo ? Number(ratingInfo.avg_rating) : null,
        // Latest version info (what user last uploaded)
        latestVersion: latestVersion
          ? {
            id: latestVersion.id,
            versionNumber: latestVersion.version_number,
            title: latestVersion.title,
            coverImageUrl: latestVersion.cover_image_url,
            status: latestVersion.status,
            validationResult,
            validatedAt: latestVersion.validated_at,
          }
          : null,
        // Published version info (what public sees)
        publishedVersion: publishedVersion
          ? {
            id: publishedVersion.id,
            versionNumber: publishedVersion.version_number,
            title: publishedVersion.title,
            coverImageUrl: publishedVersion.cover_image_url,
          }
          : null,
        // For backwards compatibility - use latest version's status
        status: latestVersion?.status || 'draft',
        title: latestVersion?.title || '',
        coverImageUrl: latestVersion?.cover_image_url || null,
        validationResult,
        validatedAt: latestVersion?.validated_at || null,
      }
    }),
    stats: {
      totalAdventures: adventures.length,
      totalDownloads,
      avgRating,
      totalRatings,
    },
  }
})
