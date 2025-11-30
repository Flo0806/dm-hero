<template>
  <v-dialog v-model="internalShow" max-width="900" scrollable>
    <v-card>
      <!-- Loading State -->
      <template v-if="loading">
        <v-card-text class="d-flex justify-center align-center" style="min-height: 300px">
          <v-progress-circular indeterminate color="primary" size="64" />
        </v-card-text>
      </template>

      <!-- Content -->
      <template v-else>
        <v-card-title>
          {{ lore ? $t('lore.edit') : $t('lore.create') }}
        </v-card-title>

        <v-tabs v-if="lore" v-model="activeTab" class="mb-4" show-arrows>
          <v-tab value="details">
            <v-icon start>mdi-book-open-variant</v-icon>
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
          <v-tab value="npcs">
            <v-icon start>mdi-account</v-icon>
            {{ $t('npcs.title') }}
            <v-chip size="x-small" class="ml-2">{{ counts.npcs }}</v-chip>
          </v-tab>
          <v-tab value="factions">
            <v-icon start>mdi-shield-account</v-icon>
            {{ $t('factions.title') }}
            <v-chip size="x-small" class="ml-2">{{ counts.factions }}</v-chip>
          </v-tab>
          <v-tab value="items">
            <v-icon start>mdi-treasure-chest</v-icon>
            {{ $t('items.title') }}
            <v-chip size="x-small" class="ml-2">{{ counts.items }}</v-chip>
          </v-tab>
          <v-tab value="locations">
            <v-icon start>mdi-map-marker</v-icon>
            {{ $t('locations.title') }}
            <v-chip size="x-small" class="ml-2">{{ counts.locations }}</v-chip>
          </v-tab>
          <v-tab value="players">
            <v-icon start>mdi-account-star</v-icon>
            {{ $t('players.title') }}
            <v-chip size="x-small" class="ml-2">{{ counts.players }}</v-chip>
          </v-tab>
        </v-tabs>

        <v-card-text style="max-height: 600px">
          <v-tabs-window v-if="lore" v-model="activeTab">
            <!-- Details Tab -->
            <v-tabs-window-item value="details">
              <v-text-field
                v-model="form.name"
                :label="$t('lore.name')"
                :rules="[(v: string) => !!v || $t('lore.nameRequired')]"
                variant="outlined"
                class="mb-4"
              />

              <v-select
                v-model="form.type"
                :label="$t('lore.type')"
                :placeholder="$t('lore.typePlaceholder')"
                :items="loreTypeItems"
                variant="outlined"
                clearable
                class="mb-4"
              />

              <v-text-field
                v-model="form.date"
                :label="$t('lore.date')"
                :placeholder="$t('lore.datePlaceholder')"
                variant="outlined"
                type="date"
                class="mb-4"
              />

              <v-textarea
                v-model="form.description"
                :label="$t('lore.description')"
                variant="outlined"
                rows="5"
                auto-grow
              />
            </v-tabs-window-item>

            <!-- Images Tab -->
            <v-tabs-window-item value="images">
              <EntityImageGallery
                v-if="lore"
                :entity-id="lore.id"
                entity-type="Lore"
                :entity-name="lore.name"
                :entity-description="lore.description || undefined"
                @preview-image="(url: string) => handleImagePreview(url, lore?.name || '')"
                @images-updated="refreshLore"
              />
            </v-tabs-window-item>

            <!-- Documents Tab -->
            <v-tabs-window-item value="documents">
              <EntityDocuments
                v-if="lore"
                :entity-id="lore.id"
                entity-type="Lore"
                @changed="refreshLore"
              />
            </v-tabs-window-item>

            <!-- NPCs Tab -->
            <v-tabs-window-item value="npcs">
              <div class="text-h6 mb-4">{{ $t('lore.linkedNpcs') }}</div>

              <v-list v-if="linkedNpcs.length > 0">
                <v-list-item v-for="npc in linkedNpcs" :key="npc.id" class="mb-2" border>
                  <template #prepend>
                    <v-avatar v-if="npc.image_url" size="40" rounded="lg">
                      <v-img :src="`/uploads/${npc.image_url}`" />
                    </v-avatar>
                    <v-icon v-else icon="mdi-account" color="primary" />
                  </template>
                  <v-list-item-title>{{ npc.name }}</v-list-item-title>
                  <v-list-item-subtitle v-if="npc.description">
                    {{ npc.description.substring(0, 100) }}{{ npc.description.length > 100 ? '...' : '' }}
                  </v-list-item-subtitle>
                  <template #append>
                    <v-btn
                      icon="mdi-delete"
                      variant="text"
                      size="small"
                      color="error"
                      @click="removeNpc(npc)"
                    />
                  </template>
                </v-list-item>
              </v-list>

              <v-empty-state
                v-else
                icon="mdi-account-off"
                :title="$t('lore.noLinkedNpcs')"
                :text="$t('lore.noLinkedNpcsText')"
              />

              <v-divider class="my-4" />

              <div class="text-h6 mb-4">{{ $t('lore.addNpc') }}</div>

              <v-autocomplete
                v-model="selectedNpcId"
                :items="availableNpcs"
                item-title="name"
                item-value="id"
                :label="$t('lore.selectNpc')"
                :placeholder="$t('lore.selectNpcPlaceholder')"
                variant="outlined"
                clearable
                class="mb-2"
              />

              <v-btn color="primary" block :disabled="!selectedNpcId" :loading="loadingNpcs" @click="addNpc">
                {{ $t('lore.linkNpc') }}
              </v-btn>
            </v-tabs-window-item>

            <!-- Factions Tab -->
            <v-tabs-window-item value="factions">
              <div class="text-h6 mb-4">{{ $t('lore.linkedFactions') }}</div>

              <v-list v-if="linkedFactions.length > 0">
                <v-list-item v-for="faction in linkedFactions" :key="faction.id" class="mb-2" border>
                  <template #prepend>
                    <v-avatar v-if="faction.image_url" size="40" rounded="lg">
                      <v-img :src="`/uploads/${faction.image_url}`" />
                    </v-avatar>
                    <v-icon v-else icon="mdi-shield-account" color="primary" />
                  </template>
                  <v-list-item-title>{{ faction.name }}</v-list-item-title>
                  <v-list-item-subtitle v-if="faction.description">
                    {{ faction.description.substring(0, 100) }}{{ faction.description.length > 100 ? '...' : '' }}
                  </v-list-item-subtitle>
                  <template #append>
                    <v-btn icon="mdi-delete" variant="text" size="small" color="error" @click="removeFaction(faction)" />
                  </template>
                </v-list-item>
              </v-list>

              <v-empty-state
                v-else
                icon="mdi-shield-off"
                :title="$t('lore.noLinkedFactions')"
                :text="$t('lore.noLinkedFactionsText')"
              />

              <v-divider class="my-4" />

              <div class="text-h6 mb-4">{{ $t('lore.addFaction') }}</div>

              <v-autocomplete
                v-model="selectedFactionId"
                :items="availableFactions"
                item-title="name"
                item-value="id"
                :label="$t('lore.selectFaction')"
                :placeholder="$t('lore.selectFactionPlaceholder')"
                variant="outlined"
                clearable
                class="mb-2"
              />

              <v-btn color="primary" block :disabled="!selectedFactionId" :loading="loadingFactions" @click="addFaction">
                {{ $t('lore.linkFaction') }}
              </v-btn>
            </v-tabs-window-item>

            <!-- Items Tab -->
            <v-tabs-window-item value="items">
              <v-autocomplete
                v-model="selectedItemId"
                :items="itemsForSelect"
                :label="$t('lore.selectItem')"
                variant="outlined"
                clearable
                class="mb-4"
              />
              <v-btn color="primary" block :disabled="!selectedItemId" :loading="loadingItems" @click="addItem">
                {{ $t('lore.linkItem') }}
              </v-btn>

              <v-list v-if="linkedItems.length > 0" class="mt-4">
                <v-list-item v-for="item in linkedItems" :key="item.id">
                  <template #prepend>
                    <v-avatar v-if="item.image_url" size="48" class="mr-3">
                      <v-img :src="`/uploads/${item.image_url}`" />
                    </v-avatar>
                    <v-avatar v-else size="48" class="mr-3" color="surface-variant">
                      <v-icon icon="mdi-treasure-chest" />
                    </v-avatar>
                  </template>
                  <v-list-item-title>{{ item.name }}</v-list-item-title>
                  <v-list-item-subtitle v-if="item.description">
                    {{ item.description.substring(0, 80) }}{{ item.description.length > 80 ? '...' : '' }}
                  </v-list-item-subtitle>
                  <template #append>
                    <v-btn icon="mdi-delete" variant="text" color="error" size="small" @click="removeItem(item)" />
                  </template>
                </v-list-item>
              </v-list>

              <v-empty-state
                v-else
                icon="mdi-treasure-chest"
                :title="$t('lore.noLinkedItems')"
                :text="$t('lore.noLinkedItemsText')"
                class="mt-4"
              />
            </v-tabs-window-item>

            <!-- Locations Tab -->
            <v-tabs-window-item value="locations">
              <v-autocomplete
                v-model="selectedLocationId"
                :items="locationsForSelect"
                :label="$t('lore.selectLocation')"
                :placeholder="$t('lore.selectLocationPlaceholder')"
                variant="outlined"
                clearable
                class="mb-4"
              />
              <v-btn color="primary" block :disabled="!selectedLocationId" :loading="loadingLocations" @click="addLocation">
                {{ $t('lore.linkLocation') }}
              </v-btn>

              <v-list v-if="linkedLocations.length > 0" class="mt-4">
                <v-list-item v-for="location in linkedLocations" :key="location.id">
                  <template #prepend>
                    <v-avatar v-if="location.image_url" size="48" class="mr-3">
                      <v-img :src="`/uploads/${location.image_url}`" />
                    </v-avatar>
                    <v-avatar v-else size="48" class="mr-3" color="surface-variant">
                      <v-icon icon="mdi-map-marker" />
                    </v-avatar>
                  </template>
                  <v-list-item-title>{{ location.name }}</v-list-item-title>
                  <v-list-item-subtitle v-if="location.description">
                    {{ location.description.substring(0, 80) }}{{ location.description.length > 80 ? '...' : '' }}
                  </v-list-item-subtitle>
                  <template #append>
                    <v-btn
                      v-if="location.direction === 'outgoing' || !location.direction"
                      icon="mdi-delete"
                      variant="text"
                      color="error"
                      size="small"
                      @click="removeLocation(location)"
                    />
                  </template>
                </v-list-item>
              </v-list>

              <v-empty-state
                v-else
                icon="mdi-map-marker"
                :title="$t('lore.noLinkedLocations')"
                :text="$t('lore.noLinkedLocationsText')"
                class="mt-4"
              />
            </v-tabs-window-item>

            <!-- Players Tab -->
            <v-tabs-window-item value="players">
              <EntityPlayersTab v-if="lore" :entity-id="lore.id" @changed="refreshLore" />
            </v-tabs-window-item>
          </v-tabs-window>

          <!-- Create Form (no tabs) -->
          <div v-if="!lore">
            <v-text-field
              v-model="form.name"
              :label="$t('lore.name')"
              :rules="[(v: string) => !!v || $t('lore.nameRequired')]"
              variant="outlined"
              class="mb-4"
            />

            <v-select
              v-model="form.type"
              :label="$t('lore.type')"
              :placeholder="$t('lore.typePlaceholder')"
              :items="loreTypeItems"
              variant="outlined"
              clearable
              class="mb-4"
            />

            <v-text-field
              v-model="form.date"
              :label="$t('lore.date')"
              :placeholder="$t('lore.datePlaceholder')"
              variant="outlined"
              type="date"
              class="mb-4"
            />

            <v-textarea
              v-model="form.description"
              :label="$t('lore.description')"
              variant="outlined"
              rows="5"
              auto-grow
            />
          </div>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="saving" @click="close">
            {{ $t('common.cancel') }}
          </v-btn>
          <v-btn color="primary" :disabled="!form.name" :loading="saving" @click="save">
            {{ lore ? $t('common.save') : $t('common.create') }}
          </v-btn>
        </v-card-actions>
      </template>
    </v-card>
  </v-dialog>

  <!-- Image Preview Dialog -->
  <ImagePreviewDialog v-model="showImagePreview" :image-url="previewImageUrl" :title="previewImageTitle" />
