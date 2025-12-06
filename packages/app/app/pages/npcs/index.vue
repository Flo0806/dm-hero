<template>
  <v-container>
    <UiPageHeader :title="$t('npcs.title')" :subtitle="$t('npcs.subtitle')">
      <template #actions>
        <v-btn
          color="primary"
          prepend-icon="mdi-plus"
          size="large"
          @click="openCreateDialog"
        >
          {{ $t('npcs.create') }}
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
    />

    <v-row v-if="entitiesStore.npcsLoading">
      <v-col v-for="i in 6" :key="i" cols="12" md="6" lg="4">
        <v-skeleton-loader type="card" />
      </v-col>
    </v-row>

    <!-- Search Loading State (when searching with no previous results) -->
    <div v-else-if="searching && filteredNpcs.length === 0" class="text-center py-16">
      <v-progress-circular indeterminate size="64" color="primary" class="mb-4" />
      <div class="text-h6">{{ $t('common.searching') }}</div>
    </div>

    <!-- NPC Cards with Search Overlay -->
    <div v-else-if="filteredNpcs && filteredNpcs.length > 0" class="position-relative">
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

      <!-- NPC Cards -->
      <v-row>
        <v-col v-for="npc in filteredNpcs" :key="npc.id" cols="12" md="6" lg="4">
          <NpcCard
            :npc="npc"
            :is-highlighted="highlightedId === npc.id"
            :races="races"
            :classes="classes"
            @view="viewNpc"
            @edit="editNpc"
            @download="(npc: NPC) => downloadImage(`/uploads/${npc.image_url}`, npc.name)"
            @delete="deleteNpc"
          />
        </v-col>
      </v-row>
    </div>

    <div v-else>
      <ClientOnly>
        <v-empty-state
          icon="mdi-account-group"
          :title="$t('npcs.empty')"
          :text="$t('npcs.emptyText')"
        >
          <template #actions>
            <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreateDialog">
              {{ $t('npcs.create') }}
            </v-btn>
          </template>
        </v-empty-state>
        <template #fallback>
          <v-container class="text-center py-16">
            <v-icon icon="mdi-account-group" size="64" color="grey" class="mb-4" />
            <h2 class="text-h5 mb-2">{{ $t('npcs.empty') }}</h2>
            <p class="text-body-1 text-medium-emphasis mb-4">{{ $t('npcs.emptyText') }}</p>
            <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreateDialog">
              {{ $t('npcs.create') }}
            </v-btn>
          </v-container>
        </template>
      </ClientOnly>
    </div>

    <!-- View NPC Dialog -->
    <ClientOnly>
      <NpcViewDialog
        v-model:show="showViewDialog"
        :npc="viewingNpc"
        :races="races"
        :classes="classes"
        :can-go-back="npcViewStack.length > 0"
        @edit="handleEditFromView"
        @view-npc="viewNpcById"
        @view-item="viewItemById"
        @view-location="viewLocationById"
        @go-back="goBackInNpcView"
      />
    </ClientOnly>

    <!-- Create/Edit Dialog - Now self-contained! -->
    <ClientOnly>
      <NpcEditDialog
        :show="showEditDialog"
        :npc-id="editingNpcId"
        @update:show="handleEditDialogClose"
        @saved="handleNpcSaved"
        @created="handleNpcCreated"
      />
    </ClientOnly>

    <!-- Image Preview -->
    <ClientOnly>
      <ImagePreviewDialog
        v-model="showImagePreview"
        :image-url="previewImageUrl"
        :title="previewImageTitle"
        :download-file-name="previewImageTitle"
      />
    </ClientOnly>

    <!-- Delete Confirmation -->
    <ClientOnly>
      <UiDeleteConfirmDialog
        v-model="showDeleteDialog"
        :title="$t('npcs.deleteTitle')"
        :message="$t('npcs.deleteConfirm', { name: deletingNpc?.name })"
        :loading="deleting"
        @confirm="confirmDelete"
        @cancel="showDeleteDialog = false"
      />
    </ClientOnly>

    <!-- Floating Action Button -->
    <v-btn
      color="primary"
      icon="mdi-plus"
      size="large"
      class="fab-create"
      @click="openCreateDialog"
    />
  </v-container>
</template>

