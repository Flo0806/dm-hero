<template>
  <v-dialog v-model="dialogVisible" max-width="500" persistent>
    <v-card>
      <v-card-title>
        {{ marker ? $t('maps.editMarker') : $t('maps.addMarker') }}
      </v-card-title>
      <v-card-text>
        <!-- Position display -->
        <v-alert v-if="position" type="info" variant="tonal" density="compact" class="mb-4">
          {{ $t('maps.position') }}: {{ position.x.toFixed(1) }}%, {{ position.y.toFixed(1) }}%
        </v-alert>
        <v-alert v-else type="warning" variant="tonal" density="compact" class="mb-4">
          {{ $t('maps.clickToSetPosition') }}
        </v-alert>

        <!-- Entity Type -->
        <v-select
          v-model="form.entityType"
          :items="entityTypes"
          item-title="label"
          item-value="value"
          :label="$t('maps.entityType')"
          variant="outlined"
          density="compact"
          class="mb-3"
          @update:model-value="onEntityTypeChange"
        />

        <!-- Entity Search -->
        <v-autocomplete
          v-model="form.entityId"
          v-model:search="entitySearch"
          :items="entityOptions"
          :loading="searchLoading"
          item-title="name"
          item-value="id"
          :label="$t('maps.entity')"
          variant="outlined"
          density="compact"
          class="mb-3"
          clearable
          no-filter
          :disabled="!form.entityType"
        >
          <template #item="{ item, props: itemProps }">
            <v-list-item v-bind="itemProps">
              <template #prepend>
                <v-avatar size="32" :color="getEntityColor(form.entityType)">
                  <v-img v-if="item.raw.image_url" :src="`/uploads/${item.raw.image_url}`" />
                  <v-icon v-else :icon="getEntityIcon(form.entityType)" size="small" />
                </v-avatar>
              </template>
            </v-list-item>
          </template>
        </v-autocomplete>

        <!-- Custom Label (optional) -->
        <v-text-field
          v-model="form.customLabel"
          :label="$t('maps.customLabelOptional')"
          variant="outlined"
          density="compact"
          class="mb-3"
          :hint="$t('maps.customLabelHint')"
          persistent-hint
        />

        <!-- Notes (optional) -->
        <v-textarea
          v-model="form.notes"
          :label="$t('maps.notesOptional')"
          variant="outlined"
          density="compact"
          rows="2"
        />
      </v-card-text>
      <v-card-actions>
        <v-btn
          v-if="marker"
          color="error"
          variant="text"
          icon="mdi-delete"
          :loading="deleting"
          @click="deleteMarker"
        />
        <v-spacer />
        <v-btn variant="text" icon="mdi-close" @click="close" />
        <v-btn
          color="primary"
          :icon="marker ? 'mdi-check' : 'mdi-plus'"
          :loading="saving"
          :disabled="!canSave"
          @click="save"
        />
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import type { MapMarker } from '~~/types/map'

const props = defineProps<{
  show: boolean
  mapId: number
  marker?: MapMarker | null
  position?: { x: number; y: number } | null
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  saved: [marker: MapMarker]
  deleted: [markerId: number]
}>()

const dialogVisible = computed({
  get: () => props.show,
  set: (val) => emit('update:show', val),
})

const entityTypes = [
  { value: 'npc', label: 'NPC' },
  { value: 'location', label: 'Location' },
  { value: 'item', label: 'Item' },
  { value: 'faction', label: 'Faction' },
  { value: 'lore', label: 'Lore' },
  { value: 'player', label: 'Player' },
]

const form = ref({
  entityType: 'npc' as string,
  entityId: null as number | null,
  customLabel: '',
  notes: '',
})

const entitySearch = ref('')
const entityOptions = ref<Array<{ id: number; name: string; image_url?: string }>>([])
const searchLoading = ref(false)
const saving = ref(false)
const deleting = ref(false)

const campaignStore = useCampaignStore()
const activeCampaignId = computed(() => campaignStore.activeCampaignId)

const canSave = computed(() => {
  return props.position && form.value.entityId
})

// Watch for entity search with debounce
let searchTimeout: ReturnType<typeof setTimeout> | null = null
watch(entitySearch, (val) => {
  if (searchTimeout) clearTimeout(searchTimeout)
  if (!val || val.length < 1 || !activeCampaignId.value) {
    return
  }
  searchTimeout = setTimeout(() => {
    searchEntities(val)
  }, 300)
})

