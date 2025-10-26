<template>
  <v-container>
    <!-- Redirect to campaigns if no campaign selected -->
    <div v-if="!activeCampaignId" class="text-center py-16">
      <v-icon icon="mdi-sword-cross" size="64" class="mb-4" color="primary" />
      <h2 class="text-h4 mb-4">
        Wähle eine Kampagne
      </h2>
      <p class="text-body-1 text-medium-emphasis mb-6">
        Um loszulegen, wähle eine bestehende Kampagne oder erstelle eine neue.
      </p>
      <v-btn
        color="primary"
        size="large"
        to="/campaigns"
        prepend-icon="mdi-arrow-right"
      >
        Zu den Kampagnen
      </v-btn>
    </div>

    <div v-else>
      <v-row>
        <v-col cols="12">
          <div class="d-flex align-center justify-space-between mb-4">
            <div>
              <div class="text-h2 mb-2">
                <v-icon icon="mdi-dice-d20" size="48" class="mr-3" />
                Willkommen, Dungeon Master
              </div>
              <p class="text-h6 text-medium-emphasis">
                Behalte den Überblick über deine Kampagne
              </p>
            </div>
            <v-chip
              v-if="activeCampaignName"
              color="primary"
              size="large"
              prepend-icon="mdi-sword-cross"
              @click="navigateTo('/campaigns')"
              class="cursor-pointer"
            >
              {{ activeCampaignName }}
            </v-chip>
          </div>
        </v-col>
      </v-row>

    <v-row>
      <v-col
        v-for="category in categories"
        :key="category.title"
        cols="12"
        md="6"
        lg="4"
      >
        <v-card
          :to="category.to"
          hover
          class="h-100"
        >
          <v-card-text class="pa-6">
            <div class="d-flex align-center mb-4">
              <v-icon
                :icon="category.icon"
                :color="category.color"
                size="32"
                class="mr-3"
              />
              <div class="text-h5">
                {{ category.title }}
              </div>
            </div>
            <div class="text-body-2 text-medium-emphasis">
              {{ category.description }}
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row class="mt-8">
      <v-col cols="12">
        <v-card>
          <v-card-title>
            <v-icon icon="mdi-information" class="mr-2" />
            Schnellstart
          </v-card-title>
          <v-card-text>
            <v-list>
              <v-list-item>
                <template #prepend>
                  <v-icon icon="mdi-keyboard" />
                </template>
                <v-list-item-title>
                  Drücke <kbd>/</kbd> um die Schnellsuche zu öffnen
                </v-list-item-title>
              </v-list-item>
              <v-list-item>
                <template #prepend>
                  <v-icon icon="mdi-plus" />
                </template>
                <v-list-item-title>
                  Erstelle NPCs, Orte und mehr über die Sidebar
                </v-list-item-title>
              </v-list-item>
              <v-list-item>
                <template #prepend>
                  <v-icon icon="mdi-link-variant" />
                </template>
                <v-list-item-title>
                  Verknüpfe Entitäten miteinander für besseren Überblick
                </v-list-item-title>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
    </div>
  </v-container>
</template>

<script setup lang="ts">
const activeCampaignId = ref<string | null>(null)
const activeCampaignName = ref<string | null>(null)

onMounted(() => {
  activeCampaignId.value = localStorage.getItem('activeCampaignId')
  activeCampaignName.value = localStorage.getItem('activeCampaignName')
})

const categories = [
  {
    title: 'NPCs',
    icon: 'mdi-account-group',
    color: '#D4A574',
    to: '/npcs',
    description: 'Verwalte alle NPCs deiner Kampagne - von Questgebern bis zu Schurken',
  },
  {
    title: 'Orte',
    icon: 'mdi-map-marker',
    color: '#8B7355',
    to: '/locations',
    description: 'Alle Locations, Städte, Dungeons und wichtigen Orte',
  },
  {
    title: 'Items',
    icon: 'mdi-sword',
    color: '#CC8844',
    to: '/items',
    description: 'Magische Items, Artefakte und wichtige Gegenstände',
  },
  {
    title: 'Fraktionen',
    icon: 'mdi-shield',
    color: '#7B92AB',
    to: '/factions',
    description: 'Gilden, Organisationen und Gruppierungen',
  },
  {
    title: 'Quests',
    icon: 'mdi-script-text',
    color: '#B8935F',
    to: '/quests',
    description: 'Haupt- und Nebenquests im Überblick',
  },
  {
    title: 'Sessions',
    icon: 'mdi-book-open-page-variant',
    color: '#D4A574',
    to: '/sessions',
    description: 'Session-Logs und Zusammenfassungen',
  },
]
</script>
