<template>
  <v-dialog v-model="internalShow" max-width="900" scrollable persistent>
    <v-card class="d-flex flex-column" style="max-height: 90vh">
      <!-- Loading State -->
      <template v-if="loading">
        <v-card-text class="d-flex justify-center align-center" style="min-height: 300px">
          <v-progress-circular indeterminate color="primary" size="64" />
        </v-card-text>
      </template>

      <!-- Content -->
      <template v-else>
        <v-card-title class="d-flex align-center flex-shrink-0">
          {{ faction ? $t('factions.edit') : $t('factions.create') }}
          <v-spacer />
          <SharedPinButton v-if="faction?.id" :entity-id="faction.id" variant="icon" />
        </v-card-title>

        <v-tabs v-if="faction" v-model="activeTab" class="mb-4 flex-shrink-0" show-arrows>
          <v-tab value="details">
            <v-icon start>mdi-shield-account</v-icon>
            {{ $t('common.details') }}
          </v-tab>
          <v-tab value="images">
            <v-icon start>mdi-image-multiple</v-icon>
            {{ $t('common.images') }}
            <v-chip size="x-small" class="ml-2">{{ counts.images }}</v-chip>
          </v-tab>
          <v-tab value="documents">
            <v-icon start>mdi-file-document</v-icon>
            {{ $t('documents.title') }}
            <v-chip size="x-small" class="ml-2">{{ counts.documents }}</v-chip>
          </v-tab>
          <v-tab value="members">
            <v-icon start>mdi-account-group</v-icon>
            {{ $t('factions.members') }}
            <v-chip size="x-small" class="ml-2">{{ counts.members }}</v-chip>
          </v-tab>
          <v-tab value="items">
            <v-icon start>mdi-treasure-chest</v-icon>
            {{ $t('common.items') }}
            <v-chip size="x-small" class="ml-2">{{ counts.items }}</v-chip>
          </v-tab>
          <v-tab value="locations">
            <v-icon start>mdi-map-marker</v-icon>
            {{ $t('common.locations') }}
            <v-chip size="x-small" class="ml-2">{{ counts.locations }}</v-chip>
          </v-tab>
          <v-tab value="lore">
            <v-icon start>mdi-book-open-variant</v-icon>
            {{ $t('common.lore') }}
            <v-chip size="x-small" class="ml-2">{{ counts.lore }}</v-chip>
          </v-tab>
          <v-tab value="players">
            <v-icon start>mdi-account-star</v-icon>
            {{ $t('players.title') }}
            <v-chip size="x-small" class="ml-2">{{ counts.players }}</v-chip>
          </v-tab>
        </v-tabs>

        <v-card-text class="flex-grow-1 overflow-y-auto">
          <v-tabs-window v-if="faction" v-model="activeTab">
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
                :image-url="faction?.image_url"
                :entity-name="form.name"
                entity-type="Faction"
                :uploading="uploadingImage"
                :generating="generatingImage"
                :deleting="deletingImage"
                :has-api-key="hasApiKey"
                :generate-disabled="!form.name || uploadingImage || deletingImage || generatingImage || !hasApiKey || hasUnsavedImageChanges"
                :generate-disabled-reason="hasUnsavedImageChanges ? $t('common.saveChangesFirst') : ''"
                :avatar-size="160"
                default-icon="mdi-shield-account"
                @preview-image="handleImagePreview"
                @upload="triggerImageUpload"
                @generate="generateImage"
                @download="downloadImage"
                @delete="deleteImage"
              />

              <v-text-field
                v-model="form.name"
                :label="$t('factions.name')"
                :rules="[(v: string) => !!v || $t('factions.nameRequired')]"
                variant="outlined"
                class="mb-4"
              />

              <v-textarea
                v-model="form.description"
                :label="$t('factions.description')"
                variant="outlined"
                rows="4"
                class="mb-4"
              />

              <v-row>
                <v-col cols="12" md="6">
                  <v-combobox
                    v-model="form.metadata.type"
                    :label="$t('factions.type')"
                    :items="factionTypes"
                    item-title="title"
                    item-value="value"
                    variant="outlined"
                    clearable
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-select
                    v-model="form.leaderId"
                    :items="availableNpcs"
                    item-title="name"
                    item-value="id"
                    :label="$t('factions.leader')"
                    variant="outlined"
                    clearable
                    :placeholder="$t('factions.leaderPlaceholder')"
                  />
                </v-col>
              </v-row>

              <v-row>
                <v-col cols="12" md="6">
                  <v-select
                    v-model="form.metadata.alignment"
                    :label="$t('factions.alignment')"
                    :items="factionAlignments"
                    item-title="title"
                    item-value="value"
                    variant="outlined"
                    clearable
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="form.metadata.headquarters"
                    :label="$t('factions.headquarters')"
                    variant="outlined"
                  />
                </v-col>
              </v-row>

              <v-textarea
                v-model="form.metadata.goals"
                :label="$t('factions.goals')"
                :placeholder="$t('factions.goalsPlaceholder')"
                variant="outlined"
                rows="3"
                class="mb-4"
                persistent-placeholder
              />

              <v-textarea
                v-model="form.metadata.notes"
                :label="$t('factions.notes')"
                variant="outlined"
                rows="3"
              />

              <v-divider class="my-4" />

              <!-- Current Location (Headquarters) with Map Sync -->
              <LocationSelectWithMap
                v-model="form.location_id"
                :label="$t('factions.currentLocation')"
                @update:map-sync="mapSyncData = $event"
              />
            </v-tabs-window-item>

            <!-- Images Tab -->
            <v-tabs-window-item value="images">
              <EntityImageGallery
                v-if="faction"
                :entity-id="faction.id"
                entity-type="Faction"
                :entity-name="faction.name"
                :entity-description="faction.description || undefined"
                :generate-disabled="hasUnsavedImageChanges"
                :generate-disabled-reason="hasUnsavedImageChanges ? $t('common.saveChangesFirst') : ''"
                @preview-image="(url: string) => handleImagePreview(url, faction?.name || '')"
                @images-updated="refreshFaction"
                @generating="generatingImage = $event"
              />
            </v-tabs-window-item>

            <!-- Documents Tab -->
            <v-tabs-window-item value="documents">
              <EntityDocuments
                v-if="faction"
                :entity-id="faction.id"
                entity-type="Faction"
                @changed="refreshFaction"
              />
            </v-tabs-window-item>

            <!-- Members Tab -->
            <v-tabs-window-item value="members">
              <EntityNpcsTab
                :linked-npcs="factionMembers"
                :available-npcs="availableNpcs"
                :loading="loadingMembers || addingMember"
                :show-avatar="false"
                :show-membership-type="true"
                :show-rank="true"
                :membership-type-suggestions="membershipTypeSuggestions"
                @add="addMember"
                @update="updateMember"
                @remove="removeMember"
              />
            </v-tabs-window-item>

            <!-- Items Tab -->
            <v-tabs-window-item value="items">
              <EntityItemsTab
                :linked-items="factionItems"
                :available-items="availableItems"
                :loading="addingItem"
                :show-avatar="true"
                :show-quantity="true"
                @add="addItem"
                @update="updateItem"
                @remove="removeItem"
              />
            </v-tabs-window-item>

            <!-- Locations Tab -->
            <v-tabs-window-item value="locations">
              <FactionLocationsTab
                :locations="factionLocations"
                :available-locations="availableLocations"
                :loading-locations="loadingLocations"
                :adding="addingLocation"
                @add="addLocation"
                @update="updateLocation"
                @remove="removeLocation"
              />
            </v-tabs-window-item>

            <!-- Lore Tab -->
            <v-tabs-window-item value="lore">
              <EntityLoreTab
                :linked-lore="linkedLore"
                :available-lore="availableLore"
                :loading="loadingLore"
                @add="addLore"
                @remove="removeLore"
              />
            </v-tabs-window-item>

            <!-- Players Tab -->
            <v-tabs-window-item value="players">
              <EntityPlayersTab
                v-if="faction"
                :entity-id="faction.id"
                @changed="refreshFaction"
              />
            </v-tabs-window-item>
          </v-tabs-window>

          <!-- Create Form (no tabs) -->
          <div v-if="!faction">
            <v-text-field
              v-model="form.name"
              :label="$t('factions.name')"
              :rules="[(v: string) => !!v || $t('factions.nameRequired')]"
              variant="outlined"
              class="mb-4"
            />

            <v-textarea
              v-model="form.description"
              :label="$t('factions.description')"
              variant="outlined"
              rows="4"
              class="mb-4"
            />

            <v-row>
              <v-col cols="12" md="6">
                <v-combobox
                  v-model="form.metadata.type"
                  :label="$t('factions.type')"
                  :items="factionTypes"
                  item-title="title"
                  item-value="value"
                  variant="outlined"
                  clearable
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-select
                  v-model="form.leaderId"
                  :items="availableNpcs"
                  item-title="name"
                  item-value="id"
                  :label="$t('factions.leader')"
                  variant="outlined"
                  clearable
                  :placeholder="$t('factions.leaderPlaceholder')"
                />
              </v-col>
            </v-row>

            <v-row>
              <v-col cols="12" md="6">
                <v-select
                  v-model="form.metadata.alignment"
                  :label="$t('factions.alignment')"
                  :items="factionAlignments"
                  item-title="title"
                  item-value="value"
                  variant="outlined"
                  clearable
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="form.metadata.headquarters"
                  :label="$t('factions.headquarters')"
                  variant="outlined"
                />
              </v-col>
            </v-row>

            <v-textarea
              v-model="form.metadata.goals"
              :label="$t('factions.goals')"
              :placeholder="$t('factions.goalsPlaceholder')"
              variant="outlined"
              rows="3"
              class="mb-4"
              persistent-placeholder
            />

            <v-textarea
              v-model="form.metadata.notes"
              :label="$t('factions.notes')"
              variant="outlined"
              rows="3"
            />
          </div>
        </v-card-text>

        <v-card-actions class="flex-shrink-0">
          <v-spacer />
          <v-btn
            variant="text"
            :disabled="saving || uploadingImage || deletingImage || generatingImage"
            @click="close"
          >
            {{ $t('common.cancel') }}
          </v-btn>
          <!-- Save button with wrapper for tooltip on disabled state -->
          <div class="d-inline-block">
            <v-btn
              color="primary"
              :disabled="!form.name || uploadingImage || deletingImage || generatingImage || hasDirtyTabs"
              :loading="saving"
              @click="save"
            >
              {{ faction ? $t('common.save') : $t('common.create') }}
            </v-btn>
            <v-tooltip v-if="hasDirtyTabs" activator="parent" location="top">
              {{ $t('common.unsavedTabChanges', { tabs: dirtyTabLabels.join(', ') }) }}
            </v-tooltip>
          </div>
        </v-card-actions>
      </template>
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
import type { Faction } from '~~/types/faction'
import type { Lore } from '~~/types/lore'
import { FACTION_TYPES, FACTION_ALIGNMENTS, FACTION_MEMBERSHIP_TYPES } from '~~/types/faction'
import EntityNpcsTab from '~/components/shared/EntityNpcsTab.vue'
import FactionLocationsTab from './FactionLocationsTab.vue'
import EntityItemsTab from '~/components/shared/EntityItemsTab.vue'
import EntityLoreTab from '~/components/shared/EntityLoreTab.vue'
import EntityPlayersTab from '~/components/shared/EntityPlayersTab.vue'
import EntityDocuments from '~/components/shared/EntityDocuments.vue'
import EntityImageGallery from '~/components/shared/EntityImageGallery.vue'
import EntityImageUpload from '~/components/shared/EntityImageUpload.vue'
import ImagePreviewDialog from '~/components/shared/ImagePreviewDialog.vue'
import { useImageDownload } from '~/composables/useImageDownload'
import LocationSelectWithMap from '~/components/shared/LocationSelectWithMap.vue'
import { useEntitiesStore } from '~/stores/entities'
import { useCampaignStore } from '~/stores/campaign'
import { useSnackbarStore } from '~/stores/snackbar'
import { useDialogDirtyStateProvider } from '~/composables/useDialogDirtyState'

