import { defineStore } from 'pinia'
import { getApi } from '~/composables/useApiFetch'

interface FavoritesState {
  favoriteIds: Set<number>
  loading: boolean
  initialized: boolean
}

export const useFavoritesStore = defineStore('favorites', {
  state: (): FavoritesState => ({
    favoriteIds: new Set(),
    loading: false,
    initialized: false,
  }),

  getters: {
    isFavorite: (state) => (adventureId: number) => {
      return state.favoriteIds.has(adventureId)
    },

    count: (state) => {
      return state.favoriteIds.size
    },
  },

  actions: {
    // Fetch all favorite IDs for logged-in user
    async fetchFavorites() {
      if (this.loading) return

      this.loading = true
      try {
        const $api = getApi()
        const response = await $api<{ favoriteIds: number[] }>('/api/favorites/ids')
        this.favoriteIds = new Set(response.favoriteIds)
        this.initialized = true
      } catch {
        // User not logged in or error - that's fine
        this.favoriteIds = new Set()
      } finally {
        this.loading = false
      }
    },

    // Add adventure to favorites
    async addFavorite(adventureId: number) {
      // Optimistic update
      this.favoriteIds.add(adventureId)

      try {
        const $api = getApi()
        await $api(`/api/favorites/${adventureId}`, { method: 'POST' })
      } catch (error) {
        // Rollback on error
        this.favoriteIds.delete(adventureId)
        throw error
      }
    },

    // Remove adventure from favorites
    async removeFavorite(adventureId: number) {
      // Optimistic update
      this.favoriteIds.delete(adventureId)

      try {
        const $api = getApi()
        await $api(`/api/favorites/${adventureId}`, { method: 'DELETE' })
      } catch (error) {
        // Rollback on error
        this.favoriteIds.add(adventureId)
        throw error
      }
    },

    // Toggle favorite status
    async toggleFavorite(adventureId: number) {
      if (this.favoriteIds.has(adventureId)) {
        await this.removeFavorite(adventureId)
        return false
      } else {
        await this.addFavorite(adventureId)
        return true
      }
    },

    // Clear favorites (on logout)
    clear() {
      this.favoriteIds = new Set()
      this.initialized = false
    },
  },
})
