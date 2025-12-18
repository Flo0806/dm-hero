<template>
  <v-card class="dashboard-card notes-widget h-100" variant="outlined" to="/notes" hover>
    <v-card-text class="pa-4">
      <div class="d-flex align-center justify-space-between mb-3">
        <div class="d-flex align-center">
          <v-icon icon="mdi-notebook-outline" color="primary" size="24" class="mr-2" />
          <span class="text-subtitle-1 font-weight-medium">{{ $t('dashboard.notes.title') }}</span>
          <v-badge
            v-if="pendingCount > 0"
            :content="pendingCount"
            color="primary"
            inline
            class="ml-2"
          />
        </div>
        <v-icon icon="mdi-chevron-right" size="20" class="text-medium-emphasis" />
      </div>

      <div v-if="pendingCount > 0" class="d-flex flex-column ga-2">
        <div
          v-for="note in previewNotes"
          :key="note.id"
          class="note-item d-flex align-start py-2 px-3 rounded"
        >
          <v-icon
            :icon="note.completed ? 'mdi-checkbox-marked-circle' : 'mdi-checkbox-blank-circle-outline'"
            size="16"
            :color="note.completed ? 'success' : 'grey'"
            class="mr-2"
          />
          <span class="note-text flex-grow-1 text-body-2 text-truncate" :class="{ 'text-decoration-line-through': note.completed }">
            {{ note.content }}
          </span>
        </div>
        <div v-if="pendingCount > 3" class="text-caption text-medium-emphasis mt-2">
          {{ $t('dashboard.notes.more', { count: pendingCount - 3 }) }}
        </div>
      </div>

      <div v-else class="d-flex flex-column align-center text-center py-2">
        <v-icon icon="mdi-check-circle" size="32" color="success" class="mb-2" />
        <p class="text-body-2 text-medium-emphasis">
          {{ $t('dashboard.notes.allDone') }}
        </p>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import type { CampaignNote } from '~~/types/note'

const props = defineProps<{
  notes: CampaignNote[]
  pendingCount: number
}>()

// Show first 3 pending notes as preview
const previewNotes = computed(() => {
  return props.notes
    .filter((n) => !n.completed)
    .slice(0, 3)
})
</script>

<style scoped>
.note-item {
  background: rgba(var(--v-theme-surface), 0.5);
}
</style>