<script setup lang="ts">
import type { NPC } from '../../../types/npc'
import NpcCard from '../../components/npcs/NpcCard.vue'
import NpcViewDialog from '../../components/npcs/NpcViewDialog.vue'
import NpcEditDialog from '../../components/npcs/NpcEditDialog.vue'
import ImagePreviewDialog from '../../components/shared/ImagePreviewDialog.vue'

const { locale } = useI18n()
const router = useRouter()

// Use image download composable
const { downloadImage } = useImageDownload()

// Image Preview
const showImagePreview = ref(false)
const previewImageUrl = ref('')
const previewImageTitle = ref('')

// Auto-imported stores
const entitiesStore = useEntitiesStore()
const campaignStore = useCampaignStore()
const { loadNpcCountsBatch } = useNpcCounts()

// Get active campaign from campaign store
const activeCampaignId = computed(() => campaignStore.activeCampaignId)

// Check if campaign is selected
onMounted(async () => {
  // Load entities for this campaign
  await entitiesStore.fetchNPCs(activeCampaignId.value!)

  // Load races and classes for view dialog
  await loadReferenceData()

  // Load counts for all NPCs via store
  await entitiesStore.loadAllNpcCounts()
})

// Search with FTS5
const route = useRoute()
const searchQuery = ref('')
const searchResults = ref<NPC[]>([])
const searching = ref(false)

// Highlighted NPC (from global search)
const highlightedId = ref<number | null>(null)
const isFromGlobalSearch = ref(false)