// ============================================================================
// Props & Emits - SIMPLIFIED: only show and factionId needed!
// ============================================================================
const props = defineProps<{
  show: boolean
  factionId?: number | null // null/undefined = create mode
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  saved: [faction: Faction]
  created: [faction: Faction]
}>()

// ============================================================================
// Composables & Stores
// ============================================================================
const { t } = useI18n()
const entitiesStore = useEntitiesStore()
const campaignStore = useCampaignStore()
const snackbarStore = useSnackbarStore()
const { downloadImage: downloadImageFile } = useImageDownload()

// Dirty state management for tabs
const { hasDirtyTabs, dirtyTabLabels } = useDialogDirtyStateProvider()

// ============================================================================
// Internal State
// ============================================================================
const internalShow = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value),
})

const loading = ref(false)
const saving = ref(false)
const activeTab = ref('details')
const faction = ref<Faction | null>(null)

// Form state - managed internally
// Note: type can be string (custom value) or {value, title} object (predefined value from v-combobox)
const form = ref({
  name: '',
  description: '',
  leaderId: null as number | null,
  location_id: null as number | null,
  metadata: {
    type: undefined as string | { value: string; title: string } | undefined,
    alignment: undefined as string | undefined,
    headquarters: undefined as string | undefined,
    goals: undefined as string | undefined,
    notes: undefined as string | undefined,
  },
})

