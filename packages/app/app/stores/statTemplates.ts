import type { StatTemplate, SaveStatTemplatePayload } from '~~/types/stat-template'

interface PresetInfo {
  system_key: string
  name: string
  description: string
  groups: Array<{
    name: string
    group_type: string
    fields: Array<{
      name: string
      label: string
      field_type: 'string' | 'number' | 'resource' | 'boolean'
      has_modifier: boolean
    }>
  }>
}

export const useStatTemplatesStore = defineStore('statTemplates', {
  state: () => ({
    templates: [] as StatTemplate[],
    presets: [] as PresetInfo[],
    loading: false,
  }),

  actions: {
    async loadTemplates() {
      this.loading = true
      try {
        this.templates = await $fetch<StatTemplate[]>('/api/stat-templates')
      }
      catch (e) {
        console.error('[StatTemplatesStore] Failed to load templates:', e)
        this.templates = []
      }
      finally {
        this.loading = false
      }
    },

    async ensureLoaded() {
      if (this.templates.length === 0 && !this.loading) {
        await this.loadTemplates()
      }
    },

    async loadPresets() {
      if (this.presets.length > 0) return
      try {
        this.presets = await $fetch<PresetInfo[]>('/api/stat-templates/presets')
      }
      catch (e) {
        console.error('[StatTemplatesStore] Failed to load presets:', e)
      }
    },

    async saveTemplate(id: number, payload: SaveStatTemplatePayload) {
      const updated = await $fetch<StatTemplate>(`/api/stat-templates/${id}/save`, {
        method: 'POST',
        body: payload,
      })
      const idx = this.templates.findIndex(t => t.id === id)
      if (idx !== -1) {
        this.templates[idx] = updated
      }
      return updated
    },

    async createFromPreset(systemKey: string, name: string) {
      const template = await $fetch<StatTemplate>('/api/stat-templates', {
        method: 'POST',
        body: { name, fromPreset: systemKey },
      })
      this.templates.push(template)
      return template
    },

    async checkDelete(id: number) {
      return await $fetch<{ success: boolean, requiresConfirmation?: boolean, linkedEntityCount?: number }>(
        `/api/stat-templates/${id}`,
        { method: 'DELETE' },
      )
    },

    async deleteTemplate(id: number) {
      await $fetch(`/api/stat-templates/${id}?confirm=true`, {
        method: 'DELETE',
      })
      this.templates = this.templates.filter(t => t.id !== id)
    },
  },
})
