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

    <!-- Search Bar - Non-reactive for smooth typing -->
    <v-text-field
      :model-value="inputValue"
      :placeholder="$t('common.search')"
      prepend-inner-icon="mdi-magnify"
      variant="outlined"
      clearable
      class="mb-4"
      :hint="searchQuery && searchQuery.trim().length > 0 ? $t('locations.searchHint') : ''"
      persistent-hint
      @update:model-value="handleSearchInput"
      @click:clear="handleSearchClear"
    />

    <v-row v-if="pending">
      <v-col v-for="i in 6" :key="i" cols="12" md="6" lg="4">
        <v-skeleton-loader type="card" />
      </v-col>
    </v-row>

    <!-- Search Loading Indicator (shown immediately when typing starts) -->
    <div v-else-if="searching && (!searchResults || searchResults.length === 0)" class="text-center py-16">
      <v-progress-circular indeterminate size="64" color="primary" class="mb-4" />
      <div class="text-h6">
        {{ $t('common.searching') }}
      </div>
    </div>

    <!-- Location Cards with Search Overlay -->
    <div v-else-if="filteredLocations && filteredLocations.length > 0" class="position-relative">
      <!-- Search Loading Overlay (shown when searching with existing results) -->
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
          v-model:opened="openedNodes"
          :items="treeItems"
          :open-on-click="true"
          item-value="id"
          item-title="title"
          density="comfortable"
          expand-icon=""
          collapse-icon=""
        >
          <!-- Custom prepend slot for expand button + icon -->
          <template #prepend="{ item }">
            <div
              :class="{
                'highlight-blink-prepend': highlightedId === item.raw.id,
              }"
              style="display: flex; align-items: center; gap: 4px; margin-left: -8px"
            >
              <!-- Expand/Collapse icon only if has children -->
              <v-icon
                v-if="item.children && item.children.length > 0"
                :icon="openedNodes.includes(item.id) ? 'mdi-chevron-down' : 'mdi-chevron-right'"
                size="small"
                style="width: 20px"
              />
              <div v-else style="width: 20px" />

              <!-- Location type icon -->
              <v-icon :color="getNodeColor(item)" size="small">
                {{ getNodeIcon(item) }}
              </v-icon>
            </div>
          </template>

          <!-- Custom title to highlight search results -->
          <template #title="{ item }">
            <div
              :id="`location-${item.raw.id}`"
              :key="`location-title-${item.raw.id}-${animationKey}`"
              :class="{
                'highlight-blink-title': highlightedId === item.raw.id,
              }"
            >
              <span :class="{ 'text-primary font-weight-bold': item.isSearchResult }">
                {{ item.title }}
              </span>
            </div>
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
                icon="mdi-graph"
                size="x-small"
                variant="text"
                color="primary"
                @click.stop="openChaosGraph(item.raw)"
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

    <!-- Create/Edit Dialog - Now self-contained! -->
    <ClientOnly>
      <LocationEditDialog
        :show="showCreateDialog"
        :location-id="editingLocationId"
        @update:show="handleDialogClose"
        @saved="handleLocationSaved"
        @created="handleLocationCreated"
      />
    </ClientOnly>

    <!-- View Location Dialog -->
    <LocationViewDialog
      v-model="showViewDialog"
      :location="viewingLocation"
      :npcs="connectedNpcs"
      :items="locationItems"
      :lore="locationLore"
      :documents="locationDocuments"
      :images="locationImages"
      :counts="viewDialogCounts"
      :loading="loadingViewData"
      :loading-npcs="loadingNpcs"
      :loading-items="loadingItems"
      :loading-lore="loadingLore"
      @edit="editLocationAndCloseView"
      @preview-image="(image: { image_url: string }) => openImagePreview(`/uploads/${image.image_url}`, viewingLocation?.name || '')"
    />

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
import LocationViewDialog from '~/components/locations/LocationViewDialog.vue'
import LocationEditDialog from '~/components/locations/LocationEditDialog.vue'
import ImagePreviewDialog from '~/components/shared/ImagePreviewDialog.vue'

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

interface LocationCounts {
  npcs: number
  items: number
  lore: number
  players: number
  documents: number
  images: number
}

