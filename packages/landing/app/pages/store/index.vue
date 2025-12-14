<template>
  <v-container class="py-12">
    <!-- Header -->
    <div class="text-center mb-12">
      <img
        src="/images/store/store-logo.png"
        alt="Adventure Store"
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
      <template v-if="isAuthenticated">
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
            v-if="isCreator"
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

    <!-- Coming Soon State -->
    <v-card class="text-center pa-12" elevation="0" color="surface-variant">
      <v-icon icon="mdi-treasure-chest" size="96" color="primary" class="mb-6" />
      <h2 class="text-h4 mb-4">{{ $t('store.comingSoon.title') }}</h2>
      <p class="text-body-1 text-medium-emphasis mb-6" style="max-width: 500px; margin: 0 auto">
        {{ $t('store.comingSoon.description') }}
      </p>
      <v-btn color="primary" variant="tonal" to="/" prepend-icon="mdi-arrow-left">
        {{ $t('store.comingSoon.backHome') }}
      </v-btn>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
const { t } = useI18n()
const router = useRouter()
const { user, isAuthenticated, isCreator, logout } = useAuth()

async function handleLogout() {
  await logout()
  router.push('/')
}

const search = ref('')
const sortBy = ref('newest')
const language = ref<string | null>(null)

const sortOptions = computed(() => [
  { title: t('store.sort.newest'), value: 'newest' },
  { title: t('store.sort.popular'), value: 'popular' },
  { title: t('store.sort.rating'), value: 'rating' },
])

const languageOptions = computed(() => [
  { title: 'Deutsch', value: 'de' },
  { title: 'English', value: 'en' },
])
</script>

<style scoped>
.store-logo {
  width: 180px;
  height: 180px;
  border-radius: 24px;
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
