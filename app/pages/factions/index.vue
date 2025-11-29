<template>
  <v-container>
    <UiPageHeader :title="$t('factions.title')" :subtitle="$t('factions.subtitle')">
      <template #actions>
        <v-btn color="primary" prepend-icon="mdi-plus" size="large" @click="openCreateDialog">
          {{ $t('factions.create') }}
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
      :hint="searchQuery && searchQuery.trim().length > 0 ? $t('factions.searchHint') : ''"
      persistent-hint
    />

    <v-row v-if="pending">
      <v-col v-for="i in 6" :key="i" cols="12" md="6" lg="4">
        <v-skeleton-loader type="card" />
      </v-col>
    </v-row>

    <!-- Faction Cards with Search Overlay -->
    <div v-else-if="filteredFactions && filteredFactions.length > 0" class="position-relative">
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

      <!-- Faction Cards -->
      <v-row>
        <v-col v-for="faction in filteredFactions" :key="faction.id" cols="12" md="6" lg="4">
          <FactionCard
            :faction="faction"
            :is-highlighted="highlightedId === faction.id"
            @view="viewFaction"
            @edit="editFaction"
            @download="(f) => downloadImage(`/uploads/${f.image_url}`, f.name)"
            @delete="deleteFaction"
            @chaos="openChaosGraph"
          />
        </v-col>
      </v-row>
    </div>

    <ClientOnly v-else>
      <v-empty-state icon="mdi-shield-account-outline" :title="$t('factions.empty')" :text="$t('factions.emptyText')">
        <template #actions>
          <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreateDialog">
            {{ $t('factions.create') }}
          </v-btn>
        </template>
      </v-empty-state>
      <template #fallback>
        <v-container class="text-center py-16">
          <v-icon icon="mdi-shield-account-outline" size="64" color="grey" class="mb-4" />
          <h2 class="text-h5 mb-2">{{ $t('factions.empty') }}</h2>
          <p class="text-body-1 text-medium-emphasis mb-4">{{ $t('factions.emptyText') }}</p>
          <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreateDialog">
            {{ $t('factions.create') }}
          </v-btn>
        </v-container>
      </template>
    </ClientOnly>

    <!-- View Faction Dialog -->
    <ClientOnly>
      <FactionViewDialog
        v-model="showViewDialog"
        :faction="viewingFaction"
        @edit="editFactionAndCloseView"
        @preview-image="openImagePreview"
      />
    </ClientOnly>

    <!-- Create/Edit Dialog - Now self-contained! -->
    <ClientOnly>
      <FactionEditDialog
        :show="showEditDialog"
        :faction-id="editingFactionId"
        @update:show="handleDialogClose"
        @saved="handleFactionSaved"
        @created="handleFactionCreated"
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
        :title="$t('factions.deleteTitle')"
        :message="$t('factions.deleteConfirm', { name: deletingFaction?.name })"
        :loading="deleting"
        @confirm="confirmDelete"
        @cancel="showDeleteDialog = false"
      />
    </ClientOnly>
  </v-container>
</template>

<script setup lang="ts">
import type { Faction } from '~~/types/faction'
import ImagePreviewDialog from '~/components/shared/ImagePreviewDialog.vue'
import FactionCard from '~/components/factions/FactionCard.vue'
import FactionViewDialog from '~/components/factions/FactionViewDialog.vue'
import FactionEditDialog from '~/components/factions/FactionEditDialog.vue'

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
const searchResults = ref<Faction[]>([])
const searching = ref(false)

let searchTimeout: ReturnType<typeof setTimeout> | null = null
let abortController: AbortController | null = null

async function executeSearch(query: string) {
  if (!activeCampaignId.value) return

  if (abortController) abortController.abort()
  abortController = new AbortController()

  searching.value = true
  try {
    const results = await $fetch<Faction[]>('/api/factions', {
      query: { campaignId: activeCampaignId.value, search: query.trim() },
      headers: { 'Accept-Language': locale.value },
      signal: abortController.signal,
    })
    searchResults.value = results

    if (results.length > 0) {
      loadFactionCountsBatch(results)
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

const filteredFactions = computed(() => {
  if (searchQuery.value && searchQuery.value.trim().length > 0) {
    return searchResults.value
  }
  return factions.value || []
})

// ============================================================================
// Highlighted faction (from global search)
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
        const element = document.getElementById(`faction-${highlightedId.value}`)
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
const { loadFactionCountsBatch } = useFactionCounts()
const { downloadImage } = useImageDownload()

const factions = computed(() => entitiesStore.factions)
const pending = computed(() => entitiesStore.factionsLoading)

onMounted(async () => {
  await entitiesStore.fetchFactions(activeCampaignId.value!)

  if (factions.value && factions.value.length > 0) {
    loadFactionCountsBatch(factions.value)
  }

  initializeFromQuery()
})

// ============================================================================
// Edit Dialog (self-contained)
// ============================================================================
const showEditDialog = ref(false)
const editingFactionId = ref<number | null>(null)

function openCreateDialog() {
  editingFactionId.value = null
  showEditDialog.value = true
}

function editFaction(faction: Faction) {
  editingFactionId.value = faction.id
  showEditDialog.value = true
}

function openChaosGraph(faction: Faction) {
  router.push(`/chaos/${faction.id}`)
}

function editFactionAndCloseView(faction: Faction) {
  editFaction(faction)
  showViewDialog.value = false
}

function handleDialogClose(open: boolean) {
  showEditDialog.value = open
  if (!open) {
    editingFactionId.value = null
  }
}

async function handleFactionSaved(faction: Faction) {
  // Store is already updated by FactionEditDialog
  // Reload counts via store
  await entitiesStore.loadFactionCounts(faction.id)

  // If searching, re-execute to update results
  if (searchQuery.value && searchQuery.value.trim().length > 0) {
    executeSearch(searchQuery.value)
  }
}

async function handleFactionCreated(faction: Faction) {
  // Store is already updated by FactionEditDialog
  await entitiesStore.loadFactionCounts(faction.id)

  // If searching, re-execute to update results
  if (searchQuery.value && searchQuery.value.trim().length > 0) {
    executeSearch(searchQuery.value)
  }
}

// ============================================================================
// View Dialog
// ============================================================================
const showViewDialog = ref(false)
const viewingFaction = ref<Faction | null>(null)

function viewFaction(faction: Faction) {
  viewingFaction.value = faction
  showViewDialog.value = true
}

// ============================================================================
// Delete Dialog
// ============================================================================
const showDeleteDialog = ref(false)
const deletingFaction = ref<Faction | null>(null)
const deleting = ref(false)

function deleteFaction(faction: Faction) {
  deletingFaction.value = faction
  showDeleteDialog.value = true
}

async function confirmDelete() {
  if (!deletingFaction.value) return

  deleting.value = true

  try {
    await entitiesStore.deleteFaction(deletingFaction.value.id)
    showDeleteDialog.value = false
    deletingFaction.value = null
  } catch (error) {
    console.error('Failed to delete faction:', error)
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

function openImagePreview(imageUrl: string, title?: string) {
  previewImageUrl.value = imageUrl
  previewImageTitle.value = title || ''
  showImagePreview.value = true
}
</script>
