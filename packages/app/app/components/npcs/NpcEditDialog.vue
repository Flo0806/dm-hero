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
          {{ npc ? $t('npcs.edit') : $t('npcs.create') }}
          <v-spacer />
          <SharedPinButton v-if="npc?.id" :entity-id="npc.id" variant="icon" />
        </v-card-title>

        <v-tabs v-if="npc" v-model="activeTab" class="mb-4 flex-shrink-0" show-arrows>
          <v-tab value="details">
            <v-icon start> mdi-account-details </v-icon>
            {{ $t('npcs.details') }}
          </v-tab>
          <v-tab value="npcRelations">
            <v-icon start> mdi-account-multiple </v-icon>
            {{ $t('npcs.npcRelations') }}
            <v-chip size="x-small" class="ml-2">{{ counts.relations }}</v-chip>
          </v-tab>
          <v-tab value="locations">
            <v-icon start> mdi-map-marker </v-icon>
            {{ $t('npcs.linkedLocations') }}
            <v-chip size="x-small" class="ml-2">{{ counts.locations }}</v-chip>
          </v-tab>
          <v-tab value="memberships">
            <v-icon start> mdi-shield-account </v-icon>
            {{ $t('npcs.memberships') }}
            <v-chip size="x-small" class="ml-2">{{ counts.memberships }}</v-chip>
          </v-tab>
          <v-tab value="items">
            <v-icon start> mdi-sword </v-icon>
            {{ $t('npcs.items') }}
            <v-chip size="x-small" class="ml-2">{{ counts.items }}</v-chip>
          </v-tab>
          <v-tab value="notes">
            <v-icon start> mdi-note-text </v-icon>
            {{ $t('npcs.notes') }}
            <v-chip size="x-small" class="ml-2">{{ counts.notes }}</v-chip>
          </v-tab>
          <v-tab value="documents">
            <v-icon start> mdi-file-document </v-icon>
            {{ $t('documents.title') }}
            <v-chip size="x-small" class="ml-2">{{ counts.documents }}</v-chip>
          </v-tab>
          <v-tab value="lore">
            <v-icon start>mdi-book-open-variant</v-icon>
            {{ $t('npcs.badgeTooltips.lore') }}
            <v-chip size="x-small" class="ml-2">{{ counts.lore }}</v-chip>
          </v-tab>
          <v-tab value="players">
            <v-icon start>mdi-account-star</v-icon>
            {{ $t('players.title') }}
            <v-chip size="x-small" class="ml-2">{{ counts.players }}</v-chip>
          </v-tab>
        </v-tabs>

        <v-card-text class="flex-grow-1 overflow-y-auto">
          <v-tabs-window v-if="npc" v-model="activeTab">
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
                :image-url="npc?.image_url"
                :entity-name="form.name"
                entity-type="NPC"
                :uploading="uploadingImage"
                :generating="generatingImage"
                :deleting="deletingImage"
                :has-api-key="hasApiKey"
                :generate-disabled="!form.name || uploadingImage || deletingImage || generatingImage || !hasApiKey || hasUnsavedImageChanges"
                :generate-disabled-reason="hasUnsavedImageChanges ? $t('common.saveChangesFirst') : ''"
                :avatar-size="160"
                default-icon="mdi-account"
                @preview-image="handleImagePreview"
                @upload="triggerImageUpload"
                @generate="generateImage"
                @download="downloadImage"
                @delete="deleteImage"
              />

              <v-text-field
                v-model="form.name"
                :label="$t('npcs.name')"
                :rules="[(v: string) => !!v || $t('npcs.nameRequired')]"
                variant="outlined"
                class="mb-4"
              >
                <template #append-inner>
                  <v-btn
                    :loading="generatingName"
                    icon="mdi-auto-fix"
                    variant="text"
                    size="small"
                    color="primary"
                    @click="generateName"
                  />
                </template>
              </v-text-field>

              <v-textarea
                v-model="form.description"
                :label="$t('npcs.description')"
                variant="outlined"
                rows="4"
                class="mb-4"
              />

              <!-- Race & Class -->
              <v-row>
                <v-col cols="12" md="6">
                  <v-select
                    :key="`race-${locale}`"
                    v-model="form.metadata.race"
                    :items="raceItems"
                    :label="$t('npcs.race')"
                    variant="outlined"
                    clearable
                    item-title="title"
                    item-value="value"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-select
                    :key="`class-${locale}`"
                    v-model="form.metadata.class"
                    :items="classItems"
                    :label="$t('npcs.class')"
                    variant="outlined"
                    clearable
                    item-title="title"
                    item-value="value"
                  />
                </v-col>
              </v-row>

              <!-- Age & Gender -->
              <v-row>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model.number="form.metadata.age"
                    :label="$t('npcs.age')"
                    variant="outlined"
                    type="number"
                    min="0"
                    clearable
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-select
                    v-model="form.metadata.gender"
                    :label="$t('npcs.gender')"
                    :items="genderItems"
                    variant="outlined"
                    clearable
                  />
                </v-col>
              </v-row>

              <!-- Type & Status -->
              <v-row>
                <v-col cols="12" md="6">
                  <v-select
                    v-model="form.metadata.type"
                    :items="npcTypes"
                    :label="$t('npcs.type')"
                    variant="outlined"
                    clearable
                  >
                    <template #item="{ props: itemProps, item }">
                      <v-list-item v-bind="itemProps">
                        <template #prepend>
                          <v-icon :icon="getNpcTypeIcon(item.value)" />
                        </template>
                      </v-list-item>
                    </template>
                    <template #selection="{ item }">
                      <v-chip>
                        <template #prepend>
                          <v-icon :icon="getNpcTypeIcon(item.value)" size="small" class="mr-1" />
                        </template>
                        {{ item.title }}
                      </v-chip>
                    </template>
                  </v-select>
                </v-col>
                <v-col cols="12" md="6">
                  <v-select
                    v-model="form.metadata.status"
                    :items="npcStatuses"
                    :label="$t('npcs.status')"
                    variant="outlined"
                    clearable
                  >
                    <template #item="{ props: itemProps, item }">
                      <v-list-item v-bind="itemProps">
                        <template #prepend>
                          <v-icon :icon="getNpcStatusIcon(item.value)" :color="getNpcStatusColor(item.value)" />
                        </template>
                      </v-list-item>
                    </template>
                    <template #selection="{ item }">
                      <v-chip :color="getNpcStatusColor(item.value)">
                        <template #prepend>
                          <v-icon :icon="getNpcStatusIcon(item.value)" size="small" class="mr-1" />
                        </template>
                        {{ item.title }}
                      </v-chip>
                    </template>
                  </v-select>
                </v-col>
              </v-row>

              <!-- Current Location -->
              <v-row class="mt-2">
                <v-col cols="12">
                  <LocationSelectWithMap
                    v-model="form.location_id"
                    :entity-id="npc?.id"
                    entity-type="NPC"
                    @update:map-sync="mapSyncData = $event"
                  />
                </v-col>
              </v-row>
            </v-tabs-window-item>

            <!-- NPC Relations Tab -->
            <v-tabs-window-item value="npcRelations">
              <NpcRelationsTab
                v-if="npc"
                :npc-relations="npcRelations"
                :available-npcs="availableNpcs"
                :adding="addingRelation"
                @add="addNpcRelation"
                @update="updateNpcRelation"
                @remove="removeNpcRelation"
              />
            </v-tabs-window-item>

            <!-- Locations Tab -->
            <v-tabs-window-item value="locations">
              <EntityLocationsTab
                v-if="npc"
                :entity-id="npc.id"
                @changed="refreshNpc"
              />
            </v-tabs-window-item>

            <!-- Memberships Tab -->
            <v-tabs-window-item value="memberships">
              <NpcMembershipsTab
                :memberships="factionMemberships"
                :factions="availableFactions"
                :adding="addingMembership"
                @add="addMembership"
                @update="updateMembership"
                @remove="removeMembership"
              />
            </v-tabs-window-item>

            <!-- Items Tab -->
            <v-tabs-window-item value="items">
              <EntityItemsTab
                :linked-items="npcItems"
                :available-items="availableItems"
                :loading="addingItem"
                :show-avatar="false"
                :show-relation-type="true"
                :show-quantity="true"
                :show-equipped="true"
                :show-rarity="true"
                :relation-type-suggestions="npcItemRelationTypeSuggestions"
                @add="addItem"
                @update="updateItem"
                @remove="removeItem"
              />
            </v-tabs-window-item>

            <!-- Notes Tab -->
            <v-tabs-window-item value="notes">
              <NpcNotesTab v-if="npc" :npc-id="npc.id" />
            </v-tabs-window-item>

            <!-- Documents Tab -->
            <v-tabs-window-item value="documents">
              <EntityDocuments v-if="npc" :entity-id="npc.id" @changed="refreshNpc" />
            </v-tabs-window-item>

            <!-- Lore Tab -->
            <v-tabs-window-item value="lore">
              <EntityLoreTab
                v-if="npc"
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
                v-if="npc"
                :entity-id="npc.id"
                @changed="refreshNpc"
              />
            </v-tabs-window-item>
          </v-tabs-window>

          <!-- Create Form (no tabs) -->
          <div v-if="!npc">
            <v-text-field
              v-model="form.name"
              :label="$t('npcs.name')"
              :rules="[(v: string) => !!v || $t('npcs.nameRequired')]"
              variant="outlined"
              class="mb-4"
            >
              <template #append-inner>
                <v-btn
                  :loading="generatingName"
                  icon="mdi-auto-fix"
                  variant="text"
                  size="small"
                  color="primary"
                  @click="generateName"
                />
              </template>
            </v-text-field>

            <v-textarea
              v-model="form.description"
              :label="$t('npcs.description')"
              variant="outlined"
              rows="4"
              class="mb-4"
            />

            <!-- Race & Class -->
            <v-row>
              <v-col cols="12" md="6">
                <v-select
                  :key="`race-${locale}`"
                  v-model="form.metadata.race"
                  :items="raceItems"
                  :label="$t('npcs.race')"
                  variant="outlined"
                  clearable
                  item-title="title"
                  item-value="value"
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-select
                  :key="`class-${locale}`"
                  v-model="form.metadata.class"
                  :items="classItems"
                  :label="$t('npcs.class')"
                  variant="outlined"
                  clearable
                  item-title="title"
                  item-value="value"
                />
              </v-col>
            </v-row>

            <!-- Age & Gender -->
            <v-row>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model.number="form.metadata.age"
                  :label="$t('npcs.age')"
                  variant="outlined"
                  type="number"
                  min="0"
                  clearable
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-select
                  v-model="form.metadata.gender"
                  :label="$t('npcs.gender')"
                  :items="genderItems"
                  variant="outlined"
                  clearable
                />
              </v-col>
            </v-row>

            <!-- Type & Status -->
            <v-row>
              <v-col cols="12" md="6">
                <v-select
                  v-model="form.metadata.type"
                  :items="npcTypes"
                  :label="$t('npcs.type')"
                  variant="outlined"
                  clearable
                >
                  <template #item="{ props: itemProps, item }">
                    <v-list-item v-bind="itemProps">
                      <template #prepend>
                        <v-icon :icon="getNpcTypeIcon(item.value)" />
                      </template>
                    </v-list-item>
                  </template>
                  <template #selection="{ item }">
                    <v-chip>
                      <template #prepend>
                        <v-icon :icon="getNpcTypeIcon(item.value)" size="small" class="mr-1" />
                      </template>
                      {{ item.title }}
                    </v-chip>
                  </template>
                </v-select>
              </v-col>
              <v-col cols="12" md="6">
                <v-select
                  v-model="form.metadata.status"
                  :items="npcStatuses"
                  :label="$t('npcs.status')"
                  variant="outlined"
                  clearable
                >
                  <template #item="{ props: itemProps, item }">
                    <v-list-item v-bind="itemProps">
                      <template #prepend>
                        <v-icon :icon="getNpcStatusIcon(item.value)" :color="getNpcStatusColor(item.value)" />
                      </template>
                    </v-list-item>
                  </template>
                  <template #selection="{ item }">
                    <v-chip :color="getNpcStatusColor(item.value)">
                      <template #prepend>
                        <v-icon :icon="getNpcStatusIcon(item.value)" size="small" class="mr-1" />
                      </template>
                      {{ item.title }}
                    </v-chip>
                  </template>
                </v-select>
              </v-col>
            </v-row>

            <!-- Current Location (Create mode) -->
            <v-row class="mt-2">
              <v-col cols="12">
                <LocationSelectWithMap
                  v-model="form.location_id"
                  entity-type="NPC"
                  @update:map-sync="mapSyncData = $event"
                />
              </v-col>
            </v-row>
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
              {{ npc ? $t('common.save') : $t('common.create') }}
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
import type { Lore } from '~~/types/lore'
import type { NpcItem, NpcMembership } from '~~/types/npc-components'
import { NPC_TYPES, NPC_STATUSES, NPC_ITEM_RELATION_TYPES, type NpcType, type NpcStatus, type NPC } from '~~/types/npc'
import NpcRelationsTab from './NpcRelationsTab.vue'
import EntityLocationsTab from '../shared/EntityLocationsTab.vue'
import NpcMembershipsTab from './NpcMembershipsTab.vue'
import EntityItemsTab from '../shared/EntityItemsTab.vue'
import EntityLoreTab from '../shared/EntityLoreTab.vue'
import EntityPlayersTab from '../shared/EntityPlayersTab.vue'
import NpcNotesTab from './NpcNotesTab.vue'
import EntityDocuments from '../shared/EntityDocuments.vue'
import EntityImageUpload from '../shared/EntityImageUpload.vue'
import ImagePreviewDialog from '../shared/ImagePreviewDialog.vue'
import LocationSelectWithMap from '../shared/LocationSelectWithMap.vue'
import { useImageDownload } from '~/composables/useImageDownload'
import { useEntitiesStore } from '~/stores/entities'
import { useCampaignStore } from '~/stores/campaign'
import { useSnackbarStore } from '~/stores/snackbar'
import { getNpcTypeIcon, getNpcStatusIcon, getNpcStatusColor } from '~/utils/npc-icons'

