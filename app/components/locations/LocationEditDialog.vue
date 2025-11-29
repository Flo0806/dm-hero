<template>
  <v-dialog
    v-model="internalShow"
    max-width="900"
    :persistent="saving"
    scrollable
  >
    <v-card v-if="internalShow">
      <v-card-title class="d-flex align-center">
        <span>{{ location ? $t('locations.edit') : $t('locations.create') }}</span>
        <v-spacer />
        <v-btn icon variant="text" @click="close">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <!-- Loading State -->
      <v-card-text v-if="loading" class="text-center py-8">
        <v-progress-circular indeterminate size="64" color="primary" />
        <p class="mt-4">{{ $t('common.loading') }}</p>
      </v-card-text>

      <template v-else>
        <!-- Tabs (only for editing) -->
        <v-tabs v-if="location" v-model="activeTab" class="mb-4" show-arrows>
          <v-tab value="details">
            <v-icon start>mdi-map-marker-outline</v-icon>
            {{ $t('locations.details') }}
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
            <v-icon start>mdi-account-group</v-icon>
            {{ $t('npcs.title') }}
            <v-chip size="x-small" class="ml-2">{{ counts.npcs }}</v-chip>
          </v-tab>
          <v-tab value="items">
            <v-icon start>mdi-treasure-chest</v-icon>
            {{ $t('items.title') }}
            <v-chip size="x-small" class="ml-2">{{ counts.items }}</v-chip>
          </v-tab>
          <v-tab value="lore">
            <v-icon start>mdi-book-open-variant</v-icon>
            {{ $t('lore.title') }}
            <v-chip size="x-small" class="ml-2">{{ counts.lore }}</v-chip>
          </v-tab>
          <v-tab value="players">
            <v-icon start>mdi-account-star</v-icon>
            {{ $t('players.title') }}
            <v-chip size="x-small" class="ml-2">{{ counts.players }}</v-chip>
          </v-tab>
        </v-tabs>

        <v-card-text style="max-height: 600px; overflow-y: auto">
          <v-tabs-window v-if="location" v-model="activeTab">
            <!-- Details Tab -->
            <v-tabs-window-item value="details">
              <v-text-field
                v-model="form.name"
                :label="$t('locations.name')"
                :rules="[(v: string) => !!v || $t('locations.nameRequired')]"
                variant="outlined"
                class="mb-4"
              />

              <v-textarea
                v-model="form.description"
                :label="$t('locations.description')"
                variant="outlined"
                rows="4"
                class="mb-4"
              />

              <v-select
                v-model="form.parentLocationId"
                :label="$t('locations.parentLocation')"
                :items="availableParentLocations"
                item-title="name"
                item-value="id"
                variant="outlined"
                clearable
                :hint="$t('locations.parentLocationHint')"
                persistent-hint
                class="mb-4"
              />

              <v-row>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="form.metadata.type"
                    :label="$t('locations.type')"
                    variant="outlined"
                    :placeholder="$t('locations.typePlaceholder')"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="form.metadata.region"
                    :label="$t('locations.region')"
                    variant="outlined"
                  />
                </v-col>
              </v-row>

              <v-textarea
                v-model="form.metadata.notes"
                :label="$t('locations.notes')"
                variant="outlined"
                rows="3"
              />
            </v-tabs-window-item>

            <!-- Images Tab -->
            <v-tabs-window-item value="images">
              <EntityImageGallery
                v-if="location"
                :entity-id="location.id"
                entity-type="Location"
                :entity-name="location.name"
                :entity-description="location.description || undefined"
                @images-updated="loadCounts(location!.id)"
              />
            </v-tabs-window-item>

            <!-- Documents Tab -->
            <v-tabs-window-item value="documents">
              <EntityDocuments
                v-if="location"
                :entity-id="location.id"
                entity-type="Location"
                @changed="loadCounts(location!.id)"
              />
            </v-tabs-window-item>

            <!-- NPCs Tab -->
            <v-tabs-window-item value="npcs">
              <EntityNpcsTab
                :linked-npcs="linkedNpcs"
                :available-npcs="availableNpcs"
                :show-avatar="true"
                @add="addNpcRelation"
                @remove="removeNpcRelation"
              />
            </v-tabs-window-item>

            <!-- Items Tab -->
            <v-tabs-window-item value="items">
              <EntityItemsTab
                :linked-items="linkedItems"
                :available-items="availableItems"
                :show-avatar="true"
                :show-relation-type="true"
                :relation-type-suggestions="itemRelationTypeSuggestions"
                @add="addItemRelation"
                @remove="removeItemRelation"
              />
            </v-tabs-window-item>

            <!-- Lore Tab -->
            <v-tabs-window-item value="lore">
              <EntityLoreTab
                :linked-lore="linkedLore"
                :available-lore="availableLore"
                @add="addLoreRelation"
                @remove="removeLoreRelation"
              />
            </v-tabs-window-item>

            <!-- Players Tab -->
            <v-tabs-window-item value="players">
              <EntityPlayersTab
                v-if="location"
                :entity-id="location.id"
                @changed="loadCounts(location!.id)"
              />
            </v-tabs-window-item>
          </v-tabs-window>

          <!-- Create mode (no tabs) - show all details fields -->
          <div v-if="!location">
            <v-text-field
              v-model="form.name"
              :label="$t('locations.name')"
              :rules="[(v: string) => !!v || $t('locations.nameRequired')]"
              variant="outlined"
              class="mb-4"
            />

            <v-textarea
              v-model="form.description"
              :label="$t('locations.description')"
              variant="outlined"
              rows="4"
              class="mb-4"
            />

            <v-select
              v-model="form.parentLocationId"
              :label="$t('locations.parentLocation')"
              :items="availableParentLocations"
              item-title="name"
              item-value="id"
              variant="outlined"
              clearable
              :hint="$t('locations.parentLocationHint')"
              persistent-hint
              class="mb-4"
            />

            <v-row>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="form.metadata.type"
                  :label="$t('locations.type')"
                  variant="outlined"
                  :placeholder="$t('locations.typePlaceholder')"
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="form.metadata.region"
                  :label="$t('locations.region')"
                  variant="outlined"
                />
              </v-col>
            </v-row>

            <v-textarea
              v-model="form.metadata.notes"
              :label="$t('locations.notes')"
              variant="outlined"
              rows="3"
            />
          </div>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="saving" @click="close">
            {{ $t('common.cancel') }}
          </v-btn>
          <v-btn
            color="primary"
            :disabled="!form.name"
            :loading="saving"
            @click="save"
          >
            {{ location ? $t('common.save') : $t('common.create') }}
          </v-btn>
        </v-card-actions>
      </template>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import EntityDocuments from '~/components/shared/EntityDocuments.vue'
