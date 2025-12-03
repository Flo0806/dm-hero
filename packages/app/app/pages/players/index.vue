<template>
  <v-container>
    <UiPageHeader :title="$t('players.title')" :subtitle="$t('players.subtitle')">
      <template #actions>
        <v-btn color="primary" prepend-icon="mdi-plus" size="large" @click="openCreateDialog">
          {{ $t('players.create') }}
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
      :hint="searchQuery && searchQuery.trim().length > 0 ? $t('players.searchHint') : ''"
      persistent-hint
    />

    <!-- Loading Skeleton -->
    <v-row v-if="loading">
      <v-col v-for="i in 6" :key="i" cols="12" sm="6" md="4" lg="3">
        <v-skeleton-loader type="card" />
      </v-col>
    </v-row>

    <!-- Player Cards with Search Overlay -->
    <div v-else-if="filteredPlayers.length > 0" class="position-relative">
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

      <!-- Player Cards -->
      <v-row>
        <v-col v-for="player in filteredPlayers" :key="player.id" cols="12" sm="6" md="4" lg="3">
          <PlayerCard
            :player="player"
            :is-highlighted="highlightedId === player.id"
            @view="viewPlayer"
            @edit="editPlayer"
            @download="handleDownload"
            @delete="confirmDelete"
            @chaos="openChaos"
          />
        </v-col>
      </v-row>
    </div>

    <!-- Empty State -->
    <div v-else>
      <ClientOnly>
        <v-empty-state
          icon="mdi-account-star-outline"
          :title="$t('players.empty')"
          :text="$t('players.emptyText')"
        >
          <template #actions>
            <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreateDialog">
              {{ $t('players.create') }}
            </v-btn>
          </template>
        </v-empty-state>
      </ClientOnly>
    </div>

    <!-- View Dialog -->
    <PlayerViewDialog
      :show="showViewDialog"
      :player="viewingPlayer"
      @update:show="handleViewDialogClose"
      @edit="handleEditFromView"
    />

    <!-- Self-contained Edit Dialog -->
    <PlayerEditDialog
      :show="showEditDialog"
      :player-id="editingPlayerId"
      @update:show="handleDialogClose"
      @saved="handlePlayerSaved"
      @created="handlePlayerCreated"
    />

    <!-- Delete Confirmation -->
    <UiDeleteConfirmDialog
      v-model="showDeleteDialog"
      :title="$t('players.deleteTitle')"
      :message="$t('players.deleteConfirm', { name: deletingPlayer?.name })"
      :loading="deleting"
      @confirm="deletePlayer"
      @cancel="showDeleteDialog = false"
    />
  </v-container>
</template>

<script setup lang="ts">
import type { Player } from '../../../types/player'
import PlayerEditDialog from '~/components/players/PlayerEditDialog.vue'
import PlayerViewDialog from '~/components/players/PlayerViewDialog.vue'
import PlayerCard from '~/components/players/PlayerCard.vue'
import { useImageDownload } from '~/composables/useImageDownload'

const route = useRoute()
const router = useRouter()
const campaignStore = useCampaignStore()
const entitiesStore = useEntitiesStore()
const { downloadImage } = useImageDownload()
const { loadPlayerCountsBatch, reloadPlayerCounts } = usePlayerCounts()

const activeCampaignId = computed(() => campaignStore.activeCampaignId)

// Highlight from route query (for global search navigation)
const highlightedId = ref<number | null>(null)

// State
const searchQuery = ref('')
const searchResults = ref<Player[]>([])
const searching = ref(false)
let searchTimeout: ReturnType<typeof setTimeout> | null = null
const showViewDialog = ref(false)
const showEditDialog = ref(false)
const showDeleteDialog = ref(false)
const deleting = ref(false)
const viewingPlayer = ref<Player | null>(null)
const editingPlayerId = ref<number | null>(null)
const deletingPlayer = ref<Player | null>(null)

