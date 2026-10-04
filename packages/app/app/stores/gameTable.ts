import { defineStore } from 'pinia'
import type { GameTable, GameTablePlayer } from '~~/types/game-table'
import type { GameTableHandout, GameTableShare, ShareType } from '~~/types/share'

// Increases with every load - an older (slower) response must not overwrite a newer one
let loadSeq = 0

interface GameTableState {
  table: GameTable | null
  loading: boolean
  loadedCampaignId: number | null
  shares: GameTableShare[]
  /** Documents handed out to players */
  handouts: GameTableHandout[]
  /** Fields each share type offers (from the server) */
  shareKinds: Partial<Record<ShareType, string[]>>
  /** The DM's remembered ticks per share type */
  shareDefaults: Partial<Record<ShareType, string[]>>
  /** What the global share dialog is open for */
  shareTarget: { type: ShareType, entityId: number, name: string } | null
}

// The live game of the active campaign (players join it via the player app)
export const useGameTableStore = defineStore('gameTable', {
  state: (): GameTableState => ({
    table: null,
    loading: false,
    loadedCampaignId: null,
    shares: [],
    handouts: [],
    shareKinds: {},
    shareDefaults: {},
    shareTarget: null,
  }),

  getters: {
    shareOf: state => (type: ShareType, entityId: number) =>
      state.shares.find(s => s.entity_type === type && s.entity_id === entityId) ?? null,
  },

  actions: {
    async load(campaignId: number) {
      const seq = ++loadSeq
      this.loading = true
      try {
        const table = await $fetch<GameTable | null>('/api/game-table', { query: { campaignId } })
        // Campaign switched meanwhile -> this answer is outdated
        if (seq !== loadSeq) return
        this.table = table
        this.loadedCampaignId = campaignId
        const [shares, handouts] = table
          ? await Promise.all([
              $fetch<GameTableShare[]>(`/api/game-table/${table.id}/shares`),
              $fetch<GameTableHandout[]>(`/api/game-table/${table.id}/handouts`),
            ])
          : [[], []]
        if (seq !== loadSeq) return
        this.shares = shares
        this.handouts = handouts
      }
      finally {
        this.loading = false
      }
    },

    /** Ping a spot on the shown map - everyone at the table sees it pulse (optionally with a short note) */
    async ping(mapId: number, x: number, y: number, text?: string) {
      if (!this.table) return
      await $fetch(`/api/game-table/${this.table.id}/ping`, { method: 'POST', body: { mapId, x, y, text } })
    },

    /** Show one map to the players (null = none) */
    /** pending: shown, but the players don't have it yet (relay offline / image too large) */
    async setShownMap(mapId: number | null) {
      if (!this.table) return null
      const { shownMapId, pending } = await $fetch<{ shownMapId: number | null, pending: 'offline' | 'tooLarge' | null }>(
        `/api/game-table/${this.table.id}/shown-map`,
        { method: 'PUT', body: { mapId } },
      )
      this.table.shown_map_id = shownMapId
      return pending
    },

    /** Game expired on the player server: register it again, nothing is deleted */
    async reconnect() {
      if (!this.table) return
      this.table = await $fetch<GameTable>(`/api/game-table/${this.table.id}/reconnect`, { method: 'POST' })
    },

    async start(campaignId: number) {
      this.table = await $fetch<GameTable>('/api/game-table', { method: 'POST', body: { campaignId } })
      this.shares = []
      this.handouts = []
    },

    async close() {
      if (!this.table) return
      await $fetch(`/api/game-table/${this.table.id}`, { method: 'DELETE' })
      this.table = null
      this.shares = []
      this.handouts = []
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

    /** Approve (gets the game key) or reject (kicked) a new player device */
    async decideDevice(playerId: number, publicKey: string, approve: boolean) {
      if (!this.table) return
      await $fetch(`/api/game-table/${this.table.id}/devices`, { method: 'POST', body: { playerId, publicKey, approve } })
    },

    async loadShares() {
      this.shares = this.table ? await $fetch<GameTableShare[]>(`/api/game-table/${this.table.id}/shares`) : []
    },

    /** Fields per share type - fetched once, independent of whether a game exists yet */
    async ensureShareKinds() {
      if (Object.keys(this.shareKinds).length) return
      const [kinds, defaults] = await Promise.all([
        $fetch<Partial<Record<ShareType, string[]>>>('/api/game-table/share-kinds'),
        $fetch<Partial<Record<ShareType, string[]>>>('/api/game-table/share-defaults'),
      ])
      this.shareKinds = kinds
      this.shareDefaults = defaults
    },

    async saveShareDefaults(type: ShareType, fields: string[]) {
      await $fetch('/api/game-table/share-defaults', { method: 'PUT', body: { type, fields } })
      this.shareDefaults = { ...this.shareDefaults, [type]: [...fields] }
    },

    /** Share (or change the fields of) an entity - players see it right away */
    async share(type: ShareType, entityId: number, fields: string[], displayName: string | null) {
      if (!this.table) return
      await $fetch(`/api/game-table/${this.table.id}/shares`, { method: 'PUT', body: { type, entityId, fields, displayName } })
      await this.loadShares()
    },

    async unshare(shareId: number) {
      await $fetch(`/api/game-table/shares/${shareId}`, { method: 'DELETE' })
      this.shares = this.shares.filter(s => s.id !== shareId)
    },

    handoutOf(documentId: number) {
      return this.handouts.find(h => h.document_id === documentId) ?? null
    },

    async loadHandouts() {
      this.handouts = this.table ? await $fetch<GameTableHandout[]>(`/api/game-table/${this.table.id}/handouts`) : []
    },

    /** Hand a document to all or chosen players (or change who gets it). pending: saved, players get it once the player server answers */
    async handOut(documentId: number, recipients: 'all' | number[]) {
      if (!this.table) return false
      const { pending } = await $fetch<{ pending: boolean }>(`/api/game-table/${this.table.id}/handouts`, { method: 'PUT', body: { documentId, recipients } })
      await this.loadHandouts()
      return pending
    },

    async withdrawHandout(id: number) {
      await $fetch(`/api/game-table/handouts/${id}`, { method: 'DELETE' })
      this.handouts = this.handouts.filter(h => h.id !== id)
    },

    openShareDialog(type: ShareType, entityId: number, name: string) {
      this.shareTarget = { type, entityId, name }
    },

    replacePlayer(player: GameTablePlayer) {
      if (!this.table) return
      const index = this.table.players.findIndex(p => p.id === player.id)
      if (index !== -1) this.table.players[index] = player
    },
  },
})