import EntityImageGallery from '~/components/shared/EntityImageGallery.vue'
import EntityPlayersTab from '~/components/shared/EntityPlayersTab.vue'
import EntityNpcsTab from '~/components/shared/EntityNpcsTab.vue'
import EntityItemsTab from '~/components/shared/EntityItemsTab.vue'
import EntityLoreTab from '~/components/shared/EntityLoreTab.vue'

interface Location {
  id: number
  name: string
  description: string | null
  image_url?: string | null
  parent_entity_id?: number | null
  metadata: {
    type?: string
    region?: string
    notes?: string
  } | null
  created_at: string
  updated_at: string
}

interface LinkedNpc {
  id: number // This is the relation_id from API
  entity_id: number // The actual NPC entity ID
  name: string
  description: string | null
  image_url: string | null
}

interface LinkedItem {
  id: number // relation_id
  entity_id: number
  name: string
  description: string | null
  image_url: string | null
  relation_type?: string
  direction?: 'outgoing' | 'incoming'
}

interface LinkedLore {
  id: number // relation_id
  entity_id: number
  name: string
  description: string | null
  image_url: string | null
}

// Props & Emits
const props = defineProps<{
  show: boolean
  locationId?: number | null
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  saved: [location: Location]
  created: [location: Location]
}>()

