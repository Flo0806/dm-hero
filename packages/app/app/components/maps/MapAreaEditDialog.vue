<template>
  <v-dialog v-model="dialogVisible" max-width="500" persistent>
    <v-card>
      <v-card-title>
        {{ area ? $t('maps.editArea') : $t('maps.addArea') }}
      </v-card-title>
      <v-card-text>
        <!-- Position display -->
        <v-alert v-if="position" type="info" variant="tonal" density="compact" class="mb-4">
          {{ $t('maps.position') }}: {{ position.x.toFixed(1) }}%, {{ position.y.toFixed(1) }}%
        </v-alert>
        <v-alert v-else type="warning" variant="tonal" density="compact" class="mb-4">
          {{ $t('maps.clickToSetPosition') }}
        </v-alert>

        <!-- Location Search -->
        <v-autocomplete
          v-model="form.locationId"
          v-model:search="locationSearch"
          :items="locationOptions"
          :loading="searchLoading"
          item-title="name"
          item-value="id"
          :label="$t('maps.selectLocation')"
          variant="outlined"
          density="compact"
          class="mb-3"
          clearable
          no-filter
          prepend-inner-icon="mdi-map-marker"
        >
          <template #item="{ item, props: itemProps }">
            <v-list-item v-bind="itemProps">
              <template #prepend>
                <v-avatar size="32" color="#8B7355">
                  <v-img v-if="item.raw.image_url" :src="`/uploads/${item.raw.image_url}`" />
                  <v-icon v-else icon="mdi-map-marker" size="small" />
                </v-avatar>
              </template>
            </v-list-item>
          </template>
        </v-autocomplete>

        <!-- Radius -->
        <v-slider
          v-model="form.radius"
          :label="$t('maps.radius')"
          :min="1"
          :max="20"
          :step="0.5"
          thumb-label
          class="mb-3"
        >
          <template #append>
            <span class="text-body-2">{{ form.radius }}%</span>
          </template>
        </v-slider>

        <!-- Color -->
        <v-text-field
          v-model="form.color"
          :label="$t('maps.colorOptional')"
          variant="outlined"
          density="compact"
          :hint="$t('maps.colorHint')"
          persistent-hint
          placeholder="#8B7355"
        >
          <template #prepend-inner>
            <div
              class="color-preview"
              :style="{ backgroundColor: form.color || '#8B7355' }"
            />
          </template>
        </v-text-field>
      </v-card-text>
      <v-card-actions>
        <v-btn
          v-if="area"
          color="error"
          variant="text"
          icon="mdi-delete"
          :loading="deleting"
          @click="deleteArea"
        />
        <v-spacer />
        <v-btn variant="text" icon="mdi-close" @click="close" />
        <v-btn
          color="primary"
          :icon="area ? 'mdi-check' : 'mdi-plus'"
          :loading="saving"
          :disabled="!canSave"
          @click="save"
        />
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import type { MapArea } from '~~/types/map'

const props = defineProps<{
  show: boolean
  mapId: number
  area?: MapArea | null
  position?: { x: number; y: number } | null
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  saved: [area: MapArea]
  deleted: [areaId: number]
}>()

const dialogVisible = computed({
  get: () => props.show,
  set: (val) => emit('update:show', val),
})

const form = ref({
  locationId: null as number | null,
  radius: 5,
  color: '',
})

const locationSearch = ref('')
const locationOptions = ref<Array<{ id: number; name: string; image_url?: string }>>([])
const searchLoading = ref(false)
const saving = ref(false)
const deleting = ref(false)

const campaignStore = useCampaignStore()
const activeCampaignId = computed(() => campaignStore.activeCampaignId)

const canSave = computed(() => {
  return props.position && form.value.locationId
})

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

// Reset form when dialog opens
watch(() => props.show, async (val) => {
  if (val) {
    if (props.area) {
      // Edit mode
      form.value.locationId = props.area.location_id
      form.value.radius = props.area.radius
      form.value.color = props.area.color || ''
      // Load the location name for display
      if (props.area.location_name) {
        locationOptions.value = [{
          id: props.area.location_id,
          name: props.area.location_name,
          image_url: props.area.location_image_url || undefined,
        }]
      }
    } else {
      // Create mode
      form.value = {
        locationId: null,
        radius: 5,
        color: '',
      }
      locationOptions.value = []
      // Load initial locations
      await loadLocations()
    }
  }
})

// Load locations without search (initial load)
async function loadLocations() {
  if (!activeCampaignId.value) return

  searchLoading.value = true
  try {
    const results = await $fetch<Array<{ id: number; name: string; image_url?: string }>>('/api/locations', {
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

async function searchLocations(query: string) {
  if (!activeCampaignId.value) return

  searchLoading.value = true
  try {
    const results = await $fetch<Array<{ id: number; name: string; image_url?: string }>>('/api/locations', {
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

async function save() {
  if (!canSave.value || !props.position) return

  saving.value = true
  try {
    if (props.area) {
      // Update existing area
      const updated = await $fetch<MapArea>(`/api/maps/${props.mapId}/areas/${props.area.id}`, {
        method: 'PATCH',
        body: {
          center_x: props.position.x,
          center_y: props.position.y,
          radius: form.value.radius,
          color: form.value.color || null,
        },
      })
      emit('saved', updated)
    } else {
      // Create new area
      const result = await $fetch<MapArea>(`/api/maps/${props.mapId}/areas`, {
        method: 'POST',
        body: {
          location_id: form.value.locationId,
          center_x: props.position.x,
          center_y: props.position.y,
          radius: form.value.radius,
          color: form.value.color || null,
        },
      })
      emit('saved', result)
    }
    close()
  } catch (error) {
    console.error('Failed to save area:', error)
  } finally {
    saving.value = false
  }
}

function close() {
  dialogVisible.value = false
}

async function deleteArea() {
  if (!props.area) return

  deleting.value = true
  try {
    await $fetch(`/api/maps/${props.mapId}/areas/${props.area.id}`, {
      method: 'DELETE',
    })
    emit('deleted', props.area.id)
    close()
  } catch (error) {
    console.error('Failed to delete area:', error)
  } finally {
    deleting.value = false
  }
}
</script>

<style scoped>
.color-preview {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.3);
}
</style>
