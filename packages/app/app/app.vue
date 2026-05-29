<template>
  <v-app>
    <ClientOnly>
      <NavigationDrawer
        v-model="drawer"
        v-model:rail="rail"
        :has-active-campaign="hasActiveCampaign"
        :active-campaign-name="activeCampaignName"
        :is-search-active="showSearch"
        @search-click="showSearch = true"
      />
    </ClientOnly>

    <AppBar
      :current-locale="currentLocale"
      @change-locale="changeLocale"
      @search-click="showSearch = true"
    />

    <v-main class="main-no-scroll">
      <div class="content-scrollable">
        <v-container fluid>
          <NuxtPage />
        </v-container>
      </div>
    </v-main>

    <GlobalSearch
      v-model="showSearch"
      v-model:search-query="searchQuery"
      :search-results="filteredSearchResults"
      @select-result="navigateToResult"
    />

    <!-- Global Snackbar -->
    <v-snackbar
      v-model="snackbarStore.show"
      :color="snackbarStore.color"
      :timeout="snackbarStore.timeout"
      location="top"
    >
      {{ snackbarStore.message }}
      <template v-if="snackbarStore.persistent" #actions>
        <v-btn variant="text" @click="snackbarStore.hide()">
          {{ $t('common.close') }}
        </v-btn>
      </template>
    </v-snackbar>

    <!-- Announcements Dialog -->
    <ClientOnly>
      <SharedAnnouncementDialog />
    </ClientOnly>
  </v-app>
</template>

<script setup lang="ts">
import { useLocale } from 'vuetify'
import NavigationDrawer from '~/components/layout/NavigationDrawer.vue'
import AppBar from '~/components/layout/AppBar.vue'
import GlobalSearch from '~/components/layout/GlobalSearch.vue'

const vuetifyLocale = useLocale()
const { locale, setLocale } = useI18n()
const drawer = ref(true)
const rail = ref(false)
const showSearch = ref(false)
const searchQuery = ref('')
const searchResults = ref<
  Array<{
    id: number
    name: string
    type: string
    icon: string
    color: string
    path: string
    linkedEntities: string[]
    archived_at?: string | null
  }>
>([])

// Filter archived from global search unless showArchived is enabled
const entitiesStore = useEntitiesStore()
const filteredSearchResults = computed(() =>
  entitiesStore.showArchived
    ? searchResults.value
    : searchResults.value.filter(r => !r.archived_at),
)

// Stores
const campaignStore = useCampaignStore()
const snackbarStore = useSnackbarStore()
const notesStore = useNotesStore()

// Active campaign from store (not cookie - store is the source of truth)
const activeCampaignName = computed(() => campaignStore.currentCampaign?.name || null)
const hasActiveCampaign = computed(() => campaignStore.hasActiveCampaign)

// Language
const currentLocale = computed(() => locale.value)
const localeCookie = useCookie<'en' | 'de'>('locale', {
  maxAge: 60 * 60 * 24 * 365, // 1 year
})

// Sync Vuetify locale with i18n locale fox
watch(
  locale,
  (newLocale) => {
    vuetifyLocale.current.value = newLocale
  },
  { immediate: true },
)

// Initialize campaign and locale from cookie on mount
onMounted(() => {
  campaignStore.initFromCookie()

  // Initialize locale from cookie
  if (localeCookie.value && (localeCookie.value === 'en' || localeCookie.value === 'de')) {
    setLocale(localeCookie.value)
  }
})

// Load notes when campaign changes (for badge in drawer)
// Only run on client to avoid SSR hydration issues with loading state
if (import.meta.client) {
  watch(
    () => campaignStore.activeCampaignId,
    (newId) => {
      if (newId) {
        notesStore.fetchNotes(Number(newId))
      }
      else {
        notesStore.clearNotes()
      }
    },
    { immediate: true },
  )
}

function changeLocale(newLocale: string) {
  if (newLocale === 'en' || newLocale === 'de') {
    setLocale(newLocale)
    localeCookie.value = newLocale
  }
}