const { t } = useI18n()
const entitiesStore = useEntitiesStore()
const campaignStore = useCampaignStore()

// Internal state
const internalShow = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value),
})

const loading = ref(false)
const saving = ref(false)
const activeTab = ref('details')
const location = ref<Location | null>(null)

// Form state
const form = ref({
  name: '',
  description: '',
  parentLocationId: null as number | null,
  metadata: {
    type: '',
    region: '',
    notes: '',
  },
})

// Counts for tab badges
const counts = ref({
  images: 0,
  documents: 0,
  npcs: 0,
  items: 0,
  lore: 0,
  players: 0,
})

// Linked entities
const linkedNpcs = ref<LinkedNpc[]>([])
const linkedItems = ref<LinkedItem[]>([])
const linkedLore = ref<LinkedLore[]>([])

// Available entities for dropdowns (from store)
// Use entity_id to filter out already linked entities
const availableNpcs = computed(() => {
  const linkedEntityIds = new Set(linkedNpcs.value.map((n) => n.entity_id))
  return (entitiesStore.npcs || [])
    .filter((npc) => !linkedEntityIds.has(npc.id))
    .map((npc) => ({ id: npc.id, name: npc.name }))
})

const availableItems = computed(() => {
  const linkedEntityIds = new Set(linkedItems.value.map((i) => i.entity_id))
  return (entitiesStore.items || [])
    .filter((item) => !linkedEntityIds.has(item.id))
    .map((item) => ({ id: item.id, name: item.name }))
})

const availableLore = computed(() => {
  const linkedEntityIds = new Set(linkedLore.value.map((l) => l.entity_id))
  return (entitiesStore.lore || [])
    .filter((lore) => !linkedEntityIds.has(lore.id))
    .map((lore) => ({ id: lore.id, name: lore.name }))
})

const availableParentLocations = computed(() => {
  if (!entitiesStore.locations) return []
  // Exclude current location to prevent circular reference
  if (location.value) {
    return entitiesStore.locations.filter((loc) => loc.id !== location.value?.id)
  }
  return entitiesStore.locations
})

const itemRelationTypeSuggestions = computed(() => [
  { title: t('locations.itemRelationTypes.contains'), value: 'contains' },
  { title: t('locations.itemRelationTypes.hidden'), value: 'hidden' },
  { title: t('locations.itemRelationTypes.displayed'), value: 'displayed' },
  { title: t('locations.itemRelationTypes.stored'), value: 'stored' },
  { title: t('locations.itemRelationTypes.lost'), value: 'lost' },
  { title: t('locations.itemRelationTypes.guarded'), value: 'guarded' },
])

// Watch for dialog open - watch both show AND locationId together
watch(
  () => [props.show, props.locationId] as const,
  async ([show, locationId]) => {
    if (show) {
      await loadData(locationId)
    }
  },
  { immediate: true },
)

