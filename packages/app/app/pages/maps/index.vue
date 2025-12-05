<template>
  <v-container>
    <UiPageHeader :title="$t('maps.title')" :subtitle="$t('maps.subtitle')">
      <template #actions>
        <v-btn color="primary" prepend-icon="mdi-plus" size="large" @click="showUploadDialog = true">
          {{ $t('maps.upload') }}
        </v-btn>
      </template>
    </UiPageHeader>

    <!-- Maps List -->
    <v-row v-if="loading">
      <v-col v-for="i in 3" :key="i" cols="12" md="4">
        <v-skeleton-loader type="card" />
      </v-col>
    </v-row>

    <v-row v-else-if="maps.length > 0">
      <v-col v-for="map in maps" :key="map.id" cols="12" md="4">
        <v-card hover @click="selectMap(map)">
          <v-img
            :src="`/uploads/${map.image_url}`"
            height="200"
            cover
            class="bg-grey-darken-3"
          >
            <template #placeholder>
              <div class="d-flex align-center justify-center fill-height">
                <v-progress-circular indeterminate />
              </div>
            </template>
          </v-img>
          <v-card-title>{{ map.name }}</v-card-title>
          <v-card-subtitle v-if="map.version_name">
            {{ map.version_name }}
          </v-card-subtitle>
          <v-card-text v-if="map.description">
            {{ map.description }}
          </v-card-text>
          <v-card-actions>
            <v-chip size="small" prepend-icon="mdi-map-marker">
              {{ map._markerCount || 0 }} {{ $t('maps.markers') }}
            </v-chip>
            <v-spacer />
            <v-btn icon="mdi-pencil" variant="text" size="small" @click.stop="editMap(map)" />
            <v-btn icon="mdi-delete" variant="text" size="small" color="error" @click.stop="deleteMap(map)" />
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <v-empty-state
      v-else
      icon="mdi-map"
      :title="$t('maps.noMaps')"
      :text="$t('maps.noMapsText')"
    >
      <template #actions>
        <v-btn color="primary" prepend-icon="mdi-plus" @click="showUploadDialog = true">
          {{ $t('maps.upload') }}
        </v-btn>
      </template>
    </v-empty-state>

    <!-- Selected Map Viewer (placeholder) -->
    <v-dialog v-model="showMapViewer" fullscreen>
      <v-card v-if="selectedMap">
        <v-toolbar color="primary">
          <v-btn icon="mdi-close" @click="showMapViewer = false" />
          <v-toolbar-title>{{ selectedMap.name }}</v-toolbar-title>
          <v-spacer />
          <v-btn icon="mdi-plus" @click="showAddMarkerDialog = true" />
        </v-toolbar>
        <v-card-text class="pa-0" style="height: calc(100vh - 64px); position: relative;">
          <ClientOnly>
            <MapsMapViewer
              :map="selectedMap"
              :markers="selectedMapMarkers"
              @marker-click="onMarkerClick"
              @marker-right-click="onMarkerRightClick"
              @map-click="onMapClick"
              @marker-drag="onMarkerDrag"
            />
          </ClientOnly>
          <!-- Help badges -->
          <div class="map-help-badges">
            <v-chip size="small" variant="tonal" prepend-icon="mdi-cursor-default-click">
              {{ $t('maps.helpClick') }}
            </v-chip>
            <v-chip size="small" variant="tonal" prepend-icon="mdi-cursor-default-click-outline">
              {{ $t('maps.helpRightClick') }}
            </v-chip>
            <v-chip size="small" variant="tonal" prepend-icon="mdi-cursor-move">
              {{ $t('maps.helpDrag') }}
            </v-chip>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- Upload Dialog -->
    <v-dialog v-model="showUploadDialog" max-width="500">
      <v-card>
        <v-card-title>{{ $t('maps.upload') }}</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="uploadForm.name"
            :label="$t('maps.name')"
            variant="outlined"
            class="mb-3"
          />
          <v-textarea
            v-model="uploadForm.description"
            :label="$t('maps.descriptionOptional')"
            variant="outlined"
            rows="2"
            class="mb-3"
          />
          <v-text-field
            v-model="uploadForm.version_name"
            :label="$t('maps.versionNameOptional')"
            :placeholder="$t('maps.versionNamePlaceholder')"
            variant="outlined"
            class="mb-3"
          />
          <v-file-input
            v-model="uploadForm.file"
            :label="$t('maps.mapImage')"
            accept="image/*"
            variant="outlined"
            prepend-icon="mdi-map"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showUploadDialog = false">{{ $t('maps.cancel') }}</v-btn>
          <v-btn
            color="primary"
            :loading="uploading"
            :disabled="!uploadForm.name || !uploadForm.file"
            @click="uploadMap"
          >
            {{ $t('maps.upload') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Add/Edit Marker Dialog -->
    <MapsMapMarkerEditDialog
      v-model:show="showAddMarkerDialog"
      :map-id="selectedMap?.id || 0"
      :marker="editingMarker"
      :position="markerPosition"
      @saved="onMarkerSaved"
      @deleted="onMarkerDeleted"
    />

    <!-- Delete Confirmation -->
    <UiDeleteConfirmDialog
      v-model="showDeleteDialog"
      :title="$t('maps.delete')"
      :message="$t('maps.deleteConfirm', { name: deletingMap?.name })"
      :loading="deleting"
      @confirm="confirmDelete"
    />

    <!-- Entity Preview Dialog -->
    <SharedEntityPreviewDialog
      v-model="showEntityPreview"
      :entity-type="previewEntityType"
      :entity-id="previewEntityId"
    />
  </v-container>
</template>

<script setup lang="ts">
import type { CampaignMap, MapMarker } from '~~/types/map'
import type { EntityPreviewType } from '~/components/shared/EntityPreviewDialog.vue'

const campaignStore = useCampaignStore()
const activeCampaignId = computed(() => campaignStore.activeCampaignId)

// State
const maps = ref<CampaignMap[]>([])
const loading = ref(false)
const uploading = ref(false)
const deleting = ref(false)

const showUploadDialog = ref(false)
const showMapViewer = ref(false)
const showAddMarkerDialog = ref(false)
const showDeleteDialog = ref(false)
const showEntityPreview = ref(false)

const selectedMap = ref<CampaignMap | null>(null)
const selectedMapMarkers = ref<MapMarker[]>([])
const deletingMap = ref<CampaignMap | null>(null)

const uploadForm = ref({
  name: '',
  description: '',
  version_name: '',
  file: null as File | null,
})

const editingMarker = ref<MapMarker | null>(null)
const markerPosition = ref<{ x: number; y: number } | null>(null)

// Entity preview state
const previewEntityType = ref<EntityPreviewType>('npc')
const previewEntityId = ref<number | null>(null)

// Load maps
async function loadMaps() {
  if (!activeCampaignId.value) return

  loading.value = true
  try {
    maps.value = await $fetch<CampaignMap[]>('/api/maps', {
      query: { campaignId: activeCampaignId.value },
    })
  } catch (error) {
    console.error('Failed to load maps:', error)
  } finally {
    loading.value = false
  }
}

// Select map and load details
async function selectMap(map: CampaignMap) {
  selectedMap.value = map
  showMapViewer.value = true

  try {
    const details = await $fetch<CampaignMap & { markers: MapMarker[] }>(`/api/maps/${map.id}`)
    selectedMap.value = details
    selectedMapMarkers.value = details.markers || []
  } catch (error) {
    console.error('Failed to load map details:', error)
  }
}

// Upload new map
async function uploadMap() {
  if (!activeCampaignId.value || !uploadForm.value.file) return

  uploading.value = true
  try {
    // First create the map with a placeholder image
    const map = await $fetch<CampaignMap>('/api/maps', {
      method: 'POST',
      body: {
        campaignId: activeCampaignId.value,
        name: uploadForm.value.name,
        description: uploadForm.value.description || null,
        version_name: uploadForm.value.version_name || null,
        image_url: 'placeholder', // Will be updated after upload
      },
    })

    // Then upload the image
    if (!uploadForm.value.file) return
    const formData = new FormData()
    formData.append('image', uploadForm.value.file)

    await $fetch(`/api/maps/${map.id}/upload-image`, {
      method: 'POST',
      body: formData,
    })

    // Reload maps
    await loadMaps()

    // Reset form and close upload dialog
    uploadForm.value = { name: '', description: '', version_name: '', file: null as File | null }
    showUploadDialog.value = false

    // Open the newly created map directly
    await selectMap(map)
  } catch (error) {
    console.error('Failed to upload map:', error)
  } finally {
    uploading.value = false
  }
}

function onMarkerClick(marker: MapMarker) {
  // Open entity preview dialog
  if (marker.entity_type && marker.entity_id) {
    previewEntityType.value = marker.entity_type.toLowerCase() as EntityPreviewType
    previewEntityId.value = marker.entity_id
    showEntityPreview.value = true
  }
}

function onMarkerRightClick(marker: MapMarker) {
  // Edit marker on right-click
  editingMarker.value = marker
  markerPosition.value = { x: marker.x, y: marker.y }
  showAddMarkerDialog.value = true
}

function onMapClick(position: { x: number; y: number }) {
  // Create new marker at clicked position
  editingMarker.value = null
  markerPosition.value = position
  showAddMarkerDialog.value = true
}

async function onMarkerSaved(_marker: MapMarker) {
  // Reload markers for current map
  await reloadMarkers()
}

async function onMarkerDeleted(_markerId: number) {
  // Reload markers for current map
  await reloadMarkers()
}

async function onMarkerDrag(data: { marker: MapMarker; x: number; y: number }) {
  // Update marker position via API
  try {
    await $fetch(`/api/maps/${selectedMap.value?.id}/markers/${data.marker.id}`, {
      method: 'PATCH',
      body: {
        x: data.x,
        y: data.y,
      },
    })
    // Reload to get fresh data
    await reloadMarkers()
  } catch (error) {
    console.error('Failed to update marker position:', error)
  }
}

async function reloadMarkers() {
  if (selectedMap.value) {
    try {
      const details = await $fetch<CampaignMap & { markers: MapMarker[] }>(`/api/maps/${selectedMap.value.id}`)
      selectedMapMarkers.value = details.markers || []
    } catch (error) {
      console.error('Failed to reload markers:', error)
    }
  }
}

function editMap(map: CampaignMap) {
  // TODO: Edit dialog
  console.log('Edit map:', map)
}

function deleteMap(map: CampaignMap) {
  deletingMap.value = map
  showDeleteDialog.value = true
}

async function confirmDelete() {
  if (!deletingMap.value) return

  deleting.value = true
  try {
    await $fetch(`/api/maps/${deletingMap.value.id}`, { method: 'DELETE' })
    await loadMaps()
    showDeleteDialog.value = false
    deletingMap.value = null
  } catch (error) {
    console.error('Failed to delete map:', error)
  } finally {
    deleting.value = false
  }
}

// Load on mount
onMounted(() => {
  loadMaps()
})

// Reload when campaign changes
watch(activeCampaignId, () => {
  loadMaps()
})
</script>

<style scoped>
.map-help-badges {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  z-index: 1000;
  pointer-events: none;
}
</style>
