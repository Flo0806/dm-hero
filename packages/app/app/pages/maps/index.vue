<template>
  <div class="maps-page">
    <!-- Map Selection View (no map selected) -->
    <v-container v-if="!selectedMap">
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
          <v-card hover class="map-card" @click="selectMap(map)">
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
            <div class="map-card-content">
              <v-card-title class="map-card-title">{{ map.name }}</v-card-title>
              <v-card-subtitle class="map-card-subtitle">
                {{ map.version_name || '&nbsp;' }}
              </v-card-subtitle>
              <v-card-text class="map-card-description">
                {{ map.description || '&nbsp;' }}
              </v-card-text>
            </div>
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
    </v-container>

    <!-- Map Viewer (map selected) - Inline instead of dialog -->
    <div v-else class="map-viewer-container">
      <!-- Header Bar -->
      <div class="map-header">
        <v-btn icon="mdi-arrow-left" variant="text" @click="closeMap" />
        <h2 class="map-title">{{ selectedMap.name }}</h2>
        <v-chip v-if="selectedMap.version_name" size="small" class="ml-2">
          {{ selectedMap.version_name }}
        </v-chip>
        <v-spacer />
        <!-- Active mode indicator -->
        <v-chip
          v-if="addMode"
          color="primary"
          closable
          class="mr-2"
          :prepend-icon="addMode === 'marker' ? 'mdi-map-marker-plus' : 'mdi-map-marker-radius'"
          @click:close="addMode = null"
        >
          {{ addMode === 'marker' ? $t('maps.addingMarker') : $t('maps.addingArea') }}
        </v-chip>

        <!-- Entity type filters -->
        <div v-if="availableEntityTypes.length > 0" class="filter-chips">
          <v-chip
            v-for="entityType in availableEntityTypes"
            :key="entityType"
            :prepend-icon="ENTITY_TYPE_ICONS[entityType] || 'mdi-help'"
            :variant="activeFilters.has(entityType) ? 'flat' : 'outlined'"
            :color="activeFilters.has(entityType) ? ENTITY_TYPE_COLORS[entityType] : undefined"
            size="small"
            class="mr-1"
            @click="toggleFilter(entityType)"
          >
            {{ $t(`nav.${entityType.toLowerCase()}s`) }}
          </v-chip>
        </div>

        <!-- Measure button -->
        <v-btn
          icon="mdi-ruler"
          :variant="measureMode ? 'flat' : 'text'"
          :color="measureMode ? 'primary' : undefined"
          @click="toggleMeasureMode"
        />

        <v-menu>
          <template #activator="{ props: menuProps }">
            <v-btn icon="mdi-plus" variant="text" v-bind="menuProps" />
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
      </div>

      <!-- Map Content -->
      <div class="map-content">
        <ClientOnly>
          <MapsMapViewer
            :map="selectedMap"
            :markers="filteredMarkers"
            :areas="selectedMapAreas"
            :measure-points="measurePoints"
            @marker-click="onMarkerClick"
            @marker-right-click="onMarkerRightClick"
            @map-click="onMapClick"
            @marker-drag="onMarkerDrag"
            @marker-drag-into-area="onMarkerDragIntoArea"
            @marker-drag-out-of-area="onMarkerDragOutOfArea"
            @area-click="onAreaClick"
            @area-right-click="onAreaRightClick"
            @area-drag="onAreaDrag"
          />
        </ClientOnly>
        <!-- Help badges -->
        <div class="map-help-badges">
          <!-- Measure mode hints -->
          <template v-if="measureMode">
            <v-chip size="small" color="primary" prepend-icon="mdi-ruler">
              {{ $t('maps.measuring') }}
            </v-chip>
            <!-- Warning if no scale set -->
            <v-chip
              v-if="!selectedMap?.scale_value"
              size="small"
              color="warning"
              prepend-icon="mdi-alert"
              class="measure-warning"
            >
              {{ $t('maps.measureNoScale') }}
            </v-chip>
            <v-chip v-else-if="measurePoints.length > 0" size="small" color="secondary">
              {{ $t('maps.measureTotal', { distance: measuredDistance.toFixed(1), unit: selectedMap?.scale_unit || '?' }) }}
            </v-chip>
            <v-chip size="small" variant="tonal" prepend-icon="mdi-cursor-default-click">
              {{ $t('maps.measureClick') }}
            </v-chip>
            <v-chip size="small" variant="tonal" prepend-icon="mdi-keyboard-esc">
              {{ $t('maps.measureFinish') }}
            </v-chip>
          </template>
          <!-- Area mode hint -->
          <v-chip
            v-else-if="addMode === 'area'"
            size="small"
            color="primary"
            prepend-icon="mdi-map-marker-radius"
          >
            {{ $t('maps.clickToPlaceArea') }}
          </v-chip>
          <!-- Default hints -->
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
            <v-chip size="small" variant="tonal" prepend-icon="mdi-gesture-tap-hold">
              {{ $t('maps.helpDragArea') }}
            </v-chip>
          </template>
        </div>
      </div>
    </div>

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

    <!-- Edit Map Dialog -->
    <v-dialog v-model="showEditDialog" max-width="500">
      <v-card>
        <v-card-title>{{ $t('maps.edit') }}</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="editForm.name"
            :label="$t('maps.name')"
            variant="outlined"
            class="mb-3"
          />
          <v-textarea
            v-model="editForm.description"
            :label="$t('maps.descriptionOptional')"
            variant="outlined"
            rows="2"
            class="mb-3"
          />
          <v-text-field
            v-model="editForm.version_name"
            :label="$t('maps.versionNameOptional')"
            :placeholder="$t('maps.versionNamePlaceholder')"
            variant="outlined"
            class="mb-3"
          />
          <v-divider class="my-4" />
          <div class="text-subtitle-2 mb-2">{{ $t('maps.scale') }}</div>
          <v-row dense>
            <v-col cols="6">
              <v-text-field
                v-model.number="editForm.scale_value"
                :label="$t('maps.scaleValue')"
                :placeholder="$t('maps.scaleValuePlaceholder')"
                variant="outlined"
                type="number"
                min="0"
                density="compact"
              />
            </v-col>
            <v-col cols="6">
              <v-select
                v-model="editForm.scale_unit"
                :label="$t('maps.scaleUnit')"
                :items="scaleUnitOptions"
                variant="outlined"
                density="compact"
                clearable
              />
            </v-col>
          </v-row>
          <div class="text-caption text-medium-emphasis mb-3">
            {{ $t('maps.scaleHint') }}
          </div>

          <v-divider class="my-4" />
          <v-file-input
            v-model="editForm.newImage"
            :label="$t('maps.replaceImage')"
            accept="image/*"
            variant="outlined"
            prepend-icon="mdi-image-edit"
          />
          <v-alert
            v-if="editForm.newImage"
            type="warning"
            variant="tonal"
            density="compact"
            class="mt-2"
          >
            {{ $t('maps.replaceImageHint') }}
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showEditDialog = false">{{ $t('maps.cancel') }}</v-btn>
          <v-btn
            color="primary"
            :loading="saving"
            :disabled="!editForm.name"
            @click="saveMapEdit"
          >
            {{ $t('maps.save') }}
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

    <!-- Area Move/Resize Conflict Dialog (when markers fall outside area) -->
    <v-dialog v-model="showAreaConflictDialog" max-width="500" persistent>
      <v-card>
        <v-card-title class="d-flex align-center">
          <v-icon start color="warning">mdi-alert-circle</v-icon>
          {{ $t('maps.areaConflict') }}
        </v-card-title>
        <v-card-text>
          <p class="mb-4">
            {{ $t('maps.areaConflictMessage', {
              count: affectedMarkers.length,
              location: pendingAreaChange?.area?.location_name
            }) }}
          </p>

          <!-- List of affected markers -->
          <v-list v-if="affectedMarkers.length > 0" density="compact" class="mb-4">
            <v-list-item v-for="marker in affectedMarkers" :key="marker.id">
              <template #prepend>
                <v-icon :color="getEntityColor(marker.entity_type)">
                  {{ getEntityIcon(marker.entity_type) }}
                </v-icon>
              </template>
              <v-list-item-title>{{ marker.entity_name }}</v-list-item-title>
            </v-list-item>
          </v-list>

          <v-radio-group v-model="areaConflictAction" hide-details>
            <v-radio value="move" :label="$t('maps.areaConflictMove')" />
            <v-radio value="keep" :label="$t('maps.areaConflictKeep')" />
            <v-radio value="remove" :label="$t('maps.areaConflictRemove')" />
          </v-radio-group>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="cancelAreaChange">
            {{ $t('common.cancel') }}
          </v-btn>
          <v-btn color="primary" :loading="applyingAreaChange" @click="confirmAreaChange">
            {{ $t('common.confirm') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import type { CampaignMap, MapMarker, MapArea } from '~~/types/map'
import { ENTITY_TYPE_ICONS, ENTITY_TYPE_COLORS } from '~~/types/map'
import type { EntityPreviewType } from '~/components/shared/EntityPreviewDialog.vue'

const campaignStore = useCampaignStore()
const activeCampaignId = computed(() => campaignStore.activeCampaignId)

// State
const maps = ref<CampaignMap[]>([])
const loading = ref(false)
const uploading = ref(false)
const deleting = ref(false)

const showUploadDialog = ref(false)
const showEditDialog = ref(false)
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

// Entity type filter
const activeFilters = ref<Set<string>>(new Set())

// Available entity types based on current markers
const availableEntityTypes = computed(() => {
  const types = new Set<string>()
  for (const marker of selectedMapMarkers.value) {
    if (marker.entity_type) {
      types.add(marker.entity_type)
    }
  }
  return Array.from(types).sort()
})

// Filtered markers based on active filters
const filteredMarkers = computed(() => {
  if (activeFilters.value.size === 0) {
    return selectedMapMarkers.value
  }
  return selectedMapMarkers.value.filter(
    (marker) => marker.entity_type && activeFilters.value.has(marker.entity_type),
  )
})

// Toggle filter for an entity type
function toggleFilter(entityType: string) {
  if (activeFilters.value.has(entityType)) {
    activeFilters.value.delete(entityType)
  } else {
    activeFilters.value.add(entityType)
  }
  // Trigger reactivity
  activeFilters.value = new Set(activeFilters.value)
}

const uploadForm = ref({
  name: '',
  description: '',
  version_name: '',
  file: null as File | null,
})

const editForm = ref({
  name: '',
  description: '',
  version_name: '',
  scale_value: null as number | null,
  scale_unit: null as string | null,
  newImage: null as File | null,
})

// Scale unit options for measurement
const scaleUnitOptions = [
  { value: 'km', title: 'Kilometer (km)' },
  { value: 'miles', title: 'Miles' },
  { value: 'm', title: 'Meter (m)' },
  { value: 'ft', title: 'Feet (ft)' },
  { value: 'leagues', title: 'Leagues' },
]
const editingMap = ref<CampaignMap | null>(null)
const saving = ref(false)

// Measurement tool state
const measureMode = ref(false)
const measurePoints = ref<{ x: number; y: number }[]>([])

// Calculate total measured distance
const measuredDistance = computed(() => {
  if (measurePoints.value.length < 2 || !selectedMap.value?.scale_value) {
    return 0
  }

  let totalDistance = 0
  for (let i = 1; i < measurePoints.value.length; i++) {
    const p1 = measurePoints.value[i - 1]!
    const p2 = measurePoints.value[i]!
    // Calculate distance in percentage units, then convert to map scale
    const dx = p2.x - p1.x
    const dy = p2.y - p1.y
    const distPercent = Math.sqrt(dx * dx + dy * dy)
    // Scale: 100% width = scale_value units
    totalDistance += (distPercent / 100) * selectedMap.value.scale_value
  }

  return totalDistance
})

function toggleMeasureMode() {
  measureMode.value = !measureMode.value
  if (!measureMode.value) {
    // Clear measurement when exiting
    measurePoints.value = []
  } else {
    // Disable other modes
    addMode.value = null
  }
}

function addMeasurePoint(x: number, y: number) {
  measurePoints.value.push({ x, y })
}

function clearMeasurement() {
  measurePoints.value = []
}

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

// Area move/resize conflict dialog state
const showAreaConflictDialog = ref(false)
const applyingAreaChange = ref(false)
const areaConflictAction = ref<'move' | 'keep' | 'remove'>('move')
const affectedMarkers = ref<MapMarker[]>([])
const pendingAreaChange = ref<{
  area: MapArea
  type: 'drag' | 'resize'
  newX?: number
  newY?: number
  newRadius?: number
  oldX: number
  oldY: number
  oldRadius: number
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
  addMode.value = 'marker' // Default mode when opening map

  try {
    const details = await $fetch<CampaignMap & { markers: MapMarker[]; areas: MapArea[] }>(`/api/maps/${map.id}`)
    selectedMap.value = details
    selectedMapMarkers.value = details.markers || []
    selectedMapAreas.value = details.areas || []
  } catch (error) {
    console.error('Failed to load map details:', error)
  }
}

// Close map and go back to selection
function closeMap() {
  selectedMap.value = null
  selectedMapMarkers.value = []
  selectedMapAreas.value = []
  addMode.value = null
  measureMode.value = false
  measurePoints.value = []
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
  // Measure mode: add point
  if (measureMode.value) {
    addMeasurePoint(position.x, position.y)
    return
  }

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

// Helper functions for entity display
function getEntityColor(entityType?: string): string {
  if (!entityType) return 'grey'
  return ENTITY_TYPE_COLORS[entityType] || 'grey'
}

function getEntityIcon(entityType?: string): string {
  if (!entityType) return 'mdi-help'
  return ENTITY_TYPE_ICONS[entityType] || 'mdi-help'
}

// Check if a marker is inside a circle area
function isMarkerInsideArea(marker: MapMarker, centerX: number, centerY: number, radius: number): boolean {
  const dx = marker.x - centerX
  const dy = marker.y - centerY
  const distance = Math.sqrt(dx * dx + dy * dy)
  return distance <= radius
}

// Find markers that are inside the area at the given position/radius
function findMarkersInsideArea(centerX: number, centerY: number, radius: number): MapMarker[] {
  return selectedMapMarkers.value.filter((marker) =>
    isMarkerInsideArea(marker, centerX, centerY, radius),
  )
}

// Handler: Area was dragged to new position
function onAreaDrag(data: { area: MapArea; x: number; y: number }) {
  const { area, x, y } = data

  // Find markers that were inside the old position but are outside the new position
  const oldMarkers = findMarkersInsideArea(area.center_x, area.center_y, area.radius)
  const newMarkers = findMarkersInsideArea(x, y, area.radius)

  // Markers that fall outside after the move
  const markersOutside = oldMarkers.filter((m) => !newMarkers.some((nm) => nm.id === m.id))

  if (markersOutside.length > 0) {
    // Show conflict dialog
    affectedMarkers.value = markersOutside
    pendingAreaChange.value = {
      area,
      type: 'drag',
      newX: x,
      newY: y,
      oldX: area.center_x,
      oldY: area.center_y,
      oldRadius: area.radius,
    }
    areaConflictAction.value = 'move'
    showAreaConflictDialog.value = true
  } else {
    // No conflicts - apply directly
    applyAreaUpdate(area.id, { center_x: x, center_y: y })
  }
}

// Apply area update via API
async function applyAreaUpdate(areaId: number, updates: { center_x?: number; center_y?: number; radius?: number }) {
  try {
    await $fetch(`/api/maps/${selectedMap.value?.id}/areas/${areaId}`, {
      method: 'PATCH',
      body: updates,
    })
    await reloadMapData()
  } catch (error) {
    console.error('Failed to update area:', error)
  }
}

// Cancel area change - revert visually
function cancelAreaChange() {
  showAreaConflictDialog.value = false
  affectedMarkers.value = []
  pendingAreaChange.value = null
  // Reload to revert any visual changes
  reloadMapData()
}

// Confirm area change based on selected action
async function confirmAreaChange() {
  if (!pendingAreaChange.value) return

  applyingAreaChange.value = true
  try {
    const { area, type, newX, newY, newRadius, oldX, oldY, oldRadius } = pendingAreaChange.value

    // Build area update based on change type
    const areaUpdate: { center_x?: number; center_y?: number; radius?: number } = {}
    if (type === 'drag' && newX !== undefined && newY !== undefined) {
      areaUpdate.center_x = newX
      areaUpdate.center_y = newY
    } else if (type === 'resize' && newRadius !== undefined) {
      areaUpdate.radius = newRadius
    }

    // Handle markers based on selected action
    if (areaConflictAction.value === 'move') {
      // Move markers with the area
      const dx = (newX ?? oldX) - oldX
      const dy = (newY ?? oldY) - oldY
      const radiusScale = newRadius !== undefined ? newRadius / oldRadius : 1

      for (const marker of affectedMarkers.value) {
        // Calculate new position relative to area center
        if (type === 'drag') {
          // Move markers by the same delta
          await $fetch(`/api/maps/${selectedMap.value?.id}/markers/${marker.id}`, {
            method: 'PATCH',
            body: {
              x: marker.x + dx,
              y: marker.y + dy,
            },
          })
        } else if (type === 'resize') {
          // Scale marker position relative to center
          const relX = marker.x - oldX
          const relY = marker.y - oldY
          await $fetch(`/api/maps/${selectedMap.value?.id}/markers/${marker.id}`, {
            method: 'PATCH',
            body: {
              x: oldX + relX * radiusScale,
              y: oldY + relY * radiusScale,
            },
          })
        }
      }
    } else if (areaConflictAction.value === 'remove') {
      // Remove location_id from affected entities
      for (const marker of affectedMarkers.value) {
        await $fetch(`/api/entities/${marker.entity_id}/location`, {
          method: 'PATCH',
          body: { location_id: null },
        })
      }
    }
    // 'keep' action: do nothing with markers, just update area

    // Apply area update
    await applyAreaUpdate(area.id, areaUpdate)

    showAreaConflictDialog.value = false
    affectedMarkers.value = []
    pendingAreaChange.value = null
  } catch (error) {
    console.error('Failed to apply area change:', error)
  } finally {
    applyingAreaChange.value = false
  }
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
  editingMap.value = map
  editForm.value = {
    name: map.name,
    description: map.description || '',
    version_name: map.version_name || '',
    scale_value: map.scale_value,
    scale_unit: map.scale_unit,
    newImage: null,
  }
  showEditDialog.value = true
}

async function saveMapEdit() {
  if (!editingMap.value) return

  saving.value = true
  try {
    // Update map metadata
    let updated = await $fetch<CampaignMap>(`/api/maps/${editingMap.value.id}`, {
      method: 'PATCH',
      body: {
        name: editForm.value.name,
        description: editForm.value.description || null,
        version_name: editForm.value.version_name || null,
        scale_value: editForm.value.scale_value || null,
        scale_unit: editForm.value.scale_unit || null,
      },
    })

    // Upload new image if provided
    if (editForm.value.newImage) {
      const formData = new FormData()
      formData.append('image', editForm.value.newImage)

      updated = await $fetch<CampaignMap>(`/api/maps/${editingMap.value.id}/upload-image`, {
        method: 'POST',
        body: formData,
      })
    }

    // Update in maps list
    const index = maps.value.findIndex((m) => m.id === updated.id)
    if (index !== -1) {
      maps.value[index] = { ...maps.value[index], ...updated }
    }

    // Update selectedMap if it's the one being edited
    if (selectedMap.value?.id === updated.id) {
      selectedMap.value = { ...selectedMap.value, ...updated }
    }

    showEditDialog.value = false
    editingMap.value = null
  } catch (error) {
    console.error('Failed to update map:', error)
  } finally {
    saving.value = false
  }
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

// Handle ESC key to exit measure mode
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && measureMode.value) {
    clearMeasurement()
    measureMode.value = false
  }
}

// Load on mount
onMounted(() => {
  loadMaps()
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

// Reload when campaign changes
watch(activeCampaignId, () => {
  loadMaps()
  closeMap() // Close any open map when campaign changes
})
</script>

<style scoped>
.maps-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.map-viewer-container {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 64px - 8px);
  overflow: hidden;
  margin: -12px;
}

/* Hide Leaflet attribution */
.map-viewer-container :deep(.leaflet-control-attribution) {
  display: none;
}

/* Style Leaflet zoom controls to match theme */
.map-viewer-container :deep(.leaflet-control-zoom) {
  border: none;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.map-viewer-container :deep(.leaflet-control-zoom a) {
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-primary));
  border: none;
  width: 36px;
  height: 36px;
  line-height: 36px;
  font-size: 18px;
  font-weight: 500;
  transition: background-color 0.2s;
}

.map-viewer-container :deep(.leaflet-control-zoom a:hover) {
  background: rgba(var(--v-theme-primary), 0.1);
  color: rgb(var(--v-theme-primary));
}

.map-viewer-container :deep(.leaflet-control-zoom-in) {
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)) !important;
  border-radius: 8px 8px 0 0;
}

.map-viewer-container :deep(.leaflet-control-zoom-out) {
  border-radius: 0 0 8px 8px;
}

.map-header {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  background: rgb(var(--v-theme-surface));
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  flex-shrink: 0;
  gap: 8px;
}

.filter-chips {
  display: flex;
  align-items: center;
}

.map-title {
  font-size: 1.25rem;
  font-weight: 500;
  margin: 0;
}

.map-content {
  flex: 1;
  position: relative;
  overflow: hidden;
}

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

/* Make help badges more visible on any background */
.map-help-badges :deep(.v-chip) {
  background: rgba(var(--v-theme-surface), 0.95) !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(4px);
}

/* Map selection cards - equal height */
.map-card {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.map-card-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.map-card-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.map-card-subtitle {
  min-height: 20px;
}

.map-card-description {
  flex: 1;
  display: -webkit-box;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 48px;
}
</style>
