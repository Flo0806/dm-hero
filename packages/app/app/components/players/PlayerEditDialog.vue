<template>
  <v-dialog v-model="internalShow" max-width="900" scrollable persistent>
    <v-card v-if="internalShow" class="d-flex flex-column" style="max-height: 90vh">
      <v-card-title class="d-flex align-center flex-shrink-0">
        {{ player ? $t('players.edit') : $t('players.create') }}
        <v-spacer />
        <SharedPinButton v-if="player?.id" :entity-id="player.id" variant="icon" class="mr-1" />
        <v-btn icon="mdi-close" variant="text" @click="close" />
      </v-card-title>

      <!-- Tabs (only when editing) -->
      <v-tabs v-if="player" v-model="activeTab" class="mb-4 flex-shrink-0" show-arrows>
        <v-tab value="details">
          <v-icon start>mdi-account-details</v-icon>
          {{ $t('common.details') }}
        </v-tab>
        <v-tab value="images">
          <v-icon start>mdi-image-multiple</v-icon>
          {{ $t('common.images') }}
          <v-chip size="x-small" class="ml-2">{{ counts.images }}</v-chip>
        </v-tab>
        <v-tab value="stats">
          <v-icon start>mdi-clipboard-list-outline</v-icon>
          {{ $t('entityStats.title') }}
          <v-chip v-if="counts.hasStats" size="x-small" class="ml-2" color="primary">
            <v-icon size="x-small">mdi-check</v-icon>
          </v-chip>
        </v-tab>
        <v-tab value="documents">
          <v-icon start>mdi-file-document</v-icon>
          {{ $t('common.notes') }}
          <v-chip size="x-small" class="ml-2">{{ counts.documents }}</v-chip>
        </v-tab>
        <v-tab value="characters">
          <v-icon start>mdi-account-group</v-icon>
          {{ $t('players.characters') }}
          <v-chip size="x-small" class="ml-2">{{ counts.characters }}</v-chip>
        </v-tab>
        <v-tab value="items">
          <v-icon start>mdi-sword</v-icon>
          {{ $t('nav.items') }}
          <v-chip size="x-small" class="ml-2">{{ counts.items }}</v-chip>
        </v-tab>
        <v-tab value="locations">
          <v-icon start>mdi-map-marker</v-icon>
          {{ $t('nav.locations') }}
          <v-chip size="x-small" class="ml-2">{{ counts.locations }}</v-chip>
        </v-tab>
        <v-tab value="factions">
          <v-icon start>mdi-shield</v-icon>
          {{ $t('nav.factions') }}
          <v-chip size="x-small" class="ml-2">{{ counts.factions }}</v-chip>
        </v-tab>
        <v-tab value="lore">
          <v-icon start>mdi-book-open-variant</v-icon>
          {{ $t('nav.lore') }}
          <v-chip size="x-small" class="ml-2">{{ counts.lore }}</v-chip>
        </v-tab>
      </v-tabs>

      <v-card-text class="flex-grow-1 overflow-y-auto">
        <!-- Edit Mode with Tabs -->
        <v-tabs-window v-if="player" v-model="activeTab">
          <!-- Details Tab -->
          <v-tabs-window-item value="details">
            <!-- Hidden file input -->
            <input
              ref="fileInputRef"
              type="file"
              accept="image/*"
              style="display: none"
              @change="handleImageUpload"
            />

            <!-- Image Upload Section -->
            <EntityImageUpload
              class="mb-4"
              :image-url="player?.image_url"
              :entity-name="form.name"
              entity-type="Player"
              :uploading="uploadingImage"
              :generating="generatingImage"
              :deleting="deletingImage"
              :has-api-key="hasApiKey"
              :generate-disabled="!form.name || uploadingImage || deletingImage || generatingImage || !hasApiKey || hasUnsavedImageChanges"
              :generate-disabled-reason="hasUnsavedImageChanges ? $t('common.saveChangesFirst') : ''"
              :avatar-size="120"
              default-icon="mdi-account-star"
              @preview-image="handleImagePreview"
              @upload="triggerImageUpload"
              @generate="generateImage"
              @download="downloadImage"
              @delete="deleteImage"
            />

            <v-text-field
              v-model="form.name"
              :label="$t('players.name')"
              :placeholder="$t('players.namePlaceholder')"
              :rules="[(v: string) => !!v || $t('players.nameRequired')]"
              variant="outlined"
              class="mb-3"
            />

            <v-text-field
              v-model="form.player_name"
              :label="$t('players.playerName')"
              :placeholder="$t('players.playerNamePlaceholder')"
              variant="outlined"
              class="mb-3"
            />

            <!-- Character Birthday -->
            <v-card variant="outlined" class="mb-3 pa-3">
              <div class="d-flex align-center mb-2">
                <v-icon class="mr-2" color="primary">mdi-cake-variant</v-icon>
                <span class="text-subtitle-2">{{ $t('players.characterBirthday') }}</span>
                <v-tooltip v-if="!hasCalendar" location="top">
                  <template #activator="{ props: tooltipProps }">
                    <v-icon v-bind="tooltipProps" class="ml-2" size="small" color="warning">
                      mdi-alert-circle
                    </v-icon>
                  </template>
                  {{ $t('players.noCalendarForBirthday') }}
                </v-tooltip>
              </div>
              <div v-if="hasCalendar">
                <v-checkbox
                  v-model="hasBirthday"
                  :label="$t('players.hasBirthday')"
                  density="compact"
                  hide-details
                />
                <div v-if="hasBirthday" class="mt-3">
                  <InGameDatePicker
                    v-model="form.birthday"
                    :calendar-data="calendarData"
                    :show-clear-button="false"
                  />
                  <v-checkbox
                    v-model="form.showBirthdayInCalendar"
                    :label="$t('players.showBirthdayInCalendar')"
                    density="compact"
                    hide-details
                    class="mt-2"
                  />
                </div>
              </div>
              <div v-else class="text-medium-emphasis text-body-2">
                {{ $t('players.noCalendarForBirthday') }}
              </div>
            </v-card>

            <v-textarea
              v-model="form.description"
              :label="$t('players.description')"
              :placeholder="$t('players.descriptionPlaceholder')"
              variant="outlined"
              rows="2"
              class="mb-3"
              persistent-placeholder
            />

            <!-- Inspiration Counter -->
            <div class="d-flex align-center mb-3">
              <span class="text-body-1 mr-4">{{ $t('players.inspiration') }}</span>
              <v-btn
                icon="mdi-minus"
                size="small"
                variant="outlined"
                :disabled="(form.inspiration || 0) <= 0"
                @click="form.inspiration = Math.max(0, (form.inspiration || 0) - 1)"
              />
              <v-chip size="large" class="mx-2 text-h6" variant="tonal" color="primary">
                {{ form.inspiration || 0 }}
              </v-chip>
              <v-btn
                icon="mdi-plus"
                size="small"
                variant="outlined"
                @click="form.inspiration = (form.inspiration || 0) + 1"
              />
            </div>

            <v-text-field
              v-model="form.email"
              :label="$t('players.email')"
              :placeholder="$t('players.emailPlaceholder')"
              variant="outlined"
              type="email"
              class="mb-3"
            />

            <v-text-field
              v-model="form.discord"
              :label="$t('players.discord')"
              :placeholder="$t('players.discordPlaceholder')"
              variant="outlined"
              class="mb-3"
            />

            <v-text-field
              v-model="form.phone"
              :label="$t('players.phone')"
              :placeholder="$t('players.phonePlaceholder')"
              variant="outlined"
              class="mb-3"
            />

            <v-textarea
              v-model="form.notes"
              :label="$t('players.notes')"
              :placeholder="$t('players.notesPlaceholder')"
              variant="outlined"
              rows="3"
              persistent-placeholder
            />

            <v-divider class="my-4" />

            <!-- Current Location with Map Sync -->
            <LocationSelectWithMap
              v-model="form.location_id"
              :label="$t('players.currentLocation')"
              @update:map-sync="mapSyncData = $event"
            />
          </v-tabs-window-item>

          <!-- Images Tab -->
          <v-tabs-window-item value="images">
            <EntityImageGallery
              v-if="player"
              ref="imageGalleryRef"
              :entity-id="player.id"
              entity-type="Player"
              :entity-name="form.name"
              :entity-description="form.description"
              :generate-disabled="hasUnsavedImageChanges"
              :generate-disabled-reason="hasUnsavedImageChanges ? $t('common.saveChangesFirst') : ''"
              @images-updated="handleGalleryUpdated"
              @preview-image="handleImagePreview"
              @generating="generatingImage = $event"
            />
          </v-tabs-window-item>

          <!-- Stats Tab -->
          <v-tabs-window-item value="stats">
            <SharedEntityStatsTab
              v-if="player"
              ref="statsTabRef"
              :entity-id="player.id"
              @changed="playerStore.loadCounts(player!.id)"
            />
          </v-tabs-window-item>

          <!-- Documents Tab -->
          <v-tabs-window-item value="documents">
            <EntityDocuments
              v-if="player"
              :entity-id="player.id"
              @changed="playerStore.loadCounts(player!.id)"
            />
          </v-tabs-window-item>

          <!-- Characters (NPCs) Tab -->
          <v-tabs-window-item value="characters">
            <PlayerCharactersTab
              v-if="player"
              :entity-id="player.id"
              @changed="playerStore.loadCounts(player!.id)"
            />
          </v-tabs-window-item>

          <!-- Items Tab -->
          <v-tabs-window-item value="items">
            <PlayerItemsTab
              v-if="player"
              :entity-id="player.id"
              @changed="playerStore.loadCounts(player!.id)"
            />
          </v-tabs-window-item>

          <!-- Locations Tab -->
          <v-tabs-window-item value="locations">
            <EntityLocationsTab
              v-if="player"
              :entity-id="player.id"
              @changed="playerStore.loadCounts(player!.id)"
            />
          </v-tabs-window-item>

          <!-- Factions Tab -->
          <v-tabs-window-item value="factions">
            <EntityFactionsTab
              v-if="player"
              :entity-id="player.id"
              @changed="playerStore.loadCounts(player!.id)"
            />
          </v-tabs-window-item>

          <!-- Lore Tab -->
          <v-tabs-window-item value="lore">
            <PlayerLoreTab
              v-if="player"
              :entity-id="player.id"
              @changed="playerStore.loadCounts(player!.id)"
            />
          </v-tabs-window-item>
        </v-tabs-window>

        <!-- Create Form (no tabs) -->
        <div v-if="!player">
          <v-text-field
            v-model="form.name"
            :label="$t('players.name')"
            :placeholder="$t('players.namePlaceholder')"
            :rules="[(v: string) => !!v || $t('players.nameRequired')]"
            variant="outlined"
            class="mb-3"
          />

          <v-text-field
            v-model="form.player_name"
            :label="$t('players.playerName')"
            :placeholder="$t('players.playerNamePlaceholder')"
            variant="outlined"
            class="mb-3"
          />

          <v-textarea
            v-model="form.description"
            :label="$t('players.description')"
            :placeholder="$t('players.descriptionPlaceholder')"
            variant="outlined"
            rows="2"
            class="mb-3"
            persistent-placeholder
          />

          <!-- Inspiration Counter -->
          <div class="d-flex align-center mb-3">
            <span class="text-body-1 mr-4">{{ $t('players.inspiration') }}</span>
            <v-btn
              icon="mdi-minus"
              size="small"
              variant="outlined"
              :disabled="(form.inspiration || 0) <= 0"
              @click="form.inspiration = Math.max(0, (form.inspiration || 0) - 1)"
            />
            <v-chip size="large" class="mx-2 text-h6" variant="tonal" color="primary">
              {{ form.inspiration || 0 }}
            </v-chip>
            <v-btn
              icon="mdi-plus"
              size="small"
              variant="outlined"
              @click="form.inspiration = (form.inspiration || 0) + 1"
            />
          </div>

          <v-text-field
            v-model="form.email"
            :label="$t('players.email')"
            :placeholder="$t('players.emailPlaceholder')"
            variant="outlined"
            type="email"
            class="mb-3"
          />

          <v-text-field
            v-model="form.discord"
            :label="$t('players.discord')"
            :placeholder="$t('players.discordPlaceholder')"
            variant="outlined"
            class="mb-3"
          />

          <v-text-field
            v-model="form.phone"
            :label="$t('players.phone')"
            :placeholder="$t('players.phonePlaceholder')"
            variant="outlined"
            class="mb-3"
          />

          <v-textarea
            v-model="form.notes"
            :label="$t('players.notes')"
            :placeholder="$t('players.notesPlaceholder')"
            variant="outlined"
            rows="3"
            persistent-placeholder
          />
        </div>
      </v-card-text>

      <v-card-actions class="flex-shrink-0">
        <v-spacer />
        <v-btn variant="text" :disabled="saving || generatingImage || uploadingImage" @click="close">
          {{ $t('common.cancel') }}
        </v-btn>
        <!-- Save button with wrapper for tooltip on disabled state -->
        <div class="d-inline-block">
          <v-btn
            color="primary"
            :disabled="!form.name || generatingImage || uploadingImage || hasDirtyTabs"
            :loading="saving"
            @click="save"
          >
            {{ player ? $t('common.save') : $t('common.create') }}
          </v-btn>
          <v-tooltip v-if="hasDirtyTabs" activator="parent" location="top">
            {{ $t('common.unsavedTabChanges', { tabs: dirtyTabLabels.join(', ') }) }}
          </v-tooltip>
        </div>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Image Preview Dialog -->
  <ImagePreviewDialog
    v-model="showImagePreview"
    :image-url="previewImageUrl"
    :title="previewImageTitle"
  />
