import { defineStore } from 'pinia'
import { getApi } from '~/composables/useApiFetch'

export interface UserAdventure {
  id: number
  title: string
  slug: string
  coverImageUrl: string | null
  downloadCount: number
  avgRating: number | null
  status: 'draft' | 'pending_review' | 'published' | 'rejected' | 'archived'
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
