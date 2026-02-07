import { defineStore } from 'pinia'
import type { Encounter, EncounterEffect, EncounterParticipant, EncounterStatus, EncounterWithParticipants } from '~~/types/encounter'

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
    currentTurnParticipant(): EncounterParticipant | null {
      if (!this.activeEncounter) return null
      const idx = this.activeEncounter.current_turn_index
      return this.activeEncounter.participants[idx] ?? null
    },
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

    async addParticipantsWithHp(
      encounterId: number,
      participants: { entityId: number, currentHp: number, maxHp: number }[],
    ): Promise<boolean> {
      try {
        const data = await $fetch<EncounterWithParticipants>(`/api/encounters/${encounterId}/participants`, {
          method: 'POST',
          body: { participants },
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
          const oldIndex = this.activeEncounter.participants.findIndex(p => p.id === participantId)
          this.activeEncounter.participants = this.activeEncounter.participants.filter(
            p => p.id !== participantId,
          )
          const count = this.activeEncounter.participants.length
          if (count === 0) {
            // No participants left
            this.activeEncounter.current_turn_index = 0
          }
          else if (oldIndex < this.activeEncounter.current_turn_index) {
            // Removed someone before current turn — shift index back
            const newIndex = this.activeEncounter.current_turn_index - 1
            this.activeEncounter.current_turn_index = newIndex
            await this.updateEncounterStatus(this.activeEncounter.status as EncounterStatus, {
              current_turn_index: newIndex,
            })
          }
          else if (oldIndex === this.activeEncounter.current_turn_index) {
            // Removed the active participant — clamp to valid range (next in line)
            const newIndex = Math.min(this.activeEncounter.current_turn_index, count - 1)
            this.activeEncounter.current_turn_index = newIndex
            await this.updateEncounterStatus(this.activeEncounter.status as EncounterStatus, {
              current_turn_index: newIndex,
            })
          }
        }
        return true
      }
      catch (error) {
        console.error('Failed to remove participant:', error)
        return false
      }
    },

    async updateParticipant(
      encounterId: number,
      participantId: number,
      updates: Partial<Pick<EncounterParticipant, 'initiative' | 'current_hp' | 'max_hp' | 'temp_hp' | 'is_ko' | 'notes' | 'sort_order'>>,
    ): Promise<boolean> {
      try {
        const updated = await $fetch<EncounterParticipant>(
          `/api/encounters/${encounterId}/participants/${participantId}`,
          { method: 'PATCH', body: updates },
        )
        if (this.activeEncounter) {
          const idx = this.activeEncounter.participants.findIndex(p => p.id === participantId)
          if (idx !== -1) {
            this.activeEncounter.participants[idx] = updated
          }
        }
        return true
      }
      catch (error) {
        console.error('Failed to update participant:', error)
        return false
      }
    },

    async updateEncounterStatus(
      status: EncounterStatus,
      extraFields?: Partial<Pick<Encounter, 'round' | 'current_turn_index' | 'finished_at'>>,
    ): Promise<boolean> {
      if (!this.activeEncounter) return false
      try {
        const updated = await $fetch<Encounter>(
          `/api/encounters/${this.activeEncounter.id}`,
          { method: 'PATCH', body: { status, ...extraFields } },
        )
        // Merge into active encounter
        Object.assign(this.activeEncounter, updated)
        // Update in list
        const idx = this.encounters.findIndex(e => e.id === updated.id)
        if (idx !== -1) {
          this.encounters[idx] = { ...this.encounters[idx], ...updated }
        }
        return true
      }
      catch (error) {
        console.error('Failed to update encounter status:', error)
        return false
      }
    },

    async sortByInitiative(): Promise<boolean> {
      if (!this.activeEncounter) return false
      // Remember who currently has the turn
      const currentParticipantId = this.activeEncounter.participants[this.activeEncounter.current_turn_index]?.id
      // Sort descending by initiative (highest first)
      const sorted = [...this.activeEncounter.participants].sort((a, b) => {
        const initA = a.initiative ?? -Infinity
        const initB = b.initiative ?? -Infinity
        return initB - initA
      })
      // Persist sort_order
      const encId = this.activeEncounter.id
      try {
        for (let i = 0; i < sorted.length; i++) {
          const p = sorted[i]!
          p.sort_order = i
          await $fetch(
            `/api/encounters/${encId}/participants/${p.id}`,
            { method: 'PATCH', body: { sort_order: i } },
          )
        }
        if (this.activeEncounter) {
          this.activeEncounter.participants = sorted
          // Adjust turn index so the same participant stays active
          if (currentParticipantId != null) {
            const newIndex = sorted.findIndex(p => p.id === currentParticipantId)
            if (newIndex !== -1 && newIndex !== this.activeEncounter.current_turn_index) {
              this.activeEncounter.current_turn_index = newIndex
              await this.updateEncounterStatus(this.activeEncounter.status as EncounterStatus, {
                current_turn_index: newIndex,
              })
            }
          }
        }
        return true
      }
      catch (error) {
        console.error('Failed to sort by initiative:', error)
        return false
      }
    },

    async advanceTurn(): Promise<{ ok: boolean, expiredEffects: string[] }> {
      if (!this.activeEncounter) return { ok: false, expiredEffects: [] }
      const count = this.activeEncounter.participants.length
      if (count === 0) return { ok: false, expiredEffects: [] }

      let nextIndex = this.activeEncounter.current_turn_index + 1
      let nextRound = this.activeEncounter.round

      if (nextIndex >= count) {
        await this.sortByInitiative()
        nextIndex = 0
        nextRound++
      }

      const ok = await this.updateEncounterStatus(this.activeEncounter.status as EncounterStatus, {
        current_turn_index: nextIndex,
        round: nextRound,
      })
      let expiredEffects: string[] = []
      if (ok) expiredEffects = await this.tickEffects()
      return { ok, expiredEffects }
    },

    async prevTurn(): Promise<boolean> {
      if (!this.activeEncounter) return false
      const count = this.activeEncounter.participants.length
      if (count === 0) return false

      let prevIndex = this.activeEncounter.current_turn_index - 1
      let prevRound = this.activeEncounter.round

      if (prevIndex < 0) {
        prevIndex = count - 1
        prevRound = Math.max(1, prevRound - 1)
      }

      return this.updateEncounterStatus(this.activeEncounter.status as EncounterStatus, {
        current_turn_index: prevIndex,
        round: prevRound,
      })
    },

    async addEffect(
      encounterId: number,
      participantId: number,
      effect: { name: string, icon?: string | null, duration_type: string, duration_rounds?: number | null },
    ): Promise<EncounterEffect | null> {
      try {
        const created = await $fetch<EncounterEffect>(
          `/api/encounters/${encounterId}/participants/${participantId}/effects`,
          { method: 'POST', body: effect },
        )
        if (this.activeEncounter) {
          const p = this.activeEncounter.participants.find(p => p.id === participantId)
          if (p) {
            if (!p.effects) p.effects = []
            p.effects.push(created)
          }
        }
        return created
      }
      catch (error) {
        console.error('Failed to add effect:', error)
        return null
      }
    },

    async removeEffect(encounterId: number, participantId: number, effectId: number): Promise<boolean> {
      try {
        await $fetch(
          `/api/encounters/${encounterId}/participants/${participantId}/effects/${effectId}`,
          { method: 'DELETE' },
        )
        if (this.activeEncounter) {
          const p = this.activeEncounter.participants.find(p => p.id === participantId)
          if (p && p.effects) {
            p.effects = p.effects.filter(e => e.id !== effectId)
          }
        }
        return true
      }
      catch (error) {
        console.error('Failed to remove effect:', error)
        return false
      }
    },

    async tickEffects(): Promise<string[]> {
      if (!this.activeEncounter) return []
      const p = this.currentTurnParticipant
      if (!p?.effects?.length) return []
      const encId = this.activeEncounter.id
      const expired: string[] = []

      for (const e of [...p.effects]) {
        if (e.duration_type !== 'rounds' || e.remaining_rounds == null) continue
        e.remaining_rounds--
        if (e.remaining_rounds <= 0) {
          // Remove expired effect
          expired.push(e.name)
          await $fetch(`/api/encounters/${encId}/participants/${p.id}/effects/${e.id}`, { method: 'DELETE' })
          p.effects = p.effects!.filter(ef => ef.id !== e.id)
        }
        else {
          // Persist decremented rounds
          await $fetch(`/api/encounters/${encId}/participants/${p.id}/effects/${e.id}`, {
            method: 'PATCH',
            body: { remaining_rounds: e.remaining_rounds },
          })
        }
      }
      return expired
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
