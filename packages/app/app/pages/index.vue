<template>
  <v-container>
    <!-- Redirect to campaigns if no campaign selected -->
    <div v-if="!activeCampaignId" class="text-center py-16">
      <v-icon icon="mdi-sword-cross" size="64" class="mb-4" color="primary" />
      <h2 class="text-h4 mb-4">
        {{ $t('dashboard.noCampaign.title') }}
      </h2>
      <p class="text-body-1 text-medium-emphasis mb-6">
        {{ $t('dashboard.noCampaign.description') }}
      </p>
      <v-btn color="primary" size="large" to="/campaigns" prepend-icon="mdi-arrow-right">
        {{ $t('dashboard.noCampaign.button') }}
      </v-btn>
    </div>

    <div v-else>
      <!-- Header -->
      <v-row>
        <v-col cols="12">
          <div class="d-flex align-center justify-space-between mb-2 position-relative">
            <!-- 3D Dice Animation (absolute, doesn't take layout space) -->
            <ClientOnly>
              <DashboardDice notation="2d20" :width="260" :height="200" class="dice-overlay" />
            </ClientOnly>
            <!-- Title with left margin to make room for dice -->
            <div style="margin-left: 230px;" class="mb-6 mt-4">
              <div class="text-h3 font-weight-bold mb-1">
                {{ $t('app.welcome') }}
              </div>
              <p class="text-body-1 text-medium-emphasis">
                {{ $t('app.subtitle') }}
              </p>
            </div>
            <v-chip
              v-if="activeCampaignName"
              color="primary"
              size="large"
              prepend-icon="mdi-sword-cross"
              class="cursor-pointer campaign-chip"
              @click="router.push('/campaigns')"
            >
              {{ activeCampaignName }}
            </v-chip>
          </div>
        </v-col>
      </v-row>

      <!-- Stats & Widgets Row (with optional Map) -->
      <v-row class="mb-4 widgets-row">
        <!-- Maps Widget (left side on xl when present) -->
        <v-col v-if="maps.length > 0" cols="12" xl="6" class="d-flex">
          <DashboardMapsWidget :maps="maps" class="flex-grow-1" />
        </v-col>

        <!-- Widgets container (right side on xl when map present) -->
        <v-col cols="12" :xl="maps.length > 0 ? 6 : 12">
          <v-row>
            <!-- Stats Card -->
            <v-col cols="12" sm="6" :lg="maps.length > 0 ? 6 : 3">
              <DashboardStatsCard
                :total-playtime-minutes="totalPlaytimeMinutes"
                :session-count="sessionCount"
                :total-entities="totalEntities"
                :pinned-count="pinboardStore.pinCount"
                class="h-100"
              />
            </v-col>

            <!-- Calendar Widget -->
            <v-col cols="12" sm="6" :lg="maps.length > 0 ? 6 : 3">
              <DashboardCalendarWidget
                :calendar="calendarData"
                :weather="currentWeather"
                :loading="calendarLoading"
                :days-since-first-session="daysSinceFirstSession"
                class="h-100"
              />
            </v-col>

            <!-- Notes Widget -->
            <v-col cols="12" sm="6" :lg="maps.length > 0 ? 6 : 3">
              <DashboardNotesWidget
                :notes="notesStore.notes"
                :pending-count="notesStore.pendingCount"
                class="h-100"
              />
            </v-col>

            <!-- Pinboard Widget -->
            <v-col cols="12" sm="6" :lg="maps.length > 0 ? 6 : 3">
              <DashboardPinboardWidget
                :pins="pinboardStore.pins"
                class="h-100"
                @open-entity="openEntityPreview"
              />
            </v-col>
          </v-row>
        </v-col>
      </v-row>

      <!-- Category Cards -->
      <v-row class="mb-4">
        <v-col cols="12">
          <div class="text-h6 font-weight-medium">
            {{ $t('dashboard.categories.title') }}
          </div>
        </v-col>
      </v-row>

      <v-row>
        <v-col v-for="category in categories" :key="category.type" cols="12" sm="6" md="4" lg="3">
          <DashboardCategoryCard
            :title="category.title"
            :description="category.description"
            :icon="category.icon"
            :color="category.color"
            :to="category.to"
            :count="category.count"
            :pinned-count="category.pinnedCount"
          />
        </v-col>
      </v-row>

      <!-- Export/Import Actions -->
      <v-row class="mb-4 mt-6">
        <v-col cols="12">
          <div class="d-flex align-center flex-wrap ga-2 mb-2">
            <div class="text-h6 font-weight-medium">
              {{ $t('dashboard.dataManagement') }}
            </div>
            <v-chip color="warning" size="small">Beta</v-chip>
          </div>
          <v-alert type="warning" variant="tonal" density="compact" class="mt-2">
            <div class="d-flex align-center flex-wrap">
              <span>{{ $t('common.betaWarning') }}</span>
              <v-btn
                variant="text"
                size="small"
                color="warning"
                class="ml-2"
                to="/settings"
              >
                {{ $t('common.backupSettings') }}
              </v-btn>
            </div>
          </v-alert>
        </v-col>
      </v-row>

      <v-row class="mb-4">
        <v-col cols="12" sm="6" md="4">
          <v-card hover class="h-100" @click="showExportDialog = true">
            <v-card-text class="pa-4">
              <div class="d-flex align-center">
                <v-icon icon="mdi-export" size="28" color="primary" class="mr-3" />
                <div>
                  <div class="text-subtitle-1 font-weight-medium">{{ $t('campaigns.export.title') }}</div>
                  <div class="text-body-2 text-medium-emphasis">
                    {{ $t('dashboard.exportHint') }}
                  </div>
                </div>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" sm="6" md="4">
          <v-card hover class="h-100" @click="showImportDialog = true">
            <v-card-text class="pa-4">
              <div class="d-flex align-center">
                <v-icon icon="mdi-import" size="28" color="secondary" class="mr-3" />
                <div>
                  <div class="text-subtitle-1 font-weight-medium">{{ $t('campaigns.import.title') }}</div>
                  <div class="text-body-2 text-medium-emphasis">
                    {{ $t('dashboard.importHint') }}
                  </div>
                </div>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" sm="6" md="4">
          <v-card hover class="h-100" @click="showCopyDialog = true">
            <v-card-text class="pa-4">
              <div class="d-flex align-center">
                <v-icon icon="mdi-content-copy" size="28" color="info" class="mr-3" />
                <div>
                  <div class="text-subtitle-1 font-weight-medium">{{ $t('entities.copyToCampaign.title') }}</div>
                  <div class="text-body-2 text-medium-emphasis">
                    {{ $t('dashboard.copyHint') }}
                  </div>
                </div>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Quick Start (collapsed) -->
      <v-row class="mt-6">
        <v-col cols="12">
          <v-expansion-panels variant="accordion">
            <v-expansion-panel>
              <v-expansion-panel-title>
                <v-icon icon="mdi-lightbulb-outline" class="mr-2" />
                {{ $t('quickstart.title') }}
              </v-expansion-panel-title>
              <v-expansion-panel-text>
                <v-list density="compact">
                  <v-list-item prepend-icon="mdi-keyboard">
                    <v-list-item-title>{{ $t('quickstart.searchHint') }}</v-list-item-title>
                  </v-list-item>
                  <v-list-item prepend-icon="mdi-plus">
                    <v-list-item-title>{{ $t('quickstart.createHint') }}</v-list-item-title>
                  </v-list-item>
                  <v-list-item prepend-icon="mdi-link-variant">
                    <v-list-item-title>{{ $t('quickstart.linkHint') }}</v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>
        </v-col>
      </v-row>
    </div>

    <!-- Entity Preview Dialog -->
    <SharedEntityPreviewDialog
      v-model="showEntityPreview"
      :entity-id="previewEntityId"
      :entity-type="previewEntityType"
    />

    <!-- Export Dialog -->
    <CampaignExportDialog
      v-if="activeCampaignId"
      v-model="showExportDialog"
      :campaign-id="campaignStore.activeCampaignIdNumber!"
    />

    <!-- Import Dialog -->
    <CampaignImportDialog
      v-model="showImportDialog"
      @imported="onCampaignImported"
    />

    <!-- Copy to Campaign Dialog -->
    <CopyToCampaignDialog
      v-if="activeCampaignId"
      v-model="showCopyDialog"
      :current-campaign-id="campaignStore.activeCampaignIdNumber!"
    />
  </v-container>
</template>

<script setup lang="ts">
import type { CampaignMap } from '~~/types/map'
import type { PinboardItem } from '~~/types/pinboard'
import type { EntityPreviewType } from '../components/shared/EntityPreviewDialog.vue'
import CampaignExportDialog from '~/components/campaigns/CampaignExportDialog.vue'
import CampaignImportDialog from '~/components/campaigns/CampaignImportDialog.vue'
import CopyToCampaignDialog from '~/components/entities/CopyToCampaignDialog.vue'

interface Session {
  id: number
  duration_minutes: number | null
  in_game_year_start: number | null
  in_game_month_start: number | null
  in_game_day_start: number | null // Day of month (1-31)
  in_game_year_end: number | null
  in_game_month_end: number | null
  in_game_day_end: number | null // Day of month (1-31)
}

interface Weather {
  weather_type: string
  temperature: number | null
}

const router = useRouter()
const { t } = useI18n()
const campaignStore = useCampaignStore()
const entitiesStore = useEntitiesStore()
const notesStore = useNotesStore()
const pinboardStore = usePinboardStore()
const inGameCalendar = useInGameCalendar()

// Campaign state
const activeCampaignId = computed(() => campaignStore.activeCampaignId)
const activeCampaignName = useCookie('activeCampaignName')

// Data state
const sessions = ref<Session[]>([])
const maps = ref<CampaignMap[]>([])
const currentWeather = ref<{ weatherType: string; temperature?: number } | null>(null)

// Entity preview dialog
const showEntityPreview = ref(false)
const previewEntityId = ref<number | null>(null)
const previewEntityType = ref<EntityPreviewType>('npc')

// Export/Import/Copy dialogs
const showExportDialog = ref(false)
const showImportDialog = ref(false)
const showCopyDialog = ref(false)

function onCampaignImported(_campaignId: number) {
  // Refresh the page after import
  router.push('/')
}

// Computed: total playtime
const totalPlaytimeMinutes = computed(() => {
  return sessions.value.reduce((sum, s) => sum + (s.duration_minutes || 0), 0)
})

const sessionCount = computed(() => sessions.value.length)

// Computed: total entities
const totalEntities = computed(() => {
  return (
    entitiesStore.npcs.length +
    entitiesStore.locations.length +
    entitiesStore.items.length +
    entitiesStore.factions.length +
    entitiesStore.lore.length +
    entitiesStore.players.length
  )
})

// Calendar loading state
const calendarLoading = computed(() => inGameCalendar.loading.value)

// Computed: calendar data for widget
const calendarData = computed(() => {
  const cal = inGameCalendar.calendarData.value
  if (!cal || cal.months.length === 0) {
    return null
  }

  const currentDate = inGameCalendar.getCurrentDate()
  if (!currentDate) return null

  return {
    currentDay: currentDate.day,
    currentMonth: currentDate.month,
    currentMonthName: currentDate.monthName,
    currentYear: currentDate.year,
    eraName: cal.config.era_name || '',
  }
})

// Computed: total campaign days based on session dates (first to last session)
// Recalculates absolute days using current calendar config to handle leap year changes
const daysSinceFirstSession = computed(() => {
  const cal = inGameCalendar.calendarData.value
  if (!cal) return null

  // Find sessions with complete in-game dates (year/month/day)
  const sessionsWithDate = sessions.value.filter(
    (s) =>
      s.in_game_year_start !== null &&
      s.in_game_month_start !== null &&
      s.in_game_day_start !== null,
  )

  if (sessionsWithDate.length === 0) return null

  // Recalculate absolute days using current calendar config
  const absoluteDays = sessionsWithDate.map((s) =>
    inGameCalendar.dateToAbsoluteDay(
      s.in_game_year_start!,
      s.in_game_month_start!,
      s.in_game_day_start!,
      cal,
    ),
  )

  const firstSessionDay = Math.min(...absoluteDays)
  const lastSessionDay = Math.max(...absoluteDays)

  // Return the span between first and last session
  return lastSessionDay - firstSessionDay
})

// Computed: category cards
const categories = computed(() => {
  const pinCounts = pinboardStore.countsByType

  return [
    {
      type: 'npc',
      title: t('categories.npcs.title'),
      icon: 'mdi-account-group',
      color: '#D4A574',
      to: '/npcs',
      description: t('categories.npcs.description'),
      count: entitiesStore.npcs.length,
      pinnedCount: pinCounts.npc || 0,
    },
    {
      type: 'location',
      title: t('categories.locations.title'),
      icon: 'mdi-map-marker',
      color: '#8B7355',
      to: '/locations',
      description: t('categories.locations.description'),
      count: entitiesStore.locations.length,
      pinnedCount: pinCounts.location || 0,
    },
    {
      type: 'item',
      title: t('categories.items.title'),
      icon: 'mdi-sword',
      color: '#CC8844',
      to: '/items',
      description: t('categories.items.description'),
      count: entitiesStore.items.length,
      pinnedCount: pinCounts.item || 0,
    },
    {
      type: 'faction',
      title: t('categories.factions.title'),
      icon: 'mdi-shield',
      color: '#7B92AB',
      to: '/factions',
      description: t('categories.factions.description'),
      count: entitiesStore.factions.length,
      pinnedCount: pinCounts.faction || 0,
    },
    {
      type: 'lore',
      title: t('categories.lore.title'),
      icon: 'mdi-book-open-variant',
      color: '#9B8B7A',
      to: '/lore',
      description: t('categories.lore.description'),
      count: entitiesStore.lore.length,
      pinnedCount: pinCounts.lore || 0,
    },
    {
      type: 'player',
      title: t('categories.players.title'),
      icon: 'mdi-account-star',
      color: '#A8C686',
      to: '/players',
      description: t('categories.players.description'),
      count: entitiesStore.players.length,
      pinnedCount: pinCounts.player || 0,
    },
    {
      type: 'session',
      title: t('categories.sessions.title'),
      icon: 'mdi-book-open-page-variant',
      color: '#D4A574',
      to: '/sessions',
      description: t('categories.sessions.description'),
      count: sessionCount.value,
      pinnedCount: 0, // Sessions can't be pinned
    },
    {
      type: 'calendar',
      title: t('calendar.title'),
      icon: 'mdi-calendar',
      color: '#B39DDB',
      to: '/calendar',
      description: t('categories.calendar.description'),
      count: inGameCalendar.calendarData.value?.months.length || 0,
      pinnedCount: 0,
    },
  ]
})

// Fetch all dashboard data
async function fetchDashboardData() {
  if (!activeCampaignId.value) return

  const campaignId = Number(activeCampaignId.value)

  // Fetch all data in parallel
  await Promise.all([
    // Entities (from store)
    entitiesStore.fetchNPCs(campaignId),
    entitiesStore.fetchLocations(campaignId),
    entitiesStore.fetchItems(campaignId),
    entitiesStore.fetchFactions(campaignId),
    entitiesStore.fetchLore(campaignId),
    entitiesStore.fetchPlayers(campaignId),

    // Notes (from store)
    notesStore.fetchNotes(campaignId),

    // Pinboard (from store)
    pinboardStore.fetchPins(campaignId),

    // Sessions (direct fetch)
    fetchSessions(campaignId),

    // Maps (direct fetch)
    fetchMaps(campaignId),

    // Calendar (direct fetch)
    fetchCalendar(),
  ])
}

async function fetchSessions(campaignId: number) {
  try {
    sessions.value = await $fetch<Session[]>('/api/sessions', {
      query: { campaignId },
    })
  } catch (error) {
    console.error('Failed to fetch sessions:', error)
    sessions.value = []
  }
}

async function fetchMaps(campaignId: number) {
  try {
    maps.value = await $fetch<CampaignMap[]>('/api/maps', {
      query: { campaignId },
    })
  } catch (error) {
    console.error('Failed to fetch maps:', error)
    maps.value = []
  }
}

async function fetchCalendar() {
  const cal = await inGameCalendar.loadCalendar()

  // Fetch current weather if calendar loaded
  if (cal) {
    await fetchCurrentWeather(cal.config)
  }
}

async function fetchCurrentWeather(config: { current_year: number; current_month: number; current_day: number }) {
  if (!activeCampaignId.value) return

  try {
    const weather = await $fetch<Weather | null>('/api/calendar/weather', {
      query: {
        campaignId: activeCampaignId.value,
        year: config.current_year,
        month: config.current_month,
        day: config.current_day,
      },
    })
    if (weather) {
      currentWeather.value = {
        weatherType: weather.weather_type,
        temperature: weather.temperature ?? undefined,
      }
    }
  } catch {
    // Weather might not exist for this day
    currentWeather.value = null
  }
}

function openEntityPreview(pin: PinboardItem) {
  previewEntityId.value = pin.id
  previewEntityType.value = pin.type as EntityPreviewType
  showEntityPreview.value = true
}

// Initialize
onMounted(() => {
  campaignStore.initFromCookie()
  if (activeCampaignId.value) {
    fetchDashboardData()
  }
})

// Watch for campaign changes
watch(activeCampaignId, (newId) => {
  if (newId) {
    fetchDashboardData()
  }
})
</script>

<style scoped>
.cursor-pointer {
  cursor: pointer;
}

/* Dice overlay - positioned absolute so it doesn't take layout space */
.dice-overlay {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  z-index: 1;
  pointer-events: auto;
}

/* Campaign chip - absolute position on smaller screens */
@media (max-width: 1465px) {
  .campaign-chip {
    position: absolute;
    top: -15px;
    right: 0;
  }
}

/* Widget row alignment */
.widgets-row {
  align-items: stretch;
}
</style>
