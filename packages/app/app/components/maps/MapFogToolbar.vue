<template>
  <!-- Fog of war: reveal or cover with a brush, all at once, undo -->
  <v-card class="fog-toolbar d-flex align-center flex-wrap ga-2 pa-2" role="toolbar" :aria-label="$t('maps.fog.title')" :disabled="disabled">
    <v-btn-toggle v-model="mode" mandatory density="compact" variant="outlined" divided>
      <v-btn value="reveal" prepend-icon="mdi-eye-outline">{{ $t('maps.fog.reveal') }}</v-btn>
      <v-btn value="cover" prepend-icon="mdi-weather-fog">{{ $t('maps.fog.cover') }}</v-btn>
    </v-btn-toggle>

    <v-btn-toggle v-model="size" mandatory density="compact" variant="outlined" divided :aria-label="$t('maps.fog.brushSize')">
      <v-btn v-for="(_, key) in FOG_BRUSH_SIZES" :key="key" :value="key" :aria-label="$t(`maps.fog.size.${key}`)">
        <v-icon :size="{ small: 10, medium: 16, large: 22 }[key]">mdi-circle</v-icon>
        <v-tooltip activator="parent" location="bottom">{{ $t(`maps.fog.size.${key}`) }}</v-tooltip>
      </v-btn>
    </v-btn-toggle>

    <v-btn icon size="small" variant="text" :disabled="!canUndo" :aria-label="$t('maps.fog.undo')" @click="emit('undo')">
      <v-icon>mdi-undo</v-icon>
      <v-tooltip activator="parent" location="bottom">{{ $t('maps.fog.undo') }}</v-tooltip>
    </v-btn>
    <v-btn size="small" variant="text" prepend-icon="mdi-eye-check-outline" @click="emit('revealAll')">
      {{ $t('maps.fog.revealAll') }}
    </v-btn>
    <v-btn size="small" variant="text" prepend-icon="mdi-eye-off-outline" @click="emit('coverAll')">
      {{ $t('maps.fog.coverAll') }}
    </v-btn>
  </v-card>
</template>

<script setup lang="ts">
import { FOG_BRUSH_SIZES, type FogBrushSize, type FogMode } from '~~/types/fog'

defineProps<{ canUndo: boolean, disabled?: boolean }>()
const emit = defineEmits<{ undo: [], revealAll: [], coverAll: [] }>()
const mode = defineModel<FogMode>('mode', { required: true })
const size = defineModel<FogBrushSize>('size', { required: true })
</script>

<style scoped>
.fog-toolbar {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 1000;
  max-width: calc(100% - 24px);
  background: rgba(var(--v-theme-surface), 0.95) !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}
</style>