// Debounced FTS5 + Levenshtein Search with AbortController (must be declared early for template)
// IMPORTANT: inputValue is non-reactive for smooth typing, searchQuery is reactive for logic
let inputValue = '' // Non-reactive - used by input field
const searchQuery = ref('') // Reactive - used by computeds
const searchResults = ref<Location[]>([])
const searching = ref(false)
const isInSearchMode = ref(false) // Cache the search mode to avoid rebuilding tree on every keystroke

// Non-reactive search input handlers for smooth typing
let inputTimeout: ReturnType<typeof setTimeout> | null = null
function handleSearchInput(value: string) {
  // Update non-reactive input value immediately (smooth typing)
  inputValue = value

  // Show loading immediately when user starts typing
  if (value && value.trim().length > 0) {
    searching.value = true
    isInSearchMode.value = true
  } else {
    searching.value = false
    isInSearchMode.value = false
  }

  // Debounce updating the reactive searchQuery (triggers search)
  if (inputTimeout) clearTimeout(inputTimeout)
  inputTimeout = setTimeout(() => {
    searchQuery.value = value
  }, 50) // Very short delay - just enough to keep typing smooth
}

function handleSearchClear() {
  inputValue = ''
  searchQuery.value = ''
  if (inputTimeout) clearTimeout(inputTimeout)
}

const { locale } = useI18n()
const router = useRouter()
const route = useRoute()
const entitiesStore = useEntitiesStore()
const campaignStore = useCampaignStore()

// Get active campaign from campaign store
const activeCampaignId = computed(() => campaignStore.activeCampaignId)

// Highlighted location (from global search or after save)
const highlightedId = ref<number | null>(null)
const isFromGlobalSearch = ref(false)
const animationKey = ref(0) // Unique key to prevent re-triggering animation on re-render

