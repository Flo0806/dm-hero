import { defineStore } from 'pinia'

interface Campaign {
  id: number
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export const useCampaignStore = defineStore('campaign', {
  state: () => ({
    activeCampaignId: (import.meta.client ? localStorage.getItem('activeCampaignId') : null) as string | null,
    currentCampaign: null as Campaign | null,
    campaigns: [] as Campaign[],
    loading: false,
  }),

  getters: {
    hasActiveCampaign: state => !!state.activeCampaignId,
    activeCampaignIdNumber: state => state.activeCampaignId ? Number(state.activeCampaignId) : null,
  },

  actions: {
    // Set active campaign
    setActiveCampaign(campaignId: number | string) {
      this.activeCampaignId = String(campaignId)
      if (import.meta.client) {
        localStorage.setItem('activeCampaignId', String(campaignId))
      }
      // Load campaign details
      this.loadCurrentCampaign()
    },

    // Clear active campaign
    clearActiveCampaign() {
      this.activeCampaignId = null
      this.currentCampaign = null
      if (import.meta.client) {
        localStorage.removeItem('activeCampaignId')
        localStorage.removeItem('activeCampaignName')
      }
    },

    // Load current campaign details
    async loadCurrentCampaign() {
      if (!this.activeCampaignId)
        return

      try {
        const campaign = await $fetch<Campaign>(`/api/campaigns/${this.activeCampaignId}`)
        this.currentCampaign = campaign
        // Also store campaign name in localStorage for app.vue
        if (import.meta.client) {
          localStorage.setItem('activeCampaignName', campaign.name)
        }
      }
      catch (error) {
        console.error('Failed to load current campaign:', error)
        // If campaign doesn't exist, clear it
        this.clearActiveCampaign()
      }
    },

    // Load all campaigns
    async loadCampaigns() {
      this.loading = true
      try {
        const campaigns = await $fetch<Campaign[]>('/api/campaigns')
        this.campaigns = campaigns
      }
      catch (error) {
        console.error('Failed to load campaigns:', error)
        this.campaigns = []
      }
      finally {
        this.loading = false
      }
    },

    // Create campaign
    async createCampaign(data: { name: string, description?: string }) {
      const campaign = await $fetch<Campaign>('/api/campaigns', {
        method: 'POST',
        body: data,
      })
      this.campaigns.push(campaign)
      return campaign
    },

    // Update campaign
    async updateCampaign(id: number, data: { name?: string, description?: string }) {
      const campaign = await $fetch<Campaign>(`/api/campaigns/${id}`, {
        method: 'PATCH',
        body: data,
      })
      const index = this.campaigns.findIndex(c => c.id === id)
      if (index !== -1) {
        this.campaigns[index] = campaign
      }
      if (this.currentCampaign?.id === id) {
        this.currentCampaign = campaign
      }
      return campaign
    },

    // Delete campaign
    async deleteCampaign(id: number) {
      await $fetch(`/api/campaigns/${id}`, {
        method: 'DELETE',
      })
      this.campaigns = this.campaigns.filter(c => c.id !== id)
      if (this.activeCampaignId === String(id)) {
        this.clearActiveCampaign()
      }
    },
  },
})