</template>

<script setup lang="ts">
import type { Lore } from '~~/types/lore'
import { LORE_TYPES } from '~~/types/lore'
import EntityDocuments from '~/components/shared/EntityDocuments.vue'
import EntityImageGallery from '~/components/shared/EntityImageGallery.vue'
import EntityPlayersTab from '~/components/shared/EntityPlayersTab.vue'
import ImagePreviewDialog from '~/components/shared/ImagePreviewDialog.vue'
import { useEntitiesStore } from '~/stores/entities'
import { useCampaignStore } from '~/stores/campaign'

// ============================================================================
// Props & Emits
// ============================================================================
const props = defineProps<{
  show: boolean
  loreId?: number | null
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  saved: [lore: Lore]
  created: [lore: Lore]
}>()

// ============================================================================
// Composables & Stores
// ============================================================================
const { t } = useI18n()
const entitiesStore = useEntitiesStore()
const campaignStore = useCampaignStore()

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
const lore = ref<Lore | null>(null)

// Form state
const form = ref({
  name: '',
  description: '',
  type: '' as string,
  date: '',
})

// Counts for tab badges
const counts = ref({
  npcs: 0,
  items: 0,
  factions: 0,
  locations: 0,
  players: 0,
  documents: 0,
  images: 0,
})

