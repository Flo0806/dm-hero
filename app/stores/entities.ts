import { defineStore } from 'pinia'
import type { NPC } from '../../types/npc'
import type { Item } from '../../types/item'
import type { Lore } from '../../types/lore'
import type { Player } from '../../types/player'
import type { Faction } from '../../types/faction'

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

    // Lore
    lore: [] as Lore[],
    loreLoaded: false,
    loreLoading: false,

    // Players
    players: [] as Player[],
    playersLoaded: false,
    playersLoading: false,
  }),

  getters: {
    // NPCs
    getNpcById: (state) => (id: number) => state.npcs.find((npc) => npc.id === id),
    npcsForSelect: (state) => state.npcs.map((npc) => ({ id: npc.id, name: npc.name })),

    // Factions
    getFactionById: (state) => (id: number) => state.factions.find((f) => f.id === id),
    factionsForSelect: (state) => state.factions.map((f) => ({ id: f.id, name: f.name })),

    // Locations
    getLocationById: (state) => (id: number) => state.locations.find((l) => l.id === id),
    locationsForSelect: (state) => state.locations.map((l) => ({ id: l.id, name: l.name })),

    // Items
    getItemById: (state) => (id: number) => state.items.find((i) => i.id === id),
    itemsForSelect: (state) => state.items.map((i) => ({ id: i.id, name: i.name })),

    // Lore
    getLoreById: (state) => (id: number) => state.lore.find((l) => l.id === id),
    loreForSelect: (state) => state.lore.map((l) => ({ id: l.id, name: l.name })),

    // Players
    getPlayerById: (state) => (id: number) => state.players.find((p) => p.id === id),
    playersForSelect: (state) => state.players.map((p) => ({ id: p.id, name: p.name })),
  },

  actions: {
    // ==================== NPCs ====================

    async fetchNPCs(campaignId: string | number, force = false) {
      // Skip if already loaded and not forcing
      if (this.npcsLoaded && !force) return

      this.npcsLoading = true
      try {
        const npcs = await $fetch<NPC[]>('/api/npcs', {
          query: { campaignId },
        })
        this.npcs = npcs
        this.npcsLoaded = true
      } catch (error) {
        console.error('Failed to fetch NPCs:', error)
        this.npcs = []
      } finally {
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
      // Load counts for new NPC
      await this.loadNpcCounts(npc.id)
      return this.npcs.find((n) => n.id === npc.id) || npc
    },

    async updateNPC(id: number, data: Partial<NPC>) {
      const npc = await $fetch<NPC>(`/api/npcs/${id}`, {
        method: 'PATCH',
        body: data,
      })
      const index = this.npcs.findIndex((n) => n.id === id)
      if (index !== -1) {
        // Preserve _counts from old NPC and merge with new data
        const oldNpc = this.npcs[index]
        this.npcs[index] = { ...oldNpc, ...npc }
        // Reload counts after update
        await this.loadNpcCounts(id)
      }
      return this.npcs[index] || npc
    },

    async deleteNPC(id: number) {
      await $fetch(`/api/npcs/${id}`, {
        method: 'DELETE',
      })
      this.npcs = this.npcs.filter((n) => n.id !== id)
    },

    async refreshNPC(id: number) {
      const npc = await $fetch<NPC>(`/api/npcs/${id}`)
      const index = this.npcs.findIndex((n) => n.id === id)
      if (index !== -1) {
        // Preserve _counts from the old NPC (not returned by API)
        this.npcs[index] = { ...this.npcs[index], ...npc }
      }
      return npc
    },

    // Load counts for a single NPC and update it in the store
    async loadNpcCounts(id: number) {
      const index = this.npcs.findIndex((n) => n.id === id)
      if (index === -1) return

      try {
        const counts = await $fetch<{
          relations: number
          items: number
          locations: number
          documents: number
          images: number
          memberships: number
          lore: number
          notes: number
          players: number
          factionName: string | null
        }>(`/api/npcs/${id}/counts`)

        // Update NPC in store with new counts
        if (this.npcs[index]) {
          this.npcs[index] = {
            ...this.npcs[index],
            _counts: counts,
          }
        }
      } catch (error) {
        console.error(`Failed to load counts for NPC ${id}:`, error)
      }
    },

    // Load counts for all NPCs in the store
    async loadAllNpcCounts() {
      await Promise.all(this.npcs.map((npc) => this.loadNpcCounts(npc.id)))
    },

    // ==================== Factions ====================

    async fetchFactions(campaignId: string | number, force = false) {
      if (this.factionsLoaded && !force) return

      this.factionsLoading = true
      try {
        const factions = await $fetch<Faction[]>('/api/factions', {
          query: { campaignId },
        })
        this.factions = factions
        this.factionsLoaded = true
      } catch (error) {
        console.error('Failed to fetch factions:', error)
        this.factions = []
      } finally {
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
      const index = this.factions.findIndex((f) => f.id === id)
      if (index !== -1) {
        this.factions[index] = faction
      }
      return faction
    },

    async deleteFaction(id: number) {
      await $fetch(`/api/factions/${id}`, {
        method: 'DELETE',
      })
      this.factions = this.factions.filter((f) => f.id !== id)
    },

    async refreshFaction(id: number) {
      const faction = await $fetch<Faction>(`/api/factions/${id}`)
      const index = this.factions.findIndex((f) => f.id === id)
      if (index !== -1) {
        // Preserve _counts from the old entity (not returned by API)
        this.factions[index] = { ...this.factions[index], ...faction }
      }
      return faction
    },

    async loadFactionCounts(id: number) {
      const index = this.factions.findIndex((f) => f.id === id)
      if (index === -1) return

      try {
        const counts = await $fetch<{
          members: number
          items: number
          locations: number
          lore: number
          players: number
          documents: number
          images: number
        }>(`/api/factions/${id}/counts`)

        const faction = this.factions[index]
        if (faction) {
          this.factions[index] = {
            ...faction,
            _counts: counts,
          }
        }
      } catch (error) {
        console.error(`Failed to load counts for faction ${id}:`, error)
      }
    },

    // ==================== Locations ====================

    async fetchLocations(campaignId: string | number, force = false) {
      if (this.locationsLoaded && !force) return

      this.locationsLoading = true
      try {
        const locations = await $fetch<Location[]>('/api/locations', {
          query: { campaignId },
        })
        this.locations = locations
        this.locationsLoaded = true
      } catch (error) {
        console.error('Failed to fetch locations:', error)
        this.locations = []
      } finally {
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
      const index = this.locations.findIndex((l) => l.id === id)
      if (index !== -1) {
        this.locations[index] = location
      }
      return location
    },

    async deleteLocation(id: number) {
      await $fetch(`/api/locations/${id}`, {
        method: 'DELETE',
      })
      this.locations = this.locations.filter((l) => l.id !== id)
    },

    async refreshLocation(id: number) {
      const location = await $fetch<Location>(`/api/locations/${id}`)
      const index = this.locations.findIndex((l) => l.id === id)
      if (index !== -1) {
        // Preserve _counts from the old entity (not returned by API)
        this.locations[index] = { ...this.locations[index], ...location }
      }
      return location
    },

    // ==================== Items ====================

    async fetchItems(campaignId: string | number, force = false) {
      if (this.itemsLoaded && !force) return

      this.itemsLoading = true
      try {
        const items = await $fetch<Item[]>('/api/items', {
          query: { campaignId },
        })
        this.items = items
        this.itemsLoaded = true
      } catch (error) {
        console.error('Failed to fetch items:', error)
        this.items = []
      } finally {
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
      const index = this.items.findIndex((i) => i.id === id)
      if (index !== -1) {
        this.items[index] = item
      }
      return item
    },

    async deleteItem(id: number) {
      await $fetch(`/api/items/${id}`, {
        method: 'DELETE',
      })
      this.items = this.items.filter((i) => i.id !== id)
    },

    async refreshItem(id: number) {
      const item = await $fetch<Item>(`/api/items/${id}`)
      const index = this.items.findIndex((i) => i.id === id)
      if (index !== -1) {
        // Preserve _counts from the old entity (not returned by API)
        this.items[index] = { ...this.items[index], ...item }
      }
      return item
    },

    // Load counts for a single Item and update it in the store
    async loadItemCounts(id: number) {
      const index = this.items.findIndex((i) => i.id === id)
      if (index === -1) return

      try {
        const counts = await $fetch<{
          owners: number
          locations: number
          factions: number
          lore: number
          players: number
          documents: number
          images: number
        }>(`/api/items/${id}/counts`)

        // Update Item in store with new counts
        if (this.items[index]) {
          this.items[index] = {
            ...this.items[index],
            _counts: counts,
          }
        }
      } catch (error) {
        console.error(`Failed to load counts for Item ${id}:`, error)
      }
    },

    // Load counts for all Items in the store
    async loadAllItemCounts() {
      await Promise.all(this.items.map((item) => this.loadItemCounts(item.id)))
    },

    // ==================== Lore ====================

    async fetchLore(campaignId: string | number, force = false) {
      if (this.loreLoaded && !force) return

      this.loreLoading = true
      try {
        // Save existing _counts before fetching
        const existingCounts = new Map<number, Lore['_counts']>()
        this.lore.forEach((l) => {
          if (l._counts) {
            existingCounts.set(l.id, l._counts)
          }
        })

        const lore = await $fetch<Lore[]>('/api/lore', {
          query: { campaignId },
        })

        // Restore _counts from previous data
        lore.forEach((l) => {
          const savedCounts = existingCounts.get(l.id)
          if (savedCounts) {
            l._counts = savedCounts
          }
        })

        this.lore = lore
        this.loreLoaded = true
      } catch (error) {
        console.error('Failed to fetch lore:', error)
        this.lore = []
      } finally {
        this.loreLoading = false
      }
    },

    async createLore(campaignId: string | number, data: Partial<Lore>) {
      const lore = await $fetch<Lore>('/api/lore', {
        method: 'POST',
        body: {
          ...data,
          campaignId,
        },
      })
      this.lore.push(lore)
      return lore
    },

    async updateLore(id: number, data: Partial<Lore>) {
      const lore = await $fetch<Lore>(`/api/lore/${id}`, {
        method: 'PATCH',
        body: data,
      })
      const index = this.lore.findIndex((l) => l.id === id)
      if (index !== -1) {
        // Preserve _counts from old Lore and merge with new data
        const oldLore = this.lore[index]
        this.lore[index] = { ...oldLore, ...lore }
        // Reload counts after update
        await this.loadLoreCounts(id)
      }
      return this.lore[index] || lore
    },

    async deleteLore(id: number) {
      await $fetch(`/api/lore/${id}`, {
        method: 'DELETE',
      })
      this.lore = this.lore.filter((l) => l.id !== id)
    },

    async refreshLore(id: number) {
      const lore = await $fetch<Lore>(`/api/lore/${id}`)
      const index = this.lore.findIndex((l) => l.id === id)
      if (index !== -1) {
        // Preserve _counts from the old entity (not returned by API)
        this.lore[index] = { ...this.lore[index], ...lore }
      }
      return lore
    },

    // Load counts for a single Lore and update it in the store
    async loadLoreCounts(id: number) {
      const index = this.lore.findIndex((l) => l.id === id)
      if (index === -1) return

      try {
        const counts = await $fetch<{
          npcs: number
          items: number
          factions: number
          locations: number
          players: number
          documents: number
          images: number
        }>(`/api/lore/${id}/counts`)

        // Update Lore in store with new counts
        if (this.lore[index]) {
          this.lore[index] = {
            ...this.lore[index],
            _counts: counts,
          }
        }
      } catch (error) {
        console.error(`Failed to load counts for Lore ${id}:`, error)
      }
    },

    // Load counts for all Lore entries in the store
    async loadAllLoreCounts() {
      await Promise.all(this.lore.map((l) => this.loadLoreCounts(l.id)))
    },

    // Set counts directly (without fetching) - used when we already have the data
    setLoreCounts(id: number, counts: Lore['_counts']) {
      const index = this.lore.findIndex((l) => l.id === id)
      if (index === -1) return

      const loreItem = this.lore[index]
      if (loreItem) {
        this.lore[index] = {
          ...loreItem,
          _counts: counts,
        }
      }
    },

    // ==================== Players ====================

    async fetchPlayers(campaignId: string | number, force = false) {
      if (this.playersLoaded && !force) return

      this.playersLoading = true
      try {
        // Save existing _counts before fetching
        const existingCounts = new Map<number, Player['_counts']>()
        this.players.forEach((p) => {
          if (p._counts) {
            existingCounts.set(p.id, p._counts)
          }
        })

        const players = await $fetch<Player[]>('/api/players', {
          query: { campaignId },
        })

        // Restore _counts from previous data
        players.forEach((p) => {
          const savedCounts = existingCounts.get(p.id)
          if (savedCounts) {
            p._counts = savedCounts
          }
        })

        this.players = players
        this.playersLoaded = true
      } catch (error) {
        console.error('Failed to fetch players:', error)
        this.players = []
      } finally {
        this.playersLoading = false
      }
    },

    async createPlayer(campaignId: string | number, data: Partial<Player>) {
      const player = await $fetch<Player>('/api/players', {
        method: 'POST',
        body: {
          ...data,
          campaignId,
        },
      })
      this.players.push(player)
      // Load counts for new Player
      await this.loadPlayerCounts(player.id)
      return this.players.find((p) => p.id === player.id) || player
    },

    async updatePlayer(id: number, data: Partial<Player>) {
      const player = await $fetch<Player>(`/api/players/${id}`, {
        method: 'PATCH',
        body: data,
      })
      const index = this.players.findIndex((p) => p.id === id)
      if (index !== -1) {
        // Preserve _counts from old Player and merge with new data
        const oldPlayer = this.players[index]
        this.players[index] = { ...oldPlayer, ...player }
        // Reload counts after update
        await this.loadPlayerCounts(id)
      }
      return this.players[index] || player
    },

    async deletePlayer(id: number) {
      await $fetch(`/api/players/${id}`, {
        method: 'DELETE',
      })
      this.players = this.players.filter((p) => p.id !== id)
    },

    async refreshPlayer(id: number) {
      const player = await $fetch<Player>(`/api/players/${id}`)
      const index = this.players.findIndex((p) => p.id === id)
      if (index !== -1) {
        // Preserve _counts from the old entity (not returned by API)
        this.players[index] = { ...this.players[index], ...player }
      }
      return player
    },

    // Load counts for a single Player and update it in the store
    async loadPlayerCounts(id: number) {
      const index = this.players.findIndex((p) => p.id === id)
      if (index === -1) return

      try {
        const counts = await $fetch<{
          characters: number
          items: number
          locations: number
          factions: number
          lore: number
          sessions: number
          documents: number
          images: number
        }>(`/api/players/${id}/counts`)

        const player = this.players[index]
        if (player) {
          this.players[index] = {
            ...player,
            _counts: counts,
          }
        }
      } catch (error) {
        console.error(`Failed to load counts for Player ${id}:`, error)
      }
    },

    // Set counts directly (without fetching) - used when we already have the data
    setPlayerCounts(id: number, counts: Player['_counts']) {
      const index = this.players.findIndex((p) => p.id === id)
      if (index === -1) return

      const player = this.players[index]
      if (player) {
        this.players[index] = {
          ...player,
          _counts: counts,
        }
      }
    },

    // ==================== Utility ====================

    // Refresh all entities for current campaign
    async refreshAll(campaignId: string | number) {
      await Promise.all([
        this.fetchNPCs(campaignId, true),
        this.fetchFactions(campaignId, true),
        this.fetchLocations(campaignId, true),
        this.fetchItems(campaignId, true),
        this.fetchLore(campaignId, true),
        this.fetchPlayers(campaignId, true),
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
      this.lore = []
      this.loreLoaded = false
      this.players = []
      this.playersLoaded = false
    },
  },
})
