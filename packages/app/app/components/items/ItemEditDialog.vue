<template>
  <v-dialog
    :model-value="show"
    max-width="1200"
    scrollable
    persistent
    @update:model-value="handleDialogChange"
  >
    <v-card v-if="show" class="d-flex flex-column" style="max-height: 90vh">
      <!-- Loading State -->
      <template v-if="loading">
        <v-card-text class="d-flex justify-center align-center" style="min-height: 300px">
          <v-progress-circular indeterminate color="primary" size="64" />
        </v-card-text>
      </template>

      <!-- Content -->
      <template v-else>
        <v-card-title class="d-flex align-center flex-shrink-0">
          <span>{{ item ? $t('items.edit') : $t('items.create') }}</span>
          <v-spacer />
          <SharedPinButton v-if="item?.id" :entity-id="item.id" variant="icon" />
        </v-card-title>

        <v-tabs v-if="item" v-model="activeTab" class="px-4" show-arrows>
        <v-tab value="details">
          <v-icon start>mdi-information</v-icon>
          {{ $t('items.details') }}
        </v-tab>
        <v-tab value="images">
          <v-icon start>mdi-image-multiple</v-icon>
          {{ $t('common.images') }}
          <v-badge v-if="counts.images > 0" :content="counts.images" color="primary" inline class="ml-1" />
        </v-tab>
        <v-tab value="documents">
          <v-icon start>mdi-file-document</v-icon>
          {{ $t('documents.title') }}
          <v-badge v-if="counts.documents > 0" :content="counts.documents" color="primary" inline class="ml-1" />
        </v-tab>
        <v-tab value="npcs">
          <v-icon start>mdi-account</v-icon>
          {{ $t('npcs.title') }}
          <v-badge v-if="linkedOwners.length > 0" :content="linkedOwners.length" color="primary" inline class="ml-1" />
        </v-tab>
        <v-tab value="locations">
          <v-icon start>mdi-map-marker</v-icon>
          {{ $t('items.locations') }}
          <v-badge v-if="linkedLocations.length > 0" :content="linkedLocations.length" color="primary" inline class="ml-1" />
        </v-tab>
        <v-tab value="factions">
          <v-icon start>mdi-shield-account</v-icon>
          {{ $t('factions.title') }}
          <v-badge v-if="linkedFactions.length > 0" :content="linkedFactions.length" color="primary" inline class="ml-1" />
        </v-tab>
        <v-tab value="lore">
          <v-icon start>mdi-book-open-variant</v-icon>
          {{ $t('lore.title') }}
          <v-badge v-if="linkedLore.length > 0" :content="linkedLore.length" color="primary" inline class="ml-1" />
        </v-tab>
        <v-tab value="players">
          <v-icon start>mdi-account-star</v-icon>
          {{ $t('players.title') }}
          <v-badge v-if="counts.players > 0" :content="counts.players" color="primary" inline class="ml-1" />
        </v-tab>
        </v-tabs>

        <v-card-text class="flex-grow-1 overflow-y-auto">
        <!-- Edit Mode with Tabs -->
        <v-tabs-window v-if="item" v-model="activeTab">
          <!-- Details Tab -->
          <v-tabs-window-item value="details">
            <input
              ref="fileInputRef"
              type="file"
              accept="image/*"
              style="display: none"
              @change="handleImageUpload"
            />

            <EntityImageUpload
              class="mb-4"
              :image-url="item?.image_url"
              :entity-name="form.name"
              entity-type="Item"
              :uploading="uploadingImage"
              :generating="generatingImage"
              :deleting="deletingImage"
              :has-api-key="hasApiKey"
              :generate-disabled="!form.name || uploadingImage || deletingImage || generatingImage || !hasApiKey || hasUnsavedImageChanges"
              :generate-disabled-reason="hasUnsavedImageChanges ? $t('common.saveChangesFirst') : ''"
              :avatar-size="160"
              default-icon="mdi-sword"
              @preview-image="openImagePreview"
              @upload="triggerImageUpload"
              @generate="generateImage"
              @download="downloadImage"
              @delete="deleteImage"
            />

            <v-text-field
              v-model="form.name"
              :label="$t('items.name')"
              :rules="[(v: string) => !!v || $t('items.nameRequired')]"
              variant="outlined"
              class="mb-4"
            />

            <v-textarea
              v-model="form.description"
              :label="$t('items.description')"
              variant="outlined"
              rows="3"
              class="mb-4"
            />

            <v-divider class="my-4" />

            <div class="text-h6 mb-4">{{ $t('items.metadata') }}</div>

            <v-row>
              <v-col cols="12" md="6">
                <v-select
                  v-model="form.metadata.type"
                  :items="ITEM_TYPES"
                  :label="$t('items.type')"
                  variant="outlined"
                  clearable
                >
                  <template #item="{ props: itemProps, item: selectItem }">
                    <v-list-item v-bind="itemProps" :title="$t(`items.types.${selectItem.value}`)" />
                  </template>
                  <template #selection="{ item: selectItem }">
                    {{ $t(`items.types.${selectItem.value}`) }}
                  </template>
                </v-select>
              </v-col>
              <v-col cols="12" md="6">
                <v-select
                  v-model="form.metadata.rarity"
                  :items="ITEM_RARITIES"
                  :label="$t('items.rarity')"
                  variant="outlined"
                  clearable
                >
                  <template #item="{ props: itemProps, item: selectItem }">
                    <v-list-item v-bind="itemProps" :title="$t(`items.rarities.${selectItem.value}`)" />
                  </template>
                  <template #selection="{ item: selectItem }">
                    {{ $t(`items.rarities.${selectItem.value}`) }}
                  </template>
                </v-select>
              </v-col>
            </v-row>

            <v-row>
              <v-col cols="12" md="5">
                <v-text-field
                  v-model.number="form.metadata.weight"
                  :label="$t('items.weight')"
                  :suffix="$t('items.weightUnit')"
                  variant="outlined"
                  type="number"
                  step="0.1"
                  min="0"
                />
              </v-col>
              <v-col cols="12" md="5">
                <v-tooltip :text="$t('items.valueHint')" location="top">
                  <template #activator="{ props: tooltipProps }">
                    <v-text-field
                      v-bind="tooltipProps"
                      v-model.number="form.metadata.value"
                      :label="$t('items.value')"
                      variant="outlined"
                      type="number"
                      step="0.01"
                      min="0"
                    />
                  </template>
                </v-tooltip>
              </v-col>
              <v-col cols="12" md="2">
                <v-select
                  v-model="form.metadata.currency_id"
                  :items="translatedCurrencies"
                  :label="$t('items.currency')"
                  variant="outlined"
                  item-title="displayName"
                  item-value="id"
                  density="default"
                >
                  <template #item="{ props: itemProps, item: selectItem }">
                    <v-list-item v-bind="itemProps">
                      <template #prepend>
                        <span class="font-weight-bold mr-2">{{ selectItem.raw.symbol }}</span>
                      </template>
                    </v-list-item>
                  </template>
                  <template #selection="{ item: selectItem }">
                    {{ selectItem.raw.symbol }}
                  </template>
                </v-select>
              </v-col>
            </v-row>

            <v-textarea
              v-model="form.metadata.notes"
              :label="$t('items.notes')"
              variant="outlined"
              rows="3"
            />

            <v-divider class="my-4" />

            <!-- Current Location with Map Sync -->
            <LocationSelectWithMap
              v-model="form.location_id"
              :label="$t('items.currentLocation')"
              @update:map-sync="mapSyncData = $event"
            />
          </v-tabs-window-item>

          <!-- Images Tab -->
          <v-tabs-window-item value="images">
            <EntityImageGallery
              v-if="item"
              :entity-id="item.id"
              :entity-name="form.name"
              entity-type="Item"
              :generate-disabled="hasUnsavedImageChanges"
              :generate-disabled-reason="hasUnsavedImageChanges ? $t('common.saveChangesFirst') : ''"
              @images-updated="loadCounts(item!.id)"
              @preview-image="openImagePreview"
              @generating="generatingImage = $event"
            />
          </v-tabs-window-item>

          <!-- Documents Tab -->
          <v-tabs-window-item value="documents">
            <EntityDocuments
              v-if="item"
              :entity-id="item.id"
              entity-type="Item"
              @changed="loadCounts(item!.id)"
            />
          </v-tabs-window-item>

          <!-- NPCs Tab -->
          <v-tabs-window-item value="npcs">
            <div class="mb-4 mt-4">
              <v-row align="center">
                <v-col cols="12" md="4">
                  <v-autocomplete
                    v-model="newOwner.npcId"
                    :items="availableOwners"
                    :label="$t('items.selectNpc')"
                    variant="outlined"
                    item-title="name"
                    item-value="id"
                    clearable
                  />
                </v-col>
                <v-col cols="12" md="4">
                  <v-select
                    v-model="newOwner.relationType"
                    :items="npcRelationTypeOptions"
                    :label="$t('items.ownerRelationType')"
                    variant="outlined"
                    item-title="title"
                    item-value="value"
                  />
                </v-col>
                <v-col cols="12" md="2">
                  <v-text-field
                    v-model.number="newOwner.quantity"
                    :label="$t('items.quantity')"
                    variant="outlined"
                    type="number"
                    min="1"
                  />
                </v-col>
                <v-col cols="12" md="2">
                  <v-btn
                    color="primary"
                    block
                    :disabled="!newOwner.npcId || !newOwner.relationType"
                    :loading="addingOwner"
                    @click="addOwner"
                  >
                    {{ $t('common.add') }}
                  </v-btn>
                </v-col>
              </v-row>
            </div>

            <v-divider class="my-4" />

            <v-empty-state
              v-if="linkedOwners.length === 0"
              icon="mdi-account-off"
              :title="$t('items.noOwners')"
            />

            <v-list v-else>
              <v-list-item
                v-for="owner in linkedOwners"
                :key="owner.id"
                :prepend-avatar="owner.image_url ? `/uploads/${owner.image_url}` : undefined"
              >
                <template v-if="!owner.image_url" #prepend>
                  <v-avatar color="grey-lighten-2">
                    <v-icon>mdi-account</v-icon>
                  </v-avatar>
                </template>

                <v-list-item-title>{{ owner.name }}</v-list-item-title>
                <v-list-item-subtitle>
                  <v-chip size="small" color="primary" variant="outlined" class="mr-2">
                    {{ $t(`items.ownerRelationTypes.${owner.relation_type}`, owner.relation_type) }}
                  </v-chip>
                  <span v-if="owner.quantity && owner.quantity > 1">
                    {{ $t('items.quantity') }}: {{ owner.quantity }}
                  </span>
                  <span v-if="owner.equipped" class="ml-2">| {{ $t('items.equipped') }}</span>
                </v-list-item-subtitle>

                <template #append>
                  <v-btn
                    icon="mdi-delete"
                    variant="text"
                    color="error"
                    size="small"
                    @click="removeOwner(owner.id)"
                  />
                </template>
              </v-list-item>
            </v-list>
          </v-tabs-window-item>

          <!-- Locations Tab -->
          <v-tabs-window-item value="locations">
            <div class="mb-4">
              <v-row align="center">
                <v-col cols="12" md="6">
                  <v-autocomplete
                    v-model="newLocation.locationId"
                    :items="availableLocations"
                    :label="$t('items.selectLocation')"
                    variant="outlined"
                    item-title="name"
                    item-value="id"
                    clearable
                  />
                </v-col>
                <v-col cols="12" md="4">
                  <v-text-field
                    v-model.number="newLocation.quantity"
                    :label="$t('items.quantity')"
                    variant="outlined"
                    type="number"
                    min="1"
                  />
                </v-col>
                <v-col cols="12" md="2">
                  <v-btn
                    color="primary"
                    block
                    :disabled="!newLocation.locationId || !newLocation.quantity"
                    :loading="addingLocation"
                    @click="addLocation"
                  >
                    {{ $t('common.add') }}
                  </v-btn>
                </v-col>
              </v-row>
            </div>

            <v-divider class="my-4" />

            <v-empty-state
              v-if="linkedLocations.length === 0"
              icon="mdi-map-marker-off"
              :title="$t('items.noLocations')"
            />

            <v-list v-else>
              <v-list-item
                v-for="loc in linkedLocations"
                :key="loc.id"
                :prepend-avatar="loc.image_url ? `/uploads/${loc.image_url}` : undefined"
              >
                <template v-if="!loc.image_url" #prepend>
                  <v-avatar color="grey-lighten-2">
                    <v-icon>mdi-map-marker</v-icon>
                  </v-avatar>
                </template>

                <v-list-item-title>{{ loc.name }}</v-list-item-title>
                <v-list-item-subtitle>
                  {{ $t('items.quantity') }}: {{ loc.quantity ?? 1 }}
                </v-list-item-subtitle>

                <template #append>
                  <v-btn
                    icon="mdi-delete"
                    variant="text"
                    color="error"
                    size="small"
                    @click="removeLocation(loc.id)"
                  />
                </template>
              </v-list-item>
            </v-list>
          </v-tabs-window-item>

          <!-- Factions Tab -->
          <v-tabs-window-item value="factions">
            <div class="mb-4">
              <v-row align="center">
                <v-col cols="12" md="8">
                  <v-autocomplete
                    v-model="newFaction.factionId"
                    :items="availableFactions"
                    :label="$t('items.selectFaction')"
                    variant="outlined"
                    item-title="name"
                    item-value="id"
                    clearable
                  />
                </v-col>
                <v-col cols="12" md="4">
                  <v-btn
                    color="primary"
                    block
                    :disabled="!newFaction.factionId"
                    :loading="addingFaction"
                    @click="addFaction"
                  >
                    {{ $t('common.add') }}
                  </v-btn>
                </v-col>
              </v-row>
            </div>

            <v-divider class="my-4" />

            <v-empty-state
              v-if="linkedFactions.length === 0"
              icon="mdi-shield-account-outline"
              :title="$t('items.noFactions')"
            />

            <v-list v-else>
              <v-list-item
                v-for="faction in linkedFactions"
                :key="faction.id"
                :prepend-avatar="faction.image_url ? `/uploads/${faction.image_url}` : undefined"
              >
                <template v-if="!faction.image_url" #prepend>
                  <v-avatar color="grey-lighten-2">
                    <v-icon>mdi-shield-account</v-icon>
                  </v-avatar>
                </template>

                <v-list-item-title>{{ faction.name }}</v-list-item-title>
                <v-list-item-subtitle v-if="faction.description">
                  {{ faction.description }}
                </v-list-item-subtitle>

                <template #append>
                  <v-btn
                    icon="mdi-delete"
                    variant="text"
                    color="error"
                    size="small"
                    @click="removeFaction(faction.id)"
                  />
                </template>
              </v-list-item>
            </v-list>
          </v-tabs-window-item>

          <!-- Lore Tab -->
          <v-tabs-window-item value="lore">
            <EntityLoreTab
              :linked-lore="linkedLore"
              :available-lore="availableLore"
              :loading="addingLore"
              @add="addLore"
              @remove="removeLore"
            />
          </v-tabs-window-item>

          <!-- Players Tab -->
          <v-tabs-window-item value="players">
            <EntityPlayersTab
              v-if="item"
              :entity-id="item.id"
              @changed="loadCounts(item!.id)"
            />
          </v-tabs-window-item>
        </v-tabs-window>

          <!-- Create Mode (no tabs) -->
          <div v-else>
          <v-text-field
            v-model="form.name"
            :label="$t('items.name')"
            :rules="[(v: string) => !!v || $t('items.nameRequired')]"
            variant="outlined"
            class="mb-4"
          />

          <v-textarea
            v-model="form.description"
            :label="$t('items.description')"
            variant="outlined"
            rows="3"
            class="mb-4"
          />

          <v-row>
            <v-col cols="12" md="6">
              <v-select
                v-model="form.metadata.type"
                :items="ITEM_TYPES"
                :label="$t('items.type')"
                variant="outlined"
                clearable
              >
                <template #item="{ props: itemProps, item: selectItem }">
                  <v-list-item v-bind="itemProps" :title="$t(`items.types.${selectItem.value}`)" />
                </template>
                <template #selection="{ item: selectItem }">
                  {{ $t(`items.types.${selectItem.value}`) }}
                </template>
              </v-select>
            </v-col>
            <v-col cols="12" md="6">
              <v-select
                v-model="form.metadata.rarity"
                :items="ITEM_RARITIES"
                :label="$t('items.rarity')"
                variant="outlined"
                clearable
              >
                <template #item="{ props: itemProps, item: selectItem }">
                  <v-list-item v-bind="itemProps" :title="$t(`items.rarities.${selectItem.value}`)" />
                </template>
                <template #selection="{ item: selectItem }">
                  {{ $t(`items.rarities.${selectItem.value}`) }}
                </template>
              </v-select>
            </v-col>
          </v-row>
          </div>
        </v-card-text>

        <v-card-actions class="flex-shrink-0">
          <v-spacer />
          <v-btn variant="text" :disabled="saving || uploadingImage || deletingImage || generatingImage" @click="close">
            {{ $t('common.cancel') }}
          </v-btn>
          <!-- Save button with wrapper for tooltip on disabled state -->
          <div class="d-inline-block">
            <v-btn
              color="primary"
              :loading="saving"
              :disabled="!form.name || uploadingImage || deletingImage || generatingImage || hasDirtyTabs"
              @click="save"
            >
              {{ item ? $t('common.save') : $t('common.create') }}
            </v-btn>
            <v-tooltip v-if="hasDirtyTabs" activator="parent" location="top">
              {{ $t('common.unsavedTabChanges', { tabs: dirtyTabLabels.join(', ') }) }}
            </v-tooltip>
          </div>
        </v-card-actions>
      </template>
    </v-card>

    <!-- Image Preview Dialog -->
    <ImagePreviewDialog
      v-model="showImagePreview"
      :image-url="previewImageUrl"
      :title="previewImageTitle"
      :download-file-name="previewImageTitle"
    />
  </v-dialog>
