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
      <v-row>
        <v-col cols="12">
          <div class="d-flex align-center justify-space-between mb-4">
            <div>
              <div class="text-h2 mb-2">
                <v-icon icon="mdi-dice-d20" size="48" class="mr-3" />
                {{ $t('app.welcome') }}
              </div>
              <p class="text-h6 text-medium-emphasis">
                {{ $t('app.subtitle') }}
              </p>
            </div>
            <v-chip
              v-if="activeCampaignName"
              color="primary"
              size="large"
              prepend-icon="mdi-sword-cross"
              class="cursor-pointer"
              @click="router.push('/campaigns')"
            >
              {{ activeCampaignName }}
            </v-chip>
          </div>
        </v-col>
      </v-row>

      <v-row>
        <v-col v-for="category in categories" :key="category.title" cols="12" md="6" lg="4">
          <v-card :to="category.to" hover class="h-100">
            <v-card-text class="pa-6">
              <div class="d-flex align-center mb-4">
                <v-icon :icon="category.icon" :color="category.color" size="32" class="mr-3" />
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
              {{ $t('quickstart.title') }}
            </v-card-title>
            <v-card-text>
              <v-list>
                <v-list-item>
                  <template #prepend>
                    <v-icon icon="mdi-keyboard" />
                  </template>
                  <v-list-item-title>
                    {{ $t('quickstart.searchHint') }}
                  </v-list-item-title>
                </v-list-item>
                <v-list-item>
                  <template #prepend>
                    <v-icon icon="mdi-plus" />
                  </template>
                  <v-list-item-title>
                    {{ $t('quickstart.createHint') }}
                  </v-list-item-title>
                </v-list-item>
                <v-list-item>
                  <template #prepend>
                    <v-icon icon="mdi-link-variant" />
                  </template>
                  <v-list-item-title>
                    {{ $t('quickstart.linkHint') }}
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
const router = useRouter()
const campaignStore = useCampaignStore()

// Get active campaign from campaign store
const activeCampaignId = computed(() => campaignStore.activeCampaignId)
const activeCampaignName = useCookie('activeCampaignName')

onMounted(() => {
  // Initialize campaign from cookie
  campaignStore.initFromCookie()
})

const { t } = useI18n()

const categories = computed(() => [
  {
    title: t('categories.npcs.title'),
    icon: 'mdi-account-group',
    color: '#D4A574',
    to: '/npcs',
    description: t('categories.npcs.description'),
  },
  {
    title: t('categories.locations.title'),
    icon: 'mdi-map-marker',
    color: '#8B7355',
    to: '/locations',
    description: t('categories.locations.description'),
  },
  {
    title: t('categories.items.title'),
    icon: 'mdi-sword',
    color: '#CC8844',
    to: '/items',
    description: t('categories.items.description'),
  },
  {
    title: t('categories.factions.title'),
    icon: 'mdi-shield',
    color: '#7B92AB',
    to: '/factions',
    description: t('categories.factions.description'),
  },
  {
    title: t('categories.sessions.title'),
    icon: 'mdi-book-open-page-variant',
    color: '#D4A574',
    to: '/sessions',
    description: t('categories.sessions.description'),
  },
])
</script>
