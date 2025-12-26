import { defineStore } from 'pinia'
import { getApi } from '~/composables/useApiFetch'

// Validation types
export interface ValidationError {
  type: 'structure' | 'filetype' | 'size' | 'content' | 'format'
  field?: string
  message: string
  details?: string
}

export interface ValidationWarning {
  type: 'size' | 'content'
  message: string
}

export interface ValidationResult {
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

// Adventure status type
export type AdventureStatus = 'draft' | 'pending_review' | 'validating' | 'published' | 'rejected' | 'archived'

export interface VersionInfo {
  id: number
  versionNumber: number
  title: string
  coverImageUrl: string | null
  status?: AdventureStatus
  validationResult?: ValidationResult | null
  validatedAt?: string | null
}

export interface UserAdventure {
  id: number
  title: string
  slug: string
  coverImageUrl: string | null
  downloadCount: number
  avgRating: number | null
  status: AdventureStatus
  validationResult: ValidationResult | null
  validatedAt: string | null
  latestVersion: VersionInfo | null
  publishedVersion: Omit<VersionInfo, 'status' | 'validationResult' | 'validatedAt'> | null
}

export interface UserStats {
  totalAdventures: number
  totalDownloads: number
  avgRating: number
  totalRatings: number
}

interface ProfileState {
  adventures: UserAdventure[]
  stats: UserStats
  loading: boolean
  error: string | null
}

export const useProfileStore = defineStore('profile', {
  state: (): ProfileState => ({
    adventures: [],
    stats: {
      totalAdventures: 0,
      totalDownloads: 0,
      avgRating: 0,
      totalRatings: 0,
    },
    loading: false,
    error: null,
  }),

  getters: {
    // Get adventure by ID
    getAdventureById: (state) => (id: number) => {
      return state.adventures.find((a) => a.id === id)
    },

    // Adventures by status
    pendingAdventures: (state) => {
      return state.adventures.filter((a) => a.status === 'pending_review' || a.status === 'validating')
    },

    publishedAdventures: (state) => {
      return state.adventures.filter((a) => a.status === 'published')
    },

    rejectedAdventures: (state) => {
      return state.adventures.filter((a) => a.status === 'rejected')
    },

    // Has any adventures needing attention
    hasRejectedAdventures: (state) => {
      return state.adventures.some((a) => a.status === 'rejected')
    },

    hasPendingAdventures: (state) => {
      return state.adventures.some((a) => a.status === 'pending_review' || a.status === 'validating')
    },

    // Count by status
    statusCounts: (state) => {
      const counts: Record<AdventureStatus, number> = {
        draft: 0,
        pending_review: 0,
        validating: 0,
        published: 0,
        rejected: 0,
        archived: 0,
      }
      for (const a of state.adventures) {
        counts[a.status]++
      }
      return counts
    },
  },

  actions: {
    // Fetch user's adventures (works on SSR with headers or client with $api)
    async fetchAdventures(headers?: Record<string, string>) {
      this.loading = true
      this.error = null

      try {
        // Use $fetch with headers for SSR, $api for client (auto-refresh)
        let response: { adventures: UserAdventure[]; stats: UserStats }
        if (headers) {
          response = await $fetch<{ adventures: UserAdventure[]; stats: UserStats }>(
            '/api/profile/adventures',
            { headers },
          )
        } else {
          const $api = getApi()
          response = await $api<{ adventures: UserAdventure[]; stats: UserStats }>(
            '/api/profile/adventures',
          )
        }
        this.adventures = response.adventures
        this.stats = response.stats
      } catch (err) {
        console.error('Failed to fetch user adventures:', err)
        this.error = 'Failed to load adventures'
      } finally {
        this.loading = false
      }
    },

    // Delete an adventure (client-only, uses $api for auto-refresh)
    async deleteAdventure(adventureId: number) {
      try {
        const $api = getApi()
        await $api(`/api/profile/adventures/${adventureId}`, {
          method: 'POST',
          body: { action: 'delete' },
        })
        // Refresh the list
        await this.fetchAdventures()
      } catch (err) {
        console.error('Failed to delete adventure:', err)
        throw err
      }
    },
  },
})