</template>

<script setup lang="ts">
import type { Item, ItemMetadata } from '~~/types/item'
import { ITEM_TYPES, ITEM_RARITIES } from '~~/types/item'
import { NPC_ITEM_RELATION_TYPES } from '~~/types/npc'
import EntityDocuments from '~/components/shared/EntityDocuments.vue'
import EntityImageGallery from '~/components/shared/EntityImageGallery.vue'
import EntityImageUpload from '~/components/shared/EntityImageUpload.vue'
import EntityPlayersTab from '~/components/shared/EntityPlayersTab.vue'
import EntityLoreTab from '~/components/shared/EntityLoreTab.vue'
import ImagePreviewDialog from '~/components/shared/ImagePreviewDialog.vue'
import LocationSelectWithMap from '~/components/shared/LocationSelectWithMap.vue'
import { useEntitiesStore } from '~/stores/entities'
import { useCampaignStore } from '~/stores/campaign'
import { useSnackbarStore } from '~/stores/snackbar'
import { useDialogDirtyStateProvider } from '~/composables/useDialogDirtyState'

// ============================================================================
// Interfaces
// ============================================================================
interface LinkedOwner {
  id: number // relation_id
  entity_id: number
  name: string
  description?: string | null
  image_url?: string | null
  relation_type: string
  quantity?: number | null
  equipped?: boolean | null
}

