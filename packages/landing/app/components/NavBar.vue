<script setup lang="ts">
const { t, locale, setLocale } = useI18n()

const drawer = ref(false)
const scrolled = ref(false)

const navItems = [
  { key: 'features', href: '#features' },
  { key: 'screenshots', href: '#screenshots' },
  { key: 'download', href: '#download' },
  { key: 'docs', href: '/docs' },
]

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
      <a href="#" class="d-flex align-center text-decoration-none logo-link">
        <img src="/logo.png" alt="DM Hero" class="nav-logo" />
        <span class="text-h6 font-weight-bold gradient-text d-none d-sm-inline">
          DM Hero
        </span>
      </a>

      <v-spacer />

      <!-- Desktop Navigation -->
      <nav class="d-none d-md-flex align-center ga-1">
        <v-btn
          v-for="item in navItems"
          :key="item.key"
          :href="item.href"
          variant="text"
          color="primary"
          class="nav-link"
        >
          {{ t(`nav.${item.key}`) }}
        </v-btn>

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

  <!-- Mobile Navigation Drawer -->
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

      <v-list-item
        v-for="item in navItems"
        :key="item.key"
        :href="item.href"
        color="primary"
        @click="drawer = false"
      >
        <v-list-item-title>{{ t(`nav.${item.key}`) }}</v-list-item-title>
      </v-list-item>

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
    </v-list>
  </v-navigation-drawer>
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
</style>
