<template>
  <v-container>
    <UiPageHeader :title="$t('items.title')" :subtitle="$t('items.subtitle')">
      <template #actions>
        <v-btn color="primary" prepend-icon="mdi-plus" size="large" @click="openCreateDialog">
          {{ $t('items.create') }}
        </v-btn>
      </template>
    </UiPageHeader>

    <!-- Search Bar -->
    <v-text-field
      v-model="searchQuery"
      :placeholder="$t('common.search')"
      prepend-inner-icon="mdi-magnify"
      :loading="searching"
      variant="outlined"
      clearable
      class="mb-4"
      :hint="searchQuery && searchQuery.trim().length > 0 ? $t('items.searchHint') : ''"
      persistent-hint
    />

    <v-row v-if="pending">
      <v-col v-for="i in 6" :key="i" cols="12" md="6" lg="4">
        <v-skeleton-loader type="card" />
      </v-col>
    </v-row>

    <!-- Item Cards with Search Overlay -->
    <div v-else-if="filteredItems && filteredItems.length > 0" class="position-relative">
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
          <div class="text-h6">{{ $t('common.searching') }}</div>
        </div>
      </v-overlay>

      <!-- Item Cards -->
      <v-row>
        <v-col v-for="item in filteredItems" :key="item.id" cols="12" md="6" lg="4">
          <ItemCard
            :item="item"
            :is-highlighted="highlightedId === item.id"
            @view="viewItem"
            @edit="editItem"
            @download="(item) => downloadImage(`/uploads/${item.image_url}`, item.name)"
            @delete="deleteItem"
            @chaos="openChaosGraph"
          />
        </v-col>
      </v-row>
    </div>

    <ClientOnly v-else>
      <v-empty-state icon="mdi-sword" :title="$t('items.empty')" :text="$t('items.emptyText')">
        <template #actions>
          <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreateDialog">
            {{ $t('items.create') }}
          </v-btn>
        </template>
      </v-empty-state>
      <template #fallback>
        <v-container class="text-center py-16">
          <v-icon icon="mdi-sword" size="64" color="grey" class="mb-4" />
          <h2 class="text-h5 mb-2">{{ $t('items.empty') }}</h2>
          <p class="text-body-1 text-medium-emphasis mb-4">{{ $t('items.emptyText') }}</p>
          <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreateDialog">
            {{ $t('items.create') }}
          </v-btn>
        </v-container>
      </template>
    </ClientOnly>

    <!-- View Item Dialog -->
    <ClientOnly>
      <ItemViewDialog
        v-model="showViewDialog"
        :item="viewingItem"
        :owners="itemOwners"
        :locations="itemLocations"
        :factions="itemFactions"
        :lore="itemLore"
        :documents="itemDocuments"
        :images="itemImages"
        :counts="viewDialogCounts"
        :loading="loadingViewData"
        :loading-owners="loadingOwners"
        :loading-locations="loadingLocations"
        :loading-factions="loadingFactions"
        :loading-lore="loadingLore"
        @edit="editItemAndCloseView"
        @preview-image="(image: { image_url: string }) => openImagePreview(`/uploads/${image.image_url}`, viewingItem?.name || '')"
      />
    </ClientOnly>

    <!-- Create/Edit Item Dialog - Now self-contained! -->
    <ClientOnly>
      <ItemEditDialog
        :show="showEditDialog"
        :item-id="editingItemId"
        @update:show="handleDialogClose"
        @saved="handleItemSaved"
        @created="handleItemCreated"
      />
    </ClientOnly>

    <!-- Image Preview Dialog -->
    <ClientOnly>
      <ImagePreviewDialog
        v-model="showImagePreview"
        :image-url="previewImageUrl"
        :title="previewImageTitle"
        :download-file-name="previewImageTitle"
      />
    </ClientOnly>

    <!-- Delete Confirmation Dialog -->
    <ClientOnly>
      <UiDeleteConfirmDialog
        v-model="showDeleteDialog"
        :title="$t('items.deleteTitle')"
        :message="$t('items.deleteConfirm', { name: deletingItem?.name })"
        :loading="deleting"
        @confirm="confirmDelete"
        @cancel="showDeleteDialog = false"
      />
    </ClientOnly>
  </v-container>
</template>