interface LinkedLocation {
  id: number // relation_id
  entity_id: number
  name: string
  description?: string | null
  image_url?: string | null
  quantity?: number | null
}

interface LinkedFaction {
  id: number // relation_id
  entity_id: number
  name: string
  description?: string | null
  image_url?: string | null
}

interface LinkedLoreItem {
  id: number // relation_id
  entity_id: number
  name: string
  description?: string | null
  image_url?: string | null
}

interface Currency {
  id: number
  campaign_id: number
  code: string
  name: string
  symbol: string | null
  exchange_rate: number
  is_default: number
}

// Default currency keys that have translations
const DEFAULT_CURRENCY_KEYS = ['copper', 'silver', 'gold', 'platinum']

interface ApiRelatedEntity {
  id: number
  from_entity_id: number
  to_entity_id: number
  name: string
  description: string | null
  image_url: string | null
  relation_type: string
  notes: { quantity?: number; equipped?: boolean } | null
  direction: 'outgoing' | 'incoming'
}

interface ItemForm {
  name: string
  description: string | null
  location_id: number | null
  metadata: ItemMetadata
}

// ============================================================================
// Props & Emits
// ============================================================================
const props = defineProps<{
  show: boolean
  itemId?: number | null
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  saved: [item: Item]
  created: [item: Item]
}>()