// Relations - API returns relation_id as 'id', entity data separately
interface LinkedEntity {
  id: number // This is the RELATION ID from the API
  from_entity_id: number
  to_entity_id: number
  name: string
  description: string | null
  image_url: string | null
  direction?: 'outgoing' | 'incoming'
}

const linkedNpcs = ref<LinkedEntity[]>([])
const linkedFactions = ref<LinkedEntity[]>([])
const linkedItems = ref<LinkedEntity[]>([])
const linkedLocations = ref<LinkedEntity[]>([])

const loadingNpcs = ref(false)
const loadingFactions = ref(false)
const loadingItems = ref(false)
const loadingLocations = ref(false)

// Selected IDs for adding
const selectedNpcId = ref<number | null>(null)
const selectedFactionId = ref<number | null>(null)
const selectedItemId = ref<number | null>(null)
const selectedLocationId = ref<number | null>(null)

// Image preview
const showImagePreview = ref(false)
const previewImageUrl = ref('')
const previewImageTitle = ref('')

// ============================================================================
// Computed: Available entities from store
// ============================================================================
const availableNpcs = computed(() =>
  entitiesStore.npcs.map((n) => ({ id: n.id, name: n.name, image_url: n.image_url })),
)

const availableFactions = computed(() =>
  entitiesStore.factions.map((f) => ({ id: f.id, name: f.name, image_url: f.image_url })),
)

