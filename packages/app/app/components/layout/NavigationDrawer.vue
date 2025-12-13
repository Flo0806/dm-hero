<template>
  <v-navigation-drawer
    v-if="hasActiveCampaign"
    :model-value="modelValue"
    :rail="rail"
    permanent
    @click="$emit('update:rail', false)"
    @update:model-value="$emit('update:model-value', $event)"
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

    <v-divider v-if="activeCampaignName && !rail" />

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
        @click="$emit('search-click')"
      />
      <v-list-item
        prepend-icon="mdi-account-group"
        :title="$t('nav.npcs')"
        value="npcs"
        to="/npcs"
      />
      <v-list-item
        prepend-icon="mdi-map-marker"
        :title="$t('nav.locations')"
        value="locations"
        to="/locations"
      />
      <v-list-item prepend-icon="mdi-sword" :title="$t('nav.items')" value="items" to="/items" />
      <v-list-item
        prepend-icon="mdi-shield"
        :title="$t('nav.factions')"
        value="factions"
        to="/factions"
      />
      <v-list-item
        prepend-icon="mdi-book-open-variant"
        :title="$t('nav.lore')"
        value="lore"
        to="/lore"
      />
      <v-list-item
        prepend-icon="mdi-account-star"
        :title="$t('nav.players')"
        value="players"
        to="/players"
      />
      <v-list-item
        prepend-icon="mdi-book-open-page-variant"
        :title="$t('nav.sessions')"
        value="sessions"
        to="/sessions"
      />
      <v-list-item
        prepend-icon="mdi-calendar"
        :title="$t('calendar.title')"
        value="calendar"
        to="/calendar"
      />
      <v-list-item
        prepend-icon="mdi-map"
        :title="$t('nav.maps')"
        value="maps"
        to="/maps"
      />
      <v-list-item
        prepend-icon="mdi-notebook-outline"
        :title="$t('nav.notes')"
        value="notes"
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
        <v-list-item
          :prepend-icon="isDark ? 'mdi-weather-night' : 'mdi-weather-sunny'"
          :title="rail ? '' : $t('nav.theme')"
          @click="$emit('toggle-theme')"
        />
      </v-list>
    </template>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
const router = useRouter()
const notesStore = useNotesStore()

interface Props {
  modelValue: boolean
  rail: boolean
  hasActiveCampaign: boolean
  activeCampaignName?: string | null
  isDark: boolean
}

defineProps<Props>()

defineEmits<{
  'update:model-value': [value: boolean]
  'update:rail': [value: boolean]
  'search-click': []
  'toggle-theme': []
}>()
</script>