// ============================================================================
// Composables & Stores
// ============================================================================
const { t } = useI18n()
const entitiesStore = useEntitiesStore()
const campaignStore = useCampaignStore()
const snackbarStore = useSnackbarStore()

// Dirty state management for tabs
const { hasDirtyTabs, dirtyTabLabels, setDirty } = useDialogDirtyStateProvider()

// ============================================================================
// State
// ============================================================================
const item = ref<Item | null>(null)
const loading = ref(false)
const saving = ref(false)
const activeTab = ref('details')

const form = ref<ItemForm>({
  name: '',
  description: null,
  location_id: null,
  metadata: {
    type: null,
    rarity: null,
    weight: null,
    value: null,
    currency_id: null,
    notes: undefined,
  },
})

// Map sync data (from LocationSelectWithMap)
const mapSyncData = ref<{ locationId: number | null; mapIds: number[] } | null>(null)

const counts = ref({
  images: 0,
  documents: 0,
  players: 0,
})

// Currencies
const currencies = ref<Currency[]>([])

// Translated currencies for display
const translatedCurrencies = computed(() => {
  return currencies.value.map((c) => ({
    ...c,
    displayName: DEFAULT_CURRENCY_KEYS.includes(c.name)
      ? t(`campaigns.currencies.defaults.${c.name}`)
      : c.name,
  }))
})