</template>

<script setup lang="ts">
import type { Player } from '~~/types/player'
import EntityImageUpload from '../shared/EntityImageUpload.vue'
import EntityImageGallery from '../shared/EntityImageGallery.vue'
import EntityDocuments from '../shared/EntityDocuments.vue'
import SharedEntityStatsTab from '../shared/EntityStatsTab.vue'
import EntityLocationsTab from '../shared/EntityLocationsTab.vue'
import EntityFactionsTab from '../shared/EntityFactionsTab.vue'
import PlayerCharactersTab from './PlayerCharactersTab.vue'
import PlayerItemsTab from './PlayerItemsTab.vue'
import PlayerLoreTab from './PlayerLoreTab.vue'
import ImagePreviewDialog from '../shared/ImagePreviewDialog.vue'
import LocationSelectWithMap from '../shared/LocationSelectWithMap.vue'
import InGameDatePicker from '../calendar/InGameDatePicker.vue'
import { useSnackbarStore } from '~/stores/snackbar'
import { usePlayerStore } from '../../stores/player.js'

const props = defineProps<{
  show: boolean
  playerId?: number | null
  initialTab?: string // Tab to open when dialog opens (default: 'details')
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  'saved': [player: Player]
  'created': [player: Player]
}>()

const { t } = useI18n()
const { downloadImage: downloadImageFile } = useImageDownload()
const entitiesStore = useEntitiesStore()
const campaignStore = useCampaignStore()
const playerStore = usePlayerStore()
const snackbarStore = useSnackbarStore()
const { showError, showUploadError, showImageError } = useErrorHandler()

