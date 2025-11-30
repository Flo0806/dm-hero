<template>
  <v-dialog
    :model-value="modelValue"
    max-width="800"
    @update:model-value="$emit('update:model-value', $event)"
  >
    <v-card>
      <v-card-title>
        <v-text-field
          :model-value="searchQuery"
          autofocus
          clearable
          hide-details
          placeholder="Suche nach NPCs, Orten, Items..."
          prepend-inner-icon="mdi-magnify"
          variant="solo"
          flat
          @update:model-value="$emit('update:search-query', $event)"
        />
      </v-card-title>
      <v-divider />
      <v-card-text style="max-height: 500px; overflow-y: auto">
        <div v-if="searchQuery" class="text-caption text-disabled mb-2">
          Suche nach "{{ searchQuery }}"...
        </div>
        <v-list v-if="searchResults.length > 0">
          <v-list-item
            v-for="result in searchResults"
            :key="result.id"
            @click="$emit('select-result', result)"
          >
            <template #prepend>
              <v-icon :icon="result.icon" :color="result.color" />
            </template>
            <v-list-item-title>{{ result.name }}</v-list-item-title>
            <v-list-item-subtitle class="d-flex align-center flex-wrap ga-1">
              <span>{{ result.type }}</span>
              <template v-if="result.linkedEntities && result.linkedEntities.length > 0">
                <span class="mx-1">·</span>
                <v-chip
                  v-for="linked in result.linkedEntities"
                  :key="linked"
                  size="x-small"
                  variant="tonal"
                  density="compact"
                >
                  {{ linked }}
                </v-chip>
              </template>
            </v-list-item-subtitle>
          </v-list-item>
        </v-list>
        <div v-else-if="searchQuery" class="text-center text-disabled py-8">
          Keine Ergebnisse gefunden
        </div>
        <div v-else class="text-center text-disabled py-8">Drücke <kbd>/</kbd> um zu suchen</div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
interface SearchResult {
  id: number
  name: string
  type: string
  icon: string
  color: string
  path: string
  linkedEntities: string[]
}

interface Props {
  modelValue: boolean
  searchQuery: string
  searchResults: SearchResult[]
}

defineProps<Props>()

defineEmits<{
  'update:model-value': [value: boolean]
  'update:search-query': [query: string]
  'select-result': [result: SearchResult]
}>()
</script>

<style scoped>
kbd {
  background-color: rgba(var(--v-theme-on-surface), 0.1);
  border-radius: 4px;
  padding: 2px 6px;
  font-family: monospace;
  font-size: 0.9em;
}
</style>