const itemsForSelect = computed(() =>
  entitiesStore.items.map((i) => ({ title: i.name, value: i.id })),
)

const locationsForSelect = computed(() =>
  entitiesStore.locations.map((l) => ({ title: l.name, value: l.id })),
)

const loreTypeItems = computed(() =>
  LORE_TYPES.map((type) => ({
    title: t(`lore.types.${type}`),
    value: type,
  })),
)

// ============================================================================
// Watch: Load data when dialog opens or loreId changes
// ============================================================================
watch(
  () => [props.show, props.loreId],
  async ([show, loreId]) => {
    if (show) {
      await loadData(loreId as number | null | undefined)
    }
  },
  { immediate: true },
)

// ============================================================================
// Data Loading
// ============================================================================
async function loadData(loreId: number | null | undefined) {
  loading.value = true
  activeTab.value = 'details'

  try {
    await loadStoreData()

    if (loreId) {
      await loadLore(loreId)
      await loadRelations(loreId)
    } else {
      resetForm()
    }
  } finally {
    loading.value = false
  }
}

async function loadStoreData() {
  const campaignId = campaignStore.activeCampaignId
  if (!campaignId) return

  await Promise.all([
    entitiesStore.fetchNPCs(campaignId),
    entitiesStore.fetchFactions(campaignId),
    entitiesStore.fetchItems(campaignId),
    entitiesStore.fetchLocations(campaignId),
    entitiesStore.fetchPlayers(campaignId),
  ])
}