// ============================================================================
// Props & Emits - SIMPLIFIED: only show and npcId needed!
// ============================================================================
const props = defineProps<{
  show: boolean
  npcId?: number | null // null/undefined = create mode
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  saved: [npc: NPC]
  created: [npc: NPC]
}>()

// ============================================================================
// Composables & Stores
// ============================================================================
const { locale, t } = useI18n()
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
const npc = ref<NPC | null>(null)

// Form state - managed internally
const form = ref({
  name: '',
  description: '',
  location_id: null as number | null,
  metadata: {
    race: undefined as string | undefined,
    class: undefined as string | undefined,
    age: undefined as number | undefined,
    gender: undefined as string | undefined,
    type: undefined as NpcType | undefined,
    status: undefined as NpcStatus | undefined,
  },
})

// Snapshot of original values for image-critical fields
const originalImageData = ref({
  name: '',
  description: '',
  race: undefined as string | undefined,
  class: undefined as string | undefined,
  age: undefined as number | undefined,
  gender: undefined as string | undefined,
})

// Check if image-critical fields have unsaved changes
const hasUnsavedImageChanges = computed(() => {
  return (
    form.value.name !== originalImageData.value.name ||
    form.value.description !== originalImageData.value.description ||
    form.value.metadata.race !== originalImageData.value.race ||
    form.value.metadata.class !== originalImageData.value.class ||
    form.value.metadata.age !== originalImageData.value.age ||
    form.value.metadata.gender !== originalImageData.value.gender
  )
})