// Linked entities
const linkedOwners = ref<LinkedOwner[]>([])
const linkedLocations = ref<LinkedLocation[]>([])
const linkedFactions = ref<LinkedFaction[]>([])
const linkedLore = ref<LinkedLoreItem[]>([])

// Available entities for dropdowns (sorted alphabetically)
const availableOwners = computed(() => {
  const linkedIds = new Set(linkedOwners.value.map((o) => o.entity_id))
  return (entitiesStore.npcs || [])
    .filter((npc) => !linkedIds.has(npc.id))
    .map((npc) => ({ id: npc.id, name: npc.name }))
    .sort((a, b) => a.name.localeCompare(b.name))
})

const availableLocations = computed(() => {
  const linkedIds = new Set(linkedLocations.value.map((l) => l.entity_id))
  return (entitiesStore.locations || [])
    .filter((loc) => !linkedIds.has(loc.id))
    .map((loc) => ({ id: loc.id, name: loc.name }))
    .sort((a, b) => a.name.localeCompare(b.name))
})

const availableFactions = computed(() => {
  const linkedIds = new Set(linkedFactions.value.map((f) => f.entity_id))
  return (entitiesStore.factions || [])
    .filter((f) => !linkedIds.has(f.id))
    .map((f) => ({ id: f.id, name: f.name }))
    .sort((a, b) => a.name.localeCompare(b.name))
})

const availableLore = computed(() => {
  const linkedIds = new Set(linkedLore.value.map((l) => l.entity_id))
  return (entitiesStore.lore || [])
    .filter((l) => !linkedIds.has(l.id))
    .map((l) => ({ id: l.id, name: l.name }))
    .sort((a, b) => a.name.localeCompare(b.name))
})

// New relation forms
const newOwner = ref({ npcId: null as number | null, relationType: 'owns' as string, quantity: 1 })

// Computed: NPC relation type options for dropdown
const npcRelationTypeOptions = computed(() =>
  NPC_ITEM_RELATION_TYPES.map((type) => ({
    value: type,
    title: t(`items.ownerRelationTypes.${type}`, type),
  })),
)
const newLocation = ref({ locationId: null as number | null, quantity: 1 })
const newFaction = ref({ factionId: null as number | null })

// Track dirty state for inline tabs (NPCs, Locations, Factions)
// These tabs have forms directly in this component, not in separate tab components
const npcsTabDirty = computed(() => !!newOwner.value.npcId)
const locationsTabDirty = computed(() => !!newLocation.value.locationId)
const factionsTabDirty = computed(() => !!newFaction.value.factionId)

// Register and update dirty state for inline tabs
watch(npcsTabDirty, (dirty) => setDirty('npcsTab', dirty), { immediate: true })
watch(locationsTabDirty, (dirty) => setDirty('locationsTab', dirty), { immediate: true })
watch(factionsTabDirty, (dirty) => setDirty('factionsTab', dirty), { immediate: true })

// Loading states for relation operations
const addingOwner = ref(false)
const addingLocation = ref(false)
const addingFaction = ref(false)
const addingLore = ref(false)

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
  rarity: undefined as string | undefined,
})

// Check if image-critical fields have unsaved changes
const hasUnsavedImageChanges = computed(() => {
  return (
    form.value.name !== originalImageData.value.name ||
    (form.value.description || '') !== originalImageData.value.description ||
    (form.value.metadata.type || undefined) !== originalImageData.value.type ||
    (form.value.metadata.rarity || undefined) !== originalImageData.value.rarity
  )
})

// Image preview
const showImagePreview = ref(false)
const previewImageUrl = ref('')
const previewImageTitle = ref('')

// ============================================================================
// Watch for dialog open
// ============================================================================
watch(
  () => [props.show, props.itemId] as const,
  async ([show, itemId]) => {
    if (show) {
      await loadData(itemId)
    }
  },
  { immediate: true },
)