// Map sync data (from LocationSelectWithMap)
const mapSyncData = ref<{ locationId: number | null; mapIds: number[] } | null>(null)

// Relations data - loaded internally
interface FactionMember {
  id: number
  from_entity_id: number
  to_entity_id: number
  relation_type: string
  notes: Record<string, unknown> | null
  name: string
  image_url?: string | null
  description?: string | null
  direction?: 'outgoing' | 'incoming'
}

interface FactionLocation {
  id: number
  from_entity_id: number
  to_entity_id: number
  relation_type: string
  notes: Record<string, unknown> | null
  created_at: string
  name: string
  image_url?: string | null
  description?: string | null
  direction?: 'outgoing' | 'incoming'
}

interface FactionItem {
  id: number
  relation_id?: number
  name: string
  description: string | null
  image_url: string | null
  quantity?: number | null
  relation_type?: string | null
  direction?: 'outgoing' | 'incoming'
}

const factionMembers = ref<FactionMember[]>([])
const factionLocations = ref<FactionLocation[]>([])
const factionItems = ref<FactionItem[]>([])
const linkedLore = ref<Array<Pick<Lore, 'id' | 'name' | 'description' | 'image_url'>>>([])

// Counts for tab badges
const counts = ref({
  members: 0,
  items: 0,
  locations: 0,
  lore: 0,
  players: 0,
  documents: 0,
  images: 0,
})

