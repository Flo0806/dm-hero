<template>
  <v-app>
    <NavigationDrawer
      v-model="drawer"
      v-model:rail="rail"
      :has-active-campaign="hasActiveCampaign"
      :active-campaign-name="activeCampaignName"
      :is-dark="theme.global.current.value.dark"
      @search-click="showSearch = true"
      @toggle-theme="toggleTheme"
    />

    <AppBar
      :current-locale="currentLocale"
      @change-locale="changeLocale"
      @search-click="showSearch = true"
    />

    <v-main>
      <v-container fluid>
        <NuxtPage />
      </v-container>
    </v-main>

    <GlobalSearch
      v-model="showSearch"
      v-model:search-query="searchQuery"
      :search-results="searchResults"
      @select-result="navigateToResult"
    />
  </v-app>
</template>

<script setup lang="ts">
import { useTheme } from 'vuetify'
import NavigationDrawer from '~/components/layout/NavigationDrawer.vue'
import AppBar from '~/components/layout/AppBar.vue'
import GlobalSearch from '~/components/layout/GlobalSearch.vue'

const theme = useTheme()
const { locale, setLocale } = useI18n()
const drawer = ref(true)
const rail = ref(false)
const showSearch = ref(false)
const searchQuery = ref('')
const searchResults = ref<Array<{
  id: number
  name: string
  type: string
  icon: string
  color: string
  path: string
}>>([])

// Campaign store
const campaignStore = useCampaignStore()

// Active campaign from cookies
const activeCampaignName = useCookie('activeCampaignName')
const hasActiveCampaign = computed(() => campaignStore.hasActiveCampaign)

// Language
const currentLocale = computed(() => locale.value)
const localeCookie = useCookie('locale', {
  maxAge: 60 * 60 * 24 * 365, // 1 year
})

// Initialize campaign and locale from cookie on mount
onMounted(() => {
  campaignStore.initFromCookie()

  // Initialize locale from cookie
  if (localeCookie.value) {
    setLocale(localeCookie.value)
  }
})

function toggleTheme() {
  theme.global.name.value = theme.global.current.value.dark ? 'light' : 'dark'
}

function changeLocale(newLocale: string) {
  setLocale(newLocale)
  localeCookie.value = newLocale
}

function getEntityPath(entityType: string, entityId: number): string {
  // Map entity types to their corresponding routes
  const typeMap: Record<string, string> = {
    'NPC': '/npcs',
    'Location': '/locations',
    'Item': '/items',
    'Faction': '/factions',
    'Quest': '/quests',
    'Session': '/sessions',
  }
  const basePath = typeMap[entityType] || '/npcs'
  return `${basePath}?id=${entityId}`
}

function navigateToResult(result: typeof searchResults.value[0]) {
  navigateTo(result.path)
  showSearch.value = false
  searchQuery.value = ''
}

// Keyboard Shortcuts
onMounted(() => {
  const handleKeydown = (e: KeyboardEvent) => {
    // "/" öffnet Suche
    if (e.key === '/' && !showSearch.value) {
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
    const results = await $fetch<Array<{
      id: number
      name: string
      description: string
      type: string
      icon: string
      color: string
    }>>('/api/search', {
      query: {
        q: query.trim(),
        campaignId: campaignStore.activeCampaignId,
      },
    })

    searchResults.value = results.map(r => ({
      ...r,
      path: getEntityPath(r.type, r.id),
    }))
  }
  catch (error) {
    console.error('Search failed:', error)
    searchResults.value = []
  }
})
</script>
