<template>
  <v-container>
    <UiPageHeader :title="$t('lore.title')" :subtitle="$t('lore.subtitle')">
      <template #actions>
        <v-btn color="primary" prepend-icon="mdi-plus" size="large" @click="openCreateDialog">
          {{ $t('lore.create') }}
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

    <v-row v-if="pending">
      <v-col v-for="i in 6" :key="i" cols="12" md="6" lg="4">
        <v-skeleton-loader type="card" />
      </v-col>
    </v-row>

    <!-- Lore Cards with Search Overlay -->
    <div v-else-if="filteredLore && filteredLore.length > 0" class="position-relative">
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

      <!-- Lore Cards -->
      <v-row>
        <v-col v-for="loreEntry in filteredLore" :key="loreEntry.id" cols="12" md="6" lg="4">
          <LoreCard
            :lore="loreEntry"
            :is-highlighted="highlightedId === loreEntry.id"
            @view="viewLore"
            @edit="editLore"
            @download="(lore) => downloadImage(`/uploads/${lore.image_url}`, lore.name)"
            @delete="confirmDelete"
            @chaos="openChaos"
          />
        </v-col>
      </v-row>
    </div>

    <!-- Empty State -->
    <v-card v-else>
      <v-card-text class="text-center pa-8">
        <v-icon icon="mdi-book-open-variant" size="64" color="grey" class="mb-4" />
        <div class="text-h6 mb-2">
          {{ $t('lore.empty') }}
        </div>
        <div class="text-body-2 text-medium-emphasis mb-4">
          {{ $t('lore.emptyText') }}
        </div>
        <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreateDialog">
          {{ $t('lore.create') }}
        </v-btn>
      </v-card-text>
    </v-card>

    <!-- Self-contained Edit Dialog -->
    <LoreEditDialog
      :show="showEditDialog"
      :lore-id="editingLoreId"
      @update:show="handleDialogClose"
      @saved="handleLoreSaved"
      @created="handleLoreCreated"
    />

    <!-- View Dialog -->
    <LoreViewDialog
      v-model="showViewDialog"
      :lore="selectedLore"
      :npcs="viewDialogNpcs"
      :items="viewDialogItems"
      :factions="viewDialogFactions"
      :locations="viewDialogLocations"
      :documents="viewDialogDocuments"
      :images="viewDialogImages"
      :counts="viewDialogCounts"
      :loading-npcs="loadingViewNpcs"
      :loading-items="loadingViewItems"
      :loading-factions="loadingViewFactions"
      :loading-locations="loadingViewLocations"
      @edit="editLore"
      @preview-image="handlePreviewImage"
    />

    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="showDeleteDialog" max-width="400">
      <v-card>
        <v-card-title>{{ $t('lore.deleteConfirmTitle') }}</v-card-title>
        <v-card-text>
          {{ $t('lore.deleteConfirmText', { name: loreToDelete?.name }) }}
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showDeleteDialog = false">
            {{ $t('common.cancel') }}
          </v-btn>
          <v-btn color="error" :loading="deleting" @click="deleteLore">
            {{ $t('common.delete') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Image Preview Dialog -->
    <ImagePreviewDialog v-model="showImagePreview" :image-url="previewImageUrl" :title="previewImageName" />

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
import type { Lore } from '../../../types/lore'
import LoreCard from '~/components/lore/LoreCard.vue'
import LoreViewDialog from '~/components/lore/LoreViewDialog.vue'
import LoreEditDialog from '~/components/lore/LoreEditDialog.vue'
import ImagePreviewDialog from '~/components/shared/ImagePreviewDialog.vue'

// Composables
const route = useRoute()
const router = useRouter()
const campaignStore = useCampaignStore()
const entitiesStore = useEntitiesStore()
const { downloadImage } = useImageDownload()
const { loadLoreCountsBatch } = useLoreCounts()

// Refs for search
const searchQuery = ref('')
const searchResults = ref<Lore[]>([])
const searching = ref(false)

// Get active campaign from store
const activeCampaignId = computed(() => campaignStore.activeCampaignId)

// Get lore from store
const lore = computed(() => entitiesStore.lore)

// Refs for dialogs
const showEditDialog = ref(false)
const showViewDialog = ref(false)
const showDeleteDialog = ref(false)
const editingLoreId = ref<number | null>(null)
const selectedLore = ref<Lore | null>(null)
const loreToDelete = ref<Lore | null>(null)
const deleting = ref(false)
const highlightedId = ref<number | null>(null)

// View Dialog data
const viewDialogNpcs = ref<Array<{ id: number; name: string; description: string | null; image_url: string | null }>>([])
const viewDialogItems = ref<Array<{ id: number; name: string; description: string | null; image_url: string | null }>>([])
const viewDialogFactions = ref<
  Array<{ id: number; name: string; description: string | null; image_url: string | null }>
>([])
const viewDialogLocations = ref<
  Array<{ id: number; name: string; description: string | null; image_url: string | null }>
>([])
const viewDialogDocuments = ref<Array<{ id: number; title: string; content: string }>>([])
const viewDialogImages = ref<Array<{ id: number; image_url: string; is_primary: boolean }>>([])
const viewDialogCounts = ref<{
  npcs: number
  items: number
  factions: number
  locations: number
  documents: number
  images: number
} | null>(null)
const loadingViewNpcs = ref(false)
const loadingViewItems = ref(false)
const loadingViewFactions = ref(false)
const loadingViewLocations = ref(false)

// Image preview
const showImagePreview = ref(false)
const previewImageUrl = ref('')
const previewImageName = ref('')

// Check for active campaign and handle highlighting
onMounted(async () => {
  await entitiesStore.fetchLore(activeCampaignId.value!)

  // Load counts for all lore entries in background using store
  if (lore.value && lore.value.length > 0) {
    lore.value.forEach((l) => {
      if (!l._counts) {
        entitiesStore.loadLoreCounts(l.id)
      }
    })
  }

  // Handle highlight query parameter
  const highlightParam = route.query.highlight
  const searchParam = route.query.search
  if (highlightParam && searchParam) {
    highlightedId.value = Number.parseInt(highlightParam as string, 10)
    searchQuery.value = searchParam as string

    // Scroll to highlighted card after a short delay
    nextTick(() => {
      setTimeout(() => {
        const element = document.getElementById(`lore-${highlightedId.value}`)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 500)
    })
  }
})

// Loading state from store
const pending = computed(() => entitiesStore.loreLoading)

// Debounced search
let searchTimeout: ReturnType<typeof setTimeout> | null = null
watch(searchQuery, async (query) => {
  // Clear highlight when user manually searches
  if (highlightedId.value && query !== route.query.search) {
    highlightedId.value = null
    router.replace({ query: {} })
  }

  if (searchTimeout) clearTimeout(searchTimeout)

  if (!query || query.trim().length === 0) {
    searchResults.value = []
    return
  }

  searchTimeout = setTimeout(async () => {
    searching.value = true
    try {
      const results = await $fetch<Lore[]>('/api/lore', {
        query: {
          campaignId: activeCampaignId.value,
          search: query.trim(),
        },
      })
      searchResults.value = results

      // Load counts for search results using the shared composable
      // This ensures LoreCard gets the counts via getCounts()
      loadLoreCountsBatch(results)
    } finally {
      searching.value = false
    }
  }, 300)
})

// Computed filtered lore (search results OR cached data)
const filteredLore = computed(() => {
  if (searchQuery.value && searchQuery.value.trim().length > 0) {
    return searchResults.value
  }
  return lore.value || []
})

// Open create dialog
function openCreateDialog() {
  editingLoreId.value = null
  showEditDialog.value = true
}

// View lore entry
async function viewLore(loreEntry: Lore) {
  selectedLore.value = loreEntry
  showViewDialog.value = true

  loadingViewNpcs.value = true
  loadingViewItems.value = true
  loadingViewFactions.value = true
  loadingViewLocations.value = true

  // Load all data in parallel
  try {
    const [npcs, items, factions, locations, documents, images, counts] = await Promise.all([
      $fetch<typeof viewDialogNpcs.value>(`/api/entities/${loreEntry.id}/related/npcs`).catch(() => []),
      $fetch<typeof viewDialogItems.value>(`/api/entities/${loreEntry.id}/related/items`).catch(() => []),
      $fetch<typeof viewDialogFactions.value>(`/api/entities/${loreEntry.id}/related/factions`).catch(() => []),
      $fetch<typeof viewDialogLocations.value>(`/api/entities/${loreEntry.id}/related/locations`).catch(() => []),
      $fetch<typeof viewDialogDocuments.value>(`/api/entities/${loreEntry.id}/documents`).catch(() => []),
      $fetch<typeof viewDialogImages.value>(`/api/entity-images/${loreEntry.id}`).catch(() => []),
      $fetch<typeof viewDialogCounts.value>(`/api/lore/${loreEntry.id}/counts`).catch(() => null),
    ])

    viewDialogNpcs.value = npcs
    viewDialogItems.value = items
    viewDialogFactions.value = factions
    viewDialogLocations.value = locations
    viewDialogDocuments.value = documents
    viewDialogImages.value = images
    viewDialogCounts.value = counts
  } catch (error) {
    console.error('Failed to load lore data:', error)
  } finally {
    loadingViewNpcs.value = false
    loadingViewItems.value = false
    loadingViewFactions.value = false
    loadingViewLocations.value = false
  }
}

// Edit lore entry
function editLore(loreEntry: Lore) {
  editingLoreId.value = loreEntry.id
  showViewDialog.value = false
  showEditDialog.value = true
}

// Handle dialog close
function handleDialogClose(value: boolean) {
  showEditDialog.value = value
  if (!value) {
    editingLoreId.value = null
  }
}

// Handle lore saved
async function handleLoreSaved(savedLore: Lore) {
  // Reload counts from store
  await entitiesStore.loadLoreCounts(savedLore.id)

  // If user is searching, re-execute search to update FTS5 results
  if (searchQuery.value && searchQuery.value.trim().length > 0) {
    const results = await $fetch<Lore[]>('/api/lore', {
      query: {
        campaignId: activeCampaignId.value,
        search: searchQuery.value.trim(),
      },
    })
    searchResults.value = results
  }
}

// Handle lore created
async function handleLoreCreated(createdLore: Lore) {
  // Reload counts from store
  await entitiesStore.loadLoreCounts(createdLore.id)

  // If user is searching, re-execute search to update FTS5 results
  if (searchQuery.value && searchQuery.value.trim().length > 0) {
    const results = await $fetch<Lore[]>('/api/lore', {
      query: {
        campaignId: activeCampaignId.value,
        search: searchQuery.value.trim(),
      },
    })
    searchResults.value = results
  }
}

// Confirm delete
function confirmDelete(loreEntry: Lore) {
  loreToDelete.value = loreEntry
  showDeleteDialog.value = true
}

// Delete lore entry
async function deleteLore() {
  if (!loreToDelete.value) return

  deleting.value = true
  try {
    await $fetch(`/api/lore/${loreToDelete.value.id}`, {
      method: 'DELETE',
    })

    if (activeCampaignId.value!) {
      await entitiesStore.fetchLore(activeCampaignId.value, true)
    }
    showDeleteDialog.value = false
    loreToDelete.value = null
  } catch (error) {
    console.error('Failed to delete lore:', error)
  } finally {
    deleting.value = false
  }
}

// Open Chaos graph
function openChaos(loreEntry: Lore) {
  router.push(`/chaos/${loreEntry.id}`)
}

// Handle image preview
function handlePreviewImage(imageUrl: string, title: string) {
  previewImageUrl.value = imageUrl
  previewImageName.value = title
  showImagePreview.value = true
}
</script>

<style scoped>
.highlighted-card {
  animation: highlight-pulse 2s ease-in-out;
  box-shadow: 0 0 0 3px rgba(var(--v-theme-primary), 0.5) !important;
}

@keyframes highlight-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 3px rgba(var(--v-theme-primary), 0);
  }
  50% {
    box-shadow: 0 0 0 3px rgba(var(--v-theme-primary), 0.8);
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