// Initialize from query params (global search)
function initializeFromQuery() {
  const highlightParam = route.query.highlight
  const searchParam = route.query.search

  if (highlightParam && searchParam) {
    highlightedId.value = Number(highlightParam)
    const searchText = String(searchParam)
    searchQuery.value = searchText
    inputValue = searchText // Also update the non-reactive input value!
    isInSearchMode.value = true // Activate search mode
    isFromGlobalSearch.value = true
    // Note: animationKey will be incremented AFTER search completes (see watch below)

    // Scroll to highlighted location after a short delay
    nextTick(() => {
      setTimeout(() => {
        const element = document.getElementById(`location-${highlightedId.value}`)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 500) // Longer delay to wait for search to complete
    })

    // Clear highlight after animation completes (2s = 2 blinks)
    setTimeout(() => {
      highlightedId.value = null
    }, 3000) // Longer timeout because we wait for search
  }
}

onMounted(async () => {
  // Load locations from store (cached)
  await entitiesStore.fetchLocations(activeCampaignId.value!)

  // Load NPCs, Lore, Items and Players for linking
  await entitiesStore.fetchNPCs(activeCampaignId.value!)
  await entitiesStore.fetchLore(activeCampaignId.value!)
  await entitiesStore.fetchItems(activeCampaignId.value!)
  await entitiesStore.fetchPlayers(activeCampaignId.value!)

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
  if (!isFromGlobalSearch.value) {
    // Manual search by user, clear highlight
    highlightedId.value = null
    // Remove query params from URL
    if (route.query.highlight || route.query.search) {
      router.replace({ query: {} })
    }
  }
  // Note: isFromGlobalSearch is reset in the searchResults watch after animation triggers
})

// Use store data
const locations = computed(() => entitiesStore.locations)
const pending = computed(() => entitiesStore.locationsLoading)

// Debounce search with abort controller
let searchTimeout: ReturnType<typeof setTimeout> | null = null
let abortController: AbortController | null = null

// Search execution function
async function executeSearch(query: string) {
  if (!activeCampaignId.value!) return

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
    isInSearchMode.value = false // Exit search mode
    return
  }

  // Show loading state immediately (user sees overlay during debounce)
  searching.value = true
  isInSearchMode.value = true // Enter search mode

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

  // Use cached search mode instead of reading searchQuery directly
  const isSearching = isInSearchMode.value

  let locationsToShow: Location[] = []
  const searchResultIds = new Set<number>()
  const addedLocationIds = new Set<number>() // Track added locations to prevent duplicates

  if (isSearching) {
    // Searching: Include search results + all their parents
    searchResults.forEach((result) => {
      searchResultIds.add(result.id)
      if (!addedLocationIds.has(result.id)) {
        locationsToShow.push(result)
        addedLocationIds.add(result.id)
      }

      // Add all parents
      const parentIds = getParentIds(result.id, allLocations)
      parentIds.forEach((parentId) => {
        if (!addedLocationIds.has(parentId)) {
          const parent = allLocations.find((l) => l.id === parentId)
          if (parent) {
            locationsToShow.push(parent)
            addedLocationIds.add(parentId)
          }
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

  // Sort function: alphabetical by name (case-insensitive)
  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
    // Recursively sort children
    nodes.forEach((node) => {
      if (node.children && node.children.length > 0) {
        sortNodes(node.children)
      }
    })
  }

  // Sort root nodes and all children
  sortNodes(rootNodes)

  return rootNodes
})

// Control which tree nodes are open/collapsed
// Use a writable ref that tracks both manual and search-based opening
const openedNodes = ref<number[]>([])

// Update opened nodes when search results change
watch(
  [isInSearchMode, searchResults],
  ([searching, results]) => {
    if (searching && results.length > 0) {
      // When searching, expand all nodes that contain search results
      const nodesToOpen = new Set<number>()
      const allLocations = locations.value || []

      results.forEach((result) => {
        // Add the result node itself
        nodesToOpen.add(result.id)

        // Add all parent IDs to ensure the result is visible
        const parentIds = getParentIds(result.id, allLocations)
        parentIds.forEach((id) => nodesToOpen.add(id))
      })

      openedNodes.value = Array.from(nodesToOpen)

      // If this is the first search after global search, trigger animation
      if (isFromGlobalSearch.value) {
        animationKey.value++
        isFromGlobalSearch.value = false // Reset flag
      }
    } else if (!searching) {
      // When not searching, collapse all
      openedNodes.value = []
    }
  },
  { immediate: true },
)

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
const editingLocationId = ref<number | null>(null)
const viewingLocation = ref<Location | null>(null)
const deletingLocation = ref<Location | null>(null)
const viewDialogCounts = ref<LocationCounts | null>(null)
const deleting = ref(false)

// Image preview state
const showImagePreview = ref(false)
const previewImageUrl = ref('')
const previewImageTitle = ref('')

// API key state for image generation
const hasApiKey = ref(false)

// Image functions removed - now handled by EntityImageGallery component in LocationViewDialog

// Open image preview dialog
function openImagePreview(imageUrl: string, title: string) {
  previewImageUrl.value = imageUrl
  previewImageTitle.value = title
  showImagePreview.value = true
}

// View Dialog State (removed - now in LocationViewDialog component)

// Connected NPCs
const connectedNpcs = ref<ConnectedNPC[]>([])
const loadingNpcs = ref(false)

// Location Items (compatible with EntityRelationsList)
const locationItems = ref<
  Array<{
    id: number
    name: string
    description?: string | null
    relation_type?: string
    image_url?: string | null
    metadata?: Record<string, unknown> | null
  }>
>([])
const loadingItems = ref(false)

// Location Lore
const locationLore = ref<
  Array<{ id: number; name: string; description: string | null; image_url: string | null }>
>([])
const loadingLore = ref(false)

// Location Documents & Images
const locationDocuments = ref<Array<{ id: number; title: string; content: string }>>([])
const locationImages = ref<Array<{ id: number; image_url: string; is_primary: boolean }>>([])
const loadingViewData = ref(false)

async function viewLocation(location: Location) {
  viewingLocation.value = location
  showViewDialog.value = true

  // Load all view data in parallel
  loadingViewData.value = true
  loadingNpcs.value = true
  loadingItems.value = true
  loadingLore.value = true

  try {
    const [npcs, items, lore, documents, images, counts] = await Promise.all([
      $fetch<ConnectedNPC[]>(`/api/entities/${location.id}/related/npcs`).catch(() => []),
      $fetch<typeof locationItems.value>(`/api/entities/${location.id}/related/items`).catch(() => []),
      $fetch<typeof locationLore.value>(`/api/entities/${location.id}/related/lore`).catch(() => []),
      $fetch<typeof locationDocuments.value>(`/api/entities/${location.id}/documents`).catch(() => []),
      $fetch<typeof locationImages.value>(`/api/entity-images/${location.id}`).catch(() => []),
      $fetch<LocationCounts>(`/api/locations/${location.id}/counts`).catch(() => null),
    ])

    connectedNpcs.value = npcs
    locationItems.value = items
    locationLore.value = lore
    locationDocuments.value = documents
    locationImages.value = images
    viewDialogCounts.value = counts
  } finally {
    loadingViewData.value = false
    loadingNpcs.value = false
    loadingItems.value = false
    loadingLore.value = false
  }

  // Load items for the form if not already loaded
  if (!entitiesStore.itemsLoaded && activeCampaignId.value!) {
    await entitiesStore.fetchItems(activeCampaignId.value!)
  }
}

// loadLocationItems removed - now loaded in viewLocation() via Promise.all()

function editLocation(location: Location) {
  editingLocationId.value = location.id
  showCreateDialog.value = true
}

function editLocationAndCloseView(location: Location) {
  editLocation(location)
  showViewDialog.value = false
}

function deleteLocation(location: Location) {
  deletingLocation.value = location
  showDeleteDialog.value = true
}

// Handler for dialog close
function handleDialogClose(open: boolean) {
  showCreateDialog.value = open
  if (!open) {
    editingLocationId.value = null
  }
}

// Handler for location saved (updated)
function handleLocationSaved(location: Location) {
  // Store is already updated by LocationEditDialog
  // Just highlight and scroll to saved location
  highlightAfterSave(location.id)
}

// Handler for location created
function handleLocationCreated(location: Location) {
  // Store is already updated by LocationEditDialog
  // Just highlight and scroll to new location
  highlightAfterSave(location.id)
}

// Helper function to highlight and scroll to location after save
async function highlightAfterSave(locationId: number) {
  highlightedId.value = locationId
  animationKey.value++

  await nextTick()
  await nextTick()

  // Try multiple times to find the element (tree rendering can be slow)
  let attempts = 0
  const maxAttempts = 10
  const scrollInterval = setInterval(() => {
    attempts++
    const element = document.getElementById(`location-${locationId}`)

    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      clearInterval(scrollInterval)
    } else if (attempts >= maxAttempts) {
      clearInterval(scrollInterval)
    }
  }, 200)

  // Clear highlight after animation completes
  setTimeout(() => {
    highlightedId.value = null
  }, 2500)
}

// Open Chaos Graph for location
function openChaosGraph(location: Location) {
  router.push(`/chaos/${location.id}`)
}

async function confirmDelete() {
  if (!deletingLocation.value || !activeCampaignId.value!) return

  deleting.value = true

  try {
    // Delete location (cascade deletes children)
    const result = await $fetch<{ success: boolean; deletedCount: number; message: string }>(
      `/api/locations/${deletingLocation.value.id}`,
      { method: 'DELETE' },
    )

    // Show message if children were deleted
    if (result.deletedCount > 1) {
      // TODO: Show toast notification for deleted children
      // result.message contains the count
    }

    // Reload locations to reflect cascade deletions
    await entitiesStore.fetchLocations(activeCampaignId.value, true)

    showDeleteDialog.value = false
    deletingLocation.value = null
  } catch (error) {
    console.error('Failed to delete location:', error)
  } finally {
    deleting.value = false
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

/* Add consistent padding to all treeview items */
:deep(.v-treeview-item) {
  padding: 4px 8px;
  margin: 2px 0;
  border-radius: 4px;
}

/* Highlight entire treeview row - only animate background */
:deep(.v-treeview-item:has(.highlight-blink-prepend)) {
  animation: highlight-blink-animation 1s ease-in-out;
  animation-iteration-count: 2;
}

@keyframes highlight-blink-animation {
  0% {
    background-color: transparent;
  }
  25% {
    background-color: rgba(var(--v-theme-primary), 0.25);
  }
  50% {
    background-color: rgba(var(--v-theme-primary), 0.25);
  }
  100% {
    background-color: transparent;
  }
}
</style>
