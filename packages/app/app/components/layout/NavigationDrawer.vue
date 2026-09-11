<template>
  <v-navigation-drawer
    :model-value="modelValue"
    :rail="rail"
    permanent
    @click="$emit('update:rail', false)"
    @update:model-value="$emit('update:model-value', $event)"
  >
    <!-- Fixed top: app title + active campaign -->
    <template #prepend>
      <v-list-item
        :prepend-icon="rail ? 'mdi-dice-d20' : 'mdi-dice-d20'"
        :title="rail ? '' : 'DM Hero'"
        nav
      >
        <template #append>
          <v-btn
            :icon="rail ? 'mdi-chevron-right' : 'mdi-chevron-left'"
            variant="text"
            @click.stop="$emit('update:rail', !rail)"
          />
        </template>
      </v-list-item>

      <v-divider />

      <!-- Active Campaign Display -->
      <v-list-item
        v-if="activeCampaignName && !rail"
        prepend-icon="mdi-sword-cross"
        :title="activeCampaignName || ''"
        :subtitle="$t('nav.activeCampaign')"
        class="mb-2"
        @click="router.push('/campaigns')"
      />

      <!-- No campaign yet: the only thing that makes sense is picking one -->
      <v-list-item
        v-if="!hasActiveCampaign"
        prepend-icon="mdi-sword-cross"
        :title="rail ? '' : $t('nav.chooseCampaign')"
        :subtitle="rail ? undefined : $t('nav.chooseCampaignHint')"
        class="mb-2"
        color="primary"
        active
        @click="router.push('/campaigns')"
      />

      <v-divider v-if="(activeCampaignName || !hasActiveCampaign) && !rail" />
    </template>

    <!-- Scrollable middle: nav items -->
    <v-list density="compact" nav>
      <v-list-item
        prepend-icon="mdi-view-dashboard"
        :title="$t('nav.dashboard')"
        value="home"
        to="/"
      />
      <v-list-item
        prepend-icon="mdi-magnify"
        :title="$t('nav.search')"
        value="search"
        :disabled="!hasActiveCampaign"
        :active="isSearchActive"
        @click="$emit('search-click')"
      />
      <v-list-item
        prepend-icon="mdi-account-group"
        :title="$t('nav.npcs')"
        value="npcs"
        :disabled="!hasActiveCampaign"
        to="/npcs"
      />
      <v-list-item
        prepend-icon="mdi-map-marker"
        :title="$t('nav.locations')"
        value="locations"
        :disabled="!hasActiveCampaign"
        to="/locations"
      />
      <v-list-item prepend-icon="mdi-sword" :title="$t('nav.items')" value="items" :disabled="!hasActiveCampaign" to="/items" />
      <v-list-item
        prepend-icon="mdi-shield"
        :title="$t('nav.factions')"
        value="factions"
        :disabled="!hasActiveCampaign"
        to="/factions"
      />
      <v-list-item
        prepend-icon="mdi-book-open-variant"
        :title="$t('nav.lore')"
        value="lore"
        :disabled="!hasActiveCampaign"
        to="/lore"
      />
      <v-list-item
        prepend-icon="mdi-account-star"
        :title="$t('nav.players')"
        value="players"
        :disabled="!hasActiveCampaign"
        to="/players"
      />
      <v-list-item
        prepend-icon="mdi-book-open-page-variant"
        :title="$t('nav.sessions')"
        value="sessions"
        :disabled="!hasActiveCampaign"
        to="/sessions"
      />
      <v-list-item
        prepend-icon="mdi-sword-cross"
        :title="$t('nav.encounters')"
        value="encounters"
        :disabled="!hasActiveCampaign"
        to="/encounters"
        :class="{ 'encounter-active': hasCombatActive }"
      />
      <v-list-item
        prepend-icon="mdi-calendar"
        :title="$t('calendar.title')"
        value="calendar"
        :disabled="!hasActiveCampaign"
        to="/calendar"
      />
      <v-list-item
        prepend-icon="mdi-map"
        :title="$t('nav.maps')"
        value="maps"
        :disabled="!hasActiveCampaign"
        to="/maps"
      />
      <v-list-item
        :prepend-icon="music.isPlaying.value ? 'mdi-music-note' : 'mdi-music'"
        :title="$t('nav.music')"
        value="music"
        to="/music"
        :class="{ 'music-active': music.isPlaying.value }"
      >
        <!-- Mini transport while a track is loaded (not in rail mode – no room) -->
        <template v-if="music.currentTrack.value && !rail" #append>
          <div class="d-flex align-center music-nav-controls">
            <v-btn icon size="x-small" variant="text" :title="$t('music.previous')" @click.stop.prevent="music.prev()">
              <v-icon icon="mdi-skip-previous" size="small" />
            </v-btn>
            <v-btn icon size="x-small" variant="text" :title="music.isPlaying.value ? $t('music.pause') : $t('music.play')" @click.stop.prevent="music.togglePlay()">
              <v-icon :icon="music.isPlaying.value ? 'mdi-pause' : 'mdi-play'" size="small" />
            </v-btn>
            <v-btn icon size="x-small" variant="text" :title="$t('music.next')" @click.stop.prevent="music.next()">
              <v-icon icon="mdi-skip-next" size="small" />
            </v-btn>
          </div>
        </template>
      </v-list-item>
      <v-list-item
        prepend-icon="mdi-folder-multiple"
        :title="$t('nav.groups')"
        value="groups"
        :disabled="!hasActiveCampaign"
        to="/groups"
      />
      <v-list-item
        prepend-icon="mdi-notebook-outline"
        :title="$t('nav.notes')"
        value="notes"
        :disabled="!hasActiveCampaign"
        to="/notes"
      >
        <template v-if="notesStore.pendingCount > 0" #append>
          <v-badge
            :content="notesStore.pendingCount"
            color="primary"
            inline
          />
        </template>
      </v-list-item>
    </v-list>

    <template #append>
      <!-- Update Banner -->
      <LayoutUpdateBanner :rail="rail" />

      <v-divider />
      <v-list density="compact" nav>
        <v-list-item
          prepend-icon="mdi-database"
          :title="rail ? '' : $t('nav.referenceData')"
          to="/reference-data"
        />
        <v-list-item
          prepend-icon="mdi-cog"
          :title="rail ? '' : $t('nav.settings')"
          to="/settings"
        />
        <LayoutThemeSwitcher :rail="rail" />
      </v-list>
    </template>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
const router = useRouter()
const notesStore = useNotesStore()
const music = useMusicPlayer()
const encounterStore = useEncounterStore()

const hasCombatActive = computed(() =>
  encounterStore.encounters.some(e => e.status === 'active'),
)

interface Props {
  modelValue: boolean
  rail: boolean
  hasActiveCampaign: boolean
  activeCampaignName?: string | null
  isSearchActive: boolean
}

defineProps<Props>()

defineEmits<{
  'update:model-value': [value: boolean]
  'update:rail': [value: boolean]
  'search-click': []
}>()
</script>

<style scoped>
.encounter-active {
  color: rgb(var(--v-theme-error)) !important;
}
.encounter-active :deep(.v-icon) {
  color: rgb(var(--v-theme-error)) !important;
}
.music-active :deep(.v-list-item__prepend .v-icon) {
  color: rgb(var(--v-theme-primary));
}
.music-nav-controls {
  margin-right: -8px;
}
</style>
