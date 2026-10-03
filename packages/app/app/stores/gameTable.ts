import { defineStore } from 'pinia'
import type { GameTable, GameTablePlayer } from '~~/types/game-table'

interface GameTableState {
  table: GameTable | null
  loading: boolean
  loadedCampaignId: number | null
}

// The live game of the active campaign (players join it via the player app)
export const useGameTableStore = defineStore('gameTable', {
  state: (): GameTableState => ({
    table: null,
    loading: false,
    loadedCampaignId: null,
  }),

  actions: {
    async load(campaignId: number) {
      this.loading = true
      try {
        this.table = await $fetch<GameTable | null>('/api/game-table', { query: { campaignId } })
        this.loadedCampaignId = campaignId
      }
      finally {
        this.loading = false
      }
    },

    async start(campaignId: number) {
      this.table = await $fetch<GameTable>('/api/game-table', { method: 'POST', body: { campaignId } })
    },

    async close() {
      if (!this.table) return
      await $fetch(`/api/game-table/${this.table.id}`, { method: 'DELETE' })
      this.table = null
    },

    async addPlayer(name: string, playerEntityId: number | null) {
      if (!this.table) return
      const player = await $fetch<GameTablePlayer>(`/api/game-table/${this.table.id}/players`, {
        method: 'POST',
        body: { name, playerEntityId },
      })
      this.table.players.push(player)
    },

    async updatePlayer(id: number, changes: { name?: string, playerEntityId?: number | null }) {
      const updated = await $fetch<GameTablePlayer>(`/api/game-table/players/${id}`, { method: 'PATCH', body: changes })
      this.replacePlayer(updated)
    },

    async rollPin(id: number) {
      this.replacePlayer(await $fetch<GameTablePlayer>(`/api/game-table/players/${id}/pin`, { method: 'POST' }))
    },

    async removePlayer(id: number) {
      await $fetch(`/api/game-table/players/${id}`, { method: 'DELETE' })
      if (this.table) this.table.players = this.table.players.filter(p => p.id !== id)
    },

    replacePlayer(player: GameTablePlayer) {
      if (!this.table) return
      const index = this.table.players.findIndex(p => p.id === player.id)
      if (index !== -1) this.table.players[index] = player
    },
  },
})