// Map sync data (from LocationSelectWithMap)
const mapSyncData = ref<{ locationId: number | null; mapIds: number[] } | null>(null)

// Relations data - loaded internally
interface NpcRelation {
  id: number
  related_npc_id: number
  related_npc_name: string
  related_npc_type: string
  relation_type: string
  notes: string | Record<string, unknown> | null
  image_url: string | null
  direction: 'outgoing' | 'incoming'
}

const npcRelations = ref<NpcRelation[]>([])
const factionMemberships = ref<NpcMembership[]>([])
const npcItems = ref<NpcItem[]>([])
const linkedLore = ref<Array<Pick<Lore, 'id' | 'name' | 'description' | 'image_url'>>>([])

// Counts for tab badges
const counts = ref({
  relations: 0,
  locations: 0,
  memberships: 0,
  items: 0,
  notes: 0,
  documents: 0,
  lore: 0,
  players: 0,
})

// Loading states for relation operations
const addingRelation = ref(false)
const addingMembership = ref(false)
const addingItem = ref(false)
const loadingLore = ref(false)

// Reference data - loaded from API/store
const races = ref<Array<{ name: string; name_de?: string | null; name_en?: string | null }>>([])
const classes = ref<Array<{ name: string; name_de?: string | null; name_en?: string | null }>>([])

