import { defineStore } from 'pinia'
import type { PinboardItem } from '~~/types/pinboard'

export const usePinboardStore = defineStore('pinboard', {
  state: () => ({
    pins: [] as PinboardItem[],
    loading: false,
    lastFetchedCampaignId: null as number | null,
  }),

  getters: {
    // Check if an entity is pinned
    isPinned: (state) => (entityId: number) => {
      return state.pins.some((p) => p.id === entityId)
    },

    // Get pin ID for an entity
    getPinId: (state) => (entityId: number) => {
      return state.pins.find((p) => p.id === entityId)?.pin_id ?? null
    },

    // Get pins grouped by type
    groupedPins: (state) => {
      const groups: Record<string, PinboardItem[]> = {}
      for (const pin of state.pins) {
        if (!groups[pin.type]) {
          groups[pin.type] = []
        }
        groups[pin.type]?.push(pin)
      }
      return groups
    },

    // Get pin count
    pinCount: (state) => state.pins.length,

    // Get pin counts by entity type (for dashboard cards)
    countsByType: (state) => {
      const counts: Record<string, number> = {}
      for (const pin of state.pins) {
        counts[pin.type] = (counts[pin.type] || 0) + 1
      }
      return counts
    },
  },

  actions: {
    // Fetch all pins for a campaign
    async fetchPins(campaignId: number) {
      // Skip if already loading or same campaign was just fetched
      if (this.loading) return

      this.loading = true
      try {
        const data = await $fetch<PinboardItem[]>('/api/pinboard', {
          query: { campaignId },
        })
        this.pins = data
        this.lastFetchedCampaignId = campaignId
      } catch (error) {
        console.error('Failed to fetch pins:', error)
        this.pins = []
      } finally {
        this.loading = false
      }
    },

    // Add a pin (called after successful API response)
    addPin(pin: PinboardItem) {
      // Avoid duplicates
      if (!this.pins.some((p) => p.pin_id === pin.pin_id)) {
        this.pins.push(pin)
      }
    },

    // Remove a pin by pin_id
    removePin(pinId: number) {
      this.pins = this.pins.filter((p) => p.pin_id !== pinId)
    },

    // Remove a pin by entity_id
    removePinByEntityId(entityId: number) {
      this.pins = this.pins.filter((p) => p.id !== entityId)
    },

    // Clear all pins (e.g., when switching campaigns)
    clearPins() {
      this.pins = []
      this.lastFetchedCampaignId = null
    },

    // Update pin order after reordering
    reorderPins(pinIds: number[]) {
      const pinMap = new Map(this.pins.map((p) => [p.pin_id, p]))
      this.pins = pinIds
        .map((id) => pinMap.get(id))
        .filter((p): p is PinboardItem => p !== undefined)
    },
  },
})
