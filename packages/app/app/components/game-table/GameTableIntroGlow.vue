<template>
  <!-- Short welcome when the page opens: seats around a round table light up one
       by one, then a d20 glows in the middle and everything settles (~2.5 s).
       Purely decorative and never blocks anything. -->
  <div class="table-glow" :class="{ 'table-glow--static': !animate }" aria-hidden="true">
    <svg viewBox="0 0 160 160" class="table-glow__svg">
      <circle cx="80" cy="80" r="46" class="table-glow__table" />
      <circle
        v-for="(seat, i) in seats"
        :key="i"
        :cx="seat.x"
        :cy="seat.y"
        r="7"
        class="table-glow__seat"
        :style="{ animationDelay: `${i * 170}ms` }"
      />
    </svg>
    <v-icon icon="mdi-dice-d20" size="40" class="table-glow__die" />
  </div>
</template>

<script setup lang="ts">
import { useFolderAnimationSettings } from '~/composables/useFolderAnimations'

const SEAT_COUNT = 6
const seats = Array.from({ length: SEAT_COUNT }, (_, i) => {
  const angle = (i / SEAT_COUNT) * Math.PI * 2 - Math.PI / 2
  return { x: 80 + Math.cos(angle) * 64, y: 80 + Math.sin(angle) * 64 }
})

// Respect the global animation switch and "reduce motion" (then: final state, no motion)
const { enabled } = useFolderAnimationSettings()
const animate = ref(false)
onMounted(() => {
  animate.value = enabled.value && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
})
</script>

<style scoped>
.table-glow {
  position: relative;
  width: 140px;
  height: 140px;
  flex-shrink: 0;
}

.table-glow__svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.table-glow__table {
  fill: rgba(var(--v-theme-primary), 0.06);
  stroke: rgba(var(--v-theme-primary), 0.35);
  stroke-width: 1.5;
  animation: table-appear 0.6s ease-out both;
}

.table-glow__seat {
  fill: rgb(var(--v-theme-primary));
  opacity: 0.55;
  animation: seat-light 1s ease-out both;
}

.table-glow__die {
  position: absolute;
  top: 50%;
  left: 50%;
  color: rgb(var(--v-theme-primary));
  transform: translate(-50%, -50%);
  animation: die-glow 1.2s ease-out 1.1s both;
}

/* Static: final state right away */
.table-glow--static .table-glow__table,
.table-glow--static .table-glow__seat,
.table-glow--static .table-glow__die {
  animation: none;
}

@keyframes table-appear {
  from {
    opacity: 0;
    transform: scale(0.85);
    transform-origin: center;
  }
}

@keyframes seat-light {
  0% {
    opacity: 0;
    filter: none;
  }
  45% {
    opacity: 1;
    filter: drop-shadow(0 0 8px rgb(var(--v-theme-primary)));
  }
  100% {
    opacity: 0.55;
    filter: none;
  }
}

@keyframes die-glow {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.4) rotate(-120deg);
  }
  60% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.15) rotate(10deg);
    filter: drop-shadow(0 0 12px rgb(var(--v-theme-primary)));
  }
  100% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1) rotate(0);
  }
}
</style>