// Computed
const loading = computed(() => entitiesStore.playersLoading)
const players = computed(() => entitiesStore.players)

const filteredPlayers = computed(() => {
  // If searching, use search results from API
  if (searchQuery.value && searchQuery.value.trim().length > 0) {
    return searchResults.value
  }
  // Otherwise return cached players
  return players.value
})

// Watch search query with debounce - API-based search for cross-entity support
watch(searchQuery, async (query) => {
  if (searchTimeout) clearTimeout(searchTimeout)

  if (!query || query.trim().length === 0) {
    searchResults.value = []
    searching.value = false
    return
  }

  searching.value = true

  searchTimeout = setTimeout(async () => {
    try {
      const results = await $fetch<Player[]>('/api/players', {
        query: {
          campaignId: activeCampaignId.value,
          search: query.trim(),
        },
      })
      searchResults.value = results

      // Load counts for search results using the shared composable
      loadPlayerCountsBatch(results)
    } catch (error) {
      console.error('Player search failed:', error)
      searchResults.value = []
    } finally {
      searching.value = false
    }
  }, 300)
})

// Load data
onMounted(async () => {
  if (activeCampaignId.value) {
    await entitiesStore.fetchPlayers(activeCampaignId.value)
    // Load counts for all players using the shared composable
    if (players.value.length > 0) {
      loadPlayerCountsBatch(players.value)
    }
  }
})

// Methods
function openCreateDialog() {
  editingPlayerId.value = null
  showEditDialog.value = true
}

function viewPlayer(player: Player) {
  viewingPlayer.value = player
  showViewDialog.value = true
}

function editPlayer(player: Player) {
  editingPlayerId.value = player.id
  showEditDialog.value = true
}

function handleViewDialogClose(value: boolean) {
  showViewDialog.value = value
  if (!value) {
    viewingPlayer.value = null
  }
}

function handleEditFromView(player: Player) {
  showViewDialog.value = false
  viewingPlayer.value = null
  editingPlayerId.value = player.id
  showEditDialog.value = true
}

function handleDialogClose(value: boolean) {
  showEditDialog.value = value
  if (!value) {
    editingPlayerId.value = null
  }
}

async function handlePlayerSaved(player: Player) {
  // Force reload counts for this player (ignores cache)
  await reloadPlayerCounts(player)
}

async function handlePlayerCreated(player: Player) {
  // Load counts for the new player
  await reloadPlayerCounts(player)
}

function confirmDelete(player: Player) {
  deletingPlayer.value = player
  showDeleteDialog.value = true
}

async function deletePlayer() {
  if (!deletingPlayer.value) return

  deleting.value = true
  try {
    await entitiesStore.deletePlayer(deletingPlayer.value.id)
    showDeleteDialog.value = false
    deletingPlayer.value = null
  } catch (error) {
    console.error('Failed to delete player:', error)
  } finally {
    deleting.value = false
  }
}

function openChaos(player: Player) {
  router.push(`/chaos/${player.id}`)
}

function handleDownload(player: Player) {
  if (player.image_url) {
    downloadImage(`/uploads/${player.image_url}`, player.name)
  }
}

// Handle highlight from route query (global search navigation)
watch(
  () => route.query,
  async (query) => {
    if (query.highlight) {
      highlightedId.value = Number(query.highlight)

      // Set search query if provided
      if (query.search) {
        searchQuery.value = String(query.search)
      }

      // Scroll to highlighted player after data loads
      await nextTick()
      setTimeout(() => {
        const element = document.getElementById(`player-${highlightedId.value}`)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 100)

      // Clear highlight after animation
      setTimeout(() => {
        highlightedId.value = null
      }, 3000)
    }
  },
  { immediate: true },
)

// Clear highlight when user types in search
watch(searchQuery, (newVal, oldVal) => {
  if (newVal !== oldVal && highlightedId.value) {
    highlightedId.value = null
  }
})
</script>
