<script setup lang="ts">
const { t, locale, setLocale } = useI18n()
const { user, isAuthenticated, logout } = useAuth()
const router = useRouter()

const drawer = ref(false)
const scrolled = ref(false)

const navItems = [
  { key: 'features', href: '/#features' },
  { key: 'screenshots', href: '/#screenshots' },
  { key: 'download', href: '/#download' },
  { key: 'store', href: '/store' },
  { key: 'docs', href: '/docs' },
  { key: 'support', href: 'https://buymeacoffee.com/flo0806', external: true, icon: 'mdi-coffee' },
]

// User initials for avatar fallback
const initials = computed(() => {
  if (!user.value?.displayName) return '?'
  return user.value.displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
})

// Handle scroll effect
function handleScroll() {
  scrolled.value = window.scrollY > 50
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll)
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})

// Toggle language
function toggleLanguage() {
  const newLocale = locale.value === 'en' ? 'de' : 'en'
  setLocale(newLocale)
}

// Handle logout
async function handleLogout() {
  await logout()
  drawer.value = false
  router.push('/')
}
</script>

<template>
  <v-app-bar
    :elevation="scrolled ? 2 : 0"
    :class="{ 'nav-scrolled': scrolled }"
    class="nav-bar"
    color="transparent"
  >
    <v-container class="d-flex align-center">
      <!-- Logo -->
      <NuxtLink to="/" class="d-flex align-center text-decoration-none logo-link">
        <img src="/logo.png" alt="DM Hero" class="nav-logo" />
        <span class="text-h6 font-weight-bold gradient-text d-none d-sm-inline">
          DM Hero
        </span>
      </NuxtLink>

      <v-spacer />

      <!-- Desktop Navigation -->
      <nav class="d-none d-md-flex align-center ga-1">
        <template v-for="item in navItems" :key="item.key">
          <a
            v-if="item.external"
            :href="item.href"
            target="_blank"
            rel="noopener noreferrer"
            class="bmc-nav-link"
          >
            <img
              src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png"
              alt="Buy Me A Coffee"
              class="bmc-nav-button"
            />
          </a>
          <v-btn
            v-else
            :href="item.href"
            variant="text"
            color="primary"
            class="nav-link"
          >
            {{ t(`nav.${item.key}`) }}
          </v-btn>
        </template>

        <v-btn
          href="https://github.com/Flo0806/dm-hero"
          target="_blank"
          variant="text"
          color="primary"
          class="nav-link"
        >
          <v-icon>mdi-github</v-icon>
        </v-btn>

        <!-- Language Toggle -->
        <v-btn
          variant="tonal"
          color="primary"
          size="small"
          class="ml-2"
          @click="toggleLanguage"
        >
          {{ locale === 'en' ? 'DE' : 'EN' }}
        </v-btn>

        <!-- Auth Section (client-only to prevent hydration mismatch) -->
        <ClientOnly>
          <!-- User Menu (when logged in) -->
          <v-menu v-if="isAuthenticated" offset-y>
            <template #activator="{ props: menuProps }">
              <v-btn
                v-bind="menuProps"
                variant="text"
                class="ml-2 pa-0"
                style="min-width: 40px"
              >
                <v-avatar size="36" color="primary">
                  <v-img v-if="user?.avatarUrl" :src="user.avatarUrl" />
                  <span v-else class="text-body-2">{{ initials }}</span>
                </v-avatar>
              </v-btn>
            </template>
            <v-list density="compact" min-width="180">
              <v-list-item class="px-4 py-2">
                <v-list-item-title class="font-weight-medium">
                  {{ user?.displayName }}
                </v-list-item-title>
                <v-list-item-subtitle class="text-caption">
                  {{ user?.email }}
                </v-list-item-subtitle>
              </v-list-item>
              <v-divider />
              <v-list-item to="/profile" prepend-icon="mdi-account">
                <v-list-item-title>{{ t('nav.profile') }}</v-list-item-title>
              </v-list-item>
              <v-divider />
              <v-list-item prepend-icon="mdi-logout" base-color="error" @click="handleLogout">
                <v-list-item-title>{{ t('store.logout') }}</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>

          <!-- Login Button (when not logged in) -->
          <v-btn
            v-else
            to="/login"
            variant="tonal"
            color="primary"
            size="small"
            class="ml-2"
            prepend-icon="mdi-login"
          >
            {{ t('store.login') }}
          </v-btn>

          <template #fallback>
            <div class="ml-2 d-flex align-center">
              <v-skeleton-loader type="avatar" width="36" height="36" />
            </div>
          </template>
        </ClientOnly>
      </nav>

      <!-- Mobile Menu Button -->
      <v-btn
        class="d-md-none"
        icon
        variant="text"
        color="primary"
        @click="drawer = true"
      >
        <v-icon>mdi-menu</v-icon>
      </v-btn>
    </v-container>
  </v-app-bar>

  <!-- Mobile Navigation Drawer (client-only to prevent SSR mobile detection mismatch) -->
  <ClientOnly>
    <v-navigation-drawer
      v-model="drawer"
      location="right"
      temporary
      width="280"
    >
    <v-list nav>
      <v-list-item class="mb-4">
        <template #prepend>
          <img src="/logo.png" alt="DM Hero" class="drawer-logo" />
        </template>
        <v-list-item-title class="text-h6 font-weight-bold gradient-text">
          DM Hero
        </v-list-item-title>
      </v-list-item>

      <v-divider class="mb-2" />

      <template v-for="item in navItems" :key="item.key">
        <v-list-item v-if="item.external" class="bmc-drawer-item">
          <a
            :href="item.href"
            target="_blank"
            rel="noopener noreferrer"
            class="bmc-drawer-link"
            @click="drawer = false"
          >
            <img
              src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png"
              alt="Buy Me A Coffee"
              class="bmc-drawer-button"
            />
          </a>
        </v-list-item>
        <v-list-item
          v-else
          :href="item.href"
          color="primary"
          @click="drawer = false"
        >
          <v-list-item-title>{{ t(`nav.${item.key}`) }}</v-list-item-title>
        </v-list-item>
      </template>

      <v-list-item
        href="https://github.com/Flo0806/dm-hero"
        target="_blank"
        color="primary"
      >
        <template #prepend>
          <v-icon>mdi-github</v-icon>
        </template>
        <v-list-item-title>GitHub</v-list-item-title>
      </v-list-item>

      <v-divider class="my-2" />

      <v-list-item @click="toggleLanguage">
        <template #prepend>
          <v-icon>mdi-translate</v-icon>
        </template>
        <v-list-item-title>
          {{ locale === 'en' ? 'Deutsch' : 'English' }}
        </v-list-item-title>
      </v-list-item>

      <v-divider class="my-2" />

      <!-- User Section (Mobile) -->
      <template v-if="isAuthenticated">
        <v-list-item class="mb-2">
          <template #prepend>
            <v-avatar size="40" color="primary" class="mr-3">
              <v-img v-if="user?.avatarUrl" :src="user.avatarUrl" />
              <span v-else class="text-body-2">{{ initials }}</span>
            </v-avatar>
          </template>
          <v-list-item-title class="font-weight-medium">
            {{ user?.displayName }}
          </v-list-item-title>
          <v-list-item-subtitle class="text-caption">
            {{ user?.email }}
          </v-list-item-subtitle>
        </v-list-item>

        <v-list-item to="/profile" color="primary" @click="drawer = false">
          <template #prepend>
            <v-icon>mdi-account</v-icon>
          </template>
          <v-list-item-title>{{ t('nav.profile') }}</v-list-item-title>
        </v-list-item>

        <v-list-item base-color="error" @click="handleLogout">
          <template #prepend>
            <v-icon>mdi-logout</v-icon>
          </template>
          <v-list-item-title>{{ t('store.logout') }}</v-list-item-title>
        </v-list-item>
      </template>

      <template v-else>
        <v-list-item to="/login" color="primary" @click="drawer = false">
          <template #prepend>
            <v-icon>mdi-login</v-icon>
          </template>
          <v-list-item-title>{{ t('store.login') }}</v-list-item-title>
        </v-list-item>
      </template>
    </v-list>
    </v-navigation-drawer>
  </ClientOnly>