// Dirty state management for tabs
const { hasDirtyTabs, dirtyTabLabels } = useDialogDirtyStateProvider()

// Calendar for birthday
const { calendarData, loadCalendar } = useInGameCalendar()
const hasCalendar = computed(() => calendarData.value && calendarData.value.months.length > 0)

// ============================================================================
// State
// ============================================================================
const internalShow = computed({
  get: () => props.show,
  set: v => emit('update:show', v),
})

const player = ref<Player | null>(null)
const activeTab = ref('details')
const saving = ref(false)

const form = ref({
  name: '',
  description: '',
  player_name: '',
  inspiration: 0,
  email: '',
  discord: '',
  phone: '',
  notes: '',
  location_id: null as number | null,
  birthday: null as { year: number, month: number, day: number } | null,
  showBirthdayInCalendar: true,
})

// Map sync data (from LocationSelectWithMap)
const mapSyncData = ref<{ locationId: number | null, mapIds: number[] } | null>(null)

// Birthday toggle (controls visibility, actual null is set on save)
const hasBirthday = ref(false)

// Counts from store (reactive)
const counts = computed(() => playerStore.counts)

// Stats tab ref (for saving stats on dialog save)
const statsTabRef = ref<{ saveStats: () => Promise<void> } | null>(null)

// Image management
const fileInputRef = ref<HTMLInputElement | null>(null)
const imageGalleryRef = ref<{ refresh: () => Promise<void> } | null>(null)
const uploadingImage = ref(false)
const deletingImage = ref(false)
const generatingImage = ref(false)
const hasApiKey = ref(false)