// Loading states
const loadingMembers = ref(false)
const loadingLocations = ref(false)
const loadingLore = ref(false)
const addingMember = ref(false)
const addingLocation = ref(false)
const addingItem = ref(false)

// Image management
const fileInputRef = ref<HTMLInputElement | null>(null)
const uploadingImage = ref(false)
const deletingImage = ref(false)
const generatingImage = ref(false)
const hasApiKey = ref(false)

// Snapshot of original values for image-critical fields
const originalImageData = ref({
  name: '',
  description: '',
  type: undefined as string | undefined,
})

// Check if image-critical fields have unsaved changes
const hasUnsavedImageChanges = computed(() => {
  const currentType = getComboboxValue(
    form.value.metadata.type as string | { value: string; title: string } | undefined,
  )
  return (
    form.value.name !== originalImageData.value.name ||
    form.value.description !== originalImageData.value.description ||
    currentType !== originalImageData.value.type
  )
})

// Image preview
const showImagePreview = ref(false)
const previewImageUrl = ref('')
const previewImageTitle = ref('')

// Membership type suggestions from TypeScript types
const membershipTypeSuggestions = computed(() =>
  FACTION_MEMBERSHIP_TYPES.map((type) => ({
    value: type,
    title: t(`factions.membershipTypes.${type}`),
  })),
)

// Faction type options from TypeScript types
// Explicitly typed to allow custom string values in v-combobox
const factionTypes = computed((): Array<{ value: string; title: string }> =>
  FACTION_TYPES.map((type) => ({
    value: type,
    title: t(`factions.types.${type}`),
  })),
)

// Faction alignment options from TypeScript types
const factionAlignments = computed(() =>
  FACTION_ALIGNMENTS.map((alignment) => ({
    value: alignment,
    title: t(`factions.alignments.${alignment}`),
  })),
)

// ============================================================================
// Computed: Available entities from store (sorted alphabetically)
// ============================================================================
const availableNpcs = computed(() =>
  entitiesStore.npcs
    .map((n) => ({ id: n.id, name: n.name, image_url: n.image_url }))
    .sort((a, b) => a.name.localeCompare(b.name)),
)

const availableLocations = computed(() =>
  entitiesStore.locations
    .map((l) => ({ id: l.id, name: l.name, image_url: l.image_url }))
    .sort((a, b) => a.name.localeCompare(b.name)),
)