// ============================================================================
// Data Loading
// ============================================================================
async function loadData(itemId: number | null | undefined) {
  loading.value = true
  activeTab.value = 'details'

  try {
    await loadStoreData()

    if (itemId) {
      await loadItem(itemId)
      await loadRelations(itemId)
      await loadCounts(itemId)
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
    entitiesStore.fetchItems(campaignId),
    entitiesStore.fetchNPCs(campaignId),
    entitiesStore.fetchLocations(campaignId),
    entitiesStore.fetchFactions(campaignId),
    entitiesStore.fetchLore(campaignId),
    entitiesStore.fetchPlayers(campaignId),
  ])

  // Load currencies for the campaign
  try {
    currencies.value = await $fetch<Currency[]>('/api/currencies', {
      query: { campaignId },
    })
  } catch {
    currencies.value = []
  }

  // Check API key
  try {
    const result = await $fetch<{ hasKey: boolean }>('/api/settings/openai-key/check')
    hasApiKey.value = result.hasKey
  } catch {
    hasApiKey.value = false
  }
}

async function loadItem(itemId: number) {
  try {
    const data = await $fetch<Item>(`/api/items/${itemId}`)
    item.value = data

    // If no currency_id set, use the default currency for this campaign
    let currencyId = data.metadata?.currency_id || null
    if (!currencyId) {
      const defaultCurrency = currencies.value.find((c) => c.is_default === 1)
      currencyId = defaultCurrency?.id || null
    }

    form.value = {
      name: data.name,
      description: data.description || null,
      location_id: data.location_id || null,
      metadata: {
        type: data.metadata?.type || null,
        rarity: data.metadata?.rarity || null,
        weight: data.metadata?.weight || null,
        value: data.metadata?.value || null,
        currency_id: currencyId,
        notes: data.metadata?.notes || undefined,
      },
    }

    // Save snapshot of image-critical fields
    originalImageData.value = {
      name: data.name,
      description: data.description || '',
      type: data.metadata?.type || undefined,
      rarity: data.metadata?.rarity || undefined,
    }
  } catch (e) {
    console.error('[ItemEditDialog] Failed to load item:', e)
  }
}

async function loadRelations(itemId: number) {
  try {
    const [ownersRaw, locationsRaw, factionsRaw, loreRaw] = await Promise.all([
      $fetch<ApiRelatedEntity[]>(`/api/entities/${itemId}/related/npcs`),
      $fetch<ApiRelatedEntity[]>(`/api/entities/${itemId}/related/locations`),
      $fetch<ApiRelatedEntity[]>(`/api/entities/${itemId}/related/factions`),
      $fetch<ApiRelatedEntity[]>(`/api/entities/${itemId}/related/lore`),
    ])

    linkedOwners.value = ownersRaw.map((o) => ({
      id: o.id,
      entity_id: o.direction === 'outgoing' ? o.to_entity_id : o.from_entity_id,
      name: o.name,
      description: o.description,
      image_url: o.image_url,
      relation_type: o.relation_type || 'owns',
      quantity: o.notes?.quantity,
      equipped: o.notes?.equipped,
    }))

    linkedLocations.value = locationsRaw.map((l) => ({
      id: l.id,
      entity_id: l.direction === 'outgoing' ? l.to_entity_id : l.from_entity_id,
      name: l.name,
      description: l.description,
      image_url: l.image_url,
      quantity: l.notes?.quantity,
    }))

    linkedFactions.value = factionsRaw.map((f) => ({
      id: f.id,
      entity_id: f.direction === 'outgoing' ? f.to_entity_id : f.from_entity_id,
      name: f.name,
      description: f.description,
      image_url: f.image_url,
    }))

    linkedLore.value = loreRaw.map((l) => ({
      id: l.id,
      entity_id: l.direction === 'outgoing' ? l.to_entity_id : l.from_entity_id,
      name: l.name,
      description: l.description,
      image_url: l.image_url,
    }))
  } catch (e) {
    console.error('[ItemEditDialog] Failed to load relations:', e)
  }
}

async function loadCounts(itemId: number) {
  try {
    const data = await $fetch<{ images: number; documents: number; players: number }>(`/api/items/${itemId}/counts`)
    counts.value = data
  } catch (e) {
    console.error('[ItemEditDialog] Failed to load counts:', e)
  }
}

function resetForm() {
  item.value = null

  // Set default currency
  const defaultCurrency = currencies.value.find((c) => c.is_default === 1)

  form.value = {
    name: '',
    description: null,
    location_id: null,
    metadata: {
      type: null,
      rarity: null,
      weight: null,
      value: null,
      currency_id: defaultCurrency?.id || null,
      notes: undefined,
    },
  }
  mapSyncData.value = null
  counts.value = { images: 0, documents: 0, players: 0 }
  linkedOwners.value = []
  linkedLocations.value = []
  linkedFactions.value = []
  linkedLore.value = []
  newOwner.value = { npcId: null, relationType: 'owns', quantity: 1 }
  newLocation.value = { locationId: null, quantity: 1 }
  newFaction.value = { factionId: null }
}

// ============================================================================
// Dialog Actions
// ============================================================================
function handleDialogChange(value: boolean) {
  if (!value) {
    close()
  }
}

function close() {
  resetForm()
  emit('update:show', false)
}

