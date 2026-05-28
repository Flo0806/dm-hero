<template>
  <v-container>
    <UiPageHeader :title="$t('lore.title')" :subtitle="$t('lore.subtitle')">
      <template #actions>
        <v-btn color="primary" prepend-icon="mdi-plus" size="large" @click="openCreateDialog">
          {{ $t('lore.create') }}
        </v-btn>
      </template>
    </UiPageHeader>

    <!-- Search Bar (hidden while a folder is open) -->
    <div v-if="!openedFolder" class="d-flex align-center ga-3 mb-4">
      <v-text-field
        v-model="searchQuery"
        :placeholder="$t('common.search')"
        prepend-inner-icon="mdi-magnify"
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
      entity-type="lore"
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
        <v-row v-if="loreInOpenFolder.length > 0">
          <v-col v-for="loreEntry in loreInOpenFolder" :key="loreEntry.id" cols="12" md="6" lg="4">
            <LoreCard
              :lore="loreEntry"
              @view="viewLore"
              @edit="editLore"
              @download="(lore: Lore) => downloadImage(`/uploads/${lore.image_url}`, lore.name)"
              @archive="archiveEntity"
              @delete="confirmDelete"
              @chaos="openChaos"
              @open-group="openGroupPreview"
              @open-tab="openLoreTab"
              @create-group="groupCreate.open"
              @moved="onLoreMoved"
              @move-error="onLoreMoveError"
            />
          </v-col>
        </v-row>
        <div v-else class="text-center text-medium-emphasis py-6">
          {{ $t('folders.emptyContents') }}
        </div>
      </template>
      <template #pool>
        <div v-if="loreAvailableForFolder.length === 0" class="text-center text-medium-emphasis py-4">
          {{ $t('folders.emptyPool') }}
        </div>
        <v-row v-else>
          <v-col v-for="loreEntry in loreAvailableForFolder" :key="loreEntry.id" cols="12" sm="6" md="4" lg="3">
            <div class="d-flex align-center ga-1">
              <SharedCompactEntityCard
                :entity="toCompactEntity(loreEntry)"
                fallback-icon="mdi-book-open-variant"
                class="flex-grow-1"
                style="min-width: 0"
                @open="viewLore(loreEntry)"
              />
              <v-btn
                icon="mdi-folder-arrow-left-outline"
                size="small"
                variant="text"
                color="primary"
                :title="$t('folders.moveHere')"
                @click="moveIntoOpenFolder(loreEntry)"
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

    <!-- Lore Cards with Search Overlay -->
    <div v-else-if="!openedFolder && filteredLore && filteredLore.length > 0" class="position-relative">
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
          <div class="text-headline-small">
            {{ $t('common.searching') }}
          </div>
        </div>
      </v-overlay>

      <!-- Lore Cards -->
      <v-row>
        <TransitionGroup tag="div" name="card-move-out" class="card-grid-contents">
          <v-col v-for="loreEntry in filteredLore" :key="loreEntry.id" cols="12" md="6" lg="4">
            <LoreCard
              :lore="loreEntry"
              :is-highlighted="highlightedId === loreEntry.id"
              @view="viewLore"
              @edit="editLore"
              @download="(lore) => downloadImage(`/uploads/${lore.image_url}`, lore.name)"
              @archive="archiveEntity"
              @delete="confirmDelete"
              @chaos="openChaos"
              @open-group="openGroupPreview"
              @open-tab="openLoreTab"
              @create-group="groupCreate.open"
              @moved="onLoreMoved"
              @move-error="onLoreMoveError"
            />
          </v-col>
        </TransitionGroup>
      </v-row>
    </div>

    <!-- Empty State -->
    <v-card v-else-if="!openedFolder">
      <v-card-text class="text-center pa-8">
        <v-icon icon="mdi-book-open-variant" size="64" color="grey" class="mb-4" />
        <div class="text-headline-small mb-2">
          {{ $t('lore.empty') }}
        </div>
        <div class="text-body-medium text-medium-emphasis mb-4">
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
      :initial-tab="editDialogInitialTab"
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
      :players="viewDialogPlayers"
      :documents="viewDialogDocuments"
      :images="viewDialogImages"
      :counts="viewDialogCounts"
      :loading-npcs="loadingViewNpcs"
      :loading-items="loadingViewItems"
      :loading-factions="loadingViewFactions"
      :loading-locations="loadingViewLocations"
      :loading-players="loadingViewPlayers"
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

    <!-- Group Preview Dialog -->
    <GroupPreviewDialog
      v-model="showGroupPreview"
      :group-id="previewGroupId"
    />

    <!-- Group Create Dialog (from context menu) -->
    <GroupsGroupCreateForEntityDialog
      v-model="groupCreate.show.value"
      :entity-id="groupCreate.entityId.value"
      @done="handleGroupCreated"
    />

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
import GroupPreviewDialog from '~/components/groups/GroupPreviewDialog.vue'

