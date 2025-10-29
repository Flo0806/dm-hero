<template>
  <v-app>
    <v-navigation-drawer
      v-if="hasActiveCampaign"
      v-model="drawer"
      :rail="rail"
      permanent
      @click="rail = false"
    >
      <v-list-item
        :prepend-icon="rail ? 'mdi-dice-d20' : 'mdi-dice-d20'"
        :title="rail ? '' : 'DM Hero'"
        nav
      >
        <template #append>
          <v-btn
            :icon="rail ? 'mdi-chevron-right' : 'mdi-chevron-left'"
            variant="text"
            @click.stop="rail = !rail"
          />
        </template>
      </v-list-item>

      <v-divider />

      <!-- Active Campaign Display -->
      <v-list-item
        v-if="activeCampaignName && !rail"
        prepend-icon="mdi-sword-cross"
        :title="activeCampaignName || ''"
        subtitle="Aktive Kampagne"
        class="mb-2"
        @click="navigateTo('/campaigns')"
      />

      <v-divider v-if="activeCampaignName && !rail" />

      <v-list v-if="hasActiveCampaign" density="compact" nav>
        <v-list-item
          prepend-icon="mdi-view-dashboard"
          title="Dashboard"
          value="home"
          to="/"
        />
        <v-list-item
          prepend-icon="mdi-magnify"
          title="Suche"
          value="search"
          @click="showSearch = true"
        />
        <v-list-item
          prepend-icon="mdi-account-group"
          title="NPCs"
          value="npcs"
          to="/npcs"
        />
        <v-list-item
          prepend-icon="mdi-map-marker"
          title="Orte"
          value="locations"
          to="/locations"
        />
        <v-list-item
          prepend-icon="mdi-sword"
          title="Items"
          value="items"
          to="/items"
        />
        <v-list-item
          prepend-icon="mdi-shield"
          title="Fraktionen"
          value="factions"
          to="/factions"
        />
        <v-list-item
          prepend-icon="mdi-script-text"
          title="Quests"
          value="quests"
          to="/quests"
        />
        <v-list-item
          prepend-icon="mdi-book-open-page-variant"
          title="Sessions"
          value="sessions"
          to="/sessions"
        />
      </v-list>

      <template #append>
        <v-divider />
        <v-list density="compact" nav>
          <v-list-item
            prepend-icon="mdi-database"
            :title="rail ? '' : 'Referenzdaten'"
            to="/reference-data"
          />
          <v-list-item
            :prepend-icon="theme.global.name.value === 'dark' ? 'mdi-weather-night' : 'mdi-weather-sunny'"
            :title="rail ? '' : 'Theme'"
            @click="toggleTheme"
          />
        </v-list>
      </template>
    </v-navigation-drawer>

    <v-app-bar border>
      <v-app-bar-title>
        <v-icon icon="mdi-dice-d20" class="mr-2" />
        DM Hero
      </v-app-bar-title>

      <v-spacer />

      <!-- Language Switcher -->
      <v-btn-toggle
        :model-value="currentLocale"
        mandatory
        density="compact"
        class="mr-2"
        @update:model-value="changeLocale"
      >
        <v-btn value="de" size="small">
          asdf
        </v-btn>
        <v-btn value="en" size="small">
          asdf
        </v-btn>
      </v-btn-toggle>

      <v-btn
        icon="mdi-magnify"
        @click="showSearch = true"
      />
    </v-app-bar>

    <v-main>
      <v-container fluid>
        <NuxtPage />
      </v-container>
    </v-main>

    <!-- Globale Schnellsuche Dialog -->
    <v-dialog
      v-model="showSearch"
      max-width="800"
    >
      <v-card>
        <v-card-title>
          <v-text-field
            v-model="searchQuery"
            autofocus
            clearable
            hide-details
            placeholder="Suche nach NPCs, Orten, Items..."
            prepend-inner-icon="mdi-magnify"
            variant="solo"
            flat
          />
        </v-card-title>
        <v-divider />
        <v-card-text style="max-height: 500px; overflow-y: auto;">
          <div v-if="searchQuery" class="text-caption text-disabled mb-2">
            Suche nach "{{ searchQuery }}"...
          </div>
          <v-list v-if="searchResults.length > 0">
            <v-list-item
              v-for="result in searchResults"
              :key="result.id"
              @click="navigateToResult(result)"
            >
              <template #prepend>
                <v-icon :icon="result.icon" :color="result.color" />
              </template>
              <v-list-item-title>{{ result.name }}</v-list-item-title>
              <v-list-item-subtitle>{{ result.type }}</v-list-item-subtitle>
            </v-list-item>
          </v-list>
          <div v-else-if="searchQuery" class="text-center text-disabled py-8">
            Keine Ergebnisse gefunden
          </div>
          <div v-else class="text-center text-disabled py-8">
            Drücke <kbd>/</kbd> um zu suchen
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>
  </v-app>
</template>

<script setup lang="ts">
import { useTheme } from 'vuetify'

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

<style>
kbd {
  background-color: rgba(var(--v-theme-on-surface), 0.1);
  border-radius: 4px;
  padding: 2px 6px;
  font-family: monospace;
  font-size: 0.9em;
}
</style>