// Image management
const fileInputRef = ref<HTMLInputElement | null>(null)
const uploadingImage = ref(false)
const deletingImage = ref(false)
const generatingImage = ref(false)
const hasApiKey = ref(false)
const generatingName = ref(false)

// Image preview
const showImagePreview = ref(false)
const previewImageUrl = ref('')
const previewImageTitle = ref('')

// ============================================================================
// Computed: Reference data for selects
// ============================================================================
const raceItems = computed(() =>
  races.value.map((race) => ({
    title: locale.value === 'de' ? (race.name_de || race.name) : (race.name_en || race.name),
    value: race.name,
  })),
)

const classItems = computed(() =>
  classes.value.map((cls) => ({
    title: locale.value === 'de' ? (cls.name_de || cls.name) : (cls.name_en || cls.name),
    value: cls.name,
  })),
)

const genderItems = computed(() => [
  { title: t('npcs.genders.male'), value: 'male' },
  { title: t('npcs.genders.female'), value: 'female' },
  { title: t('npcs.genders.nonbinary'), value: 'nonbinary' },
  { title: t('npcs.genders.other'), value: 'other' },
  { title: t('npcs.genders.unknown'), value: 'unknown' },
])

const npcTypes = computed(() =>
  NPC_TYPES.map((type) => ({
    value: type,
    title: t(`npcs.types.${type}`),
  })),
)

const npcStatuses = computed(() =>
  NPC_STATUSES.map((status) => ({
    value: status,
    title: t(`npcs.statuses.${status}`),
  })),
)

// Available entities from store (sorted alphabetically)
const availableNpcs = computed(() =>
  entitiesStore.npcs
    .filter((n) => n.id !== npc.value?.id)
    .map((n) => ({ id: n.id, name: n.name, image_url: n.image_url }))
    .sort((a, b) => a.name.localeCompare(b.name)),
)