async function save() {
  if (!form.value.name) return

  saving.value = true

  try {
    const campaignId = campaignStore.activeCampaignId
    if (!campaignId) throw new Error('No active campaign')

    if (item.value) {
      // Update existing
      const updated = await $fetch<Item>(`/api/items/${item.value.id}`, {
        method: 'PATCH',
        body: {
          name: form.value.name,
          description: form.value.description,
          location_id: form.value.location_id,
          metadata: form.value.metadata,
        },
      })

      // Handle map sync if enabled
      if (mapSyncData.value && mapSyncData.value.locationId && mapSyncData.value.mapIds.length > 0) {
        await syncToMaps(item.value.id, mapSyncData.value.mapIds)
      }

      // Update store
      const index = entitiesStore.items?.findIndex((i) => i.id === item.value!.id)
      if (index !== undefined && index !== -1 && entitiesStore.items) {
        entitiesStore.items[index] = { ...entitiesStore.items[index], ...updated }
      }

      emit('saved', updated)
    } else {
      // Create new
      const created = await $fetch<Item>('/api/items', {
        method: 'POST',
        body: {
          name: form.value.name,
          description: form.value.description,
          location_id: form.value.location_id,
          metadata: form.value.metadata,
          campaignId,
        },
      })

      // Handle map sync if enabled
      if (mapSyncData.value && mapSyncData.value.locationId && mapSyncData.value.mapIds.length > 0) {
        await syncToMaps(created.id, mapSyncData.value.mapIds)
      }

      entitiesStore.items?.push(created)
      emit('created', created)
    }

    close()
  } catch (e) {
    console.error('[ItemEditDialog] Failed to save:', e)
  } finally {
    saving.value = false
  }
}

