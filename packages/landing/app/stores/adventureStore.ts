import { defineStore } from 'pinia'
import { getApi } from '~/composables/useApiFetch'

// Frontend-friendly adventure type (camelCase)
export interface AdventureCard {
  id: number
  slug: string
  title: string
  description: string | null
  shortDescription: string | null
  coverImageUrl: string | null
  authorName: string
  authorDiscord: string | null
  priceCents: number
  currency: string
  downloadCount: number
  avgRating: number
  ratingCount: number
  language: string
  tags: string[] | null
  system: string
  difficulty: number
  playersMin: number
  playersMax: number
  levelMin: number
  levelMax: number
  durationHours: number
  highlights: string[] | null
  versionNumber: number
  publishedAt: string | null
}

export interface AdventureDetail extends AdventureCard {
  author: string
  files: {
    id: number
    filePath: string
    fileSize: number
    versionNumber: number
  }[]
}

interface Filters {
  search: string
  sortBy: 'newest' | 'popular' | 'rating'
  language: string | null
  page: number
}

interface AdventureState {
  // List view
  adventures: AdventureCard[]
  totalPages: number
  filters: Filters
  loading: boolean

  // Detail view
  adventureDetails: Record<string, AdventureDetail>
  loadingDetail: boolean

  // User ratings (adventureId -> rating)
  userRatings: Record<number, number>
}

// API response types (already camelCase from backend)
interface ApiAdventure {
  id: number
  slug: string
  title: string
  description: string | null
  shortDescription: string | null
  coverImageUrl: string | null
  authorName: string
  authorDiscord?: string | null
  priceCents: number
  currency: string
  downloadCount: number
  avgRating: string | number | null
  ratingCount: number
  language: string
  tags: string[] | null
  system?: string
  difficulty?: number
  playersMin?: number
  playersMax?: number
  levelMin?: number
  levelMax?: number
  durationHours?: number
  highlights?: string[] | null
  versionNumber?: number
  publishedAt?: string | null
}

interface ApiListResponse {
  adventures: ApiAdventure[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Detail API returns snake_case (different from list API)
interface ApiDetailAdventure {
  id: number
  slug: string
  title: string
  description: string | null
  short_description: string | null
  cover_image_url: string | null
  author_name: string | null
  author_discord: string | null
  price_cents: number
  currency: string
  download_count: number
  avg_rating: string | number | null
  rating_count: number
  language: string
  tags: string[] | null
  system: string
  difficulty: number
  players_min: number
  players_max: number
  level_min: number
  level_max: number
  duration_hours: string | number
  highlights: string[] | null
  author: string
  display_name?: string
  version_number?: number
  published_at?: string | null
}

interface ApiDetailResponse {
  adventure: ApiDetailAdventure
  files: {
    id: number
    file_path: string
    file_size: number
    version_number: number
  }[]
}

// Transform detail API response (snake_case) to frontend format
function transformDetailAdventure(row: ApiDetailAdventure): AdventureCard {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    shortDescription: row.short_description,
    coverImageUrl: row.cover_image_url,
    authorName: row.author_name || row.display_name || 'Unknown',
    authorDiscord: row.author_discord || null,
    priceCents: row.price_cents,
    currency: row.currency,
    downloadCount: row.download_count,
    avgRating: Number(row.avg_rating) || 0,
    ratingCount: row.rating_count || 0,
    language: row.language,
    tags: row.tags,
    system: row.system || 'dnd5e',
    difficulty: row.difficulty || 3,
    playersMin: row.players_min || 3,
    playersMax: row.players_max || 5,
    levelMin: row.level_min || 1,
    levelMax: row.level_max || 5,
    durationHours: Number(row.duration_hours) || 4,
    highlights: row.highlights || null,
    versionNumber: row.version_number || 1,
    publishedAt: row.published_at || null,
  }
}

// Transform API response to frontend format
function transformAdventure(row: ApiAdventure): AdventureCard {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    shortDescription: row.shortDescription,
    coverImageUrl: row.coverImageUrl,
    authorName: row.authorName || 'Unknown',
    authorDiscord: row.authorDiscord || null,
    priceCents: row.priceCents,
    currency: row.currency,
    downloadCount: row.downloadCount,
    avgRating: Number(row.avgRating) || 0,
    ratingCount: row.ratingCount || 0,
    language: row.language,
    tags: row.tags,
    system: row.system || 'dnd5e',
    difficulty: row.difficulty || 3,
    playersMin: row.playersMin || 3,
    playersMax: row.playersMax || 5,
    levelMin: row.levelMin || 1,
    levelMax: row.levelMax || 5,
    durationHours: row.durationHours || 4,
    highlights: row.highlights || null,
    versionNumber: row.versionNumber || 1,
    publishedAt: row.publishedAt || null,
  }
}

