<template>
  <!-- emily keeps its bespoke lightning; every other theme with a config gets
       the generic particle field. Nothing renders when animations are off. -->
  <template v-if="animationsEnabled">
    <SharedEmilyLightning v-if="current === 'emily'" />
    <SharedAmbientParticles v-else-if="config" :config="config" />
  </template>
</template>

<script setup lang="ts">
import { useThemePreference } from '~/composables/useThemePreference'
import { useFolderAnimationSettings } from '~/composables/useFolderAnimations'
import { THEME_AMBIENT } from '~/composables/themeAmbient'

/**
 * Picks the dashboard ambience for the active theme (#322). Shares the global
 * "Spielereien" on/off with the folder hover animations, so one toggle governs
 * all decorative motion.
 */
const { current } = useThemePreference()
const { enabled: animationsEnabled } = useFolderAnimationSettings()

const config = computed(() => THEME_AMBIENT[current.value] ?? null)
</script>