// Initialize from URL query parameters
function initializeFromQuery() {
  if (route.query.search && typeof route.query.search === 'string') {
    searchQuery.value = route.query.search
    isFromGlobalSearch.value = true
  }
  if (route.query.highlight && typeof route.query.highlight === 'string') {
    highlightedId.value = parseInt(route.query.highlight, 10)
    // Auto-scroll to highlighted card after a short delay
    setTimeout(() => {
      const element = document.getElementById(`npc-${highlightedId.value}`)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 500)
  }
}

onMounted(() => {
  initializeFromQuery()
})

// Watch for route changes (same-page navigation)
watch(
  () => route.query,
  () => {
    // Clear previous highlight
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

// Get data from stores
const npcs = computed(() => entitiesStore.npcs)

// Reference data for view dialog
const races = ref<
  Array<{
    id: number
    name: string
    name_de?: string | null
    name_en?: string | null
    key: string
    description: string
  }>
>([])
const classes = ref<
  Array<{
    id: number
    name: string
    name_de?: string | null
    name_en?: string | null
    key: string
    description: string
  }>
>([])

// Load reference data
async function loadReferenceData() {
  const [racesData, classesData] = await Promise.all([
    $fetch<
      Array<{
        id: number
        name: string
        name_de?: string | null
        name_en?: string | null
        key: string
        description: string
      }>
    >('/api/races'),
    $fetch<
      Array<{
        id: number
        name: string
        name_de?: string | null
        name_en?: string | null
        key: string
        description: string
      }>
    >('/api/classes'),
  ])
  races.value = racesData
  classes.value = classesData
}

// Debounced search with abort controller
let searchTimeout: ReturnType<typeof setTimeout> | null = null
let abortController: AbortController | null = null

// Search execution function (extracted for reuse)
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
    const results = await $fetch<NPC[]>('/api/npcs', {
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

    // Load counts for search results using the shared composable
    // This ensures NpcCard gets the counts via getCounts()
    loadNpcCountsBatch(results)
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

  // If empty, show all NPCs from store
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

// Re-trigger search when locale changes (no debounce)
watch(locale, () => {
  if (searchQuery.value && searchQuery.value.trim().length > 0) {
    executeSearch(searchQuery.value)
  }
})

// Show search results OR cached NPCs
const filteredNpcs = computed(() => {
  // If user is actively searching, show search results
  if (searchQuery.value && searchQuery.value.trim().length > 0) {
    return searchResults.value
  }

  // Otherwise show all cached NPCs
  return npcs.value || []
})

// ============================================================================
// Dialog State - SIMPLIFIED! Dialog manages its own data now
// ============================================================================
const showViewDialog = ref(false)
const viewingNpc = ref<NPC | null>(null)
const npcViewStack = ref<NPC[]>([]) // Stack for nested NPC views

const showEditDialog = ref(false)
const editingNpcId = ref<number | null>(null)

const showDeleteDialog = ref(false)
const deletingNpc = ref<NPC | null>(null)
const deleting = ref(false)

// Open create dialog (no npcId)
function openCreateDialog() {
  editingNpcId.value = null
  showEditDialog.value = true
}

// Handle edit dialog close
function handleEditDialogClose(show: boolean) {
  showEditDialog.value = show
}

// Handle saved NPC (edit mode)
async function handleNpcSaved(_npc: NPC) {
  // If user is searching, re-execute search to update FTS5 results
  if (searchQuery.value && searchQuery.value.trim().length > 0) {
    await executeSearch(searchQuery.value)
  }
}

// Handle created NPC (create mode) - Store already loaded counts
async function handleNpcCreated(_npc: NPC) {
  // If user is searching, re-execute search
  if (searchQuery.value && searchQuery.value.trim().length > 0) {
    await executeSearch(searchQuery.value)
  }
}

// ============================================================================
// NPC Actions - Edit, View, Delete
// ============================================================================

// Edit NPC - just open dialog with ID, dialog loads everything itself
function editNpc(npc: NPC) {
  editingNpcId.value = npc.id
  showEditDialog.value = true
}

// View NPC (read-only mode)
async function viewNpc(npc: NPC) {
  // If dialog is already open, push current NPC to stack
  if (showViewDialog.value && viewingNpc.value) {
    npcViewStack.value.push(viewingNpc.value)
  }

  viewingNpc.value = npc
  showViewDialog.value = true
}

function handleEditFromView(npc: NPC) {
  // Close view dialog
  showViewDialog.value = false
  viewingNpc.value = null

  // Open edit dialog
  editNpc(npc)
}

// View NPC by ID (from relations in view dialog)
async function viewNpcById(npcId: number) {
  const npc = entitiesStore.npcs?.find((n) => n.id === npcId)
  if (npc) {
    viewNpc(npc)
  } else {
    console.error('NPC not found in store:', npcId)
  }
}

// View Item by ID (from items in view dialog)
async function viewItemById(itemId: number) {
  // TODO: Implement ItemViewDialog
  // For now, just a placeholder. We'll implement this when ItemViewDialog is created
  console.error('viewItemById not implemented yet:', itemId)
}

// View Location by ID (from locations in view dialog)
async function viewLocationById(locationId: number) {
  // Navigate to locations page with highlight
  await navigateTo(`/locations?highlight=${locationId}`)
}

// Go back to previous NPC in view stack
function goBackInNpcView() {
  const previousNpc = npcViewStack.value.pop()
  if (previousNpc) {
    viewingNpc.value = previousNpc
  }
}

// When closing dialog, clear the stack
watch(showViewDialog, (isOpen) => {
  if (!isOpen) {
    npcViewStack.value = []
    viewingNpc.value = null
  }
})

function deleteNpc(npc: NPC) {
  deletingNpc.value = npc
  showDeleteDialog.value = true
}

// Delete confirmation
async function confirmDelete() {
  if (!deletingNpc.value) return

  deleting.value = true

  try {
    await entitiesStore.deleteNPC(deletingNpc.value.id)

    // If user is searching, remove from search results
    if (searchQuery.value && searchQuery.value.trim().length > 0) {
      const deleteIndex = searchResults.value.findIndex((n) => n.id === deletingNpc.value?.id)
      if (deleteIndex !== -1) {
        searchResults.value.splice(deleteIndex, 1)
      }
    }

    showDeleteDialog.value = false
    deletingNpc.value = null
  } catch (error) {
    console.error('Failed to delete NPC:', error)
  } finally {
    deleting.value = false
  }
}

// All relation/membership/item/lore management now handled by NpcEditDialog internally!
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

/* Blur image during upload/generation */
.blur-image {
  filter: blur(8px);
  opacity: 0.6;
  transition:
    filter 0.3s ease,
    opacity 0.3s ease;
}

/* Highlighted card animation */
.highlighted-card {
  animation: highlight-pulse 2s ease-in-out;
  box-shadow: 0 0 0 3px rgb(var(--v-theme-primary)) !important;
}

/* NPC Card Hover Effect */
.npc-card {
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.npc-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15) !important;
}

/* NPC Description - Fixed 3 lines */
.npc-description {
  display: -webkit-box;
  line-clamp: 3;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.5;
  min-height: calc(1.5em * 3); /* 3 lines */
  max-height: calc(1.5em * 3);
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

/* Floating Action Button */
.fab-create {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 100;
}
</style>
