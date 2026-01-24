import type { Player, PlayerCounts } from '../../types/player.js'

interface BirthdayDate {
  year: number
  month: number
  day: number
}

export const usePlayerStore = defineStore('player', {
  state: () => ({
    player: null as Player | null,
    counts: {
      characters: 0,
      items: 0,
      locations: 0,
      factions: 0,
      lore: 0,
      sessions: 0,
      documents: 0,
      images: 0,
    } as PlayerCounts,
    existingBirthdayEventId: null as number | null,
    loading: false,
  }),

  actions: {
    async loadPlayer(playerId: number) {
      this.loading = true
      try {
        const data = await $fetch<Player>(`/api/players/${playerId}`)
        this.player = data

        await this.loadCounts(playerId)
        await this.loadExistingBirthdayEvent(playerId)
      } catch (e) {
        console.error('[PlayerStore] Failed to load player:', e)
      } finally {
        this.loading = false
      }
    },

    async loadCounts(playerId: number) {
      try {
        const entitiesStore = useEntitiesStore()
        const counts = await $fetch<PlayerCounts>(`/api/players/${playerId}/counts`)
        this.counts = counts
        entitiesStore.setPlayerCounts(playerId, counts)
      } catch (e) {
        console.error('[PlayerStore] Failed to load counts:', e)
      }
    },

    async loadExistingBirthdayEvent(playerId: number) {
      const campaignStore = useCampaignStore()
      const campaignId = campaignStore.activeCampaignId
      if (!campaignId) return

      try {
        const events = await $fetch<Array<{
          id: number
          event_type: string
          linked_entities?: Array<{ entity_id: number }>
        }>>('/api/calendar/events', {
          query: { campaignId },
        })

        const birthdayEvent = events.find(
          (e) =>
            e.event_type === 'birthday' &&
            e.linked_entities?.some((le) => le.entity_id === playerId),
        )

        this.existingBirthdayEventId = birthdayEvent?.id || null
      } catch (e) {
        console.error('[PlayerStore] Failed to load birthday event:', e)
      }
    },

    async handleBirthdayEvent(
      playerId: number,
      playerName: string,
      birthday: BirthdayDate | null,
      showInCalendar: boolean,
      eventTitle: string,
    ) {
      const campaignStore = useCampaignStore()
      const campaignId = campaignStore.activeCampaignId
      if (!campaignId) return

      // Case 1: No birthday or don't show in calendar -> delete existing event
      if (!birthday || !showInCalendar) {
        if (this.existingBirthdayEventId) {
          try {
            await $fetch(`/api/calendar/events/${this.existingBirthdayEventId}`, {
              method: 'DELETE',
            })
            this.existingBirthdayEventId = null
          } catch (e) {
            console.error('[PlayerStore] Failed to delete birthday event:', e)
          }
        }
        return
      }

      // Case 2: Birthday set and show in calendar
      if (this.existingBirthdayEventId) {
        // Update existing event
        try {
          await $fetch(`/api/calendar/events/${this.existingBirthdayEventId}`, {
            method: 'PATCH',
            body: {
              title: eventTitle,
              month: birthday.month,
              day: birthday.day,
              isRecurring: true,
              entityIds: [playerId],
            },
          })
        } catch (e) {
          console.error('[PlayerStore] Failed to update birthday event:', e)
        }
      } else {
        // Create new event
        try {
          const result = await $fetch<{ id: number }>('/api/calendar/events', {
            method: 'POST',
            body: {
              campaignId: Number(campaignId),
              title: eventTitle,
              eventType: 'birthday',
              month: birthday.month,
              day: birthday.day,
              isRecurring: true,
              entityIds: [playerId],
            },
          })
          this.existingBirthdayEventId = result.id
        } catch (e) {
          console.error('[PlayerStore] Failed to create birthday event:', e)
        }
      }
    },

    reset() {
      this.player = null
      this.counts = {
        characters: 0,
        items: 0,
        locations: 0,
        factions: 0,
        lore: 0,
        sessions: 0,
        documents: 0,
        images: 0,
      }
      this.existingBirthdayEventId = null
      this.loading = false
    },
  },
})