// Snapshot of original values for image-critical fields
const originalImageData = ref({
  name: '',
  description: '',
})

// Check if image-critical fields have unsaved changes
const hasUnsavedImageChanges = computed(() => {
  return (
    form.value.name !== originalImageData.value.name
    || (form.value.description || '') !== originalImageData.value.description
  )
})

// Image preview
const showImagePreview = ref(false)
const previewImageUrl = ref('')
const previewImageTitle = ref('')

// ============================================================================
// Watch: Load data when dialog opens or playerId changes
// ============================================================================
watch(
  () => [props.show, props.playerId],
  async ([show, playerId]) => {
    if (show) {
      await loadData(playerId as number | null | undefined)
    }
  },
  { immediate: true },
)

// Check API key on mount
onMounted(async () => {
  try {
    const result = await $fetch<{ hasKey: boolean }>('/api/settings/openai-key/check')
    hasApiKey.value = result.hasKey
  }
  catch {
    hasApiKey.value = false
  }
})

// ============================================================================
// Data Loading
// ============================================================================
async function loadData(playerId: number | null | undefined) {
  resetForm()
  activeTab.value = props.initialTab || 'details'

  // Load calendar for birthday picker
  await loadCalendar()

  if (playerId) {
    await loadPlayer(playerId)
  }
}

