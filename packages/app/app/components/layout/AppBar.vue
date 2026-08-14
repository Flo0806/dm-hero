<template>
  <v-app-bar border class="app-bar-draggable">
    <v-app-bar-title>
      <v-icon icon="mdi-dice-d20" class="mr-2" />
      DM Hero
      <v-chip size="x-small" variant="outlined" class="ml-2 version-badge-inline">
        v{{ version }}
      </v-chip>
      <span
        v-if="codename"
        class="release-codename text-primary ml-2"
        :style="{ fontFamily: `'${codename.font}', serif` }"
      >
        {{ codename.name }}
      </span>
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
  </v-app-bar>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import packageJson from '../../../package.json'

interface WindowControlsOverlay extends EventTarget {
  visible: boolean
  getTitlebarAreaRect(): DOMRect
  ongeometrychange: (ev: GeometryChangeEvent) => void
}

interface GeometryChangeEvent extends Event {
  titlebarAreaRect: DOMRect
}

declare global {
  interface Navigator {
    windowControlsOverlay?: WindowControlsOverlay
  }
}

interface Props {
  currentLocale: string
}

const props = defineProps<Props>()

defineEmits<{
  'change-locale': [locale: string]
  'search-click': []
}>()

const version = packageJson.version

// Each minor release gets its own codename, shown in the header in its OWN
// font — every release looks different. Add an entry per minor as it ships.
const RELEASE_CODENAMES: Record<string, { name: string, font: string }> = {
  1.4: { name: 'The Summoning', font: 'Pirata One' },
}
const codename = computed(() => {
  const [major, minor] = version.split('.')
  const exact = RELEASE_CODENAMES[`${major}.${minor}`]
  if (exact) return exact
  // Fallback: highest codename by NUMERIC major.minor (not lexicographic, so
  // e.g. 1.10 beats 1.9) — shows the upcoming release's name during its dev cycle.
  const latestKey = Object.keys(RELEASE_CODENAMES).sort((a, b) => {
    const [am, an] = a.split('.').map(Number)
    const [bm, bn] = b.split('.').map(Number)
    return am - bm || an - bn
  }).at(-1)
  return latestKey ? RELEASE_CODENAMES[latestKey] : null
})

const locales = [
  { value: 'de', label: 'Deutsch', flagIcon: 'flag:de-4x3' },
  { value: 'en', label: 'English', flagIcon: 'flag:gb-4x3' },
  { value: 'zh-CN', label: '简体中文', flagIcon: 'flag:cn-4x3' },
]

const currentLocaleData = computed(() => {
  return locales.find(l => l.value === props.currentLocale) ?? locales[0]
})

// Set to 100% by default, meaning the right edge of the window controls is at the far right of the window
const windowControlsRightEdge = ref('100%')

if (import.meta.client && window.electronAPI?.isElectron) {
  const controlsOverlay = navigator.windowControlsOverlay
  if (controlsOverlay) {
    if (controlsOverlay?.visible) {
      const titlebarAreaRect = controlsOverlay.getTitlebarAreaRect()
      windowControlsRightEdge.value = `${titlebarAreaRect.x + titlebarAreaRect.width}px`
    }
    controlsOverlay.ongeometrychange = (e: GeometryChangeEvent) => {
      windowControlsRightEdge.value = `${e.titlebarAreaRect.x + e.titlebarAreaRect.width}px`
    }
  }
}
</script>

<style>
/* Release-codename display font (bundled locally — works offline). */
@font-face {
  font-family: 'Pirata One';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/pirata-one.woff2') format('woff2');
}
</style>

<style scoped>
/* The per-release codename next to the title. */
.release-codename {
  font-size: 1.25rem;
  line-height: 1;
  letter-spacing: 0.5px;
  opacity: 0.9;
  vertical-align: middle;
}

/* Make app bar draggable in Electron (allows window dragging) */
.app-bar-draggable {
  -webkit-app-region: drag;
  padding-right: calc(100% - v-bind(windowControlsRightEdge));
}

/* Make interactive elements clickable (not draggable) */
.app-bar-draggable :deep(button),
.app-bar-draggable :deep(.v-btn),
.app-bar-draggable :deep(.v-chip),
.app-bar-draggable :deep(.v-menu) {
  -webkit-app-region: no-drag;
}
</style>