export const useAdventureStore = defineStore('adventure', {
  state: (): AdventureState => ({
    adventures: [],
    totalPages: 1,
    filters: {
      search: '',
      sortBy: 'newest',
      language: null,
      page: 1,
    },
    loading: false,
    adventureDetails: {},
    loadingDetail: false,
    userRatings: {},
  }),

  getters: {
    getAdventureById: (state) => (id: number) => {
      return state.adventures.find((a) => a.id === id)
    },

    getAdventureBySlug: (state) => (slug: string) => {
      return state.adventureDetails[slug]
    },

    getUserRating: (state) => (adventureId: number) => {
      return state.userRatings[adventureId] || null
    },
  },

  actions: {
    // Fetch adventures list
    async fetchAdventures() {
      this.loading = true
      try {
        const params = new URLSearchParams({
          page: this.filters.page.toString(),
          sort: this.filters.sortBy,
        })
        if (this.filters.search) params.set('search', this.filters.search)
        if (this.filters.language) params.set('language', this.filters.language)

        const response = await $fetch<ApiListResponse>(
          `/api/store/adventures?${params}`,
        )

        this.adventures = response.adventures.map(transformAdventure)
        this.totalPages = response.pagination.totalPages
      } catch (error) {
        console.error('Failed to fetch adventures:', error)
        this.adventures = []
      } finally {
        this.loading = false
      }
    },

    // Fetch single adventure detail
    async fetchAdventureDetail(slug: string, forceRefresh = false) {
      // Return cached if exists (unless force refresh)
      if (!forceRefresh && this.adventureDetails[slug]) {
        return this.adventureDetails[slug]
      }

      this.loadingDetail = true
      try {
        const response = await $fetch<ApiDetailResponse>(
          `/api/store/adventures/${slug}`,
        )

        const detail: AdventureDetail = {
          ...transformDetailAdventure(response.adventure),
          author: response.adventure.author,
          files: response.files.map((f) => ({
            id: f.id,
            filePath: f.file_path,
            fileSize: f.file_size,
            versionNumber: f.version_number,
          })),
        }

        this.adventureDetails[slug] = detail
        return detail
      } catch (error) {
        console.error('Failed to fetch adventure detail:', error)
        throw error
      } finally {
        this.loadingDetail = false
      }
    },

    // Rate an adventure (requires auth)
    async rateAdventure(adventureId: number, rating: number) {
      try {
        const $api = getApi()
        const response = await $api<{ avgRating: string | number; ratingCount: number }>(
          `/api/store/adventures/${adventureId}/rate`,
          {
            method: 'POST',
            body: { rating },
          },
        )

        // Convert to numbers (API might return strings)
        const newAvgRating = Number(response.avgRating) || 0
        const newRatingCount = Number(response.ratingCount) || 0

        // Store user's rating (replace to trigger reactivity)
        this.userRatings = { ...this.userRatings, [adventureId]: rating }

        // Update rating in list (replace array item to trigger reactivity)
        const adventureIndex = this.adventures.findIndex((a) => a.id === adventureId)
        if (adventureIndex !== -1) {
          const current = this.adventures[adventureIndex]
          this.adventures[adventureIndex] = {
            ...current,
            avgRating: newAvgRating,
            ratingCount: newRatingCount,
          } as AdventureCard
        }

        // Update rating in detail cache and force refresh
        let adventureSlug: string | null = null
        for (const slug in this.adventureDetails) {
          const detail = this.adventureDetails[slug]
          if (detail && detail.id === adventureId) {
            adventureSlug = slug
            // Update immediately for fast feedback
            this.adventureDetails[slug] = {
              ...detail,
              avgRating: newAvgRating,
              ratingCount: newRatingCount,
            } as AdventureDetail
            break
          }
        }

        // Force refresh from server to get accurate data
        if (adventureSlug) {
          await this.fetchAdventureDetail(adventureSlug, true)
        }

        return { avgRating: newAvgRating, ratingCount: newRatingCount }
      } catch (error) {
        console.error('Failed to rate adventure:', error)
        throw error
      }
    },

    // Fetch user's rating for an adventure (requires auth)
    async fetchUserRating(adventureId: number) {
      try {
        const $api = getApi()
        const response = await $api<{ rating: number | null }>(
          `/api/store/adventures/${adventureId}/my-rating`,
        )
        if (response.rating !== null) {
          this.userRatings[adventureId] = response.rating
        }
        return response.rating
      } catch {
        // User not logged in or no rating - that's fine
        return null
      }
    },

    // Update filters and refetch
    setSearch(search: string) {
      this.filters.search = search
      this.filters.page = 1
    },

    setSortBy(sortBy: 'newest' | 'popular' | 'rating') {
      this.filters.sortBy = sortBy
      this.filters.page = 1
    },

    setLanguage(language: string | null) {
      this.filters.language = language
      this.filters.page = 1
    },

    setPage(page: number) {
      this.filters.page = page
    },

    // Clear detail cache (e.g., after upload)
    clearDetailCache() {
      this.adventureDetails = {}
    },

    // Refresh list (after upload, etc.)
    async refresh() {
      this.clearDetailCache()
      await this.fetchAdventures()
    },

    // Download adventure - returns blob for direct download
    async downloadAdventure(slug: string, _title: string): Promise<void> {
      try {
        // Fetch as blob (file is streamed directly from server)
        const response = await fetch(`/api/store/adventures/${slug}/download`, {
          method: 'POST',
          credentials: 'include',
        })

        if (!response.ok) {
          throw new Error('Download failed')
        }

        // Get filename from Content-Disposition header or use default
        const contentDisposition = response.headers.get('Content-Disposition')
        let filename = `${slug}.dmhero`
        if (contentDisposition) {
          const match = contentDisposition.match(/filename="(.+)"/)
          if (match) {
            filename = match[1]!
          }
        }

        // Create blob and trigger download
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)

        // Update download count locally (increment by 1)
        const adventureIndex = this.adventures.findIndex((a) => a.slug === slug)
        if (adventureIndex !== -1) {
          const current = this.adventures[adventureIndex]
          if (!current) return
          this.adventures[adventureIndex] = {
            ...current,
            downloadCount: current.downloadCount + 1,
          } as AdventureCard
        }

        // Update download count in detail cache
        if (this.adventureDetails[slug]) {
          this.adventureDetails[slug] = {
            ...this.adventureDetails[slug],
            downloadCount: this.adventureDetails[slug].downloadCount + 1,
          } as AdventureDetail
        }
      } catch (error) {
        console.error('Failed to download adventure:', error)
        throw error
      }
    },
  },
})