async function loadPlayer(playerId: number) {
  // Use store to load player, counts, and birthday event
  await playerStore.loadPlayer(playerId)

  const data = playerStore.player
  if (!data) return

  player.value = data

  // Determine showBirthdayInCalendar: sync with actual event existence
  // If metadata says true but event was deleted in calendar, set to false
  const metadataShowInCalendar = data.metadata?.showBirthdayInCalendar !== false
  const eventActuallyExists = playerStore.existingBirthdayEventId !== null
  const showBirthdayInCalendar = metadataShowInCalendar && eventActuallyExists

  form.value = {
    name: data.name,
    description: data.description || '',
    player_name: data.metadata?.player_name || '',
    inspiration: data.metadata?.inspiration || 0,
    email: data.metadata?.email || '',
    discord: data.metadata?.discord || '',
    phone: data.metadata?.phone || '',
    notes: data.metadata?.notes || '',
    location_id: data.location_id || null,
    birthday: data.metadata?.birthday || null,
    showBirthdayInCalendar,
  }

  // Set birthday toggle based on existing data
  hasBirthday.value = !!data.metadata?.birthday

  // Save snapshot of image-critical fields
  originalImageData.value = {
    name: data.name,
    description: data.description || '',
  }
}

function resetForm() {
  player.value = null
  form.value = {
    name: '',
    description: '',
    player_name: '',
    inspiration: 0,
    email: '',
    discord: '',
    phone: '',
    notes: '',
    location_id: null,
    birthday: null,
    showBirthdayInCalendar: true,
  }
  mapSyncData.value = null
  hasBirthday.value = false
  playerStore.reset()
}