<script setup lang="ts">
import type { Item } from '../../../types/item'
import ImagePreviewDialog from '~/components/shared/ImagePreviewDialog.vue'
import ItemCard from '~/components/items/ItemCard.vue'
import ItemViewDialog from '~/components/items/ItemViewDialog.vue'
import ItemEditDialog from '~/components/items/ItemEditDialog.vue'

const { locale } = useI18n()
const router = useRouter()
const route = useRoute()
const campaignStore = useCampaignStore()
const entitiesStore = useEntitiesStore()

const activeCampaignId = computed(() => campaignStore.activeCampaignId)

// ============================================================================
// Search
// ============================================================================
const searchQuery = ref('')
const searchResults = ref<Item[]>([])
const searching = ref(false)

let searchTimeout: ReturnType<typeof setTimeout> | null = null
let abortController: AbortController | null = null

async function executeSearch(query: string) {
  if (!activeCampaignId.value) return

  if (abortController) abortController.abort()
  abortController = new AbortController()

  searching.value = true
  try {
    const results = await $fetch<Item[]>('/api/items', {
      query: { campaignId: activeCampaignId.value, search: query.trim() },
      headers: { 'Accept-Language': locale.value },
      signal: abortController.signal,
    })
    searchResults.value = results

    // Load counts for search results
    if (results.length > 0) {
      await Promise.all(results.map((item) => entitiesStore.loadItemCounts(item.id)))
    }
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') return
    console.error('Search failed:', error)
    searchResults.value = []
  } finally {
    searching.value = false
    abortController = null
  }
}

watch(searchQuery, async (query) => {
  if (searchTimeout) clearTimeout(searchTimeout)
  if (abortController) {
    abortController.abort()
    abortController = null
  }

  if (!query || query.trim().length === 0) {
    searchResults.value = []
    searching.value = false
    return
  }

  searching.value = true
  searchTimeout = setTimeout(() => executeSearch(query), 300)
})

const filteredItems = computed(() => {
  if (searchQuery.value && searchQuery.value.trim().length > 0) {
    return searchResults.value
  }
  return items.value || []
})

// ============================================================================
// Highlighted item (from global search)
// ============================================================================
const highlightedId = ref<number | null>(null)
const isFromGlobalSearch = ref(false)