</template>

<style scoped>
.nav-bar {
  transition: all 0.3s ease;
}

.nav-bar:not(.nav-scrolled) {
  background: transparent !important;
}

.nav-scrolled {
  background: rgba(26, 29, 41, 0.95) !important;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(212, 165, 116, 0.1);
}

.nav-link {
  text-transform: none;
  font-weight: 500;
  letter-spacing: 0.3px;
}

.nav-link:hover {
  background: rgba(212, 165, 116, 0.1);
}

.nav-logo {
  width: 40px;
  height: 40px;
  margin-right: 12px;
  border-radius: 8px;
}

.logo-link:hover .nav-logo {
  transform: scale(1.05);
  transition: transform 0.2s ease;
}

.drawer-logo {
  width: 32px;
  height: 32px;
  border-radius: 6px;
}

.bmc-nav-link {
  display: flex;
  align-items: center;
  margin-left: 8px;
  transition: transform 0.2s ease;
}

.bmc-nav-link:hover {
  transform: scale(1.05);
}

.bmc-nav-button {
  height: 36px;
  width: auto;
}

.bmc-drawer-item {
  padding: 8px 16px;
}

.bmc-drawer-link {
  display: block;
}

.bmc-drawer-button {
  height: 40px;
  width: auto;
}
</style>
