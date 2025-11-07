<template>
  <v-container>
    <UiPageHeader :title="$t('locations.title')" :subtitle="$t('locations.subtitle')">
      <template #actions>
        <v-btn
          color="primary"
          prepend-icon="mdi-plus"
          size="large"
          @click="showCreateDialog = true"
        >
          {{ $t('locations.create') }}
        </v-btn>
      </template>
    </UiPageHeader>

    <!-- Search Bar -->
    <v-text-field
      v-model="searchQuery"
      :placeholder="$t('common.search')"
      prepend-inner-icon="mdi-magnify"
      variant="outlined"
      clearable
      class="mb-4"
      :hint="searchQuery && searchQuery.trim().length > 0 ? $t('locations.searchHint') : ''"
      persistent-hint
    />

    <v-row v-if="pending">
      <v-col v-for="i in 6" :key="i" cols="12" md="6" lg="4">
        <v-skeleton-loader type="card" />
      </v-col>
    </v-row>

    <!-- Location Cards with Search Overlay -->
    <div v-else-if="filteredLocations && filteredLocations.length > 0" class="position-relative">
      <!-- Search Loading Overlay -->
      <v-overlay
        :model-value="searching"
        contained
        persistent
        class="align-center justify-center"
        scrim="surface"
        opacity="0.8"
      >
        <div class="text-center">
          <v-progress-circular indeterminate size="64" color="primary" class="mb-4" />
          <div class="text-h6">
            {{ $t('common.searching') }}
          </div>
        </div>
      </v-overlay>

      <!-- Tree View -->
      <v-card>
        <v-treeview
          :items="treeItems"
          item-value="id"
          item-title="title"
          density="comfortable"
          open-all
        >
          <!-- Custom item slot for icons and actions -->
          <template #prepend="{ item }">
            <v-icon :color="getNodeColor(item)">
              {{ getNodeIcon(item) }}
            </v-icon>
          </template>

          <!-- Custom title to highlight search results -->
          <template #title="{ item }">
            <span :class="{ 'text-primary font-weight-bold': item.isSearchResult }">
              {{ item.title }}
            </span>
          </template>

          <template #append="{ item }">
            <div class="d-flex align-center ga-1">
              <!-- Type chip -->
              <v-chip
                v-if="item.raw.metadata?.type"
                size="x-small"
                color="primary"
                variant="tonal"
                class="mr-2"
              >
                {{ item.raw.metadata.type }}
              </v-chip>

              <!-- Actions -->
              <v-btn
                icon="mdi-eye"
                size="x-small"
                variant="text"
                @click.stop="viewLocation(item.raw)"
              />
              <v-btn
                icon="mdi-pencil"
                size="x-small"
                variant="text"
                @click.stop="editLocation(item.raw)"
              />
              <v-btn
                icon="mdi-delete"
                size="x-small"
                variant="text"
                color="error"
                @click.stop="deleteLocation(item.raw)"
              />
            </div>
          </template>
        </v-treeview>
      </v-card>
    </div>

    <ClientOnly v-else>
      <v-empty-state
        icon="mdi-map-marker-multiple"
        :title="$t('locations.empty')"
        :text="$t('locations.emptyText')"
      >
        <template #actions>
          <v-btn color="primary" prepend-icon="mdi-plus" @click="showCreateDialog = true">
            {{ $t('locations.create') }}
          </v-btn>
        </template>
      </v-empty-state>
      <template #fallback>
        <v-container class="text-center py-16">
          <v-icon icon="mdi-map-marker-multiple" size="64" color="grey" class="mb-4" />
          <h2 class="text-h5 mb-2">{{ $t('locations.empty') }}</h2>
          <p class="text-body-1 text-medium-emphasis mb-4">{{ $t('locations.emptyText') }}</p>
          <v-btn color="primary" prepend-icon="mdi-plus" @click="showCreateDialog = true">
            {{ $t('locations.create') }}
          </v-btn>
        </v-container>
      </template>
    </ClientOnly>

    <!-- Create/Edit Dialog -->
    <v-dialog
      v-model="showCreateDialog"
      max-width="800"
      :persistent="saving || uploadingImage || generatingImage"
    >
      <v-card>
        <v-card-title>
          {{ editingLocation ? $t('locations.edit') : $t('locations.create') }}
        </v-card-title>
        <v-card-text>
          <!-- Image Upload Section (only for editing) -->
          <!-- Image Gallery -->
          <v-card v-if="editingLocation" variant="outlined" class="mb-4">
            <v-card-title class="d-flex align-center">
              <v-icon icon="mdi-image-multiple" class="mr-2" />
              Bilder
              <v-spacer />
              <v-btn
                icon="mdi-creation"
                color="primary"
                size="small"
                class="mr-2"
                :disabled="!locationForm.name || !hasApiKey || generatingImage || uploadingImage"
                :loading="generatingImage"
                @click="generateImage"
              >
                <v-icon>mdi-creation</v-icon>
                <v-tooltip activator="parent" location="bottom">
                  {{ $t('locations.generateImage') }}
                </v-tooltip>
              </v-btn>
              <v-btn
                icon="mdi-plus"
                color="primary"
                size="small"
                :disabled="uploadingImage || generatingImage"
                @click="triggerImageUpload"
              >
                <v-icon>mdi-plus</v-icon>
                <v-tooltip activator="parent" location="bottom"> Bilder hochladen </v-tooltip>
              </v-btn>
              <input
                ref="fileInputRef"
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                multiple
                style="display: none"
                @change="handleImageUpload"
              />
            </v-card-title>
            <v-card-text>
              <v-progress-linear v-if="loadingImages" indeterminate />
              <v-list v-else-if="locationImages.length > 0">
                <v-list-item v-for="image in locationImages" :key="image.id" class="mb-3">
                  <template #prepend>
                    <div class="position-relative image-container mr-3">
                      <v-avatar
                        size="80"
                        rounded="lg"
                        style="cursor: pointer"
                        @click="
                          openImagePreview(
                            `/uploads/${image.image_url}`,
                            editingLocation?.name || 'Location Image',
                          )
                        "
                      >
                        <v-img :src="`/uploads/${image.image_url}`" cover />
                      </v-avatar>
                      <v-btn
                        icon="mdi-download"
                        size="x-small"
                        variant="tonal"
                        class="image-download-btn"
                        @click.stop="
                          downloadImage(
                            `/uploads/${image.image_url}`,
                            editingLocation?.name || 'image',
                          )
                        "
                      />
                    </div>
                  </template>
                  <v-list-item-title class="mb-2">
                    <div class="d-flex align-center gap-2">
                      <v-chip v-if="image.is_primary" size="small" color="primary">
                        <v-icon start icon="mdi-star" />
                        Primär
                      </v-chip>
                      <span class="text-caption text-medium-emphasis">
                        {{ new Date(image.created_at).toLocaleDateString('de-DE') }}
                      </span>
                    </div>
                  </v-list-item-title>
                  <v-list-item-subtitle>
                    <v-text-field
                      :model-value="image.caption || ''"
                      placeholder="Beschriftung..."
                      variant="outlined"
                      density="compact"
                      hide-details
                      @blur="
                        (e: FocusEvent) =>
                          updateImageCaption(image.id, (e.target as HTMLInputElement).value)
                      "
                      @keyup.enter="(e: KeyboardEvent) => (e.target as HTMLInputElement).blur()"
                    />
                  </v-list-item-subtitle>
                  <template #append>
                    <div class="d-flex gap-1">
                      <v-btn
                        v-if="!image.is_primary"
                        icon="mdi-star-outline"
                        variant="text"
                        size="small"
                        @click="setPrimaryImage(image.id)"
                      >
                        <v-icon>mdi-star-outline</v-icon>
                        <v-tooltip activator="parent" location="bottom">
                          Als Primär setzen
                        </v-tooltip>
                      </v-btn>
                      <v-btn
                        icon="mdi-delete"
                        variant="text"
                        size="small"
                        color="error"
                        @click="deleteImageFromGallery(image.id)"
                      >
                        <v-icon>mdi-delete</v-icon>
                        <v-tooltip activator="parent" location="bottom"> Löschen </v-tooltip>
                      </v-btn>
                    </div>
                  </template>
                </v-list-item>
              </v-list>
              <v-empty-state
                v-else
                icon="mdi-image-off"
                title="Keine Bilder"
                text="Lade Bilder hoch, um sie hier zu sehen"
              />
            </v-card-text>
          </v-card>

          <v-text-field
            v-model="locationForm.name"
            :label="$t('locations.name')"
            :rules="[(v) => !!v || $t('locations.nameRequired')]"
            variant="outlined"
            class="mb-4"
          />

          <v-textarea
            v-model="locationForm.description"
            :label="$t('locations.description')"
            variant="outlined"
            rows="4"
            class="mb-4"
          />

          <!-- Parent Location Dropdown -->
          <v-select
            v-model="locationForm.parentLocationId"
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
                v-model="locationForm.metadata.type"
                :label="$t('locations.type')"
                variant="outlined"
                :placeholder="$t('locations.typePlaceholder')"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="locationForm.metadata.region"
                :label="$t('locations.region')"
                variant="outlined"
              />
            </v-col>
          </v-row>

          <v-textarea
            v-model="locationForm.metadata.notes"
            :label="$t('locations.notes')"
            variant="outlined"
            rows="3"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            :disabled="saving || uploadingImage || generatingImage"
            @click="closeDialog"
          >
            {{ $t('common.cancel') }}
          </v-btn>
          <v-btn
            color="primary"
            :disabled="!locationForm.name || uploadingImage || generatingImage"
            :loading="saving"
            @click="saveLocation"
          >
            {{ editingLocation ? $t('common.save') : $t('common.create') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- View Location Dialog -->
    <v-dialog v-model="showViewDialog" max-width="900">
      <v-card v-if="viewingLocation">
        <v-card-title class="d-flex align-center">
          <v-icon icon="mdi-map-marker" class="mr-2" />
          {{ viewingLocation.name }}
          <v-spacer />
          <v-btn icon="mdi-close" variant="text" @click="showViewDialog = false" />
        </v-card-title>
        <v-divider />
        <v-card-text>
          <!-- Breadcrumb Path -->
          <LocationBreadcrumb
            v-if="viewingLocation.parent_entity_id"
            :location-id="viewingLocation.id"
            class="mb-4"
          />

          <div v-if="viewingLocation.description" class="mb-4">
            <h3 class="text-h6 mb-2">
              {{ $t('locations.description') }}
            </h3>
            <p class="text-body-1">
              {{ viewingLocation.description }}
            </p>
          </div>

          <v-row v-if="viewingLocation.metadata" class="mb-4">
            <v-col v-if="viewingLocation.metadata.type" cols="12" md="6">
              <h4 class="text-subtitle-2 text-medium-emphasis">
                {{ $t('locations.type') }}
              </h4>
              <p>{{ viewingLocation.metadata.type }}</p>
            </v-col>
            <v-col v-if="viewingLocation.metadata.region" cols="12" md="6">
              <h4 class="text-subtitle-2 text-medium-emphasis">
                {{ $t('locations.region') }}
              </h4>
              <p>{{ viewingLocation.metadata.region }}</p>
            </v-col>
            <v-col v-if="viewingLocation.metadata.notes" cols="12">
              <h4 class="text-subtitle-2 text-medium-emphasis">
                {{ $t('locations.notes') }}
              </h4>
              <p>{{ viewingLocation.metadata.notes }}</p>
            </v-col>
          </v-row>

          <v-divider class="my-4" />

          <h3 class="text-h6 mb-3">
            {{ $t('locations.connectedNpcs') }}
          </h3>
          <v-progress-linear v-if="loadingNpcs" indeterminate />
          <v-list v-else-if="connectedNpcs && connectedNpcs.length > 0">
            <v-list-item
              v-for="npc in connectedNpcs"
              :key="npc.id"
              :title="npc.name"
              :subtitle="`${npc.relation_type}${npc.relation_notes ? ': ' + npc.relation_notes : ''}`"
            >
              <template #prepend>
                <v-icon icon="mdi-account" />
              </template>
            </v-list-item>
          </v-list>
          <p v-else class="text-body-2 text-medium-emphasis">
            {{ $t('locations.noConnectedNpcs') }}
          </p>

          <v-divider class="my-4" />

          <div class="d-flex justify-space-between align-center mb-3">
            <h3 class="text-h6">
              {{ $t('locations.items') }}
            </h3>
            <v-btn
              size="small"
              color="primary"
              prepend-icon="mdi-plus"
              @click="showAddItemForm = !showAddItemForm"
            >
              {{ $t('locations.addItem') }}
            </v-btn>
          </div>

          <!-- Add Item Form -->
          <v-card v-if="showAddItemForm" class="mb-4" elevation="0" border>
            <v-card-text>
              <v-row>
                <v-col cols="12">
                  <v-select
                    v-model="newItem.itemId"
                    :items="items"
                    :label="$t('locations.selectItem')"
                    item-title="name"
                    item-value="id"
                    variant="outlined"
                    density="compact"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-combobox
                    v-model="newItem.relationType"
                    :items="itemRelationTypeSuggestions"
                    :label="$t('locations.itemRelationType')"
                    :placeholder="$t('locations.itemRelationTypePlaceholder')"
                    variant="outlined"
                    density="compact"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model.number="newItem.quantity"
                    :label="$t('locations.quantity')"
                    :placeholder="$t('locations.quantityPlaceholder')"
                    type="number"
                    variant="outlined"
                    density="compact"
                  />
                </v-col>
              </v-row>
              <div class="d-flex justify-end gap-2">
                <v-btn variant="text" @click="cancelAddItem">
                  {{ $t('common.cancel') }}
                </v-btn>
                <v-btn
                  color="primary"
                  :disabled="!newItem.itemId || !newItem.relationType"
                  :loading="addingItem"
                  @click="addItemToLocation"
                >
                  {{ $t('common.save') }}
                </v-btn>
              </div>
            </v-card-text>
          </v-card>

          <v-progress-linear v-if="loadingItems" indeterminate />
          <v-list v-else-if="locationItems && locationItems.length > 0">
            <v-list-item v-for="item in locationItems" :key="item.id" class="mb-2" border>
              <template #prepend>
                <v-icon icon="mdi-sword" color="primary" />
              </template>
              <v-list-item-title>
                {{ item.item_name }}
              </v-list-item-title>
              <v-list-item-subtitle>
                <v-chip size="small" class="mr-1">
                  {{ $t(`locations.itemRelationTypes.${item.relation_type}`) }}
                </v-chip>
                <span v-if="item.notes?.quantity" class="text-caption">
                  {{ $t('locations.quantity') }}: {{ item.notes.quantity }}
                </span>
              </v-list-item-subtitle>
              <template #append>
                <v-btn
                  icon="mdi-delete"
                  variant="text"
                  size="small"
                  color="error"
                  @click="removeItem(item.id)"
                />
              </template>
            </v-list-item>
          </v-list>
          <p v-else class="text-body-2 text-medium-emphasis">
            {{ $t('locations.noItems') }}
          </p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            prepend-icon="mdi-pencil"
            @click="editLocationAndCloseView(viewingLocation)"
          >
            {{ $t('common.edit') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Confirmation -->
    <UiDeleteConfirmDialog
      v-model="showDeleteDialog"
      :title="$t('locations.deleteTitle')"
      :message="$t('locations.deleteConfirm', { name: deletingLocation?.name })"
      :loading="deleting"
      @confirm="confirmDelete"
      @cancel="showDeleteDialog = false"
    />

    <!-- Image Preview Dialog -->
    <ImagePreviewDialog
      v-model="showImagePreview"
      :image-url="previewImageUrl"
      :title="previewImageTitle"
      :download-file-name="previewImageTitle"
    />
  </v-container>
</template>

<script setup lang="ts">
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

interface ConnectedNPC {
  id: number
  name: string
  relation_type: string
  relation_notes: string | null
}

// Debounced FTS5 + Levenshtein Search with AbortController (must be declared early for template)
const searchQuery = ref('')
const searchResults = ref<Location[]>([])
const searching = ref(false)

const { t, locale } = useI18n()
const router = useRouter()
const route = useRoute()
const entitiesStore = useEntitiesStore()
const campaignStore = useCampaignStore()

// Use image download composable
const { downloadImage } = useImageDownload()

// Get active campaign from campaign store
const activeCampaignId = computed(() => campaignStore.activeCampaignId)

// Highlighted location (from global search)
const highlightedId = ref<number | null>(null)
const isFromGlobalSearch = ref(false)

// Initialize from query params (global search)
function initializeFromQuery() {
  const highlightParam = route.query.highlight
  const searchParam = route.query.search

  if (highlightParam && searchParam) {
    highlightedId.value = Number(highlightParam)
    searchQuery.value = String(searchParam)
    isFromGlobalSearch.value = true

    // Scroll to highlighted location after a short delay
    nextTick(() => {
      setTimeout(() => {
        const element = document.getElementById(`location-${highlightedId.value}`)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 100)
    })
  }
}

onMounted(async () => {
  // Initialize campaign from cookie
  campaignStore.initFromCookie()

  if (!activeCampaignId.value) {
    router.push('/campaigns')
    return
  }

  // Load locations from store (cached)
  await entitiesStore.fetchLocations(activeCampaignId.value)

  // Initialize from query params
  initializeFromQuery()

  // Check API key
  try {
    const response = await $fetch<{ hasKey: boolean }>('/api/settings/check-api-key')
    hasApiKey.value = response.hasKey
  } catch {
    hasApiKey.value = false
  }
})

// Watch for route changes (same-page navigation)
watch(
  () => route.query,
  () => {
    highlightedId.value = null
    isFromGlobalSearch.value = false
    // Re-initialize from new query
    initializeFromQuery()
  },
  { deep: true },
)

// Clear highlight when user manually searches
watch(searchQuery, () => {
  if (isFromGlobalSearch.value) {
    // First change after global search, keep highlight
    isFromGlobalSearch.value = false
  } else {
    // Manual search by user, clear highlight
    highlightedId.value = null
    // Remove query params from URL
    if (route.query.highlight || route.query.search) {
      router.replace({ query: {} })
    }
  }
})

// Use store data
const locations = computed(() => entitiesStore.locations)
const pending = computed(() => entitiesStore.locationsLoading)

// Debounce search with abort controller
let searchTimeout: ReturnType<typeof setTimeout> | null = null
let abortController: AbortController | null = null

// Search execution function
async function executeSearch(query: string) {
  if (!activeCampaignId.value) return

  // Abort previous search if still running
  if (abortController) {
    abortController.abort()
  }

  // Create new abort controller for this search
  abortController = new AbortController()

  searching.value = true
  try {
    const results = await $fetch<Location[]>('/api/locations', {
      query: {
        campaignId: activeCampaignId.value,
        search: query.trim(),
      },
      headers: {
        'Accept-Language': locale.value, // Send current locale to backend
      },
      signal: abortController.signal, // Pass abort signal to fetch
    })
    searchResults.value = results
  } catch (error: unknown) {
    // Ignore abort errors (expected when user types fast)
    if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
      return
    }
    console.error('Search failed:', error)
    searchResults.value = []
  } finally {
    searching.value = false
    abortController = null
  }
}

// Watch search query with debounce
watch(searchQuery, async (query) => {
  // Clear previous timeout
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }

  // Abort any running search immediately
  if (abortController) {
    abortController.abort()
    abortController = null
  }

  // If empty, show all locations from store
  if (!query || query.trim().length === 0) {
    searchResults.value = []
    searching.value = false
    return
  }

  // Show loading state immediately (user sees overlay during debounce)
  searching.value = true

  // Debounce search by 300ms
  searchTimeout = setTimeout(() => executeSearch(query), 300)
})

// Show search results OR cached locations
const filteredLocations = computed(() => {
  // If user is actively searching, show search results
  if (searchQuery.value && searchQuery.value.trim().length > 0) {
    return searchResults.value
  }

  // Otherwise show all cached locations
  return locations.value || []
})

// Build tree structure from flat location list
interface TreeNode {
  id: number
  title: string
  children?: TreeNode[]
  raw: Location
  isSearchResult?: boolean // Mark if this is an actual search result
}

// Helper: Get all parent IDs for a location
function getParentIds(locationId: number, allLocations: Location[]): number[] {
  const location = allLocations.find((l) => l.id === locationId)
  if (!location || !location.parent_entity_id) return []

  return [location.parent_entity_id, ...getParentIds(location.parent_entity_id, allLocations)]
}

const treeItems = computed(() => {
  const searchResults = filteredLocations.value
  const allLocations = locations.value || []

  if (!searchResults || searchResults.length === 0) return []

  // If searching, we need to include parents of search results
  const isSearching = searchQuery.value && searchQuery.value.trim().length > 0

  let locationsToShow: Location[] = []
  const searchResultIds = new Set<number>()

  if (isSearching) {
    // Searching: Include search results + all their parents
    searchResults.forEach((result) => {
      searchResultIds.add(result.id)
      locationsToShow.push(result)

      // Add all parents
      const parentIds = getParentIds(result.id, allLocations)
      parentIds.forEach((parentId) => {
        const parent = allLocations.find((l) => l.id === parentId)
        if (parent && !locationsToShow.find((l) => l.id === parent.id)) {
          locationsToShow.push(parent)
        }
      })
    })
  } else {
    // Not searching: Show all locations
    locationsToShow = searchResults
  }

  // Build tree from filtered locations
  const locationMap = new Map<number, TreeNode>()
  const rootNodes: TreeNode[] = []

  // First pass: create all nodes
  locationsToShow.forEach((location) => {
    locationMap.set(location.id, {
      id: location.id,
      title: location.name,
      children: [],
      raw: location,
      isSearchResult: searchResultIds.has(location.id),
    })
  })

  // Second pass: build hierarchy
  locationsToShow.forEach((location) => {
    const node = locationMap.get(location.id)!

    if (location.parent_entity_id) {
      // Has parent - add to parent's children
      const parent = locationMap.get(location.parent_entity_id)
      if (parent) {
        parent.children!.push(node)
      } else {
        // Parent not found (not in locationsToShow) - treat as root
        rootNodes.push(node)
      }
    } else {
      // No parent - is a root node
      rootNodes.push(node)
    }
  })

  return rootNodes
})

// Get icon based on location type
function getNodeIcon(item: TreeNode) {
  const type = item.raw?.metadata?.type?.toLowerCase()
  if (!type) return 'mdi-map-marker'

  const iconMap: Record<string, string> = {
    city: 'mdi-city',
    stadt: 'mdi-city',
    district: 'mdi-map-marker-radius',
    viertel: 'mdi-map-marker-radius',
    building: 'mdi-home',
    gebäude: 'mdi-home',
    tavern: 'mdi-beer',
    taverne: 'mdi-beer',
    shop: 'mdi-store',
    laden: 'mdi-store',
    temple: 'mdi-church',
    tempel: 'mdi-church',
    dungeon: 'mdi-gate',
    verlies: 'mdi-gate',
  }

  return iconMap[type] || 'mdi-map-marker'
}

// Get color based on location type
function getNodeColor(item: TreeNode) {
  const type = item.raw?.metadata?.type?.toLowerCase()
  if (!type) return 'primary'

  const colorMap: Record<string, string> = {
    city: 'purple',
    stadt: 'purple',
    district: 'blue',
    viertel: 'blue',
    building: 'grey',
    gebäude: 'grey',
  }

  return colorMap[type] || 'primary'
}

// Form state
const showCreateDialog = ref(false)
const showViewDialog = ref(false)
const showDeleteDialog = ref(false)
const editingLocation = ref<Location | null>(null)
const viewingLocation = ref<Location | null>(null)
const deletingLocation = ref<Location | null>(null)
const saving = ref(false)
const deleting = ref(false)

// Image preview state
const showImagePreview = ref(false)
const previewImageUrl = ref('')
const previewImageTitle = ref('')

const locationForm = ref({
  name: '',
  description: '',
  parentLocationId: null as number | null,
  metadata: {
    type: '',
    region: '',
    notes: '',
  },
})

// Image gallery state
const fileInputRef = ref<HTMLInputElement | null>(null)
const uploadingImage = ref(false)
const generatingImage = ref(false)
const loadingImages = ref(false)
const hasApiKey = ref(false)
const locationImages = ref<
  Array<{
    id: number
    entity_id: number
    image_url: string
    caption: string | null
    is_primary: number
    display_order: number
    created_at: string
  }>
>([])

// Trigger file input click
function triggerImageUpload() {
  fileInputRef.value?.click()
}

// Load images for location
async function loadLocationImages() {
  if (!editingLocation.value) return

  loadingImages.value = true
  try {
    const images = await $fetch<typeof locationImages.value>(
      `/api/entities/${editingLocation.value.id}/images`,
    )
    locationImages.value = images
  } catch (error) {
    console.error('Failed to load images:', error)
    locationImages.value = []
  } finally {
    loadingImages.value = false
  }
}

// Handle image upload from native input (multiple files)
async function handleImageUpload(event: Event) {
  const target = event.target as HTMLInputElement
  if (!target.files || !target.files.length || !editingLocation.value) return

  uploadingImage.value = true

  try {
    const formData = new FormData()
    for (const file of Array.from(target.files)) {
      formData.append('file', file)
    }

    const response = await $fetch<{
      success: boolean
      images: Array<{ id: number; imageUrl: string; isPrimary: boolean }>
    }>(`/api/entities/${editingLocation.value.id}/images`, {
      method: 'POST',
      body: formData,
    })

    // Reload images
    await loadLocationImages()

    // If a primary image was uploaded, update the location
    const primaryImage = response.images.find((img) => img.isPrimary)
    if (primaryImage && editingLocation.value) {
      editingLocation.value.image_url = primaryImage.imageUrl

      // Update the location in the store list directly
      const locationInList = entitiesStore.locations?.find(
        (l) => l.id === editingLocation.value!.id,
      )
      if (locationInList) {
        locationInList.image_url = primaryImage.imageUrl
      }
    }

    // Clear file input
    target.value = ''
  } catch (error) {
    console.error('Failed to upload images:', error)
    alert(t('locations.uploadImageError'))
  } finally {
    uploadingImage.value = false
  }
}

// AI Image Generation
async function generateImage() {
  if (!editingLocation.value || !locationForm.value.name) return

  generatingImage.value = true

  try {
    // Build detailed prompt from all available location data
    const details = []

    // Type (tavern, dungeon, forest, etc.)
    if (locationForm.value.metadata.type) {
      details.push(locationForm.value.metadata.type)
    }

    // Region (adds geographical context)
    if (locationForm.value.metadata.region) {
      details.push(`in ${locationForm.value.metadata.region}`)
    }

    // Name (required)
    details.push(locationForm.value.name)

    // Description (free-form details)
    if (locationForm.value.description) {
      details.push(locationForm.value.description)
    }

    // Notes (additional context)
    if (locationForm.value.metadata.notes) {
      details.push(locationForm.value.metadata.notes)
    }

    const prompt = details.filter((d) => d).join(', ')

    const result = await $fetch<{ imageUrl: string; revisedPrompt?: string }>(
      '/api/ai/generate-image',
      {
        method: 'POST',
        body: {
          prompt,
          entityName: locationForm.value.name,
          entityType: 'Location',
          style: 'fantasy-art',
        },
      },
    )

    if (result.imageUrl && editingLocation.value) {
      // Add the generated image directly to the gallery (no re-upload needed)
      const filename = result.imageUrl.replace('/uploads/', '')

      await $fetch(`/api/entities/${editingLocation.value.id}/add-generated-image`, {
        method: 'POST',
        body: {
          imageUrl: filename,
        },
      })

      // Reload images
      await loadLocationImages()

      // Refresh locations to update the list
      if (activeCampaignId.value) {
        await entitiesStore.fetchLocations(activeCampaignId.value)
      }
    }
  } catch (error: unknown) {
    console.error('[Location] Failed to generate image:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate image'
    alert(errorMessage)
  } finally {
    generatingImage.value = false
  }
}

// Delete image from gallery
async function deleteImageFromGallery(imageId: number) {
  try {
    await $fetch(`/api/entity-images/${imageId}`, {
      method: 'DELETE',
    })

    // Remove image from local array
    locationImages.value = locationImages.value.filter((img) => img.id !== imageId)

    // Update the editingLocation's image_url with the new primary image (if any)
    const primaryImage = locationImages.value.find((img) => img.is_primary === 1)
    if (editingLocation.value) {
      editingLocation.value.image_url = primaryImage?.image_url || null

      // Update the location in the store list directly
      const locationInList = entitiesStore.locations?.find(
        (l) => l.id === editingLocation.value!.id,
      )
      if (locationInList) {
        locationInList.image_url = primaryImage?.image_url || null
      }
    }
  } catch (error) {
    console.error('Failed to delete image:', error)
    alert(t('locations.deleteImageError'))
  }
}

// Set image as primary
async function setPrimaryImage(imageId: number) {
  try {
    await $fetch(`/api/entity-images/${imageId}/set-primary`, {
      method: 'PATCH',
    })

    // Update local image states
    locationImages.value.forEach((img) => {
      img.is_primary = img.id === imageId ? 1 : 0
    })

    // Update the editingLocation's image_url with the new primary image
    const primaryImage = locationImages.value.find((img) => img.id === imageId)
    if (primaryImage && editingLocation.value) {
      editingLocation.value.image_url = primaryImage.image_url

      // Update the location in the store list directly
      const locationInList = entitiesStore.locations?.find(
        (l) => l.id === editingLocation.value!.id,
      )
      if (locationInList) {
        locationInList.image_url = primaryImage.image_url
      }
    }
  } catch (error) {
    console.error('Failed to set primary image:', error)
  }
}

// Update image caption
async function updateImageCaption(imageId: number, caption: string) {
  try {
    await $fetch(`/api/entity-images/${imageId}/caption`, {
      method: 'PATCH',
      body: { caption },
    })

    // Update local state
    const image = locationImages.value.find((img) => img.id === imageId)
    if (image) {
      image.caption = caption
    }
  } catch (error) {
    console.error('Failed to update caption:', error)
  }
}

// Open image preview dialog
function openImagePreview(imageUrl: string, title: string) {
  previewImageUrl.value = imageUrl
  previewImageTitle.value = title
  showImagePreview.value = true
}

// Connected NPCs
const connectedNpcs = ref<ConnectedNPC[]>([])
const loadingNpcs = ref(false)

// Location Items
const locationItems = ref<
  Array<{
    id: number
    to_entity_id: number
    item_name: string
    item_description: string | null
    item_metadata: Record<string, unknown> | null
    relation_type: string
    notes: Record<string, unknown> | null
  }>
>([])
const loadingItems = ref(false)
const showAddItemForm = ref(false)
const addingItem = ref(false)

const newItem = ref({
  itemId: null as number | null,
  relationType: '',
  quantity: 1,
})

const items = computed(() => entitiesStore.itemsForSelect)

const itemRelationTypeSuggestions = computed(() => [
  t('locations.itemRelationTypes.contains'),
  t('locations.itemRelationTypes.hidden'),
  t('locations.itemRelationTypes.displayed'),
  t('locations.itemRelationTypes.stored'),
  t('locations.itemRelationTypes.lost'),
  t('locations.itemRelationTypes.guarded'),
])

// Available parent locations (exclude current location to prevent circular references)
const availableParentLocations = computed(() => {
  if (!locations.value) return []

  // When editing, exclude the current location and its children
  if (editingLocation.value) {
    return locations.value.filter((loc) => loc.id !== editingLocation.value?.id)
  }

  // When creating, show all locations
  return locations.value
})

async function viewLocation(location: Location) {
  viewingLocation.value = location
  showViewDialog.value = true

  // Load connected NPCs
  loadingNpcs.value = true
  try {
    const data = await $fetch<ConnectedNPC[]>(`/api/locations/${location.id}/npcs`)
    connectedNpcs.value = data
  } finally {
    loadingNpcs.value = false
  }

  // Load Items
  await loadLocationItems()

  // Load items for the form if not already loaded
  if (!entitiesStore.itemsLoaded && activeCampaignId.value) {
    await entitiesStore.fetchItems(activeCampaignId.value)
  }
}

async function loadLocationItems() {
  if (!viewingLocation.value) return

  loadingItems.value = true
  try {
    const items = await $fetch<typeof locationItems.value>(
      `/api/locations/${viewingLocation.value.id}/items`,
    )
    locationItems.value = items
  } catch (error) {
    console.error('Failed to load location items:', error)
    locationItems.value = []
  } finally {
    loadingItems.value = false
  }
}

async function addItemToLocation() {
  if (!viewingLocation.value || !newItem.value.itemId || !newItem.value.relationType) return

  addingItem.value = true

  try {
    await $fetch(`/api/locations/${viewingLocation.value.id}/items`, {
      method: 'POST',
      body: {
        itemId: newItem.value.itemId,
        relationType: newItem.value.relationType,
        quantity: newItem.value.quantity || undefined,
      },
    })

    await loadLocationItems()
    resetItemForm()
    showAddItemForm.value = false
  } catch (error) {
    console.error('Failed to add item to location:', error)
  } finally {
    addingItem.value = false
  }
}

async function removeItem(relationId: number) {
  try {
    await $fetch(`/api/relations/${relationId}`, {
      method: 'DELETE',
    })
    await loadLocationItems()
  } catch (error) {
    console.error('Failed to remove item:', error)
  }
}

function resetItemForm() {
  newItem.value = {
    itemId: null,
    relationType: '',
    quantity: 1,
  }
}

function cancelAddItem() {
  showAddItemForm.value = false
  resetItemForm()
}

async function editLocation(location: Location) {
  editingLocation.value = location
  locationForm.value = {
    name: location.name,
    description: location.description || '',
    parentLocationId: location.parent_entity_id || null,
    metadata: {
      type: location.metadata?.type || '',
      region: location.metadata?.region || '',
      notes: location.metadata?.notes || '',
    },
  }
  showCreateDialog.value = true
  // Load images for this location
  await loadLocationImages()
}

async function editLocationAndCloseView(location: Location) {
  await editLocation(location)
  showViewDialog.value = false
}

function deleteLocation(location: Location) {
  deletingLocation.value = location
  showDeleteDialog.value = true
}

async function saveLocation() {
  if (!activeCampaignId.value) return

  saving.value = true

  try {
    if (editingLocation.value) {
      await $fetch(`/api/locations/${editingLocation.value.id}`, {
        method: 'PATCH',
        body: {
          name: locationForm.value.name,
          description: locationForm.value.description,
          metadata: locationForm.value.metadata,
          parentLocationId: locationForm.value.parentLocationId,
        },
      })
      // Reload locations to get updated data
      await entitiesStore.fetchLocations(activeCampaignId.value)
    } else {
      await $fetch('/api/locations', {
        method: 'POST',
        body: {
          name: locationForm.value.name,
          description: locationForm.value.description,
          metadata: locationForm.value.metadata,
          campaignId: activeCampaignId.value,
          parentLocationId: locationForm.value.parentLocationId,
        },
      })
      // Reload locations to get new data
      await entitiesStore.fetchLocations(activeCampaignId.value)
    }

    closeDialog()
  } catch (error) {
    console.error('Failed to save location:', error)
  } finally {
    saving.value = false
  }
}

async function confirmDelete() {
  if (!deletingLocation.value) return

  deleting.value = true

  try {
    await entitiesStore.deleteLocation(deletingLocation.value.id)
    showDeleteDialog.value = false
    deletingLocation.value = null
  } catch (error) {
    console.error('Failed to delete location:', error)
  } finally {
    deleting.value = false
  }
}

function closeDialog() {
  showCreateDialog.value = false
  editingLocation.value = null
  locationForm.value = {
    name: '',
    description: '',
    parentLocationId: null,
    metadata: {
      type: '',
      region: '',
      notes: '',
    },
  }
}
</script>

<style scoped>
.image-download-btn {
  position: absolute;
  bottom: 8px;
  right: 8px;
  opacity: 0.5;
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.image-container:hover .image-download-btn {
  opacity: 1;
  transform: scale(1.1);
}

/* Highlight animation for locations from global search */
.highlighted-card {
  animation: highlight-pulse 2s ease-in-out;
  box-shadow: 0 0 0 3px rgb(var(--v-theme-primary)) !important;
}

@keyframes highlight-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 3px rgb(var(--v-theme-primary));
  }
  50% {
    box-shadow: 0 0 20px 5px rgb(var(--v-theme-primary));
  }
}
</style>