const availableItems = computed(() =>
  entitiesStore.items
    .map((i) => ({ id: i.id, name: i.name }))
    .sort((a, b) => a.name.localeCompare(b.name)),
)

const availableLore = computed(() =>
  entitiesStore.lore
    .map((l) => ({ id: l.id, name: l.name }))
    .sort((a, b) => a.name.localeCompare(b.name)),
)

// ============================================================================
// Watch: Load data when dialog opens or factionId changes
// ============================================================================
watch(
  () => [props.show, props.factionId],
  async ([show, factionId]) => {
    if (show) {
      await loadData(factionId as number | null | undefined)
    }
  },
  { immediate: true },
)

// ============================================================================
// Data Loading
// ============================================================================
async function loadData(factionId: number | null | undefined) {
  loading.value = true
  activeTab.value = 'details'

  try {
    // Load store data and check API key
    await Promise.all([
      loadStoreData(),
      checkApiKey(),
    ])

    if (factionId) {
      // Edit mode: load faction and relations
      await loadFaction(factionId)
      await loadRelations(factionId)
    } else {
      // Create mode: reset form
      resetForm()
    }
  } finally {
    loading.value = false
  }
}

async function loadStoreData() {
  const campaignId = campaignStore.activeCampaignId
  if (!campaignId) return

  // Ensure store has data for selects
  await Promise.all([
    entitiesStore.fetchNPCs(campaignId),
    entitiesStore.fetchFactions(campaignId),
    entitiesStore.fetchLocations(campaignId),
    entitiesStore.fetchItems(campaignId),
    entitiesStore.fetchLore(campaignId),
    entitiesStore.fetchPlayers(campaignId),
  ])
}

async function checkApiKey() {
  try {
    const result = await $fetch<{ hasKey: boolean }>('/api/settings/openai-key/check')
    hasApiKey.value = result.hasKey
  } catch {
    hasApiKey.value = false
  }
}

async function loadFaction(factionId: number) {
  try {
    const data = await $fetch<Faction>(`/api/factions/${factionId}`)
    faction.value = data

    // Populate form from faction
    // For v-combobox: convert KEY to {value, title} object so it displays the title correctly
    const typeKey = data.metadata?.type as string | undefined
    const typeItem = typeKey ? factionTypes.value.find((t) => t.value === typeKey) : undefined

    form.value = {
      name: data.name,
      description: data.description || '',
      leaderId: data.leader_id || null,
      location_id: data.location_id || null,
      metadata: {
        // If type is a known key, use the full object for proper display in v-combobox
        // If it's a custom value (not in predefined list), keep as string
        type: typeItem || typeKey,
        alignment: data.metadata?.alignment as string | undefined,
        headquarters: data.metadata?.headquarters as string | undefined,
        goals: data.metadata?.goals as string | undefined,
        notes: data.metadata?.notes as string | undefined,
      },
    }

    // Save snapshot of image-critical fields
    originalImageData.value = {
      name: data.name,
      description: data.description || '',
      type: typeKey || undefined,
    }

    // Load counts for tab badges
    await loadCounts(factionId)
  } catch (e) {
    console.error('[FactionEditDialog] Failed to load faction:', e)
  }
}

async function loadCounts(factionId: number) {
  try {
    const data = await $fetch<{
      members: number
      items: number
      locations: number
      lore: number
      players: number
      documents: number
      images: number
    }>(`/api/factions/${factionId}/counts`)
    counts.value = data
  } catch (e) {
    console.error('[FactionEditDialog] Failed to load counts:', e)
  }
}

async function loadRelations(factionId: number) {
  loadingMembers.value = true
  loadingLocations.value = true
  loadingLore.value = true

  try {
    const [members, locations, items, lore] = await Promise.all([
      $fetch<FactionMember[]>(`/api/entities/${factionId}/related/npcs`).catch(() => []),
      $fetch<FactionLocation[]>(`/api/entities/${factionId}/related/locations`).catch(() => []),
      $fetch<FactionItem[]>(`/api/entities/${factionId}/related/items`).catch(() => []),
      $fetch<Array<{ id: number; name: string; description: string | null; image_url: string | null }>>(`/api/entities/${factionId}/related/lore`).catch(() => []),
    ])

    factionMembers.value = members
    factionLocations.value = locations
    // Map items with relation_id and quantity from notes
    factionItems.value = items.map((item: { id: number; name: string; description: string | null; image_url: string | null; relation_type?: string | null; notes?: { quantity?: number } | null; direction?: 'outgoing' | 'incoming' }) => ({
      id: item.id, // This is actually relation_id from the API
      relation_id: item.id,
      name: item.name,
      description: item.description,
      image_url: item.image_url,
      relation_type: item.relation_type,
      quantity: item.notes?.quantity ?? null,
      direction: item.direction,
    }))
    linkedLore.value = lore
  } catch (e) {
    console.error('[FactionEditDialog] Failed to load relations:', e)
  } finally {
    loadingMembers.value = false
    loadingLocations.value = false
    loadingLore.value = false
  }
}