// ============================================================================
// Data Loading
// ============================================================================
async function loadData(locationId: number | null | undefined) {
  loading.value = true
  activeTab.value = 'details'

  try {
    // Load store data for dropdowns
    await loadStoreData()

    if (locationId) {
      // Edit mode: load location and relations
      await loadLocation(locationId)
      await loadRelations(locationId)
      await loadCounts(locationId)
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

  await Promise.all([
    entitiesStore.fetchLocations(campaignId),
    entitiesStore.fetchNPCs(campaignId),
    entitiesStore.fetchItems(campaignId),
    entitiesStore.fetchLore(campaignId),
    entitiesStore.fetchPlayers(campaignId),
  ])
}

async function loadLocation(locationId: number) {
  try {
    const data = await $fetch<Location>(`/api/locations/${locationId}`)
    location.value = data

    form.value = {
      name: data.name,
      description: data.description || '',
      parentLocationId: data.parent_entity_id || null,
      metadata: {
        type: data.metadata?.type || '',
        region: data.metadata?.region || '',
        notes: data.metadata?.notes || '',
      },
    }
  } catch (e) {
    console.error('[LocationEditDialog] Failed to load location:', e)
  }
}

async function loadCounts(locationId: number) {
  try {
    const data = await $fetch<{
      npcs: number
      items: number
      lore: number
      players: number
      documents: number
      images: number
    }>(`/api/locations/${locationId}/counts`)
    counts.value = data
  } catch (e) {
    console.error('[LocationEditDialog] Failed to load counts:', e)
  }
}

interface ApiRelatedEntity {
  id: number // relation_id
  from_entity_id: number
  to_entity_id: number
  name: string
  description: string | null
  image_url: string | null
  relation_type?: string
  direction: 'outgoing' | 'incoming'
}

async function loadRelations(locationId: number) {
  try {
    const [npcsRaw, itemsRaw, loreRaw] = await Promise.all([
      $fetch<ApiRelatedEntity[]>(`/api/entities/${locationId}/related/npcs`),
      $fetch<ApiRelatedEntity[]>(`/api/entities/${locationId}/related/items`),
      $fetch<ApiRelatedEntity[]>(`/api/entities/${locationId}/related/lore`),
    ])

    // Map NPCs: determine actual entity_id based on direction
    linkedNpcs.value = npcsRaw.map((npc) => ({
      id: npc.id, // relation_id
      entity_id: npc.direction === 'outgoing' ? npc.to_entity_id : npc.from_entity_id,
      name: npc.name,
      description: npc.description,
      image_url: npc.image_url,
    }))

    // Map Items: determine actual entity_id based on direction
    linkedItems.value = itemsRaw.map((item) => ({
      id: item.id, // relation_id
      entity_id: item.direction === 'outgoing' ? item.to_entity_id : item.from_entity_id,
      name: item.name,
      description: item.description,
      image_url: item.image_url,
      relation_type: item.relation_type,
    }))

    // Map Lore: determine actual entity_id based on direction
    linkedLore.value = loreRaw.map((l) => ({
      id: l.id, // relation_id
      entity_id: l.direction === 'outgoing' ? l.to_entity_id : l.from_entity_id,
      name: l.name,
      description: l.description,
      image_url: l.image_url,
    }))
  } catch (e) {
    console.error('[LocationEditDialog] Failed to load relations:', e)
  }
}

function resetForm() {
  location.value = null
  form.value = {
    name: '',
    description: '',
    parentLocationId: null,
    metadata: {
      type: '',
      region: '',
      notes: '',
    },
  }
  linkedNpcs.value = []
  linkedItems.value = []
  linkedLore.value = []
  counts.value = {
    images: 0,
    documents: 0,
    npcs: 0,
    items: 0,
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

    if (location.value) {
      // Update existing location
      const updated = await $fetch<Location>(`/api/locations/${location.value.id}`, {
        method: 'PATCH',
        body: {
          name: form.value.name,
          description: form.value.description || null,
          metadata: form.value.metadata,
          parentLocationId: form.value.parentLocationId,
        },
      })

      // Update store
      const index = entitiesStore.locations?.findIndex((l) => l.id === location.value!.id)
      if (index !== undefined && index !== -1 && entitiesStore.locations) {
        entitiesStore.locations[index] = { ...entitiesStore.locations[index], ...updated }
      }

      emit('saved', updated)
    } else {
      // Create new location
      const created = await $fetch<Location>('/api/locations', {
        method: 'POST',
        body: {
          name: form.value.name,
          description: form.value.description || null,
          metadata: form.value.metadata,
          campaignId,
          parentLocationId: form.value.parentLocationId,
        },
      })

      // Add to store
      entitiesStore.locations?.push(created)

      emit('created', created)
    }

    close()
  } catch (e) {
    console.error('[LocationEditDialog] Failed to save:', e)
  } finally {
    saving.value = false
  }
}

function close() {
  internalShow.value = false
}

// ============================================================================
// Relation Management
// ============================================================================
async function addNpcRelation(payload: { npcId: number }) {
  if (!location.value || !payload.npcId) return

  try {
    const createdRelation = await $fetch<{ id: number }>('/api/entity-relations', {
      method: 'POST',
      body: {
        fromEntityId: payload.npcId,
        toEntityId: location.value.id,
        relationType: 'befindet sich in',
      },
    })

    const npc = entitiesStore.npcs?.find((n) => n.id === payload.npcId)
    if (npc) {
      linkedNpcs.value.push({
        id: createdRelation.id, // relation_id from API
        entity_id: npc.id, // actual NPC entity ID
        name: npc.name,
        description: npc.description,
        image_url: npc.image_url || null,
      })
    }

    await loadCounts(location.value.id)
  } catch (e) {
    console.error('[LocationEditDialog] Failed to add NPC relation:', e)
  }
}

async function removeNpcRelation(relationId: number) {
  // The EntityNpcsTab emits the npc.id which is now the relation_id
  if (!location.value) {
    console.warn('[LocationEditDialog] removeNpcRelation: No location loaded')
    return
  }

  try {
    await $fetch(`/api/entity-relations/${relationId}`, { method: 'DELETE' })
    linkedNpcs.value = linkedNpcs.value.filter((n) => n.id !== relationId)
    await loadCounts(location.value.id)
  } catch (e) {
    console.error('[LocationEditDialog] Failed to remove NPC relation:', e)
  }
}

async function addItemRelation(payload: { itemId: number; relationType?: string }) {
  if (!location.value || !payload.itemId) return

  try {
    await $fetch('/api/entity-relations', {
      method: 'POST',
      body: {
        fromEntityId: location.value.id,
        toEntityId: payload.itemId,
        relationType: payload.relationType || 'contains',
      },
    })

    await loadRelations(location.value.id)
    await loadCounts(location.value.id)
  } catch (e) {
    console.error('[LocationEditDialog] Failed to add item relation:', e)
  }
}

async function removeItemRelation(relationId: number) {
  if (!location.value) return

  try {
    await $fetch(`/api/entity-relations/${relationId}`, { method: 'DELETE' })
    await loadRelations(location.value.id)
    await loadCounts(location.value.id)
  } catch (e) {
    console.error('[LocationEditDialog] Failed to remove item relation:', e)
  }
}

async function addLoreRelation(loreId: number) {
  if (!location.value || !loreId) return

  try {
    const createdRelation = await $fetch<{ id: number }>('/api/entity-relations', {
      method: 'POST',
      body: {
        fromEntityId: loreId,
        toEntityId: location.value.id,
        relationType: 'bezieht sich auf',
      },
    })

    const lore = entitiesStore.lore?.find((l) => l.id === loreId)
    if (lore) {
      linkedLore.value.push({
        id: createdRelation.id, // relation_id from API
        entity_id: lore.id, // actual Lore entity ID
        name: lore.name,
        description: lore.description,
        image_url: lore.image_url || null,
      })
    }

    await loadCounts(location.value.id)
  } catch (e) {
    console.error('[LocationEditDialog] Failed to add lore relation:', e)
  }
}

async function removeLoreRelation(relationId: number) {
  if (!location.value) return

  try {
    await $fetch(`/api/entity-relations/${relationId}`, { method: 'DELETE' })
    linkedLore.value = linkedLore.value.filter((l) => l.id !== relationId)
    await loadCounts(location.value.id)
  } catch (e) {
    console.error('[LocationEditDialog] Failed to remove lore relation:', e)
  }
}
</script>
