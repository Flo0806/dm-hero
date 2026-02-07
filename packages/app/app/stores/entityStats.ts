import type { StatTemplate, EntityStats, StatValues, StatNumberWithModifier } from '~~/types/stat-template'
import { useStatTemplatesStore } from '~/stores/statTemplates'

interface DocumentInfo {
  id: number
  entity_id: number
  title: string
  file_path?: string
  file_type?: string
  document_type?: string
}

interface StatsWithTemplate {
  stats: EntityStats
  template: StatTemplate
}

export const useEntityStatsStore = defineStore('entityStats', {
  state: () => ({
    entityId: null as number | null,
    template: null as StatTemplate | null,
    stats: null as EntityStats | null,
    localValues: {} as StatValues,
    characterSheets: [] as DocumentInfo[],
    loading: false,
    saving: false,
  }),

  getters: {
    hasStats: state => !!state.stats,
  },

  actions: {
    // Load everything for an entity
    async load(entityId: number) {
      this.entityId = entityId
      this.loading = true
      try {
        const statTemplatesStore = useStatTemplatesStore()
        await Promise.all([
          this.loadStats(entityId),
          statTemplatesStore.ensureLoaded(),
          this.loadCharacterSheets(entityId),
        ])
      }
      finally {
        this.loading = false
      }
    },

    async loadStats(entityId: number) {
      try {
        const data = await $fetch<StatsWithTemplate | null>(
          `/api/entity-stats/${entityId}`,
        )
        if (data) {
          this.stats = data.stats
          this.template = data.template
          this.localValues = { ...data.stats.values }
        }
        else {
          this.stats = null
          this.template = null
          this.localValues = {}
        }
      }
      catch (e) {
        console.error('[EntityStatsStore] Failed to load stats:', e)
        this.stats = null
        this.template = null
      }
    },

    async loadCharacterSheets(entityId: number) {
      try {
        this.characterSheets = await $fetch<DocumentInfo[]>(
          `/api/entities/${entityId}/documents`,
          { query: { document_type: 'character_sheet' } },
        )
      }
      catch (e) {
        console.error('[EntityStatsStore] Failed to load character sheets:', e)
        this.characterSheets = []
      }
    },

    // Save current values
    async saveValues() {
      if (!this.entityId || !this.template) return

      this.saving = true
      try {
        const result = await $fetch<EntityStats>(`/api/entity-stats/${this.entityId}`, {
          method: 'POST',
          body: {
            template_id: this.template.id,
            values: this.localValues,
          },
        })
        this.stats = result
        this.localValues = { ...result.values }
      }
      catch (e) {
        console.error('[EntityStatsStore] Failed to save stats:', e)
        throw e
      }
      finally {
        this.saving = false
      }
    },

    // Assign a template (empty values)
    async assignTemplate(templateId: number) {
      if (!this.entityId) return

      this.saving = true
      try {
        await $fetch<EntityStats>(`/api/entity-stats/${this.entityId}`, {
          method: 'POST',
          body: { template_id: templateId, values: {} },
        })
        await this.loadStats(this.entityId)
      }
      catch (e) {
        console.error('[EntityStatsStore] Failed to assign template:', e)
        throw e
      }
      finally {
        this.saving = false
      }
    },

    // Change template (resets values)
    async changeTemplate(templateId: number) {
      if (!this.entityId) return

      this.saving = true
      try {
        await $fetch<EntityStats>(`/api/entity-stats/${this.entityId}`, {
          method: 'POST',
          body: { template_id: templateId, values: {} },
        })
        this.localValues = {}
        await this.loadStats(this.entityId)
      }
      catch (e) {
        console.error('[EntityStatsStore] Failed to change template:', e)
        throw e
      }
      finally {
        this.saving = false
      }
    },

    // Remove stats entirely
    async removeStats() {
      if (!this.entityId) return

      this.saving = true
      try {
        await $fetch(`/api/entity-stats/${this.entityId}`, { method: 'DELETE' })
        this.stats = null
        this.template = null
        this.localValues = {}
      }
      catch (e) {
        console.error('[EntityStatsStore] Failed to remove stats:', e)
        throw e
      }
      finally {
        this.saving = false
      }
    },

    // Toggle a boolean field and save immediately
    async toggleBoolean(fieldName: string, value: boolean) {
      this.localValues[fieldName] = value
      await this.saveValues()
    },

    // Update a single field value (local only, no save)
    setFieldValue(fieldName: string, value: string | number | boolean | null) {
      this.localValues[fieldName] = value
    },

    setNumberWithModifier(fieldName: string, value: number, modifier: number) {
      this.localValues[fieldName] = { value, modifier } as StatNumberWithModifier
    },

    setResourceValue(fieldName: string, current: number, max: number) {
      this.localValues[fieldName] = { current, max }
    },

    // Revert local changes to last saved state
    revertValues() {
      if (this.stats) {
        this.localValues = { ...this.stats.values }
      }
    },

    // Upload character sheet PDF
    async uploadCharacterSheet(entityId: number, file: File) {
      const formData = new FormData()
      formData.append('entityId', String(entityId))
      formData.append('title', file.name.replace('.pdf', ''))
      formData.append('document_type', 'character_sheet')
      formData.append('file', file)

      await $fetch('/api/entity-documents/upload-pdf', {
        method: 'POST',
        body: formData,
      })
      await this.loadCharacterSheets(entityId)
    },

    // Delete character sheet
    async deleteCharacterSheet(entityId: number, docId: number) {
      await $fetch(`/api/entities/${entityId}/documents/${docId}`, {
        method: 'DELETE',
      })
      await this.loadCharacterSheets(entityId)
    },

    reset() {
      this.entityId = null
      this.template = null
      this.stats = null
      this.localValues = {}
      this.characterSheets = []
      this.loading = false
      this.saving = false
    },
  },
})