// Reset form when dialog opens
watch(() => props.show, async (val) => {
  if (val) {
    if (props.marker) {
      // Edit mode
      form.value.entityType = props.marker.entity_type?.toLowerCase() || 'npc'
      form.value.entityId = props.marker.entity_id
      form.value.customLabel = props.marker.custom_label || ''
      form.value.notes = props.marker.notes || ''
      // Load the entity name for display
      if (props.marker.entity_name) {
        entityOptions.value = [{
          id: props.marker.entity_id,
          name: props.marker.entity_name,
          image_url: props.marker.entity_image_url || undefined,
        }]
      }
    } else {
      // Create mode
      form.value = {
        entityType: 'npc',
        entityId: null,
        customLabel: '',
        notes: '',
      }
      entityOptions.value = []
      // Load initial entities
      await loadEntities()
    }
  }
})

// Load entities without search (initial load)
async function loadEntities() {
  if (!activeCampaignId.value) return

  searchLoading.value = true
  try {
    const typeEndpoints: Record<string, string> = {
      npc: 'npcs',
      location: 'locations',
      item: 'items',
      faction: 'factions',
      lore: 'lore',
      player: 'players',
    }
    const endpoint = typeEndpoints[form.value.entityType] || 'npcs'

    const results = await $fetch<Array<{ id: number; name: string; image_url?: string }>>(`/api/${endpoint}`, {
      query: {
        campaignId: activeCampaignId.value,
        limit: 50,
      },
    })
    entityOptions.value = results
  } catch (error) {
    console.error('Failed to load entities:', error)
  } finally {
    searchLoading.value = false
  }
}

async function onEntityTypeChange() {
  form.value.entityId = null
  entityOptions.value = []
  entitySearch.value = ''
  await loadEntities()
}

async function searchEntities(query: string) {
  if (!activeCampaignId.value) return

  searchLoading.value = true
  try {
    const typeEndpoints: Record<string, string> = {
      npc: 'npcs',
      location: 'locations',
      item: 'items',
      faction: 'factions',
      lore: 'lore',
      player: 'players',
    }
    const endpoint = typeEndpoints[form.value.entityType] || 'npcs'

    const results = await $fetch<Array<{ id: number; name: string; image_url?: string }>>(`/api/${endpoint}`, {
      query: {
        campaignId: activeCampaignId.value,
        search: query,
        limit: 20,
      },
    })
    entityOptions.value = results
  } catch (error) {
    console.error('Failed to search entities:', error)
  } finally {
    searchLoading.value = false
  }
}

async function save() {
  if (!canSave.value || !props.position) return

  saving.value = true
  try {
    if (props.marker) {
      // Update existing marker
      const updated = await $fetch<MapMarker>(`/api/maps/${props.mapId}/markers/${props.marker.id}`, {
        method: 'PATCH',
        body: {
          x: props.position.x,
          y: props.position.y,
          custom_label: form.value.customLabel || null,
          notes: form.value.notes || null,
        },
      })
      emit('saved', updated)
    } else {
      // Create new marker
      const result = await $fetch<{ marker: MapMarker; warning: string | null }>(`/api/maps/${props.mapId}/markers`, {
        method: 'POST',
        body: {
          entity_id: form.value.entityId,
          x: props.position.x,
          y: props.position.y,
          custom_label: form.value.customLabel || null,
          notes: form.value.notes || null,
        },
      })
      if (result.warning) {
        console.warn(result.warning)
      }
      emit('saved', result.marker)
    }
    close()
  } catch (error) {
    console.error('Failed to save marker:', error)
  } finally {
    saving.value = false
  }
}

function close() {
  dialogVisible.value = false
}

async function deleteMarker() {
  if (!props.marker) return

  deleting.value = true
  try {
    await $fetch(`/api/maps/${props.mapId}/markers/${props.marker.id}`, {
      method: 'DELETE',
    })
    emit('deleted', props.marker.id)
    close()
  } catch (error) {
    console.error('Failed to delete marker:', error)
  } finally {
    deleting.value = false
  }
}

function getEntityColor(entityType: string): string {
  const colors: Record<string, string> = {
    npc: '#D4A574',
    location: '#8B7355',
    item: '#CC8844',
    faction: '#7B92AB',
    lore: '#9C6B98',
    player: '#4CAF50',
  }
  return colors[entityType] || '#888888'
}

function getEntityIcon(entityType: string): string {
  const icons: Record<string, string> = {
    npc: 'mdi-account',
    location: 'mdi-map-marker',
    item: 'mdi-sword',
    faction: 'mdi-shield',
    lore: 'mdi-book-open-variant',
    player: 'mdi-account-star',
  }
  return icons[entityType] || 'mdi-map-marker'
}
</script>
