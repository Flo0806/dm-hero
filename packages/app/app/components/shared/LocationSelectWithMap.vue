<template>
  <div class="location-select-with-map">
    <!-- Location Autocomplete -->
    <v-autocomplete
      v-model="selectedLocationId"
      v-model:search="locationSearch"
      :items="locationOptions"
      :loading="searchLoading"
      item-title="name"
      item-value="id"
      :label="$t('entities.currentLocation')"
      variant="outlined"
      density="compact"
      clearable
      no-filter
      prepend-inner-icon="mdi-map-marker"
      :hint="$t('entities.currentLocationHint')"
      persistent-hint
      @update:model-value="onLocationChange"
    >
      <template #item="{ item, props: itemProps }">
        <v-list-item v-bind="itemProps">
          <template #prepend>
            <v-avatar size="32" color="#8B7355">
              <v-img v-if="item.raw.image_url" :src="`/uploads/${item.raw.image_url}`" />
              <v-icon v-else icon="mdi-map-marker" size="small" />
            </v-avatar>
          </template>
          <template #subtitle>
            <span v-if="item.raw.description" class="text-truncate">
              {{ item.raw.description?.substring(0, 50) }}{{ item.raw.description?.length > 50 ? '...' : '' }}
            </span>
          </template>
        </v-list-item>
      </template>
    </v-autocomplete>

    <!-- Map sync options (only show if location is selected) -->
    <v-expand-transition>
      <div v-if="selectedLocationId && availableMaps.length > 0" class="mt-3">
        <v-checkbox
          v-model="syncToMaps"
          :label="$t('entities.updateOnMaps')"
          density="compact"
          hide-details
          class="mb-2"
        />

        <v-expand-transition>
          <v-select
            v-if="syncToMaps"
            v-model="selectedMapIds"
            :items="availableMaps"
            item-title="name"
            item-value="id"
            :label="$t('entities.selectMaps')"
            variant="outlined"
            density="compact"
            multiple
            chips
            closable-chips
            :hint="$t('entities.selectMapsHint')"
            persistent-hint
          >
            <template #chip="{ item, props: chipProps }">
              <v-chip v-bind="chipProps" size="small">
                {{ item.title }}
              </v-chip>
            </template>
          </v-select>
        </v-expand-transition>
      </div>
    </v-expand-transition>
  </div>
</template>

<script setup lang="ts">
import type { CampaignMap } from '~~/types/map'

interface LocationOption {
  id: number
  name: string
  description?: string | null
  image_url?: string | null
}

const props = defineProps<{
  modelValue: number | null
  entityId?: number | null
  entityType?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number | null]
  'update:mapSync': [data: { locationId: number | null; mapIds: number[] } | null]
}>()

const campaignStore = useCampaignStore()
const activeCampaignId = computed(() => campaignStore.activeCampaignId)

// Location selection
const selectedLocationId = ref<number | null>(props.modelValue)
const locationSearch = ref('')
const locationOptions = ref<LocationOption[]>([])
const searchLoading = ref(false)

// Map sync
const syncToMaps = ref(false)
const selectedMapIds = ref<number[]>([])
const availableMaps = ref<CampaignMap[]>([])

// Watch for external changes to modelValue
watch(() => props.modelValue, (newVal) => {
  selectedLocationId.value = newVal
  if (newVal) {
    loadLocationDetails(newVal)
  }
}, { immediate: true })

// Watch for location search with debounce
let searchTimeout: ReturnType<typeof setTimeout> | null = null
watch(locationSearch, (val) => {
  if (searchTimeout) clearTimeout(searchTimeout)
  if (!val || val.length < 1 || !activeCampaignId.value) {
    return
  }
  searchTimeout = setTimeout(() => {
    searchLocations(val)
  }, 300)
})

// Load available maps on mount
onMounted(async () => {
  await loadMaps()
  await loadLocations()
})

async function loadMaps() {
  if (!activeCampaignId.value) return

  try {
    availableMaps.value = await $fetch<CampaignMap[]>('/api/maps', {
      query: { campaignId: activeCampaignId.value },
    })
  } catch (error) {
    console.error('Failed to load maps:', error)
  }
}

async function loadLocations() {
  if (!activeCampaignId.value) return

  searchLoading.value = true
  try {
    const results = await $fetch<LocationOption[]>('/api/locations', {
      query: {
        campaignId: activeCampaignId.value,
        limit: 50,
      },
    })
    locationOptions.value = results
  } catch (error) {
    console.error('Failed to load locations:', error)
  } finally {
    searchLoading.value = false
  }
}

async function loadLocationDetails(locationId: number) {
  try {
    const location = await $fetch<LocationOption>(`/api/locations/${locationId}`)
    // Make sure this location is in the options
    if (!locationOptions.value.find(l => l.id === locationId)) {
      locationOptions.value = [location, ...locationOptions.value]
    }
  } catch (error) {
    console.error('Failed to load location details:', error)
  }
}

async function searchLocations(query: string) {
  if (!activeCampaignId.value) return

  searchLoading.value = true
  try {
    const results = await $fetch<LocationOption[]>('/api/locations', {
      query: {
        campaignId: activeCampaignId.value,
        search: query,
        limit: 20,
      },
    })
    locationOptions.value = results
  } catch (error) {
    console.error('Failed to search locations:', error)
  } finally {
    searchLoading.value = false
  }
}

function onLocationChange(locationId: number | null) {
  emit('update:modelValue', locationId)
  emitMapSync()
}

function emitMapSync() {
  if (syncToMaps.value && selectedLocationId.value && selectedMapIds.value.length > 0) {
    emit('update:mapSync', {
      locationId: selectedLocationId.value,
      mapIds: selectedMapIds.value,
    })
  } else {
    emit('update:mapSync', null)
  }
}

// Watch sync options and emit changes
watch([syncToMaps, selectedMapIds], () => {
  emitMapSync()
}, { deep: true })

// Expose method to get current sync data
defineExpose({
  getMapSyncData: () => {
    if (syncToMaps.value && selectedLocationId.value && selectedMapIds.value.length > 0) {
      return {
        locationId: selectedLocationId.value,
        mapIds: selectedMapIds.value,
      }
    }
    return null
  },
})
</script>

<style scoped>
.location-select-with-map {
  width: 100%;
}
</style>
