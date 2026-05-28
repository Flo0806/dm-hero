<template>
  <v-container>
    <UiPageHeader :title="$t('items.title')" :subtitle="$t('items.subtitle')">
      <template #actions>
        <v-btn color="primary" prepend-icon="mdi-plus" size="large" @click="openCreateDialog">
          {{ $t('items.create') }}
        </v-btn>
      </template>
    </UiPageHeader>

    <!-- Search Bar (hidden while a folder is open) -->
    <div v-if="!openedFolder" class="d-flex align-center ga-3 mb-4">
      <v-text-field
        v-model="searchQuery"
        :placeholder="$t('common.search')"
        prepend-inner-icon="mdi-magnify"
        :loading="searching"
        variant="outlined"
        clearable
        hide-details
      />
      <v-btn
        :icon="entitiesStore.showArchived ? 'mdi-archive-check' : 'mdi-archive-off'"
        :color="entitiesStore.showArchived ? 'warning' : undefined"
        variant="text"
        @click="entitiesStore.toggleShowArchived()"
      >
        <v-icon>{{ entitiesStore.showArchived ? 'mdi-archive-check' : 'mdi-archive-off' }}</v-icon>
        <v-tooltip activator="parent" location="bottom">
          {{ $t('common.showArchived') }}
        </v-tooltip>
      </v-btn>
    </div>

    <!-- Folders -->
    <SharedFolderRow
      v-if="activeCampaignIdNumber && !openedFolder"
      :campaign-id="activeCampaignIdNumber"
      entity-type="item"
      @open="onFolderOpen"
      @folder-deleted="onFolderDeleted"
    />

    <!-- Folder open view -->
    <SharedFolderOpenView
      v-if="openedFolder"
      :folder="openedFolder"
      @close="closeFolder"
    >
      <template #contents>
        <v-row v-if="itemsInOpenFolder.length > 0">
          <v-col v-for="item in itemsInOpenFolder" :key="item.id" cols="12" md="6" lg="4">
            <ItemCard
              :item="item"
              @view="viewItem"
              @edit="editItem"
              @download="(item: Item) => downloadImage(`/uploads/${item.image_url}`, item.name)"
              @archive="archiveEntity"
              @delete="deleteItem"
              @chaos="openChaosGraph"
              @open-group="openGroupPreview"
              @open-tab="openItemTab"
              @create-group="groupCreate.open"
              @moved="onItemMoved"
              @move-error="onItemMoveError"
            />
          </v-col>
        </v-row>
        <div v-else class="text-center text-medium-emphasis py-6">
          {{ $t('folders.emptyContents') }}
        </div>
      </template>
      <template #pool>
        <div v-if="itemsAvailableForFolder.length === 0" class="text-center text-medium-emphasis py-4">
          {{ $t('folders.emptyPool') }}
        </div>
        <v-row v-else>
          <v-col v-for="item in itemsAvailableForFolder" :key="item.id" cols="12" sm="6" md="4" lg="3">
            <div class="d-flex align-center ga-1">
              <SharedCompactEntityCard
                :entity="toCompactEntity(item)"
                fallback-icon="mdi-sword"
                class="flex-grow-1"
                style="min-width: 0"
                @open="viewItem(item)"
              />
              <v-btn
                icon="mdi-folder-arrow-left-outline"
                size="small"
                variant="text"
                color="primary"
                :title="$t('folders.moveHere')"
                @click="moveIntoOpenFolder(item)"
              />
            </div>
          </v-col>
        </v-row>
      </template>
    </SharedFolderOpenView>

    <v-row v-if="!openedFolder && pending">
      <v-col v-for="i in 6" :key="i" cols="12" md="6" lg="4">
        <v-skeleton-loader type="card" />
      </v-col>
    </v-row>

    <!-- Item Cards with Search Overlay -->
    <div v-else-if="!openedFolder && filteredItems && filteredItems.length > 0" class="position-relative">
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
          <div class="text-headline-small">{{ $t('common.searching') }}</div>
        </div>
      </v-overlay>

      <!-- Item Cards -->
      <v-row>
        <TransitionGroup tag="div" name="card-move-out" class="card-grid-contents">
          <v-col v-for="item in filteredItems" :key="item.id" cols="12" md="6" lg="4">
            <ItemCard
              :item="item"
              :is-highlighted="highlightedId === item.id"
              @view="viewItem"
              @edit="editItem"
              @download="(item) => downloadImage(`/uploads/${item.image_url}`, item.name)"
              @archive="archiveEntity"
              @delete="deleteItem"
              @chaos="openChaosGraph"
              @open-group="openGroupPreview"
              @open-tab="openItemTab"
              @create-group="groupCreate.open"
              @moved="onItemMoved"
              @move-error="onItemMoveError"
            />
          </v-col>
        </TransitionGroup>
      </v-row>
    </div>

    <ClientOnly v-else-if="!openedFolder">
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
          <h2 class="text-headline-medium mb-2">{{ $t('items.empty') }}</h2>
          <p class="text-body-large text-medium-emphasis mb-4">{{ $t('items.emptyText') }}</p>
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
        :players="itemPlayers"
        :documents="itemDocuments"
        :images="itemImages"
        :counts="viewDialogCounts"
        :loading="loadingViewData"
        :loading-owners="loadingOwners"
        :loading-locations="loadingLocations"
        :loading-factions="loadingFactions"
        :loading-lore="loadingLore"
        :loading-players="loadingPlayers"
        @edit="editItemAndCloseView"
        @preview-image="(image: { image_url: string }) => openImagePreview(`/uploads/${image.image_url}`, viewingItem?.name || '')"
      />
    </ClientOnly>

    <!-- Create/Edit Item Dialog - Now self-contained! -->
    <ClientOnly>
      <ItemEditDialog
        :show="showEditDialog"
        :item-id="editingItemId"
        :initial-tab="editDialogInitialTab"
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

    <!-- Group Preview Dialog -->
    <ClientOnly>
      <GroupPreviewDialog
        v-model="showGroupPreview"
        :group-id="previewGroupId"
      />
    </ClientOnly>

    <!-- Group Create Dialog (from context menu) -->
    <ClientOnly>
      <GroupsGroupCreateForEntityDialog
        v-model="groupCreate.show.value"
        :entity-id="groupCreate.entityId.value"
        @done="handleGroupCreated"
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
import type { Item } from '../../../types/item'
import ImagePreviewDialog from '~/components/shared/ImagePreviewDialog.vue'
import ItemCard from '~/components/items/ItemCard.vue'
import ItemViewDialog from '~/components/items/ItemViewDialog.vue'
import ItemEditDialog from '~/components/items/ItemEditDialog.vue'
import GroupPreviewDialog from '~/components/groups/GroupPreviewDialog.vue'