async function refreshFaction() {
  if (faction.value?.id) {
    await Promise.all([
      loadFaction(faction.value.id),
      loadRelations(faction.value.id),
      loadCounts(faction.value.id),
    ])
  }
}

function resetForm() {
  faction.value = null
  form.value = {
    name: '',
    description: '',
    leaderId: null,
    location_id: null,
    metadata: {
      type: undefined,
      alignment: undefined,
      headquarters: undefined,
      goals: undefined,
      notes: undefined,
    },
  }
  mapSyncData.value = null
  factionMembers.value = []
  factionLocations.value = []
  factionItems.value = []
  linkedLore.value = []
  counts.value = {
    members: 0,
    items: 0,
    locations: 0,
    lore: 0,
    players: 0,
    documents: 0,
    images: 0,
  }
}

// ============================================================================
// Helper: Extract value from combobox selection (can be string or {value, title} object)
// ============================================================================
function getComboboxValue(val: string | { value: string; title: string } | undefined): string | undefined {
  if (!val) return undefined
  if (typeof val === 'string') return val
  if (typeof val === 'object' && 'value' in val) return val.value
  return undefined
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

    // Extract actual values from combobox selections
    const metadata = {
      ...form.value.metadata,
      type: getComboboxValue(form.value.metadata.type as string | { value: string; title: string } | undefined),
    }

    if (faction.value) {
      // Update existing faction
      const updated = await entitiesStore.updateFaction(faction.value.id, {
        name: form.value.name,
        description: form.value.description || null,
        leader_id: form.value.leaderId,
        location_id: form.value.location_id,
        metadata,
      })

      // Handle map sync if enabled
      if (mapSyncData.value && mapSyncData.value.locationId && mapSyncData.value.mapIds.length > 0) {
        await syncToMaps(faction.value.id, mapSyncData.value.mapIds)
      }

      emit('saved', updated)
    } else {
      // Create new faction
      const created = await entitiesStore.createFaction(campaignId, {
        name: form.value.name,
        description: form.value.description || null,
        leader_id: form.value.leaderId,
        location_id: form.value.location_id,
        metadata,
      })

      // Handle map sync if enabled
      if (mapSyncData.value && mapSyncData.value.locationId && mapSyncData.value.mapIds.length > 0) {
        await syncToMaps(created.id, mapSyncData.value.mapIds)
      }

      emit('created', created)
    }

    close()
  } catch (e) {
    console.error('[FactionEditDialog] Failed to save:', e)
  } finally {
    saving.value = false
  }
}

function close() {
  internalShow.value = false
}