function initializeFromQuery() {
  const highlightParam = route.query.highlight
  const searchParam = route.query.search

  if (highlightParam && searchParam) {
    highlightedId.value = Number(highlightParam)
    searchQuery.value = String(searchParam)
    isFromGlobalSearch.value = true

    nextTick(() => {
      setTimeout(() => {
        const element = document.getElementById(`item-${highlightedId.value}`)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 100)
    })
  }
}

watch(
  () => route.query,
  () => {
    highlightedId.value = null
    isFromGlobalSearch.value = false
    initializeFromQuery()
  },
  { deep: true },
)

watch(searchQuery, () => {
  if (isFromGlobalSearch.value) {
    isFromGlobalSearch.value = false
  } else {
    highlightedId.value = null
    if (route.query.highlight || route.query.search) {
      router.replace({ query: {} })
    }
  }
})

// ============================================================================
// Data Loading
// ============================================================================
const { downloadImage } = useImageDownload()

const items = computed(() => entitiesStore.items)
const pending = computed(() => entitiesStore.itemsLoading)

onMounted(async () => {
  await entitiesStore.fetchItems(activeCampaignId.value!)

  if (items.value && items.value.length > 0) {
    await entitiesStore.loadAllItemCounts()
  }

  initializeFromQuery()
})

// ============================================================================
// Edit Dialog (self-contained)
// ============================================================================
const showEditDialog = ref(false)
const editingItemId = ref<number | null>(null)

function openCreateDialog() {
  editingItemId.value = null
  showEditDialog.value = true
}

function editItem(item: Item) {
  editingItemId.value = item.id
  showEditDialog.value = true
}

function openChaosGraph(item: Item) {
  router.push(`/chaos/${item.id}`)
}

function editItemAndCloseView(item: Item | { id: number }) {
  editItem(item as Item)
  showViewDialog.value = false
}

function handleDialogClose(open: boolean) {
  showEditDialog.value = open
  if (!open) {
    editingItemId.value = null
  }
}

async function handleItemSaved(item: Item) {
  // Store is already updated by ItemEditDialog
  // Reload counts via store (reactive)
  await entitiesStore.loadItemCounts(item.id)

  // If searching, re-execute to update results
  if (searchQuery.value && searchQuery.value.trim().length > 0) {
    executeSearch(searchQuery.value)
  }
}

async function handleItemCreated(item: Item) {
  // Store is already updated by ItemEditDialog
  await entitiesStore.loadItemCounts(item.id)

  // If searching, re-execute to update results
  if (searchQuery.value && searchQuery.value.trim().length > 0) {
    executeSearch(searchQuery.value)
  }
}

// ============================================================================
// View Dialog
// ============================================================================
const showViewDialog = ref(false)
const viewingItem = ref<Item | null>(null)
const loadingViewData = ref(false)
const loadingOwners = ref(false)
const loadingLocations = ref(false)
const loadingFactions = ref(false)
const loadingLore = ref(false)

const viewDialogCounts = ref<{
  owners: number
  locations: number
  factions: number
  lore: number
  documents: number
  images: number
} | null>(null)

const itemDocuments = ref<Array<{ id: number; title: string; content: string }>>([])
const itemImages = ref<Array<{ id: number; image_url: string; is_primary: boolean }>>([])
const itemOwners = ref<Array<{ id: number; name: string; description?: string | null; image_url?: string | null; relation_type?: string }>>([])
const itemLocations = ref<Array<{ id: number; name: string; description?: string | null; image_url?: string | null; relation_type?: string }>>([])
const itemFactions = ref<Array<{ id: number; name: string; description?: string | null; image_url?: string | null; relation_type?: string }>>([])
const itemLore = ref<Array<{ id: number; name: string; description?: string | null; image_url?: string | null }>>([])

async function viewItem(item: Item) {
  viewingItem.value = item
  showViewDialog.value = true

  loadingViewData.value = true
  loadingOwners.value = true
  loadingLocations.value = true
  loadingFactions.value = true
  loadingLore.value = true

  try {
    const [owners, locations, factions, lore, documents, images, counts] = await Promise.all([
      $fetch<typeof itemOwners.value>(`/api/entities/${item.id}/related/npcs`).catch(() => []),
      $fetch<typeof itemLocations.value>(`/api/entities/${item.id}/related/locations`).catch(() => []),
      $fetch<typeof itemFactions.value>(`/api/entities/${item.id}/related/factions`).catch(() => []),
      $fetch<typeof itemLore.value>(`/api/entities/${item.id}/related/lore`).catch(() => []),
      $fetch<typeof itemDocuments.value>(`/api/entities/${item.id}/documents`).catch(() => []),
      $fetch<typeof itemImages.value>(`/api/entity-images/${item.id}`).catch(() => []),
      $fetch<typeof viewDialogCounts.value>(`/api/items/${item.id}/counts`).catch(() => null),
    ])

    itemOwners.value = owners
    itemLocations.value = locations
    itemFactions.value = factions
    itemLore.value = lore
    itemDocuments.value = documents
    itemImages.value = images
    viewDialogCounts.value = counts
  } finally {
    loadingViewData.value = false
    loadingOwners.value = false
    loadingLocations.value = false
    loadingFactions.value = false
    loadingLore.value = false
  }
}

// ============================================================================
// Delete Dialog
// ============================================================================
const showDeleteDialog = ref(false)
const deletingItem = ref<Item | null>(null)
const deleting = ref(false)

function deleteItem(item: Item) {
  deletingItem.value = item
  showDeleteDialog.value = true
}

async function confirmDelete() {
  if (!deletingItem.value) return

  deleting.value = true

  try {
    await entitiesStore.deleteItem(deletingItem.value.id)
    showDeleteDialog.value = false
    deletingItem.value = null
  } catch (error) {
    console.error('Failed to delete item:', error)
  } finally {
    deleting.value = false
  }
}

// ============================================================================
// Image Preview
// ============================================================================
const showImagePreview = ref(false)
const previewImageUrl = ref('')
const previewImageTitle = ref('')

function openImagePreview(imageUrl: string, title: string) {
  previewImageUrl.value = imageUrl
  previewImageTitle.value = title
  showImagePreview.value = true
}
</script>