// ============================================================================
// Save & Close
// ============================================================================
async function save() {
  if (!form.value.name) return

  saving.value = true

  try {
    const campaignId = campaignStore.activeCampaignId
    if (!campaignId) throw new Error('No active campaign')

    // If hasBirthday is false, clear the birthday (even if form still has a value)
    const birthdayToSave = hasBirthday.value ? form.value.birthday : null

    const metadata = {
      player_name: form.value.player_name || null,
      inspiration: form.value.inspiration || 0,
      email: form.value.email || null,
      discord: form.value.discord || null,
      phone: form.value.phone || null,
      notes: form.value.notes || null,
      birthday: birthdayToSave,
      showBirthdayInCalendar: hasBirthday.value ? form.value.showBirthdayInCalendar : false,
    }

    let savedPlayerId: number

    if (player.value) {
      // Update existing player via store (no skeleton loader)
      const updated = await entitiesStore.updatePlayer(player.value.id, {
        name: form.value.name,
        description: form.value.description || null,
        location_id: form.value.location_id,
        metadata,
      })
      savedPlayerId = updated.id

      // Handle map sync if enabled
      if (mapSyncData.value && mapSyncData.value.locationId && mapSyncData.value.mapIds.length > 0) {
        await syncToMaps(player.value.id, mapSyncData.value.mapIds)
      }

      emit('saved', updated)
    }
    else {
      // Create new player via store
      const created = await entitiesStore.createPlayer(campaignId, {
        name: form.value.name,
        description: form.value.description || null,
        location_id: form.value.location_id,
        metadata,
      })
      savedPlayerId = created.id

      // Handle map sync if enabled
      if (mapSyncData.value && mapSyncData.value.locationId && mapSyncData.value.mapIds.length > 0) {
        await syncToMaps(created.id, mapSyncData.value.mapIds)
      }

      emit('created', created)
    }

    // Handle birthday calendar event via store
    const eventTitle = t('calendar.birthdayOf', { name: form.value.name })
    await playerStore.handleBirthdayEvent(
      savedPlayerId,
      form.value.name,
      birthdayToSave,
      hasBirthday.value && form.value.showBirthdayInCalendar,
      eventTitle,
    )

    // Save stats if dirty
    await statsTabRef.value?.saveStats()

    close()
  }
  catch (e) {
    console.error('[PlayerEditDialog] Failed to save:', e)
  }
  finally {
    saving.value = false
  }
}

function close() {
  internalShow.value = false
}

// Sync Player marker to selected maps - place inside location circle if available
async function syncToMaps(entityId: number, mapIds: number[]) {
  const locationId = form.value.location_id
  let mapsWithArea: Array<{ map_id: number, map_name: string, area_id: number }> = []
  let locationName = ''

  if (locationId) {
    try {
      mapsWithArea = await $fetch<Array<{ map_id: number, map_name: string, area_id: number }>>(
        `/api/locations/${locationId}/maps-with-area`,
      )
      const location = await $fetch<{ name: string }>(`/api/locations/${locationId}`)
      locationName = location.name
    }
    catch (e) {
      console.error('[PlayerEditDialog] Failed to get maps with area:', e)
    }
  }

  const mapsWithoutLocation: string[] = []

  let allMaps: Array<{ id: number, name: string }> = []
  try {
    allMaps = await $fetch<Array<{ id: number, name: string }>>('/api/maps', {
      query: { campaignId: campaignStore.activeCampaignId },
    })
  }
  catch (e) {
    console.error('[PlayerEditDialog] Failed to get maps:', e)
  }

  for (const mapId of mapIds) {
    try {
      const areaInfo = mapsWithArea.find(m => m.map_id === mapId)

      if (areaInfo) {
        await $fetch(`/api/maps/${mapId}/place-in-area`, {
          method: 'POST',
          body: {
            entity_id: entityId,
            area_id: areaInfo.area_id,
          },
        })
      }
      else {
        const existingMarkers = await $fetch<Array<{ id: number }>>(`/api/maps/${mapId}/markers`, {
          query: { entityId },
        })

        if (existingMarkers.length === 0) {
          await $fetch(`/api/maps/${mapId}/markers`, {
            method: 'POST',
            body: {
              entity_id: entityId,
              x: 50,
              y: 50,
            },
          })
        }

        if (locationId) {
          const mapInfo = allMaps.find(m => m.id === mapId)
          if (mapInfo) {
            mapsWithoutLocation.push(mapInfo.name)
          }
        }
      }
    }
    catch (e) {
      console.error(`[PlayerEditDialog] Failed to sync to map ${mapId}:`, e)
    }
  }

  if (mapsWithoutLocation.length > 0 && locationId) {
    if (mapsWithoutLocation.length === 1) {
      snackbarStore.warning(
        t('maps.locationNotOnMap', { location: locationName, map: mapsWithoutLocation[0] }),
      )
    }
    else {
      snackbarStore.warning(
        t('maps.locationNotOnMaps', { location: locationName, count: mapsWithoutLocation.length }),
      )
    }
  }
}