async function loadLore(loreId: number) {
  try {
    const data = await $fetch<Lore>(`/api/lore/${loreId}`)
    lore.value = data

    form.value = {
      name: data.name,
      description: data.description || '',
      type: data.metadata?.type || '',
      date: data.metadata?.date || '',
    }

    await loadCounts(loreId)
  } catch (e) {
    console.error('[LoreEditDialog] Failed to load lore:', e)
  }
}

async function loadCounts(loreId: number) {
  try {
    const data = await $fetch<{
      npcs: number
      items: number
      factions: number
      locations: number
      players: number
      documents: number
      images: number
    }>(`/api/lore/${loreId}/counts`)
    counts.value = data
    // Also update the store's lore counts for card badge updates (no extra fetch)
    entitiesStore.setLoreCounts(loreId, data)
  } catch (e) {
    console.error('[LoreEditDialog] Failed to load counts:', e)
  }
}

async function loadRelations(loreId: number) {
  loadingNpcs.value = true
  loadingFactions.value = true
  loadingItems.value = true
  loadingLocations.value = true

  try {
    const [npcs, factions, items, locations] = await Promise.all([
      $fetch<LinkedEntity[]>(`/api/entities/${loreId}/related/npcs`).catch(() => []),
      $fetch<LinkedEntity[]>(`/api/entities/${loreId}/related/factions`).catch(() => []),
      $fetch<LinkedEntity[]>(`/api/entities/${loreId}/related/items`).catch(() => []),
      $fetch<LinkedEntity[]>(`/api/entities/${loreId}/related/locations`).catch(() => []),
    ])

    linkedNpcs.value = npcs
    linkedFactions.value = factions
    linkedItems.value = items
    linkedLocations.value = locations
  } catch (e) {
    console.error('[LoreEditDialog] Failed to load relations:', e)
  } finally {
    loadingNpcs.value = false
    loadingFactions.value = false
    loadingItems.value = false
    loadingLocations.value = false
  }
}

async function refreshLore() {
  if (lore.value?.id) {
    await Promise.all([loadLore(lore.value.id), loadRelations(lore.value.id), loadCounts(lore.value.id)])
  }
}

function resetForm() {
  lore.value = null
  form.value = { name: '', description: '', type: '', date: '' }
  linkedNpcs.value = []
  linkedFactions.value = []
  linkedItems.value = []
  linkedLocations.value = []
  selectedNpcId.value = null
  selectedFactionId.value = null
  selectedItemId.value = null
  selectedLocationId.value = null
  counts.value = { npcs: 0, items: 0, factions: 0, locations: 0, players: 0, documents: 0, images: 0 }
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

    const metadata: Record<string, string> = {}
    if (form.value.type) metadata.type = form.value.type
    if (form.value.date) metadata.date = form.value.date

    if (lore.value) {
      // Update existing lore via store (no skeleton loader)
      const updated = await entitiesStore.updateLore(lore.value.id, {
        name: form.value.name,
        description: form.value.description || null,
        metadata: Object.keys(metadata).length > 0 ? metadata : null,
      })
      emit('saved', updated)
    } else {
      // Create new lore via store
      const created = await entitiesStore.createLore(campaignId, {
        name: form.value.name,
        description: form.value.description || null,
        metadata: Object.keys(metadata).length > 0 ? metadata : null,
      })
      // Load counts for new Lore
      await entitiesStore.loadLoreCounts(created.id)
      emit('created', created)
    }

    close()
  } catch (e) {
    console.error('[LoreEditDialog] Failed to save:', e)
  } finally {
    saving.value = false
  }
}

function close() {
  internalShow.value = false
}

