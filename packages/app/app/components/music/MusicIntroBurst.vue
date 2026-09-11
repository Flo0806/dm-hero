<template>
  <!-- Short, non-blocking intro when the music page opens: notes, swords, hearts,
       dice and flames drift up from the header and fade out (~3.5 s).
       pointer-events: none – nothing underneath is blocked. -->
  <div v-if="particles.length" class="music-burst" aria-hidden="true">
    <v-icon
      v-for="p in particles"
      :key="p.id"
      :icon="p.icon"
      class="music-burst-icon"
      :style="p.style"
    />
  </div>
</template>

<script setup lang="ts">
import { useFolderAnimationSettings } from '~/composables/useFolderAnimations'

interface Particle {
  id: number
  icon: string
  style: Record<string, string>
}

const ICONS = [
  'mdi-music-note', 'mdi-music-note-eighth', 'mdi-music-note-quarter', 'mdi-music',
  'mdi-sword-cross', 'mdi-sword', 'mdi-shield-half-full',
  'mdi-heart', 'mdi-emoticon-happy-outline', 'mdi-emoticon-devil-outline',
  'mdi-dice-d20', 'mdi-fire', 'mdi-star-four-points',
]

const DURATION_MS = 3500
const COUNT = 26

const { enabled: animationsEnabled } = useFolderAnimationSettings()
const particles = ref<Particle[]>([])
let endTimer: ReturnType<typeof setTimeout> | null = null

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function start() {
  if (!animationsEnabled.value || prefersReducedMotion()) return
  particles.value = Array.from({ length: COUNT }, (_, i) => {
    // Theme colours only – primary / secondary at low alpha never clash with any theme
    const tone = i % 3 === 0 ? 'secondary' : 'primary'
    const delay = rand(0, 1400)
    const life = rand(1600, DURATION_MS - delay)
    return {
      id: i,
      icon: ICONS[Math.floor(Math.random() * ICONS.length)]!,
      style: {
        'left': `${rand(2, 98)}%`,
        'font-size': `${rand(14, 30)}px`,
        'color': `rgba(var(--v-theme-${tone}), ${rand(0.35, 0.7).toFixed(2)})`,
        'animation-delay': `${delay}ms`,
        'animation-duration': `${life}ms`,
        '--burst-drift': `${rand(-40, 40)}px`,
        '--burst-rise': `${rand(90, 180)}px`,
        '--burst-spin': `${rand(-40, 40)}deg`,
      },
    }
  })
  endTimer = setTimeout(() => {
    particles.value = []
  }, DURATION_MS + 100)
}

onMounted(start)
onBeforeUnmount(() => {
  if (endTimer) clearTimeout(endTimer)
})
</script>

<style scoped>
.music-burst {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}
.music-burst-icon {
  position: absolute;
  bottom: 0;
  opacity: 0;
  animation-name: music-burst-rise;
  animation-timing-function: ease-out;
  animation-fill-mode: forwards;
  will-change: transform, opacity;
}
@keyframes music-burst-rise {
  0% {
    opacity: 0;
    transform: translate(0, 10px) rotate(0deg) scale(0.6);
  }
  15% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(var(--burst-drift), calc(-1 * var(--burst-rise))) rotate(var(--burst-spin)) scale(1.1);
  }
}
@media (prefers-reduced-motion: reduce) {
  .music-burst {
    display: none;
  }
}
</style>
