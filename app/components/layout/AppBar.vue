<template>
  <v-app-bar border>
    <v-app-bar-title>
      <v-icon icon="mdi-dice-d20" class="mr-2" />
      DM Hero
    </v-app-bar-title>

    <v-spacer />

    <!-- Language Switcher with Flags -->
    <v-menu>
      <template #activator="{ props }">
        <v-btn
          v-bind="props"
          variant="text"
          class="mr-2"
        >
          <Icon :icon="currentLocaleData.flagIcon" width="20" height="15" class="mr-2" />
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

    <v-btn
      icon="mdi-magnify"
      @click="$emit('search-click')"
    />
  </v-app-bar>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

interface Props {
  currentLocale: string
}

const props = defineProps<Props>()

defineEmits<{
  'change-locale': [locale: string]
  'search-click': []
}>()

const locales = [
  { value: 'de', label: 'Deutsch', flagIcon: 'flag:de-4x3' },
  { value: 'en', label: 'English', flagIcon: 'flag:gb-4x3' },
]

const currentLocaleData = computed(() => {
  return locales.find(l => l.value === props.currentLocale) ?? locales[0]
})
</script>