// ============================================================================
// NPCs
// ============================================================================
async function addNpc() {
  if (!lore.value || !selectedNpcId.value) return

  loadingNpcs.value = true
  try {
    await $fetch('/api/entity-relations', {
      method: 'POST',
      body: { fromEntityId: selectedNpcId.value, toEntityId: lore.value.id, relationType: 'kennt' },
    })
    await loadRelations(lore.value.id)
    await loadCounts(lore.value.id)
    selectedNpcId.value = null
  } catch (e) {
    console.error('[LoreEditDialog] Failed to add NPC:', e)
  } finally {
    loadingNpcs.value = false
  }
}

async function removeNpc(npc: LinkedEntity) {
  if (!lore.value) return

  try {
    // npc.id is the relation ID from the API
    await $fetch(`/api/entity-relations/${npc.id}`, { method: 'DELETE' })
    await loadRelations(lore.value.id)
    await loadCounts(lore.value.id)
  } catch (e) {
    console.error('[LoreEditDialog] Failed to remove NPC:', e)
  }
}

// ============================================================================
// Factions
// ============================================================================
async function addFaction() {
  if (!lore.value || !selectedFactionId.value) return

  loadingFactions.value = true
  try {
    await $fetch('/api/entity-relations', {
      method: 'POST',
      body: { fromEntityId: lore.value.id, toEntityId: selectedFactionId.value, relationType: 'bezieht sich auf' },
    })
    await loadRelations(lore.value.id)
    await loadCounts(lore.value.id)
    selectedFactionId.value = null
  } catch (e) {
    console.error('[LoreEditDialog] Failed to add faction:', e)
  } finally {
    loadingFactions.value = false
  }
}

async function removeFaction(faction: LinkedEntity) {
  if (!lore.value) return

  try {
    // faction.id is the relation ID from the API
    await $fetch(`/api/entity-relations/${faction.id}`, { method: 'DELETE' })
    await loadRelations(lore.value.id)
    await loadCounts(lore.value.id)
  } catch (e) {
    console.error('[LoreEditDialog] Failed to remove faction:', e)
  }
}

// ============================================================================
// Items
// ============================================================================
async function addItem() {
  if (!lore.value || !selectedItemId.value) return

  loadingItems.value = true
  try {
    await $fetch('/api/entity-relations', {
      method: 'POST',
      body: { fromEntityId: selectedItemId.value, toEntityId: lore.value.id, relationType: 'bezieht sich auf' },
    })
    await loadRelations(lore.value.id)
    await loadCounts(lore.value.id)
    selectedItemId.value = null
  } catch (e) {
    console.error('[LoreEditDialog] Failed to add item:', e)
  } finally {
    loadingItems.value = false
  }
}

async function removeItem(item: LinkedEntity) {
  if (!lore.value) return

  try {
    // item.id is the relation ID from the API
    await $fetch(`/api/entity-relations/${item.id}`, { method: 'DELETE' })
    await loadRelations(lore.value.id)
    await loadCounts(lore.value.id)
  } catch (e) {
    console.error('[LoreEditDialog] Failed to remove item:', e)
  }
}

// ============================================================================
// Locations
// ============================================================================
async function addLocation() {
  if (!lore.value || !selectedLocationId.value) return

  loadingLocations.value = true
  try {
    await $fetch('/api/entity-relations', {
      method: 'POST',
      body: { fromEntityId: lore.value.id, toEntityId: selectedLocationId.value, relationType: 'bezieht sich auf' },
    })
    await loadRelations(lore.value.id)
    await loadCounts(lore.value.id)
    selectedLocationId.value = null
  } catch (e) {
    console.error('[LoreEditDialog] Failed to add location:', e)
  } finally {
    loadingLocations.value = false
  }
}

async function removeLocation(location: LinkedEntity) {
  if (!lore.value) return

  try {
    // location.id is the relation ID from the API
    await $fetch(`/api/entity-relations/${location.id}`, { method: 'DELETE' })
    await loadRelations(lore.value.id)
    await loadCounts(lore.value.id)
  } catch (e) {
    console.error('[LoreEditDialog] Failed to remove location:', e)
  }
}

// ============================================================================
// Image Preview
// ============================================================================
function handleImagePreview(url: string, name?: string) {
  previewImageUrl.value = url
  previewImageTitle.value = name || lore.value?.name || ''
  showImagePreview.value = true
}
</script>
