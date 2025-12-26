<template>
  <div>
    <StoreBackground />
    <v-container class="py-12 position-relative" style="z-index: 1">
    <!-- Header -->
    <div class="text-center mb-12">
      <img
        src="/images/store/basar-logo.png"
        alt="Hero Basar"
        class="store-logo mb-6"
      />
      <h1 class="text-h2 font-weight-light mb-4">
        {{ $t('store.title') }}
      </h1>
      <p class="text-h6 text-medium-emphasis mx-auto" style="max-width: 600px">
        {{ $t('store.subtitle') }}
      </p>
    </div>

    <!-- User Actions -->
    <div class="d-flex justify-center align-center mb-8">
      <!-- Loading state -->
      <template v-if="authLoading">
        <v-progress-circular indeterminate color="primary" size="32" />
      </template>
      <!-- Logged in -->
      <template v-else-if="isAuthenticated">
        <div class="user-card d-flex align-center ga-4 px-6 py-3 rounded-pill">
          <v-avatar color="primary" size="40">
            <v-icon v-if="!user?.avatarUrl">mdi-account</v-icon>
            <v-img v-else :src="user.avatarUrl" />
          </v-avatar>
          <div class="d-flex flex-column">
            <span class="text-body-1 font-weight-medium">{{ user?.displayName }}</span>
            <span class="text-caption text-medium-emphasis">{{ user?.email }}</span>
          </div>
          <v-divider vertical class="mx-2" />
          <v-btn
            color="primary"
            variant="flat"
            prepend-icon="mdi-plus"
            to="/store/upload"
            class="mr-2"
          >
            {{ $t('store.uploadAdventure') }}
          </v-btn>
          <v-btn
            variant="text"
            color="error"
            prepend-icon="mdi-logout"
            @click="handleLogout"
          >
            {{ $t('store.logout') }}
          </v-btn>
        </div>
      </template>
      <!-- Not logged in -->
      <template v-else>
        <div class="d-flex ga-3">
          <v-btn color="primary" variant="flat" size="large" to="/login" prepend-icon="mdi-login">
            {{ $t('store.login') }}
          </v-btn>
          <v-btn variant="outlined" size="large" to="/register" prepend-icon="mdi-account-plus">
            {{ $t('store.register') }}
          </v-btn>
        </div>
      </template>
    </div>

    <!-- Search & Filters -->
    <v-row class="mb-8">
      <v-col cols="12" md="6" lg="4">
        <v-text-field
          v-model="search"
          :placeholder="$t('store.searchPlaceholder')"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          density="comfortable"
          hide-details
          clearable
        />
      </v-col>
      <v-col cols="12" md="3" lg="2">
        <v-select
          v-model="sortBy"
          :items="sortOptions"
          :label="$t('store.sortBy')"
          variant="outlined"
          density="comfortable"
          hide-details
        />
      </v-col>
      <v-col cols="12" md="3" lg="2">
        <v-select
          v-model="language"
          :items="languageOptions"
          :label="$t('store.language')"
          variant="outlined"
          density="comfortable"
          hide-details
          clearable
        />
      </v-col>
    </v-row>

    <!-- Loading State -->
    <v-row v-if="loading">
      <v-col v-for="i in 8" :key="i" cols="12" sm="6" md="4" xl="3">
        <StoreAdventureCardSkeleton />
      </v-col>
    </v-row>

    <!-- Adventures Grid -->
    <v-row v-else-if="adventures.length > 0">
      <v-col v-for="adventure in adventures" :key="adventure.id" cols="12" sm="6" md="4" xl="3">
        <StoreMagicCardBorder>
          <StoreAdventureCard :adventure="adventure" />
        </StoreMagicCardBorder>
      </v-col>
    </v-row>

    <!-- Empty State -->
    <v-card v-else class="text-center pa-12" elevation="0" color="surface-variant">
      <v-icon icon="mdi-treasure-chest-outline" size="96" color="primary" class="mb-6" />
      <h2 class="text-h4 mb-4">{{ $t('store.empty.title') }}</h2>
      <p class="text-body-1 text-medium-emphasis mb-6" style="max-width: 500px; margin: 0 auto">
        {{ $t('store.empty.description') }}
      </p>
      <v-btn
        v-if="isAuthenticated"
        color="primary"
        variant="flat"
        to="/store/upload"
        prepend-icon="mdi-plus"
      >
        {{ $t('store.empty.createFirst') }}
      </v-btn>
    </v-card>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="d-flex justify-center mt-8">
      <v-pagination
        v-model="page"
        :length="totalPages"
        :total-visible="7"
        rounded
      />
    </div>
  </v-container>

  <!-- Footer -->
  <FooterSection />
  </div>
</template>

<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import { useAdventureStore } from '~/stores/adventureStore'
import { useFavoritesStore } from '~/stores/favoritesStore'

const { t } = useI18n()
const router = useRouter()
const { user, isAuthenticated, loading: authLoading, logout } = useAuth()
const store = useAdventureStore()
const favoritesStore = useFavoritesStore()

async function handleLogout() {
  await logout()
  favoritesStore.clear()
  router.push('/')
}

// Local filter refs that sync with store
const search = ref(store.filters.search)
const sortBy = ref(store.filters.sortBy)
const language = ref(store.filters.language)
const page = ref(store.filters.page)

// Computed from store
const adventures = computed(() => store.adventures)
const loading = computed(() => store.loading)
const totalPages = computed(() => store.totalPages)

const sortOptions = computed(() => [
  { title: t('store.sort.newest'), value: 'newest' },
  { title: t('store.sort.popular'), value: 'popular' },
  { title: t('store.sort.rating'), value: 'rating' },
])

const languageOptions = computed(() => [
  { title: 'Deutsch', value: 'de' },
  { title: 'English', value: 'en' },
])

// Debounced search
const debouncedSearch = useDebounceFn((val: string) => {
  store.setSearch(val)
  store.fetchAdventures()
}, 300)

// Watch filters and update store
watch(search, (val) => {
  debouncedSearch(val)
})

watch(sortBy, (val) => {
  store.setSortBy(val as 'newest' | 'popular' | 'rating')
  store.fetchAdventures()
})

watch(language, (val) => {
  store.setLanguage(val)
  store.fetchAdventures()
})

watch(page, (val) => {
  store.setPage(val)
  store.fetchAdventures()
})

// Initial fetch
onMounted(async () => {
  store.fetchAdventures()

  // Fetch favorites if logged in
  if (isAuthenticated.value) {
    favoritesStore.fetchFavorites()
  }
})

// Also fetch favorites when auth state changes (e.g., after login)
watch(isAuthenticated, (loggedIn) => {
  if (loggedIn) {
    favoritesStore.fetchFavorites()
  } else {
    favoritesStore.clear()
  }
})
</script>

<style scoped>
.store-logo {
  width: 240px;
  height: auto;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  transition: transform 0.3s ease;
}

.store-logo:hover {
  transform: scale(1.05) rotate(-2deg);
}

.user-card {
  background: rgba(var(--v-theme-surface-variant), 0.5);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(var(--v-theme-outline), 0.15);
}
</style>
