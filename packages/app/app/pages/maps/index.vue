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
          <v-menu>
            <template #activator="{ props: menuProps }">
              <v-btn icon="mdi-plus" v-bind="menuProps" />
            </template>
            <v-list density="compact">
              <v-list-item
                prepend-icon="mdi-map-marker-plus"
                :title="$t('maps.addMarker')"
                @click="startAddMarker"
              />
              <v-list-item
                prepend-icon="mdi-map-marker-radius"
                :title="$t('maps.addArea')"
                @click="startAddArea"
              />
            </v-list>
          </v-menu>
        </v-toolbar>
        <v-card-text class="pa-0" style="height: calc(100vh - 64px); position: relative;">
          <ClientOnly>
            <MapsMapViewer
              :map="selectedMap"
              :markers="selectedMapMarkers"
              :areas="selectedMapAreas"
              @marker-click="onMarkerClick"
              @marker-right-click="onMarkerRightClick"
              @map-click="onMapClick"
              @marker-drag="onMarkerDrag"
              @marker-drag-into-area="onMarkerDragIntoArea"
              @marker-drag-out-of-area="onMarkerDragOutOfArea"
              @area-click="onAreaClick"
              @area-right-click="onAreaRightClick"
            />
          </ClientOnly>
          <!-- Help badges -->
          <div class="map-help-badges">
            <v-chip
              v-if="addMode === 'area'"
              size="small"
              color="primary"
              prepend-icon="mdi-map-marker-radius"
            >
              {{ $t('maps.clickToPlaceArea') }}
            </v-chip>
            <template v-else>
              <v-chip size="small" variant="tonal" prepend-icon="mdi-cursor-default-click">
                {{ $t('maps.helpClick') }}
              </v-chip>
              <v-chip size="small" variant="tonal" prepend-icon="mdi-cursor-default-click-outline">
                {{ $t('maps.helpRightClick') }}
              </v-chip>
              <v-chip size="small" variant="tonal" prepend-icon="mdi-cursor-move">
                {{ $t('maps.helpDrag') }}
              </v-chip>
            </template>
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

    <!-- Add/Edit Area Dialog -->
    <MapsMapAreaEditDialog
      v-model:show="showAddAreaDialog"
      :map-id="selectedMap?.id || 0"
      :area="editingArea"
      :position="areaPosition"
      @saved="onAreaSaved"
      @deleted="onAreaDeleted"
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

    <!-- Location Assignment Dialog (when marker dragged into area) -->
    <v-dialog v-model="showLocationAssignDialog" max-width="450">
      <v-card>
        <v-card-title class="d-flex align-center">
          <v-icon start color="primary">mdi-map-marker-check</v-icon>
          {{ $t('maps.assignLocation') }}
        </v-card-title>
        <v-card-text>
          <p>{{ $t('maps.assignLocationQuestion', {
            entity: pendingLocationAssign?.marker?.entity_name,
            location: pendingLocationAssign?.area?.location_name
          }) }}</p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="cancelLocationAssign">
            {{ $t('common.no') }}
          </v-btn>
          <v-btn color="primary" :loading="assigningLocation" @click="confirmLocationAssign">
            {{ $t('common.yes') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Location Removal Dialog (when marker dragged out of area) -->
    <v-dialog v-model="showLocationRemoveDialog" max-width="450">
      <v-card>
        <v-card-title class="d-flex align-center">
          <v-icon start color="warning">mdi-map-marker-off</v-icon>
          {{ $t('maps.removeLocation') }}
        </v-card-title>
        <v-card-text>
          <p>{{ $t('maps.removeLocationQuestion', {
            entity: pendingLocationRemove?.marker?.entity_name,
            location: pendingLocationRemove?.previousArea?.location_name
          }) }}</p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="cancelLocationRemove">
            {{ $t('common.no') }}
          </v-btn>
          <v-btn color="warning" :loading="removingLocation" @click="confirmLocationRemove">
            {{ $t('common.yes') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import type { CampaignMap, MapMarker, MapArea } from '~~/types/map'
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
const showAddAreaDialog = ref(false)
const showDeleteDialog = ref(false)
const showEntityPreview = ref(false)

// Mode for what happens on map click
type AddMode = 'marker' | 'area' | null
const addMode = ref<AddMode>(null)

const selectedMap = ref<CampaignMap | null>(null)
const selectedMapMarkers = ref<MapMarker[]>([])
const selectedMapAreas = ref<MapArea[]>([])
const deletingMap = ref<CampaignMap | null>(null)

const uploadForm = ref({
  name: '',
  description: '',
  version_name: '',
  file: null as File | null,
})

const editingMarker = ref<MapMarker | null>(null)
const markerPosition = ref<{ x: number; y: number } | null>(null)

const editingArea = ref<MapArea | null>(null)
const areaPosition = ref<{ x: number; y: number } | null>(null)

// Entity preview state
const previewEntityType = ref<EntityPreviewType>('npc')
const previewEntityId = ref<number | null>(null)

// Location assignment dialog state (when marker dragged into area)
const showLocationAssignDialog = ref(false)
const assigningLocation = ref(false)
const pendingLocationAssign = ref<{
  marker: MapMarker
  area: MapArea
  x: number
  y: number
} | null>(null)

// Location removal dialog state (when marker dragged out of area)
const showLocationRemoveDialog = ref(false)
const removingLocation = ref(false)
const pendingLocationRemove = ref<{
  marker: MapMarker
  previousArea: MapArea
  x: number
  y: number
} | null>(null)

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
    const details = await $fetch<CampaignMap & { markers: MapMarker[]; areas: MapArea[] }>(`/api/maps/${map.id}`)
    selectedMap.value = details
    selectedMapMarkers.value = details.markers || []
    selectedMapAreas.value = details.areas || []
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
  if (addMode.value === 'area') {
    // Create new area at clicked position
    editingArea.value = null
    areaPosition.value = position
    showAddAreaDialog.value = true
    addMode.value = null
  } else {
    // Default: Create new marker at clicked position
    editingMarker.value = null
    markerPosition.value = position
    showAddMarkerDialog.value = true
    addMode.value = null
  }
}

// Start add modes (from menu)
function startAddMarker() {
  addMode.value = 'marker'
  // User will click on map to set position
}

function startAddArea() {
  addMode.value = 'area'
  // User will click on map to set position
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

// Handler: Marker dragged INTO an area circle
function onMarkerDragIntoArea(data: { marker: MapMarker; area: MapArea; x: number; y: number }) {
  // Show confirmation dialog to assign location
  pendingLocationAssign.value = data
  showLocationAssignDialog.value = true
}

// Handler: Marker dragged OUT OF an area circle
function onMarkerDragOutOfArea(data: { marker: MapMarker; previousArea: MapArea; x: number; y: number }) {
  // Show confirmation dialog to remove location
  pendingLocationRemove.value = data
  showLocationRemoveDialog.value = true
}

// Confirm: Assign location to entity
async function confirmLocationAssign() {
  if (!pendingLocationAssign.value) return

  assigningLocation.value = true
  try {
    const { marker, area } = pendingLocationAssign.value

    // Update the entity's location_id via API
    await $fetch(`/api/entities/${marker.entity_id}/location`, {
      method: 'PATCH',
      body: {
        location_id: area.location_id,
      },
    })

    showLocationAssignDialog.value = false
    pendingLocationAssign.value = null
  } catch (error) {
    console.error('Failed to assign location:', error)
  } finally {
    assigningLocation.value = false
  }
}

// Cancel: Don't assign location
function cancelLocationAssign() {
  showLocationAssignDialog.value = false
  pendingLocationAssign.value = null
}

// Confirm: Remove location from entity
async function confirmLocationRemove() {
  if (!pendingLocationRemove.value) return

  removingLocation.value = true
  try {
    const { marker } = pendingLocationRemove.value

    // Clear the entity's location_id via API
    await $fetch(`/api/entities/${marker.entity_id}/location`, {
      method: 'PATCH',
      body: {
        location_id: null,
      },
    })

    showLocationRemoveDialog.value = false
    pendingLocationRemove.value = null
  } catch (error) {
    console.error('Failed to remove location:', error)
  } finally {
    removingLocation.value = false
  }
}

// Cancel: Don't remove location
function cancelLocationRemove() {
  showLocationRemoveDialog.value = false
  pendingLocationRemove.value = null
}

// Area event handlers
function onAreaClick(area: MapArea) {
  // Open location preview dialog
  previewEntityType.value = 'location'
  previewEntityId.value = area.location_id
  showEntityPreview.value = true
}

function onAreaRightClick(area: MapArea) {
  // Edit area on right-click
  editingArea.value = area
  areaPosition.value = { x: area.center_x, y: area.center_y }
  showAddAreaDialog.value = true
}

async function onAreaSaved(_area: MapArea) {
  // Reload map data
  await reloadMapData()
}

async function onAreaDeleted(_areaId: number) {
  // Reload map data
  await reloadMapData()
}

async function reloadMapData() {
  if (selectedMap.value) {
    try {
      const details = await $fetch<CampaignMap & { markers: MapMarker[]; areas: MapArea[] }>(`/api/maps/${selectedMap.value.id}`)
      selectedMapMarkers.value = details.markers || []
      selectedMapAreas.value = details.areas || []
    } catch (error) {
      console.error('Failed to reload map data:', error)
    }
  }
}

// Alias for backwards compatibility
const reloadMarkers = reloadMapData

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