// Sync Faction marker to selected maps - place inside location circle if available
async function syncToMaps(entityId: number, mapIds: number[]) {
  const locationId = form.value.location_id
  let mapsWithArea: Array<{ map_id: number; map_name: string; area_id: number }> = []
  let locationName = ''

  if (locationId) {
    try {
      mapsWithArea = await $fetch<Array<{ map_id: number; map_name: string; area_id: number }>>(
        `/api/locations/${locationId}/maps-with-area`,
      )
      const location = await $fetch<{ name: string }>(`/api/locations/${locationId}`)
      locationName = location.name
    } catch (e) {
      console.error('[FactionEditDialog] Failed to get maps with area:', e)
    }
  }

  const mapsWithoutLocation: string[] = []

  let allMaps: Array<{ id: number; name: string }> = []
  try {
    allMaps = await $fetch<Array<{ id: number; name: string }>>('/api/maps', {
      query: { campaignId: campaignStore.activeCampaignId },
    })
  } catch (e) {
    console.error('[FactionEditDialog] Failed to get maps:', e)
  }

  for (const mapId of mapIds) {
    try {
      const areaInfo = mapsWithArea.find((m) => m.map_id === mapId)

      if (areaInfo) {
        await $fetch(`/api/maps/${mapId}/place-in-area`, {
          method: 'POST',
          body: {
            entity_id: entityId,
            area_id: areaInfo.area_id,
          },
        })
      } else {
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
          const mapInfo = allMaps.find((m) => m.id === mapId)
          if (mapInfo) {
            mapsWithoutLocation.push(mapInfo.name)
          }
        }
      }
    } catch (e) {
      console.error(`[FactionEditDialog] Failed to sync to map ${mapId}:`, e)
    }
  }

  if (mapsWithoutLocation.length > 0 && locationId) {
    if (mapsWithoutLocation.length === 1) {
      snackbarStore.warning(
        t('maps.locationNotOnMap', { location: locationName, map: mapsWithoutLocation[0] }),
      )
    } else {
      snackbarStore.warning(
        t('maps.locationNotOnMaps', { location: locationName, count: mapsWithoutLocation.length }),
      )
    }
  }
}

// ============================================================================
// Member Management
// ============================================================================
async function addMember(payload: { npcId: number; membershipType?: string; rank?: string }) {
  if (!faction.value) return

  addingMember.value = true
  try {
    await $fetch(`/api/factions/${faction.value.id}/members`, {
      method: 'POST',
      body: {
        npcId: payload.npcId,
        membershipType: payload.membershipType || 'member',
        rank: payload.rank,
      },
    })
    await loadRelations(faction.value.id)
    await loadCounts(faction.value.id)
  } catch (e) {
    console.error('[FactionEditDialog] Failed to add member:', e)
  } finally {
    addingMember.value = false
  }
}

async function updateMember(payload: { relationId: number; membershipType?: string; rank?: string }) {
  if (!faction.value) return

  try {
    await $fetch(`/api/entity-relations/${payload.relationId}`, {
      method: 'PATCH',
      body: {
        relationType: payload.membershipType,
        notes: JSON.stringify({ rank: payload.rank }),
      },
    })
    await loadRelations(faction.value.id)
  } catch (e) {
    console.error('[FactionEditDialog] Failed to update member:', e)
  }
}

async function removeMember(relationId: number) {
  if (!faction.value) return

  try {
    await $fetch(`/api/entity-relations/${relationId}`, { method: 'DELETE' })
    await loadRelations(faction.value.id)
    await loadCounts(faction.value.id)
  } catch (e) {
    console.error('[FactionEditDialog] Failed to remove member:', e)
  }
}

// ============================================================================
// Location Management
// ============================================================================
async function addLocation(payload: { locationId: number; relationType: string }) {
  if (!faction.value) return

  addingLocation.value = true
  try {
    await $fetch(`/api/factions/${faction.value.id}/locations`, {
      method: 'POST',
      body: {
        locationId: payload.locationId,
        relationType: payload.relationType,
      },
    })
    await loadRelations(faction.value.id)
    await loadCounts(faction.value.id)
  } catch (e) {
    console.error('[FactionEditDialog] Failed to add location:', e)
  } finally {
    addingLocation.value = false
  }
}

async function updateLocation(payload: { relationId: number; relationType: string }) {
  if (!faction.value) return

  try {
    await $fetch(`/api/entity-relations/${payload.relationId}`, {
      method: 'PATCH',
      body: {
        relationType: payload.relationType,
      },
    })
    await loadRelations(faction.value.id)
  } catch (e) {
    console.error('[FactionEditDialog] Failed to update location:', e)
  }
}

async function removeLocation(relationId: number) {
  if (!faction.value) return

  try {
    await $fetch(`/api/entity-relations/${relationId}`, { method: 'DELETE' })
    await loadRelations(faction.value.id)
    await loadCounts(faction.value.id)
  } catch (e) {
    console.error('[FactionEditDialog] Failed to remove location:', e)
  }
}

// ============================================================================
// Item Management
// ============================================================================
async function addItem(payload: { itemId: number; relationType?: string; quantity?: number; equipped?: boolean }) {
  if (!faction.value) return

  addingItem.value = true
  try {
    await $fetch('/api/entity-relations', {
      method: 'POST',
      body: {
        fromEntityId: faction.value.id,
        toEntityId: payload.itemId,
        relationType: payload.relationType || 'besitzt',
        notes: JSON.stringify({ quantity: payload.quantity }),
      },
    })
    await loadRelations(faction.value.id)
    await loadCounts(faction.value.id)
  } catch (e) {
    console.error('[FactionEditDialog] Failed to add item:', e)
  } finally {
    addingItem.value = false
  }
}