// Composables
const route = useRoute()
const router = useRouter()
const campaignStore = useCampaignStore()
const entitiesStore = useEntitiesStore()
const snackbarStore = useSnackbarStore()
const { downloadImage } = useImageDownload()
const { loadLoreCountsBatch } = useLoreCounts()

// Refs for search
const searchQuery = ref('')
const searchResults = ref<Lore[]>([])
const searching = ref(false)

// Get active campaign from store
const activeCampaignId = computed(() => campaignStore.activeCampaignId)
const activeCampaignIdNumber = computed(() => campaignStore.activeCampaignIdNumber)

// Get lore from store
const lore = computed(() => entitiesStore.activeLore)

// Refs for dialogs
const showEditDialog = ref(false)
const showViewDialog = ref(false)
const showDeleteDialog = ref(false)
const editingLoreId = ref<number | null>(null)
const editDialogInitialTab = ref<string | undefined>(undefined)
const selectedLore = ref<Lore | null>(null)
const loreToDelete = ref<Lore | null>(null)
const deleting = ref(false)
const highlightedId = ref<number | null>(null)

// View Dialog data
const viewDialogNpcs = ref<Array<{ id: number, name: string, description: string | null, image_url: string | null }>>([])
const viewDialogItems = ref<Array<{ id: number, name: string, description: string | null, image_url: string | null }>>([])
const viewDialogFactions = ref<
  Array<{ id: number, name: string, description: string | null, image_url: string | null }>
>([])
const viewDialogLocations = ref<
  Array<{ id: number, name: string, description: string | null, image_url: string | null }>
>([])
const viewDialogPlayers = ref<
  Array<{ id: number, name: string, description: string | null, image_url: string | null }>
>([])
const viewDialogDocuments = ref<Array<{ id: number, title: string, content: string }>>([])
const viewDialogImages = ref<Array<{ id: number, image_url: string, is_primary: boolean }>>([])
const viewDialogCounts = ref<{
  npcs: number
  items: number
  factions: number
  locations: number
  players: number
  documents: number
  images: number
} | null>(null)
const loadingViewNpcs = ref(false)
const loadingViewItems = ref(false)
const loadingViewFactions = ref(false)
const loadingViewLocations = ref(false)
const loadingViewPlayers = ref(false)

// Image preview
const showImagePreview = ref(false)
const previewImageUrl = ref('')
const previewImageName = ref('')

// Group preview
const showGroupPreview = ref(false)
const previewGroupId = ref<number | null>(null)

function openGroupPreview(groupId: number) {
  previewGroupId.value = groupId
  showGroupPreview.value = true
}

// Check for active campaign and handle highlighting
onMounted(async () => {
  await entitiesStore.fetchLore(activeCampaignId.value!)

  // Load counts for all lore entries using batch endpoint - 1 request instead of N
  if (lore.value && lore.value.length > 0) {
    await entitiesStore.loadAllLoreCounts(activeCampaignId.value!)
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
    }
    finally {
      searching.value = false
    }
  }, 300)
})

// Computed filtered lore (search results OR cached data)
const filteredLore = computed(() => {
  // Active search transcends folders.
  if (searchQuery.value && searchQuery.value.trim().length > 0) {
    return searchResults.value
  }
  // Default view hides lore in folders.
  return [...(lore.value || [])]
    .filter(l => !l.folder_id)
    .sort((a, b) => a.name.localeCompare(b.name))
})

// Folder integration (mirrors NPC/Item/Faction pages).
const foldersStore = useFoldersStore()
const openedFolderId = ref<number | null>(null)

const openedFolder = computed(() => {
  if (openedFolderId.value === null || !activeCampaignIdNumber.value) return null
  return foldersStore.folders(activeCampaignIdNumber.value, 'lore')
    .find(f => f.id === openedFolderId.value) ?? null
})

const loreInOpenFolder = computed(() => {
  if (openedFolderId.value === null) return []
  return (lore.value ?? [])
    .filter((l: Lore) => l.folder_id === openedFolderId.value)
    .sort((a: Lore, b: Lore) => a.name.localeCompare(b.name))
})

const loreAvailableForFolder = computed(() => {
  return (lore.value ?? [])
    .filter((l: Lore) => !l.folder_id)
    .sort((a: Lore, b: Lore) => a.name.localeCompare(b.name))
})

function onFolderOpen(folder: { id: number }) {
  openedFolderId.value = folder.id
}

function closeFolder() {
  openedFolderId.value = null
}