const { locale } = useI18n()
const router = useRouter()
const route = useRoute()
const campaignStore = useCampaignStore()
const entitiesStore = useEntitiesStore()
const snackbarStore = useSnackbarStore()
const { loadItemCountsBatch } = useItemCounts()

const activeCampaignId = computed(() => campaignStore.activeCampaignId)
const activeCampaignIdNumber = computed(() => campaignStore.activeCampaignIdNumber)

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

    // Load counts for search results using the shared composable
    // This ensures ItemCard gets the counts via getCounts()
    loadItemCountsBatch(results)
  }
  catch (error: unknown) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') return
    console.error('Search failed:', error)
    searchResults.value = []
  }
  finally {
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
  // Active search transcends folders (find anything by name).
  if (searchQuery.value && searchQuery.value.trim().length > 0) {
    return searchResults.value
  }
  // Default view hides items that live in a folder — folder card surfaces them.
  return [...(items.value || [])]
    .filter(item => !item.folder_id)
    .sort((a, b) => a.name.localeCompare(b.name))
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
  }
  else {
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

const items = computed(() => entitiesStore.activeItems)
const pending = computed(() => entitiesStore.itemsLoading)

onMounted(async () => {
  await entitiesStore.fetchItems(activeCampaignId.value!)

  if (items.value && items.value.length > 0) {
    await entitiesStore.loadAllItemCounts(activeCampaignId.value!)
  }

  initializeFromQuery()
})

// ============================================================================
// Edit Dialog (self-contained)
// ============================================================================
const showEditDialog = ref(false)
const editingItemId = ref<number | null>(null)
const editDialogInitialTab = ref<string | undefined>(undefined)

function openCreateDialog() {
  editingItemId.value = null
  editDialogInitialTab.value = undefined
  showEditDialog.value = true
}

function editItem(item: Item) {
  editingItemId.value = item.id
  editDialogInitialTab.value = undefined
  showEditDialog.value = true
}

function openItemTab(item: Item, tab: string) {
  editingItemId.value = item.id
  editDialogInitialTab.value = tab
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
    editDialogInitialTab.value = undefined
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

  // Highlight and scroll to the newly created item
  highlightedId.value = item.id
  await nextTick()
  setTimeout(() => {
    const element = document.getElementById(`item-${item.id}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    // Clear highlight after a few seconds
    setTimeout(() => {
      highlightedId.value = null
    }, 3000)
  }, 100)
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
const loadingPlayers = ref(false)

const viewDialogCounts = ref<{
  owners: number
  locations: number
  factions: number
  lore: number
  players: number
  documents: number
  images: number
} | null>(null)

const itemDocuments = ref<Array<{ id: number, title: string, content: string }>>([])
const itemImages = ref<Array<{ id: number, image_url: string, is_primary: boolean }>>([])
const itemOwners = ref<Array<{ id: number, name: string, description?: string | null, image_url?: string | null, relation_type?: string }>>([])
const itemLocations = ref<Array<{ id: number, name: string, description?: string | null, image_url?: string | null, relation_type?: string }>>([])
const itemFactions = ref<Array<{ id: number, name: string, description?: string | null, image_url?: string | null, relation_type?: string }>>([])
const itemLore = ref<Array<{ id: number, name: string, description?: string | null, image_url?: string | null }>>([])
const itemPlayers = ref<Array<{ id: number, name: string, description?: string | null, image_url?: string | null, relation_type?: string }>>([])

async function viewItem(item: Item) {
  viewingItem.value = item
  showViewDialog.value = true

  loadingViewData.value = true
  loadingOwners.value = true
  loadingLocations.value = true
  loadingFactions.value = true
  loadingLore.value = true
  loadingPlayers.value = true

  try {
    const [owners, locations, factions, lore, players, documents, images, counts] = await Promise.all([
      $fetch<typeof itemOwners.value>(`/api/entities/${item.id}/related/npcs`).catch(() => []),
      $fetch<typeof itemLocations.value>(`/api/entities/${item.id}/related/locations`).catch(() => []),
      $fetch<typeof itemFactions.value>(`/api/entities/${item.id}/related/factions`).catch(() => []),
      $fetch<typeof itemLore.value>(`/api/entities/${item.id}/related/lore`).catch(() => []),
      $fetch<typeof itemPlayers.value>(`/api/entities/${item.id}/related/players`).catch(() => []),
      $fetch<typeof itemDocuments.value>(`/api/entities/${item.id}/documents`).catch(() => []),
      $fetch<typeof itemImages.value>(`/api/entity-images/${item.id}`).catch(() => []),
      $fetch<typeof viewDialogCounts.value>(`/api/items/${item.id}/counts`).catch(() => null),
    ])

    itemOwners.value = owners
    itemLocations.value = locations
    itemFactions.value = factions
    itemLore.value = lore
    itemPlayers.value = players
    itemDocuments.value = documents
    itemImages.value = images
    viewDialogCounts.value = counts
  }
  finally {
    loadingViewData.value = false
    loadingOwners.value = false
    loadingLocations.value = false
    loadingFactions.value = false
    loadingLore.value = false
    loadingPlayers.value = false
  }
}

// ============================================================================
// Delete Dialog
// ============================================================================
const showDeleteDialog = ref(false)
const deletingItem = ref<Item | null>(null)
const deleting = ref(false)

// ----------------------------------------------------------------------------
// Folder integration — mirrors the NPC page pattern.
// ----------------------------------------------------------------------------
const foldersStore = useFoldersStore()
const openedFolderId = ref<number | null>(null)

const openedFolder = computed(() => {
  if (openedFolderId.value === null || !activeCampaignIdNumber.value) return null
  return foldersStore.folders(activeCampaignIdNumber.value, 'item')
    .find(f => f.id === openedFolderId.value) ?? null
})

const itemsInOpenFolder = computed(() => {
  if (openedFolderId.value === null) return []
  return (items.value ?? [])
    .filter((i: Item) => i.folder_id === openedFolderId.value)
    .sort((a: Item, b: Item) => a.name.localeCompare(b.name))
})

const itemsAvailableForFolder = computed(() => {
  return (items.value ?? [])
    .filter((i: Item) => !i.folder_id)
    .sort((a: Item, b: Item) => a.name.localeCompare(b.name))
})

function onFolderOpen(folder: { id: number }) {
  openedFolderId.value = folder.id
}

function closeFolder() {
  openedFolderId.value = null
}

function onItemMoved(item: Item, toFolderId: number | null, folderName: string | null) {
  entitiesStore.setFolderForEntity('items', item.id, toFolderId)
  const msg = toFolderId === null
    ? $t('folders.movedOut', { name: item.name })
    : $t('folders.movedInto', { name: item.name, folder: folderName ?? '' })
  snackbarStore.success(msg)
}

function onItemMoveError(_error: unknown) {
  snackbarStore.error($t('folders.moveError'))
}

function onFolderDeleted(folderId: number) {
  entitiesStore.clearFolderForEntities('items', folderId)
  for (const item of searchResults.value) {
    if (item.folder_id === folderId) item.folder_id = null
  }
}

// Compact-card subtitle for items: type · rarity (localized).
function toCompactEntity(item: Item) {
  const type = item.metadata?.type ? $t(`items.types.${item.metadata.type}`, item.metadata.type) : ''
  const rarity = item.metadata?.rarity ? $t(`items.rarities.${item.metadata.rarity}`, item.metadata.rarity) : ''
  const subtitle = [type, rarity].filter(Boolean).join(' · ') || null
  return {
    id: item.id,
    name: item.name,
    image_url: item.image_url,
    subtitle,
  }
}

async function moveIntoOpenFolder(item: Item) {
  if (openedFolderId.value === null || !activeCampaignIdNumber.value) return
  const target = openedFolderId.value
  const folderName = openedFolder.value?.name ?? null
  try {
    await foldersStore.moveEntity(
      activeCampaignIdNumber.value,
      'item',
      item.id,
      item.folder_id ?? null,
      target,
    )
    onItemMoved(item, target, folderName)
  }
  catch (e) {
    onItemMoveError(e)
  }
}

async function archiveEntity(entity: Item) {
  try {
    const archive = !entity.archived_at
    await entitiesStore.archiveEntity(entity.id, archive)
    snackbarStore.success($t(archive ? 'common.archiveSuccess' : 'common.unarchiveSuccess'))
  }
  catch (error) {
    console.error('Failed to archive entity:', error)
    snackbarStore.error($t('common.archiveError'))
  }
}

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
  }
  catch (error) {
    console.error('Failed to delete item:', error)
  }
  finally {
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

// ============================================================================
// Group Preview
// ============================================================================
const showGroupPreview = ref(false)
const previewGroupId = ref<number | null>(null)

function openGroupPreview(groupId: number) {
  previewGroupId.value = groupId
  showGroupPreview.value = true
}

// ============================================================================
// Group Create (from context menu "Neue Gruppe")
// ============================================================================
const groupCreate = useGroupCreate()

async function handleGroupCreated() {
  if (activeCampaignId.value) {
    await entitiesStore.loadAllItemCounts(activeCampaignId.value)
  }
}
</script>

<style scoped>
/* Floating Action Button */
.fab-create {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 100;
}

/* Card move-out fade — TransitionGroup wrapper is invisible to layout. */
.card-grid-contents {
  display: contents;
}
.card-move-out-leave-active {
  transition: opacity 280ms ease, transform 280ms ease;
}
.card-move-out-leave-to {
  opacity: 0;
  transform: scale(0.85);
}
</style>