async function updateItem(payload: { relationId: number; relationType?: string; quantity?: number; equipped?: boolean }) {
  if (!faction.value) return

  try {
    await $fetch(`/api/entity-relations/${payload.relationId}`, {
      method: 'PATCH',
      body: {
        relationType: payload.relationType,
        notes: JSON.stringify({ quantity: payload.quantity }),
      },
    })
    await loadRelations(faction.value.id)
  } catch (e) {
    console.error('[FactionEditDialog] Failed to update item:', e)
  }
}

async function removeItem(relationId: number) {
  if (!faction.value) return

  try {
    await $fetch(`/api/entity-relations/${relationId}`, { method: 'DELETE' })
    await loadRelations(faction.value.id)
    await loadCounts(faction.value.id)
  } catch (e) {
    console.error('[FactionEditDialog] Failed to remove item:', e)
  }
}

// ============================================================================
// Lore Management
// ============================================================================
async function addLore(loreId: number) {
  if (!faction.value) return

  loadingLore.value = true
  try {
    await $fetch('/api/entity-relations', {
      method: 'POST',
      body: {
        fromEntityId: faction.value.id,
        toEntityId: loreId,
        relationType: 'knows',
      },
    })
    await loadRelations(faction.value.id)
    await loadCounts(faction.value.id)
  } catch (e) {
    console.error('[FactionEditDialog] Failed to add lore:', e)
  } finally {
    loadingLore.value = false
  }
}

async function removeLore(relationId: number) {
  if (!faction.value) return

  try {
    await $fetch(`/api/entity-relations/${relationId}`, { method: 'DELETE' })
    await loadRelations(faction.value.id)
    await loadCounts(faction.value.id)
  } catch (e) {
    console.error('[FactionEditDialog] Failed to remove lore:', e)
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
  if (!files || files.length === 0 || !faction.value) return

  uploadingImage.value = true
  try {
    const formData = new FormData()
    const file = files[0]
    if (file) {
      formData.append('image', file)
    }

    const response = await fetch(`/api/entities/${faction.value.id}/upload-image`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error('Upload failed')
    }

    await refreshFaction()
  } catch (error) {
    console.error('Failed to upload image:', error)
  } finally {
    uploadingImage.value = false
    if (target) target.value = ''
  }
}

async function generateImage() {
  if (!faction.value || !form.value.name) return

  generatingImage.value = true

  try {
    const result = await $fetch<{ imageUrl: string }>('/api/ai/generate-image', {
      method: 'POST',
      body: {
        prompt: '', // Empty prompt - we pass structured data instead
        entityName: form.value.name,
        entityType: 'Faction',
        style: 'fantasy-art',
        entityData: {
          name: form.value.name,
          type: form.value.metadata.type,
          goals: form.value.metadata.goals,
          description: form.value.description,
        },
      },
    })

    if (result.imageUrl && faction.value) {
      await $fetch(`/api/entities/${faction.value.id}/set-image`, {
        method: 'POST',
        body: { imageUrl: result.imageUrl.replace('/uploads/', '') },
      })
      await refreshFaction()
    }
  } catch (error) {
    console.error('[FactionEditDialog] Failed to generate image:', error)
  } finally {
    generatingImage.value = false
  }
}

async function deleteImage() {
  if (!faction.value?.image_url) return

  deletingImage.value = true
  try {
    await $fetch(`/api/entities/${faction.value.id}/delete-image`, { method: 'DELETE' })
    await refreshFaction()
  } catch (error) {
    console.error('Failed to delete image:', error)
  } finally {
    deletingImage.value = false
  }
}

function downloadImage() {
  if (!faction.value?.image_url) return
  downloadImageFile(`/uploads/${faction.value.image_url}`, form.value.name)
}

function handleImagePreview(url: string, name?: string) {
  previewImageUrl.value = url
  previewImageTitle.value = name || faction.value?.name || ''
  showImagePreview.value = true
}
</script>

<style scoped>
.blur-image {
  filter: blur(4px);
  opacity: 0.6;
}
</style>
