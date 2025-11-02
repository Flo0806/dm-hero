import { defineStore } from 'pinia'
import type { NPC } from '../../types/npc'
import type { Item } from '../../types/item'

interface Faction {
  id: number
  name: string
  description: string | null
  image_url?: string | null
  metadata: {
    type?: string
    leader?: string
    alignment?: string
    headquarters?: string
    goals?: string
    notes?: string
  } | null
  leader_id?: number | null
  leader_name?: string | null
  created_at: string
  updated_at: string
}

interface Location {
  id: number
  name: string
  description: string | null
  image_url?: string | null
  parent_entity_id?: number | null
  metadata: {
    type?: string
    region?: string
    notes?: string
  } | null
  created_at: string
  updated_at: string
}

export const useEntitiesStore = defineStore('entities', {
  state: () => ({
    // NPCs
    npcs: [] as NPC[],
    npcsLoaded: false,
    npcsLoading: false,

    // Factions
    factions: [] as Faction[],
    factionsLoaded: false,
    factionsLoading: false,

    // Locations
    locations: [] as Location[],
    locationsLoaded: false,
    locationsLoading: false,

    // Items
    items: [] as Item[],
    itemsLoaded: false,
    itemsLoading: false,
  }),

  getters: {
    // NPCs
    getNpcById: state => (id: number) => state.npcs.find(npc => npc.id === id),
    npcsForSelect: state => state.npcs.map(npc => ({ id: npc.id, name: npc.name })),

    // Factions
    getFactionById: state => (id: number) => state.factions.find(f => f.id === id),
    factionsForSelect: state => state.factions.map(f => ({ id: f.id, name: f.name })),

    // Locations
    getLocationById: state => (id: number) => state.locations.find(l => l.id === id),
    locationsForSelect: state => state.locations.map(l => ({ id: l.id, name: l.name })),

    // Items
    getItemById: state => (id: number) => state.items.find(i => i.id === id),
    itemsForSelect: state => state.items.map(i => ({ id: i.id, name: i.name })),
  },

  actions: {
    // ==================== NPCs ====================

    async fetchNPCs(campaignId: string | number, force = false) {
      // Skip if already loaded and not forcing
      if (this.npcsLoaded && !force)
        return

      this.npcsLoading = true
      try {
        const npcs = await $fetch<NPC[]>('/api/npcs', {
          query: { campaignId },
        })
        this.npcs = npcs
        this.npcsLoaded = true
      }
      catch (error) {
        console.error('Failed to fetch NPCs:', error)
        this.npcs = []
      }
      finally {
        this.npcsLoading = false
      }
    },

    async createNPC(campaignId: string | number, data: Partial<NPC>) {
      const npc = await $fetch<NPC>('/api/npcs', {
        method: 'POST',
        body: {
          ...data,
          campaignId,
        },
      })
      this.npcs.push(npc)
      return npc
    },

    async updateNPC(id: number, data: Partial<NPC>) {
      const npc = await $fetch<NPC>(`/api/npcs/${id}`, {
        method: 'PATCH',
        body: data,
      })
      const index = this.npcs.findIndex(n => n.id === id)
      if (index !== -1) {
        this.npcs[index] = npc
      }
      return npc
    },

    async deleteNPC(id: number) {
      await $fetch(`/api/npcs/${id}`, {
        method: 'DELETE',
      })
      this.npcs = this.npcs.filter(n => n.id !== id)
    },

    // ==================== Factions ====================

    async fetchFactions(campaignId: string | number, force = false) {
      if (this.factionsLoaded && !force)
        return

      this.factionsLoading = true
      try {
        const factions = await $fetch<Faction[]>('/api/factions', {
          query: { campaignId },
        })
        this.factions = factions
        this.factionsLoaded = true
      }
      catch (error) {
        console.error('Failed to fetch factions:', error)
        this.factions = []
      }
      finally {
        this.factionsLoading = false
      }
    },

    async createFaction(campaignId: string | number, data: Partial<Faction>) {
      const faction = await $fetch<Faction>('/api/factions', {
        method: 'POST',
        body: {
          ...data,
          campaignId,
        },
      })
      this.factions.push(faction)
      return faction
    },

    async updateFaction(id: number, data: Partial<Faction>) {
      const faction = await $fetch<Faction>(`/api/factions/${id}`, {
        method: 'PATCH',
        body: data,
      })
      const index = this.factions.findIndex(f => f.id === id)
      if (index !== -1) {
        this.factions[index] = faction
      }
      return faction
    },

    async deleteFaction(id: number) {
      await $fetch(`/api/factions/${id}`, {
        method: 'DELETE',
      })
      this.factions = this.factions.filter(f => f.id !== id)
    },

    // ==================== Locations ====================

    async fetchLocations(campaignId: string | number, force = false) {
      if (this.locationsLoaded && !force)
        return

      this.locationsLoading = true
      try {
        const locations = await $fetch<Location[]>('/api/locations', {
          query: { campaignId },
        })
        this.locations = locations
        this.locationsLoaded = true
      }
      catch (error) {
        console.error('Failed to fetch locations:', error)
        this.locations = []
      }
      finally {
        this.locationsLoading = false
      }
    },

    async createLocation(campaignId: string | number, data: Partial<Location>) {
      const location = await $fetch<Location>('/api/locations', {
        method: 'POST',
        body: {
          ...data,
          campaignId,
        },
      })
      this.locations.push(location)
      return location
    },

    async updateLocation(id: number, data: Partial<Location>) {
      const location = await $fetch<Location>(`/api/locations/${id}`, {
        method: 'PATCH',
        body: data,
      })
      const index = this.locations.findIndex(l => l.id === id)
      if (index !== -1) {
        this.locations[index] = location
      }
      return location
    },

    async deleteLocation(id: number) {
      await $fetch(`/api/locations/${id}`, {
        method: 'DELETE',
      })
      this.locations = this.locations.filter(l => l.id !== id)
    },

    // ==================== Items ====================

    async fetchItems(campaignId: string | number, force = false) {
      if (this.itemsLoaded && !force)
        return

      this.itemsLoading = true
      try {
        const items = await $fetch<Item[]>('/api/items', {
          query: { campaignId },
        })
        this.items = items
        this.itemsLoaded = true
      }
      catch (error) {
        console.error('Failed to fetch items:', error)
        this.items = []
      }
      finally {
        this.itemsLoading = false
      }
    },

    async createItem(campaignId: string | number, data: Partial<Item>) {
      const item = await $fetch<Item>('/api/items', {
        method: 'POST',
        body: {
          ...data,
          campaignId,
        },
      })
      this.items.push(item)
      return item
    },

    async updateItem(id: number, data: Partial<Item>) {
      const item = await $fetch<Item>(`/api/items/${id}`, {
        method: 'PATCH',
        body: data,
      })
      const index = this.items.findIndex(i => i.id === id)
      if (index !== -1) {
        this.items[index] = item
      }
      return item
    },

    async deleteItem(id: number) {
      await $fetch(`/api/items/${id}`, {
        method: 'DELETE',
      })
      this.items = this.items.filter(i => i.id !== id)
    },

    // ==================== Utility ====================

    // Refresh all entities for current campaign
    async refreshAll(campaignId: string | number) {
      await Promise.all([
        this.fetchNPCs(campaignId, true),
        this.fetchFactions(campaignId, true),
        this.fetchLocations(campaignId, true),
        this.fetchItems(campaignId, true),
      ])
    },

    // Clear all data (e.g., when switching campaigns)
    clearAll() {
      this.npcs = []
      this.npcsLoaded = false
      this.factions = []
      this.factionsLoaded = false
      this.locations = []
      this.locationsLoaded = false
      this.items = []
      this.itemsLoaded = false
    },
  },
})
