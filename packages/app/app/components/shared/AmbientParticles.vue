<template>
  <div class="ambient-layer" aria-hidden="true">
    <div
      v-for="(p, i) in particles"
      :key="i"
      class="ambient-particle"
      :class="`mode-${config.mode}`"
      :style="p.style"
    >
      <!-- notes mode renders a glyph instead of a dot -->
      <span v-if="p.glyph" class="ambient-glyph">{{ p.glyph }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AmbientConfig } from '~/composables/themeAmbient'

/**
 * A subtle, decorative particle field for the dashboard background. Driven
 * entirely by a per-theme AmbientConfig (mode + colours + sizes + timing).
 * Pointer-events: none, sits behind the content, honours prefers-reduced-motion.
 *
 * Particles are generated once on mount with randomised positions/timings and
 * NEGATIVE animation delays, so the field looks alive immediately (no "all
 * start together" moment) without any JS animation loop — pure CSS.
 */
const props = defineProps<{ config: AmbientConfig }>()

interface Particle { style: Record<string, string>, glyph?: string }

const NOTE_GLYPHS = ['♪', '♫', '♩', '♬', '𝄞']

const particles = ref<Particle[]>([])

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function build() {
  const c = props.config
  if (prefersReducedMotion()) {
    particles.value = []
    return
  }
  particles.value = Array.from({ length: c.count }, () => {
    const size = rand(c.sizeMin, c.sizeMax)
    const dur = rand(c.durationMin, c.durationMax)
    const color = c.colors[Math.floor(Math.random() * c.colors.length)]!
    const opacity = 0.35 + Math.random() * 0.5
    const style: Record<string, string> = {
      'left': `${rand(0, 100)}%`,
      'top': `${rand(0, 100)}%`,
      'width': `${size}px`,
      'height': `${size}px`,
      'background': color,
      'opacity': '0',
      'animationDuration': `${dur}s`,
      'animationDelay': `${-rand(0, dur)}s`, // negative → mid-cycle start
      '--drift': `${(Math.random() - 0.5) * 140}px`,
      '--o': `${opacity}`,
    }
    if (c.mode === 'notes') {
      // Glyph instead of a dot: colour via text, size via font-size, glow via text-shadow
      style.background = 'transparent'
      style.color = color
      style.fontSize = `${size}px`
      style.width = 'auto'
      style.height = 'auto'
      style['--spin'] = `${(Math.random() - 0.5) * 50}deg`
      if (c.glow) style.textShadow = `0 0 ${(size * 0.6).toFixed(0)}px ${color}`
      return { style, glyph: NOTE_GLYPHS[Math.floor(Math.random() * NOTE_GLYPHS.length)] }
    }
    if (c.glow) style.boxShadow = `0 0 ${(size * 2.5).toFixed(0)}px ${color}`
    return { style }
  })
}

// Rebuild when the theme (and thus config) changes, and once on mount.
watch(() => props.config, build, { deep: true })
onMounted(build)
</script>

<style scoped>
.ambient-layer {
  position: fixed;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}

.ambient-particle {
  position: absolute;
  border-radius: 50%;
  will-change: transform, opacity;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
}

/* Rise — embers / bubbles floating up and fading. */
.mode-rise {
  animation-name: ambient-rise;
}
@keyframes ambient-rise {
  0% { transform: translate(0, 0); opacity: 0; }
  12% { opacity: var(--o); }
  88% { opacity: var(--o); }
  100% { transform: translate(var(--drift), -110vh); opacity: 0; }
}

/* Drift — slow dust motes wandering in place. */
.mode-drift {
  animation-name: ambient-drift;
  animation-timing-function: linear;
}
@keyframes ambient-drift {
  0% { transform: translate(0, 0); opacity: 0; }
  20% { opacity: var(--o); }
  80% { opacity: var(--o); }
  100% { transform: translate(var(--drift), -40px); opacity: 0; }
}

/* Fall — motes / dust settling down with a little sideways drift. */
.mode-fall {
  animation-name: ambient-fall;
  animation-timing-function: linear;
}
@keyframes ambient-fall {
  0% { transform: translate(0, 0); opacity: 0; }
  12% { opacity: var(--o); }
  88% { opacity: var(--o); }
  100% { transform: translate(var(--drift), 110vh); opacity: 0; }
}

/* Streak — fast comet-like sparks shooting diagonally across. */
.mode-streak {
  animation-name: ambient-streak;
  animation-timing-function: ease-in;
}
@keyframes ambient-streak {
  0% { transform: translate(0, 0) scale(1); opacity: 0; }
  10% { opacity: var(--o); }
  100% { transform: translate(calc(var(--drift) + 42vw), 78vh) scale(0.6); opacity: 0; }
}

/* Notes — music notes floating up, swaying sideways and slowly turning. */
.mode-notes {
  animation-name: ambient-notes;
  border-radius: 0;
  line-height: 1;
}
.ambient-glyph {
  display: block;
  font-family: 'Segoe UI Symbol', 'Noto Sans Symbols 2', 'DejaVu Sans', sans-serif;
}
@keyframes ambient-notes {
  0% { transform: translate(0, 0) rotate(0deg); opacity: 0; }
  10% { opacity: var(--o); }
  30% { transform: translate(calc(var(--drift) * 0.4), -30vh) rotate(calc(var(--spin) * 0.5)); }
  60% { transform: translate(calc(var(--drift) * -0.2), -60vh) rotate(calc(var(--spin) * -0.3)); }
  90% { opacity: var(--o); }
  100% { transform: translate(var(--drift), -110vh) rotate(var(--spin)); opacity: 0; }
}

/* Twinkle — sparkles pulsing and gently scaling in place. */
.mode-twinkle {
  animation-name: ambient-twinkle;
}
@keyframes ambient-twinkle {
  0%, 100% { transform: scale(0.6); opacity: 0; }
  50% { transform: scale(1.2); opacity: var(--o); }
}

/* Firefly — drifts on a small loop while its glow breathes. */
.mode-firefly {
  animation-name: ambient-firefly;
}
@keyframes ambient-firefly {
  0% { transform: translate(0, 0); opacity: 0; }
  25% { opacity: var(--o); }
  50% { transform: translate(var(--drift), -30px); opacity: calc(var(--o) * 0.4); }
  75% { opacity: var(--o); }
  100% { transform: translate(0, 0); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .ambient-particle { display: none; }
}
</style>
