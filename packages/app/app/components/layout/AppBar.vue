<template>
  <v-app-bar border class="app-bar-draggable">
    <v-app-bar-title>
      <v-icon icon="mdi-dice-d20" class="mr-2" />
      DM Hero
      <v-chip size="x-small" variant="outlined" class="ml-2 version-badge-inline">
        v{{ version }}
      </v-chip>
    </v-app-bar-title>

    <v-spacer />

    <!-- Language Switcher with Flags -->
    <v-menu>
      <template #activator="{ props: menuProps }">
        <v-btn v-bind="menuProps" variant="text" class="mr-2">
          <Icon :icon="currentLocaleData!.flagIcon" width="20" height="15" class="mr-2" />
          <span class="text-uppercase">{{ currentLocale }}</span>
          <v-icon end>mdi-chevron-down</v-icon>
        </v-btn>
      </template>
      <v-list density="compact" min-width="160">
        <v-list-item
          v-for="locale in locales"
          :key="locale.value"
          :active="currentLocale === locale.value"
          @click="$emit('change-locale', locale.value)"
        >
          <template #prepend>
            <Icon :icon="locale.flagIcon" width="24" height="18" class="mr-3" />
          </template>
          <v-list-item-title>{{ locale.label }}</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>

    <v-btn icon="mdi-magnify" class="search-btn" @click="$emit('search-click')" />

    <!-- Version badge in Electron (next to window controls) -->
    <v-chip size="x-small" variant="outlined" class="version-badge-electron">
      v{{ version }}
    </v-chip>
  </v-app-bar>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import packageJson from '../../../package.json'

interface Props {
  currentLocale: string
}

const props = defineProps<Props>()

defineEmits<{
  'change-locale': [locale: string]
  'search-click': []
}>()

const version = packageJson.version

const locales = [
  { value: 'de', label: 'Deutsch', flagIcon: 'flag:de-4x3' },
  { value: 'en', label: 'English', flagIcon: 'flag:gb-4x3' },
]

const currentLocaleData = computed(() => {
  return locales.find((l) => l.value === props.currentLocale) ?? locales[0]
})
</script>

<style scoped>
/* Make app bar draggable in Electron (allows window dragging) */
.app-bar-draggable {
  -webkit-app-region: drag;
}

/* Make interactive elements clickable (not draggable) */
.app-bar-draggable :deep(button),
.app-bar-draggable :deep(.v-btn),
.app-bar-draggable :deep(.v-chip),
.app-bar-draggable :deep(.v-menu) {
  -webkit-app-region: no-drag;
}

/* Version badge: show inline in Web, hide in Electron */
.version-badge-inline {
  display: var(--electron-hide-inline, inline-flex);
}

/* Version badge: hide in Web, show in Electron (next to window controls) */
.version-badge-electron {
  display: var(--electron-show-badge, none);
  margin-right: 8px;
  margin-top: var(--electron-badge-offset, 0px);
}

/* Extra margin for search button in Electron (Windows/Linux) */
.search-btn {
  margin-right: var(--electron-btn-margin, 0px);
}
</style>