// ============================================================================
// Image Management
// ============================================================================
function triggerImageUpload() {
  fileInputRef.value?.click()
}

async function handleImageUpload(event: Event) {
  const target = event.target as HTMLInputElement
  const files = target.files
  if (!files || files.length === 0 || !player.value) return

  uploadingImage.value = true
  try {
    const formData = new FormData()
    const file = files[0]
    if (file) {
      formData.append('image', file)
    }

    const response = await fetch(`/api/entities/${player.value.id}/upload-image`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error('Upload failed')
    }

    // Refresh player data and gallery
    await loadPlayer(player.value.id)
    await entitiesStore.refreshPlayer(player.value.id)
    await imageGalleryRef.value?.refresh()
    await playerStore.loadCounts(player.value.id)
  }
  catch (error) {
    console.error('Failed to upload image:', error)
    showUploadError('image')
  }
  finally {
    uploadingImage.value = false
    if (target) target.value = ''
  }
}

async function generateImage() {
  if (!player.value || !form.value.name) return

  generatingImage.value = true

  try {
    const result = await $fetch<{ imageUrl: string, revisedPrompt?: string }>(
      '/api/ai/generate-image',
      {
        method: 'POST',
        body: {
          prompt: '', // Empty prompt - we pass structured data instead
          entityName: form.value.name,
          entityType: 'Player',
          style: 'fantasy-art',
          entityData: {
            name: form.value.player_name || form.value.name,
            characterName: form.value.name,
            description: form.value.description,
          },
        },
      },
    )

    if (result.imageUrl && player.value) {
      const response = await $fetch<{ success: boolean }>(
        `/api/entities/${player.value.id}/set-image`,
        {
          method: 'POST',
          body: {
            imageUrl: result.imageUrl.replace('/uploads/', ''),
          },
        },
      )

      if (response.success) {
        // Notify other components (Gallery) that images changed
        entitiesStore.incrementImageVersion(player.value.id)

        await loadPlayer(player.value.id)
        await entitiesStore.refreshPlayer(player.value.id)
        await playerStore.loadCounts(player.value.id)
      }
    }
  }
  catch (error: unknown) {
    console.error('[PlayerEditDialog] Failed to generate image:', error)
    showError(error, 'errors.image.generateFailed')
  }
  finally {
    generatingImage.value = false
  }
}

async function deleteImage() {
  if (!player.value?.image_url) return

  deletingImage.value = true

  try {
    await $fetch<{ success: boolean }>(`/api/entities/${player.value.id}/delete-image`, {
      method: 'DELETE',
    })

    await loadPlayer(player.value.id)
    await entitiesStore.refreshPlayer(player.value.id)
    await imageGalleryRef.value?.refresh()
    await playerStore.loadCounts(player.value.id)
  }
  catch (error) {
    console.error('Failed to delete image:', error)
    showImageError('delete')
  }
  finally {
    deletingImage.value = false
  }
}

// Handle gallery updates - sync main image and counts
async function handleGalleryUpdated() {
  if (!player.value) return
  await loadPlayer(player.value.id)
  await entitiesStore.refreshPlayer(player.value.id)
  await playerStore.loadCounts(player.value.id)
}

function downloadImage() {
  if (!player.value?.image_url) return
  downloadImageFile(`/uploads/${player.value.image_url}`, form.value.name)
}

function handleImagePreview(url: string, name: string) {
  previewImageUrl.value = url
  previewImageTitle.value = name
  showImagePreview.value = true
}
</script>
