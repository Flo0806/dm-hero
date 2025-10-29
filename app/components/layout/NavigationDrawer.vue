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
      subtitle="Aktive Kampagne"
      class="mb-2"
      @click="navigateTo('/campaigns')"
    />

    <v-divider v-if="activeCampaignName && !rail" />

    <v-list density="compact" nav>
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
        @click="$emit('search-click')"
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
          :prepend-icon="isDark ? 'mdi-weather-night' : 'mdi-weather-sunny'"
          :title="rail ? '' : 'Theme'"
          @click="$emit('toggle-theme')"
        />
      </v-list>
    </template>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
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
