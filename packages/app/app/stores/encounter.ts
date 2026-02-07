import { defineStore } from 'pinia'
import type { Encounter, EncounterWithParticipants } from '~~/types/encounter'

export const useEncounterStore = defineStore('encounter', {
  state: () => ({
    encounters: [] as Encounter[],
    loading: false,
    loaded: false,

    // Active encounter (inline detail)
    activeEncounter: null as EncounterWithParticipants | null,
    activeLoading: false,
  }),

  getters: {
    isEncounterOpen: state => !!state.activeEncounter,
    participants: state => state.activeEncounter?.participants ?? [],
  },

  actions: {
    async fetchEncounters(campaignId: number | string, force = false) {
      if (this.loading) return
      if (this.loaded && !force) return

      this.loading = true
      try {
        const data = await $fetch<Encounter[]>('/api/encounters', {
          query: { campaignId },
        })
        this.encounters = data
        this.loaded = true
      }
      catch (error) {
        console.error('Failed to fetch encounters:', error)
        this.encounters = []
      }
      finally {
        this.loading = false
      }
    },

    async createEncounter(campaignId: number | string, name: string): Promise<Encounter | null> {
      try {
        const encounter = await $fetch<Encounter>('/api/encounters', {
          method: 'POST',
          body: { campaignId, name },
        })
        this.encounters.unshift(encounter)
        return encounter
      }
      catch (error) {
        console.error('Failed to create encounter:', error)
        return null
      }
    },

    async deleteEncounter(id: number): Promise<boolean> {
      try {
        await $fetch(`/api/encounters/${id}`, {
          method: 'DELETE',
        })
        this.encounters = this.encounters.filter(e => e.id !== id)
        return true
      }
      catch (error) {
        console.error('Failed to delete encounter:', error)
        return false
      }
    },

    async openEncounter(id: number) {
      this.activeLoading = true
      try {
        const data = await $fetch<EncounterWithParticipants>(`/api/encounters/${id}`)
        this.activeEncounter = data
      }
      catch (error) {
        console.error('Failed to open encounter:', error)
        this.activeEncounter = null
      }
      finally {
        this.activeLoading = false
      }
    },

    async closeEncounter() {
      const campaignId = this.activeEncounter?.campaign_id
      this.activeEncounter = null
      // Refresh list to update participant counts
      if (campaignId) {
        await this.fetchEncounters(campaignId, true)
      }
    },

    async addParticipants(encounterId: number, entityIds: number[]): Promise<boolean> {
      try {
        const data = await $fetch<EncounterWithParticipants>(`/api/encounters/${encounterId}/participants`, {
          method: 'POST',
          body: { entityIds },
        })
        this.activeEncounter = data
        return true
      }
      catch (error) {
        console.error('Failed to add participants:', error)
        return false
      }
    },

    async removeParticipant(encounterId: number, participantId: number): Promise<boolean> {
      try {
        await $fetch(`/api/encounters/${encounterId}/participants/${participantId}`, {
          method: 'DELETE',
        })
        if (this.activeEncounter) {
          this.activeEncounter.participants = this.activeEncounter.participants.filter(
            p => p.id !== participantId,
          )
        }
        return true
      }
      catch (error) {
        console.error('Failed to remove participant:', error)
        return false
      }
    },

    clearAll() {
      this.encounters = []
      this.loading = false
      this.loaded = false
      this.activeEncounter = null
      this.activeLoading = false
    },
  },
})