function getEntityPath(entityType: string, entityId: number, entityName: string): string {
  // Map entity types to their corresponding routes
  const typeMap: Record<string, string> = {
    NPC: '/npcs',
    Location: '/locations',
    Item: '/items',
    Faction: '/factions',
    Lore: '/lore',
    Session: '/sessions',
    Player: '/players',
    Group: '/groups',
  }
  const basePath = typeMap[entityType] || '/npcs'
  const query = new URLSearchParams()
  query.set('highlight', entityId.toString())
  // Wrap entity name in quotes for exact phrase search (prevents splitting on spaces)
  query.set('search', `"${entityName}"`)
  return `${basePath}?${query.toString()}`
}

function navigateToResult(result: (typeof searchResults.value)[0]) {
  const path = getEntityPath(result.type, result.id, result.name)
  navigateTo(path, { replace: false }) // Force navigation even if on same page
  showSearch.value = false
  searchQuery.value = ''
}

// Watch for AI/MCP bulk-imports: poll the import signal and, when it advances,
// show a snackbar and refresh the loaded lists + card counts ONCE. This fires
// only for external (AI) imports — the app's own create endpoints never touch
// the signal — so manual user creation does not trigger a reload.
if (import.meta.client) {
  const foldersStore = useFoldersStore()
  const { t } = useI18n()
  let lastSeq = -1

  const handleAiImport = async (action: 'import' | 'update', campaignId: number | null, total: number) => {
    const active = campaignStore.activeCampaignIdNumber
    const here = !!campaignId && active === campaignId
    const key = `aiImport.${action === 'update' ? 'updated' : 'imported'}${here ? '' : 'Other'}`
    if (here) {
      snackbarStore.success(t(key, { count: total }))
      await entitiesStore.refetchLoaded(active!)
      await foldersStore.refetchLoaded()
    }
    else {
      snackbarStore.info(t(key, { count: total }))
    }
  }

  const pollImportSignal = async () => {
    try {
      const sig = await $fetch<{ seq: number, action: 'import' | 'update' | null, campaignId: number | null, total: number }>(
        '/api/import/status',
      )
      // First poll establishes the baseline so we don't react to imports that
      // happened before the app was opened.
      if (lastSeq === -1) {
        lastSeq = sig.seq
        return
      }
      if (sig.seq > lastSeq) {
        lastSeq = sig.seq
        await handleAiImport(sig.action ?? 'import', sig.campaignId, sig.total)
      }
    }
    catch {
      // server not reachable yet / transient — try again next tick
    }
  }

  onMounted(() => {
    pollImportSignal()
    const timer = setInterval(pollImportSignal, 5000)
    onUnmounted(() => clearInterval(timer))
  })
}

// Keyboard Shortcuts
onMounted(() => {
  const handleKeydown = (e: KeyboardEvent) => {
    // Check if user is typing in an input field
    const target = e.target as HTMLElement
    const isTyping
      = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

    // "/" öffnet Suche (nur wenn NICHT in Eingabefeld)
    if (e.key === '/' && !showSearch.value && !isTyping) {
      e.preventDefault()
      showSearch.value = true
    }
    // ESC schließt Suche
    if (e.key === 'Escape' && showSearch.value) {
      showSearch.value = false
    }
  }

  window.addEventListener('keydown', handleKeydown)
  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown)
  })
})

// Search implementation
watch(searchQuery, async (query) => {
  if (!query || query.trim().length === 0) {
    searchResults.value = []
    return
  }

  if (!campaignStore.activeCampaignId) {
    return
  }

  try {
    const results = await $fetch<
      Array<{
        id: number
        name: string
        description: string
        type: string
        icon: string
        color: string
        linkedEntities: string[]
      }>
    >('/api/search', {
      query: {
        q: query.trim(),
        campaignId: campaignStore.activeCampaignId,
      },
    })

    searchResults.value = results.map(r => ({
      ...r,
      path: getEntityPath(r.type, r.id, r.name),
      linkedEntities: r.linkedEntities || [],
    }))
  }
  catch (error) {
    console.error('Search failed:', error)
    searchResults.value = []
  }
})
</script>

<style>
/* Prevent body/html scrolling */
html {
  overflow: hidden !important;
}

.v-application {
  height: 100vh;
  overflow: hidden;
}

/* v-main should not scroll itself */
.main-no-scroll {
  overflow: hidden !important;
  height: calc(100vh - 64px); /* 64px = AppBar height */
}

/* Inner container scrolls - scrollbar starts below AppBar */
.content-scrollable {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
}
</style>
