<template>
  <v-app-bar border>
    <v-app-bar-title>
      <v-icon icon="mdi-dice-d20" class="mr-2" />
      DM Hero
    </v-app-bar-title>

    <v-spacer />

    <!-- Language Switcher -->
    <v-btn-toggle
      :model-value="currentLocale"
      mandatory
      density="compact"
      class="mr-2"
      @update:model-value="$emit('change-locale', $event)"
    >
      <v-btn value="de" size="small">
        DE
      </v-btn>
      <v-btn value="en" size="small">
        EN
      </v-btn>
    </v-btn-toggle>

    <v-btn
      icon="mdi-magnify"
      @click="$emit('search-click')"
    />
  </v-app-bar>
</template>

<script setup lang="ts">
interface Props {
  currentLocale: string
}

defineProps<Props>()

defineEmits<{
  'change-locale': [locale: string]
  'search-click': []
}>()
</script>