const availableFactions = computed(() =>
  entitiesStore.factions
    .map((f) => ({ id: f.id, name: f.name }))
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

// Item relation type suggestions from TypeScript types
const npcItemRelationTypeSuggestions = computed(() =>
  NPC_ITEM_RELATION_TYPES.map((type) => ({
    value: type,
    title: t(`npcs.itemRelationTypes.${type}`),
  })),
)

// ============================================================================
// Watch: Load data when dialog opens or npcId changes
// ============================================================================
watch(
  () => [props.show, props.npcId],
  async ([show, npcId]) => {
    if (show) {
      await loadData(npcId as number | null | undefined)
    }
  },
  { immediate: true },
)

// ============================================================================
// Data Loading
// ============================================================================
async function loadData(npcId: number | null | undefined) {
  loading.value = true
  activeTab.value = 'details'

  try {
    // Load reference data
    await Promise.all([
      loadReferenceData(),
      loadStoreData(),
      checkApiKey(),
    ])

    if (npcId) {
      // Edit mode: load NPC and relations
      await loadNpc(npcId)
      await loadRelations(npcId)
    } else {
      // Create mode: reset form
      resetForm()
    }
  } finally {
    loading.value = false
  }
}

async function loadReferenceData() {
  try {
    const [racesData, classesData] = await Promise.all([
      $fetch<Array<{ name: string; name_de?: string | null; name_en?: string | null }>>('/api/races'),
      $fetch<Array<{ name: string; name_de?: string | null; name_en?: string | null }>>('/api/classes'),
    ])
    races.value = racesData
    classes.value = classesData
  } catch (e) {
    console.error('[NpcEditDialog] Failed to load reference data:', e)
  }
}

async function loadStoreData() {
  const campaignId = campaignStore.activeCampaignId
  if (!campaignId) return

  // Ensure store has data for selects - just call fetch, store handles caching internally
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

async function loadNpc(npcId: number) {
  try {
    const data = await $fetch<NPC>(`/api/npcs/${npcId}`)
    npc.value = data

    // Populate form from NPC
    form.value = {
      name: data.name,
      description: data.description || '',
      location_id: data.location_id || null,
      metadata: {
        race: data.metadata?.race as string | undefined,
        class: data.metadata?.class as string | undefined,
        age: data.metadata?.age as number | undefined,
        gender: data.metadata?.gender as string | undefined,
        type: data.metadata?.type as NpcType | undefined,
        status: data.metadata?.status as NpcStatus | undefined,
      },
    }

    // Save snapshot of image-critical fields
    originalImageData.value = {
      name: data.name,
      description: data.description || '',
      race: data.metadata?.race as string | undefined,
      class: data.metadata?.class as string | undefined,
      age: data.metadata?.age as number | undefined,
      gender: data.metadata?.gender as string | undefined,
    }

    // Load counts for tab badges
    await loadCounts(npcId)
  } catch (e) {
    console.error('[NpcEditDialog] Failed to load NPC:', e)
  }
}

async function loadCounts(npcId: number) {
  try {
    const data = await $fetch<{
      relations: number
      locations: number
      memberships: number
      items: number
      notes: number
      documents: number
      lore: number
      players: number
    }>(`/api/npcs/${npcId}/counts`)
    counts.value = data
  } catch (e) {
    console.error('[NpcEditDialog] Failed to load counts:', e)
  }
}

async function loadRelations(npcId: number) {
  try {
    // Load NPC relations (other NPCs + locations)
    const relationsData = await $fetch<NpcRelation[]>(`/api/npcs/${npcId}/relations`)
    // Sort alphabetically by related NPC name
    npcRelations.value = relationsData.sort((a, b) =>
      a.related_npc_name.localeCompare(b.related_npc_name),
    )

    // Load all entity relations (includes faction memberships)
    interface AllRelation {
      id: number
      from_entity_id: number
      to_entity_id: number
      to_entity_name: string
      to_entity_type: string
      relation_type: string
      notes: Record<string, unknown> | null
      created_at: string
    }
    const allRelations = await $fetch<AllRelation[]>(`/api/npcs/${npcId}/all-relations`)
    // Filter faction memberships and map to NpcMembership format
    factionMemberships.value = allRelations
      .filter((rel) => rel.to_entity_type === 'Faction')
      .map((rel) => ({
        id: rel.id,
        from_entity_id: rel.from_entity_id,
        to_entity_id: rel.to_entity_id,
        to_entity_name: rel.to_entity_name,
        to_entity_type: rel.to_entity_type,
        relation_type: rel.relation_type,
        notes: rel.notes,
        created_at: rel.created_at,
      }))

    // Load items and map notes to direct properties
    const itemsData = await $fetch<Array<{
      id: number
      relation_type: string
      notes: { quantity?: number; equipped?: boolean } | null
      name: string
      description: string | null
      metadata: { rarity?: string; type?: string } | null
      image_url: string | null
    }>>(`/api/entities/${npcId}/related/items`)
    npcItems.value = itemsData.map((item) => ({
      id: item.id,
      relation_id: item.id,
      name: item.name,
      description: item.description,
      relation_type: item.relation_type,
      quantity: item.notes?.quantity ?? null,
      equipped: item.notes?.equipped ?? null,
      rarity: item.metadata?.rarity ?? null,
      image_url: item.image_url,
    }))

    // Load lore
    const loreData = await $fetch<Array<{ id: number; name: string; description: string | null; image_url: string | null }>>(`/api/entities/${npcId}/related/lore`)
    linkedLore.value = loreData
  } catch (e) {
    console.error('[NpcEditDialog] Failed to load relations:', e)
  }
}

async function refreshNpc() {
  if (npc.value?.id) {
    await Promise.all([
      loadNpc(npc.value.id),
      loadRelations(npc.value.id),
      loadCounts(npc.value.id),
    ])
  }
}

function resetForm() {
  npc.value = null
  form.value = {
    name: '',
    description: '',
    location_id: null,
    metadata: {
      race: undefined,
      class: undefined,
      age: undefined,
      gender: undefined,
      type: undefined as NpcType | undefined,
      status: undefined as NpcStatus | undefined,
    },
  }
  mapSyncData.value = null
  npcRelations.value = []
  factionMemberships.value = []
  npcItems.value = []
  linkedLore.value = []
  counts.value = {
    relations: 0,
    locations: 0,
    memberships: 0,
    items: 0,
    notes: 0,
    documents: 0,
    lore: 0,
    players: 0,
  }
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

    if (npc.value) {
      // Update existing NPC
      const updated = await entitiesStore.updateNPC(npc.value.id, {
        name: form.value.name,
        description: form.value.description || null,
        location_id: form.value.location_id,
        metadata: form.value.metadata,
      })

      // Handle map sync if enabled
      if (mapSyncData.value && mapSyncData.value.locationId && mapSyncData.value.mapIds.length > 0) {
        await syncToMaps(npc.value.id, mapSyncData.value.mapIds)
      }

      emit('saved', updated)
    } else {
      // Create new NPC
      const created = await entitiesStore.createNPC(campaignId, {
        name: form.value.name,
        description: form.value.description || null,
        location_id: form.value.location_id,
        metadata: form.value.metadata,
      })

      // Handle map sync if enabled
      if (mapSyncData.value && mapSyncData.value.locationId && mapSyncData.value.mapIds.length > 0) {
        await syncToMaps(created.id, mapSyncData.value.mapIds)
      }

      emit('created', created)
    }

    close()
  } catch (e) {
    console.error('[NpcEditDialog] Failed to save:', e)
  } finally {
    saving.value = false
  }
}

function close() {
  internalShow.value = false
}

// Sync NPC marker to selected maps - place inside location circle if available
async function syncToMaps(entityId: number, mapIds: number[]) {
  // Get maps that have an area (circle) for the selected location
  const locationId = form.value.location_id
  let mapsWithArea: Array<{ map_id: number; map_name: string; area_id: number }> = []
  let locationName = ''

  if (locationId) {
    try {
      mapsWithArea = await $fetch<Array<{ map_id: number; map_name: string; area_id: number }>>(
        `/api/locations/${locationId}/maps-with-area`,
      )
      // Get location name from API
      const location = await $fetch<{ name: string }>(`/api/locations/${locationId}`)
      locationName = location.name
    } catch (e) {
      console.error('[NpcEditDialog] Failed to get maps with area:', e)
    }
  }

  // Track maps where location is not present (marker placed in center)
  const mapsWithoutLocation: string[] = []

  // Get all maps to know their names for warning message
  let allMaps: Array<{ id: number; name: string }> = []
  try {
    allMaps = await $fetch<Array<{ id: number; name: string }>>('/api/maps', {
      query: { campaignId: campaignStore.activeCampaignId },
    })
  } catch (e) {
    console.error('[NpcEditDialog] Failed to get maps:', e)
  }

  for (const mapId of mapIds) {
    try {
      // Check if this map has an area for the location
      const areaInfo = mapsWithArea.find((m) => m.map_id === mapId)

      if (areaInfo) {
        // Place marker inside the location circle (finds free spot automatically)
        // This API creates OR updates the marker position
        await $fetch(`/api/maps/${mapId}/place-in-area`, {
          method: 'POST',
          body: {
            entity_id: entityId,
            area_id: areaInfo.area_id,
          },
        })
      } else {
        // No area for this location on this map
        // Check if marker already exists
        const existingMarkers = await $fetch<Array<{ id: number }>>(`/api/maps/${mapId}/markers`, {
          query: { entityId },
        })

        if (existingMarkers.length === 0) {
          // Create a new marker at a default position (center of map)
          await $fetch(`/api/maps/${mapId}/markers`, {
            method: 'POST',
            body: {
              entity_id: entityId,
              x: 50,
              y: 50,
            },
          })
        }

        // Track this map for warning (location is not on this map)
        // Show warning for both new and existing markers
        if (locationId) {
          const mapInfo = allMaps.find((m) => m.id === mapId)
          if (mapInfo) {
            mapsWithoutLocation.push(mapInfo.name)
          }
        }
      }
    } catch (e) {
      console.error(`[NpcEditDialog] Failed to sync to map ${mapId}:`, e)
    }
  }

  // Show warning if location was not found on some maps
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
// Relation Management
// ============================================================================
async function addNpcRelation(payload: { npcId: number; relationType: string; notes?: string }) {
  if (!npc.value) return

  addingRelation.value = true
  try {
    await $fetch(`/api/npcs/${npc.value.id}/relations`, {
      method: 'POST',
      body: {
        toEntityId: payload.npcId,
        relationType: payload.relationType,
        notes: payload.notes ? { text: payload.notes } : undefined,
      },
    })
    await loadRelations(npc.value.id)
    await loadCounts(npc.value.id)
    // Also update the other NPC's counts in the store (for card badges)
    entitiesStore.loadNpcCounts(payload.npcId)
  } catch (e) {
    console.error('[NpcEditDialog] Failed to add relation:', e)
  } finally {
    addingRelation.value = false
  }
}

async function addMembership(payload: { factionId: number; relationType: string; rank?: string }) {
  if (!npc.value) return

  addingMembership.value = true
  try {
    await $fetch('/api/entity-relations', {
      method: 'POST',
      body: {
        fromEntityId: npc.value.id,
        toEntityId: payload.factionId,
        relationType: payload.relationType,
        notes: payload.rank ? JSON.stringify({ rank: payload.rank }) : null,
      },
    })
    await loadRelations(npc.value.id)
    await loadCounts(npc.value.id)
  } catch (e) {
    console.error('[NpcEditDialog] Failed to add membership:', e)
  } finally {
    addingMembership.value = false
  }
}

async function updateMembership(payload: { membershipId: number; relationType: string; rank?: string }) {
  if (!npc.value) return

  try {
    await $fetch(`/api/entity-relations/${payload.membershipId}`, {
      method: 'PATCH',
      body: {
        relationType: payload.relationType,
        notes: payload.rank ? JSON.stringify({ rank: payload.rank }) : null,
      },
    })
    await loadRelations(npc.value.id)
  } catch (e) {
    console.error('[NpcEditDialog] Failed to update membership:', e)
  }
}

async function removeMembership(id: number) {
  if (!npc.value) return

  try {
    await $fetch(`/api/entity-relations/${id}`, {
      method: 'DELETE',
    })
    await loadRelations(npc.value.id)
    await loadCounts(npc.value.id)
  } catch (e) {
    console.error('[NpcEditDialog] Failed to remove membership:', e)
  }
}

async function removeNpcRelation(id: number) {
  if (!npc.value) return

  // Find the other NPC's ID before deleting
  const relation = npcRelations.value.find((r) => r.id === id)
  const otherNpcId = relation?.related_npc_id

  try {
    await $fetch(`/api/entity-relations/${id}`, {
      method: 'DELETE',
    })
    await loadRelations(npc.value.id)
    await loadCounts(npc.value.id)
    // Also update the other NPC's counts in the store (for card badges)
    if (otherNpcId) {
      entitiesStore.loadNpcCounts(otherNpcId)
    }
  } catch (e) {
    console.error('[NpcEditDialog] Failed to remove NPC relation:', e)
  }
}

async function updateNpcRelation(payload: { relationId: number; relationType: string; notes?: string }) {
  if (!npc.value) return

  try {
    await $fetch(`/api/entity-relations/${payload.relationId}`, {
      method: 'PATCH',
      body: {
        relationType: payload.relationType,
        notes: payload.notes ? JSON.stringify({ text: payload.notes }) : null,
      },
    })
    await loadRelations(npc.value.id)
  } catch (e) {
    console.error('[NpcEditDialog] Failed to update NPC relation:', e)
  }
}

async function addItem(payload: { itemId: number; relationType?: string; quantity?: number; equipped?: boolean }) {
  if (!npc.value) return

  addingItem.value = true
  try {
    await $fetch(`/api/npcs/${npc.value.id}/items`, {
      method: 'POST',
      body: {
        itemId: payload.itemId,
        relationType: payload.relationType || 'owns',
        quantity: payload.quantity,
        equipped: payload.equipped,
      },
    })
    await loadRelations(npc.value.id)
    await loadCounts(npc.value.id)
  } catch (e) {
    console.error('[NpcEditDialog] Failed to add item:', e)
  } finally {
    addingItem.value = false
  }
}

async function updateItem(payload: { relationId: number; relationType?: string; quantity?: number; equipped?: boolean }) {
  if (!npc.value) return

  try {
    await $fetch(`/api/entity-relations/${payload.relationId}`, {
      method: 'PATCH',
      body: {
        relationType: payload.relationType,
        notes: JSON.stringify({
          quantity: payload.quantity,
          equipped: payload.equipped,
        }),
      },
    })
    await loadRelations(npc.value.id)
    await loadCounts(npc.value.id)
  } catch (e) {
    console.error('[NpcEditDialog] Failed to update item:', e)
  }
}

async function removeItem(id: number) {
  if (!npc.value) return

  try {
    await $fetch(`/api/entity-relations/${id}`, {
      method: 'DELETE',
    })
    await loadRelations(npc.value.id)
    await loadCounts(npc.value.id)
  } catch (e) {
    console.error('[NpcEditDialog] Failed to remove item:', e)
  }
}

async function addLore(loreId: number) {
  if (!npc.value) return

  loadingLore.value = true
  try {
    await $fetch('/api/entity-relations', {
      method: 'POST',
      body: {
        fromEntityId: npc.value.id,
        toEntityId: loreId,
        relationType: 'knows',
      },
    })
    await loadRelations(npc.value.id)
    await loadCounts(npc.value.id)
  } catch (e) {
    console.error('[NpcEditDialog] Failed to add lore:', e)
  } finally {
    loadingLore.value = false
  }
}

async function removeLore(relationId: number) {
  if (!npc.value) return

  try {
    await $fetch(`/api/entity-relations/${relationId}`, {
      method: 'DELETE',
    })
    await loadRelations(npc.value.id)
    await loadCounts(npc.value.id)
  } catch (e) {
    console.error('[NpcEditDialog] Failed to remove lore:', e)
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
  if (!files || files.length === 0 || !npc.value) return

  uploadingImage.value = true
  try {
    const formData = new FormData()
    const file = files[0]
    if (file) {
      formData.append('image', file)
    }

    const response = await fetch(`/api/entities/${npc.value.id}/upload-image`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error('Upload failed')
    }

    await refreshNpc()
  } catch (error) {
    console.error('Failed to upload image:', error)
    alert(t('npcs.uploadImageError'))
  } finally {
    uploadingImage.value = false
    if (target) target.value = ''
  }
}

async function generateImage() {
  if (!npc.value || !form.value.name) return

  generatingImage.value = true

  try {
    const result = await $fetch<{ imageUrl: string }>('/api/ai/generate-image', {
      method: 'POST',
      body: {
        prompt: '', // Empty prompt - we pass structured data instead
        entityName: form.value.name,
        entityType: 'NPC',
        style: 'fantasy-art',
        entityData: {
          name: form.value.name,
          race: form.value.metadata.race,
          class: form.value.metadata.class,
          age: form.value.metadata.age,
          gender: form.value.metadata.gender,
          type: form.value.metadata.type,
          status: form.value.metadata.status,
          description: form.value.description,
        },
      },
    })

    if (result.imageUrl && npc.value) {
      await $fetch(`/api/entities/${npc.value.id}/set-image`, {
        method: 'POST',
        body: { imageUrl: result.imageUrl.replace('/uploads/', '') },
      })
      await refreshNpc()
    }
  } catch (error: unknown) {
    console.error('[NPC] Failed to generate image:', error)
    // Extract detailed error info from Nuxt FetchError
    let errorMessage = 'Failed to generate image'
    if (error && typeof error === 'object') {
      const fetchError = error as { data?: { message?: string }; message?: string; statusCode?: number }
      // Log full error details for debugging
      console.error('[NPC] Error details:', {
        statusCode: fetchError.statusCode,
        message: fetchError.message,
        data: fetchError.data,
      })
      // Use server message if available
      errorMessage = fetchError.data?.message || fetchError.message || errorMessage
    }
    alert(errorMessage)
  } finally {
    generatingImage.value = false
  }
}

async function deleteImage() {
  if (!npc.value?.image_url) return

  deletingImage.value = true
  try {
    await $fetch(`/api/entities/${npc.value.id}/delete-image`, { method: 'DELETE' })
    await refreshNpc()
  } catch (error) {
    console.error('Failed to delete image:', error)
    alert(t('npcs.deleteImageError'))
  } finally {
    deletingImage.value = false
  }
}

function downloadImage() {
  if (!npc.value?.image_url) return
  downloadImageFile(`/uploads/${npc.value.image_url}`, form.value.name)
}

function handleImagePreview(url: string, name: string) {
  previewImageUrl.value = url
  previewImageTitle.value = name
  showImagePreview.value = true
}

// ============================================================================
// Name Generation
// ============================================================================
async function generateName() {
  generatingName.value = true

  try {
    const context = []
    if (form.value.metadata.race) context.push(form.value.metadata.race)
    if (form.value.metadata.class) context.push(form.value.metadata.class)

    const result = await $fetch<{ name: string }>('/api/ai/generate-name', {
      method: 'POST',
      body: {
        entityType: 'NPC',
        context: context.length > 0 ? context.join(', ') : undefined,
        language: locale.value as 'de' | 'en',
      },
    })

    if (result.name) {
      form.value.name = result.name
    }
  } catch (error) {
    console.error('[NPC] Failed to generate name:', error)
  } finally {
    generatingName.value = false
  }
}

// Icon helpers imported from ~/utils/npc-icons
</script>

<style scoped>
.blur-image {
  filter: blur(4px);
  opacity: 0.6;
}
</style>