// Sync Item marker to selected maps - place inside location circle if available
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
      console.error('[ItemEditDialog] Failed to get maps with area:', e)
    }
  }

  const mapsWithoutLocation: string[] = []

  let allMaps: Array<{ id: number; name: string }> = []
  try {
    allMaps = await $fetch<Array<{ id: number; name: string }>>('/api/maps', {
      query: { campaignId: campaignStore.activeCampaignId },
    })
  } catch (e) {
    console.error('[ItemEditDialog] Failed to get maps:', e)
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
      console.error(`[ItemEditDialog] Failed to sync to map ${mapId}:`, e)
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
// Relation Management - Owners
// ============================================================================
async function addOwner() {
  if (!item.value || !newOwner.value.npcId || !newOwner.value.relationType) return

  addingOwner.value = true
  try {
    const createdRelation = await $fetch<{ id: number }>('/api/entity-relations', {
      method: 'POST',
      body: {
        fromEntityId: newOwner.value.npcId,
        toEntityId: item.value.id,
        relationType: newOwner.value.relationType,
        notes: { quantity: newOwner.value.quantity },
      },
    })

    const npc = entitiesStore.npcs?.find((n) => n.id === newOwner.value.npcId)
    if (npc) {
      linkedOwners.value.push({
        id: createdRelation.id,
        entity_id: npc.id,
        name: npc.name,
        description: npc.description,
        image_url: npc.image_url || null,
        relation_type: newOwner.value.relationType,
        quantity: newOwner.value.quantity,
      })
    }

    newOwner.value = { npcId: null, relationType: 'owns', quantity: 1 }
  } catch (e) {
    console.error('[ItemEditDialog] Failed to add owner:', e)
  } finally {
    addingOwner.value = false
  }
}

async function removeOwner(relationId: number) {
  if (!item.value) return

  try {
    await $fetch(`/api/entity-relations/${relationId}`, { method: 'DELETE' })
    linkedOwners.value = linkedOwners.value.filter((o) => o.id !== relationId)
  } catch (e) {
    console.error('[ItemEditDialog] Failed to remove owner:', e)
  }
}

// ============================================================================
// Relation Management - Locations
// ============================================================================
async function addLocation() {
  if (!item.value || !newLocation.value.locationId) return

  addingLocation.value = true
  try {
    const createdRelation = await $fetch<{ id: number }>('/api/entity-relations', {
      method: 'POST',
      body: {
        fromEntityId: newLocation.value.locationId,
        toEntityId: item.value.id,
        relationType: 'contains',
        notes: { quantity: newLocation.value.quantity },
      },
    })

    const loc = entitiesStore.locations?.find((l) => l.id === newLocation.value.locationId)
    if (loc) {
      linkedLocations.value.push({
        id: createdRelation.id,
        entity_id: loc.id,
        name: loc.name,
        description: loc.description,
        image_url: loc.image_url || null,
        quantity: newLocation.value.quantity,
      })
    }

    newLocation.value = { locationId: null, quantity: 1 }
  } catch (e) {
    console.error('[ItemEditDialog] Failed to add location:', e)
  } finally {
    addingLocation.value = false
  }
}

async function removeLocation(relationId: number) {
  if (!item.value) return

  try {
    await $fetch(`/api/entity-relations/${relationId}`, { method: 'DELETE' })
    linkedLocations.value = linkedLocations.value.filter((l) => l.id !== relationId)
  } catch (e) {
    console.error('[ItemEditDialog] Failed to remove location:', e)
  }
}

// ============================================================================
// Relation Management - Factions
// ============================================================================
async function addFaction() {
  if (!item.value || !newFaction.value.factionId) return

  addingFaction.value = true
  try {
    const createdRelation = await $fetch<{ id: number }>('/api/entity-relations', {
      method: 'POST',
      body: {
        fromEntityId: newFaction.value.factionId,
        toEntityId: item.value.id,
        relationType: 'possesses',
      },
    })

    const faction = entitiesStore.factions?.find((f) => f.id === newFaction.value.factionId)
    if (faction) {
      linkedFactions.value.push({
        id: createdRelation.id,
        entity_id: faction.id,
        name: faction.name,
        description: faction.description,
        image_url: faction.image_url || null,
      })
    }

    newFaction.value = { factionId: null }
  } catch (e) {
    console.error('[ItemEditDialog] Failed to add faction:', e)
  } finally {
    addingFaction.value = false
  }
}

async function removeFaction(relationId: number) {
  if (!item.value) return

  try {
    await $fetch(`/api/entity-relations/${relationId}`, { method: 'DELETE' })
    linkedFactions.value = linkedFactions.value.filter((f) => f.id !== relationId)
  } catch (e) {
    console.error('[ItemEditDialog] Failed to remove faction:', e)
  }
}

// ============================================================================
// Relation Management - Lore
// ============================================================================
async function addLore(loreId: number) {
  if (!item.value || !loreId) return

  addingLore.value = true
  try {
    const createdRelation = await $fetch<{ id: number }>('/api/entity-relations', {
      method: 'POST',
      body: {
        fromEntityId: loreId,
        toEntityId: item.value.id,
        relationType: 'references',
      },
    })

    const lore = entitiesStore.lore?.find((l) => l.id === loreId)
    if (lore) {
      linkedLore.value.push({
        id: createdRelation.id,
        entity_id: lore.id,
        name: lore.name,
        description: lore.description,
        image_url: lore.image_url || null,
      })
    }
  } catch (e) {
    console.error('[ItemEditDialog] Failed to add lore:', e)
  } finally {
    addingLore.value = false
  }
}

async function removeLore(relationId: number) {
  if (!item.value) return

  try {
    await $fetch(`/api/entity-relations/${relationId}`, { method: 'DELETE' })
    linkedLore.value = linkedLore.value.filter((l) => l.id !== relationId)
  } catch (e) {
    console.error('[ItemEditDialog] Failed to remove lore:', e)
  }
}

// ============================================================================
// Image Management
// ============================================================================
function openImagePreview(url: string, title: string) {
  previewImageUrl.value = url
  previewImageTitle.value = title
  showImagePreview.value = true
}

function triggerImageUpload() {
  fileInputRef.value?.click()
}

async function handleImageUpload(event: Event) {
  const target = event.target as HTMLInputElement
  const files = target.files
  if (!files || files.length === 0 || !item.value) return

  uploadingImage.value = true
  try {
    const formData = new FormData()
    const file = files[0]
    if (file) formData.append('image', file)

    const response = await fetch(`/api/entities/${item.value.id}/upload-image`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) throw new Error('Upload failed')

    await entitiesStore.refreshItem(item.value.id)
    await loadItem(item.value.id)
  } catch (error) {
    console.error('[ItemEditDialog] Failed to upload image:', error)
  } finally {
    uploadingImage.value = false
    if (target) target.value = ''
  }
}

async function generateImage() {
  if (!item.value || !form.value.name) return

  generatingImage.value = true
  try {
    const result = await $fetch<{ imageUrl: string }>('/api/ai/generate-image', {
      method: 'POST',
      body: {
        prompt: '', // Empty prompt - we pass structured data instead
        entityName: form.value.name,
        entityType: 'Item',
        style: 'fantasy-art',
        entityData: {
          name: form.value.name,
          type: form.value.metadata.type,
          rarity: form.value.metadata.rarity,
          material: form.value.metadata.material,
          description: form.value.description,
        },
      },
    })

    if (result.imageUrl) {
      await $fetch(`/api/entities/${item.value.id}/add-generated-image`, {
        method: 'POST',
        body: { imageUrl: result.imageUrl.replace('/uploads/', '') },
      })

      await entitiesStore.refreshItem(item.value.id)
      await loadItem(item.value.id)
    }
  } catch (error) {
    console.error('[ItemEditDialog] Failed to generate image:', error)
  } finally {
    generatingImage.value = false
  }
}

async function deleteImage() {
  if (!item.value?.image_url) return
  if (!confirm(t('items.deleteImageConfirm'))) return

  deletingImage.value = true
  try {
    await $fetch(`/api/entities/${item.value.id}/delete-image`, { method: 'DELETE' })
    await entitiesStore.refreshItem(item.value.id)
    await loadItem(item.value.id)
  } catch (error) {
    console.error('[ItemEditDialog] Failed to delete image:', error)
  } finally {
    deletingImage.value = false
  }
}

async function downloadImage() {
  if (!item.value?.image_url) return

  try {
    const response = await fetch(`/uploads/${item.value.image_url}`)
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${form.value.name}.${item.value.image_url.split('.').pop()}`
    link.click()
    window.URL.revokeObjectURL(url)
  } catch (error) {
    console.error('[ItemEditDialog] Failed to download image:', error)
  }
}
</script>