function onLoreMoved(loreEntry: Lore, toFolderId: number | null, folderName: string | null) {
  entitiesStore.setFolderForEntity('lore', loreEntry.id, toFolderId)
  const msg = toFolderId === null
    ? $t('folders.movedOut', { name: loreEntry.name })
    : $t('folders.movedInto', { name: loreEntry.name, folder: folderName ?? '' })
  snackbarStore.success(msg)
}

function onLoreMoveError(_error: unknown) {
  snackbarStore.error($t('folders.moveError'))
}

function onFolderDeleted(folderId: number) {
  entitiesStore.clearFolderForEntities('lore', folderId)
  for (const l of searchResults.value) {
    if (l.folder_id === folderId) l.folder_id = null
  }
}

function toCompactEntity(loreEntry: Lore) {
  const type = loreEntry.metadata?.type
    ? $t(`lore.types.${loreEntry.metadata.type}`, loreEntry.metadata.type)
    : ''
  return {
    id: loreEntry.id,
    name: loreEntry.name,
    image_url: loreEntry.image_url,
    subtitle: type || null,
  }
}

async function moveIntoOpenFolder(loreEntry: Lore) {
  if (openedFolderId.value === null || !activeCampaignIdNumber.value) return
  const target = openedFolderId.value
  const folderName = openedFolder.value?.name ?? null
  try {
    await foldersStore.moveEntity(
      activeCampaignIdNumber.value,
      'lore',
      loreEntry.id,
      loreEntry.folder_id ?? null,
      target,
    )
    onLoreMoved(loreEntry, target, folderName)
  }
  catch (e) {
    onLoreMoveError(e)
  }
}

// Open create dialog
function openCreateDialog() {
  editingLoreId.value = null
  editDialogInitialTab.value = undefined
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
  loadingViewPlayers.value = true

  // Load all data in parallel
  try {
    const [npcs, items, factions, locations, players, documents, images, counts] = await Promise.all([
      $fetch<typeof viewDialogNpcs.value>(`/api/entities/${loreEntry.id}/related/npcs`).catch(() => []),
      $fetch<typeof viewDialogItems.value>(`/api/entities/${loreEntry.id}/related/items`).catch(() => []),
      $fetch<typeof viewDialogFactions.value>(`/api/entities/${loreEntry.id}/related/factions`).catch(() => []),
      $fetch<typeof viewDialogLocations.value>(`/api/entities/${loreEntry.id}/related/locations`).catch(() => []),
      $fetch<typeof viewDialogPlayers.value>(`/api/entities/${loreEntry.id}/related/players`).catch(() => []),
      $fetch<typeof viewDialogDocuments.value>(`/api/entities/${loreEntry.id}/documents`).catch(() => []),
      $fetch<typeof viewDialogImages.value>(`/api/entity-images/${loreEntry.id}`).catch(() => []),
      $fetch<typeof viewDialogCounts.value>(`/api/lore/${loreEntry.id}/counts`).catch(() => null),
    ])

    viewDialogNpcs.value = npcs
    viewDialogItems.value = items
    viewDialogFactions.value = factions
    viewDialogLocations.value = locations
    viewDialogPlayers.value = players
    viewDialogDocuments.value = documents
    viewDialogImages.value = images
    viewDialogCounts.value = counts
  }
  catch (error) {
    console.error('Failed to load lore data:', error)
  }
  finally {
    loadingViewNpcs.value = false
    loadingViewItems.value = false
    loadingViewFactions.value = false
    loadingViewLocations.value = false
    loadingViewPlayers.value = false
  }
}

// Edit lore entry
function editLore(loreEntry: Lore) {
  editingLoreId.value = loreEntry.id
  editDialogInitialTab.value = undefined
  showViewDialog.value = false
  showEditDialog.value = true
}

// Open lore edit dialog on specific tab
function openLoreTab(loreEntry: Lore, tab: string) {
  editingLoreId.value = loreEntry.id
  editDialogInitialTab.value = tab
  showEditDialog.value = true
}

// Handle dialog close
function handleDialogClose(value: boolean) {
  showEditDialog.value = value
  if (!value) {
    editingLoreId.value = null
    editDialogInitialTab.value = undefined
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

  // Highlight and scroll to the newly created lore
  highlightedId.value = createdLore.id
  await nextTick()
  setTimeout(() => {
    const element = document.getElementById(`lore-${createdLore.id}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    // Clear highlight after a few seconds
    setTimeout(() => {
      highlightedId.value = null
    }, 3000)
  }, 100)
}

async function archiveEntity(entity: Lore) {
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
  }
  catch (error) {
    console.error('Failed to delete lore:', error)
  }
  finally {
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

// Group Create (from context menu "Neue Gruppe")
const groupCreate = useGroupCreate()

async function handleGroupCreated() {
  if (activeCampaignId.value) {
    await entitiesStore.loadAllLoreCounts(activeCampaignId.value)
  }
}
</script>

<style scoped>
/* Card move-out fade for folder moves. */
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
