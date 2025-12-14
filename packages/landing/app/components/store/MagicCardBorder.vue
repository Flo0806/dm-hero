<template>
  <div
    ref="cardRef"
    class="magic-card-wrapper"
    :class="{ 'is-hovered': isHovered }"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    <!-- Glow effect -->
    <div class="card-glow" />

    <!-- Animated border - conic gradient that rotates -->
    <div class="magic-border" />

    <!-- Comet that follows the rectangular border -->
    <div class="comet-container">
      <div class="comet" :style="cometStyle" />
    </div>

    <!-- Fire particles on hover -->
    <div class="fire-particles">
      <div
        v-for="particle in fireParticles"
        :key="particle.id"
        class="fire-particle"
        :style="{
          left: particle.left + '%',
          animationDelay: particle.delay + 's',
          animationDuration: particle.duration + 's',
        }"
      />
    </div>

    <!-- Slot for card content -->
    <div class="card-content">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
interface FireParticle {
  id: number
  left: number
  delay: number
  duration: number
}

const cardRef = ref<HTMLElement | null>(null)
const isHovered = ref(false)
const cometProgress = ref(0)
const cardWidth = ref(300)
const cardHeight = ref(400)

// Fire particles
const fireParticles = ref<FireParticle[]>([])

// Calculate comet position along rectangular path
const cometStyle = computed(() => {
  const progress = cometProgress.value
  const w = cardWidth.value
  const h = cardHeight.value
  const perimeter = 2 * w + 2 * h
  const distance = progress * perimeter

  let x = 0
  let y = 0
  let rotation = 0

  if (distance < w) {
    // Top edge (left to right)
    x = distance
    y = 0
    rotation = 90
  } else if (distance < w + h) {
    // Right edge (top to bottom)
    x = w
    y = distance - w
    rotation = 180
  } else if (distance < 2 * w + h) {
    // Bottom edge (right to left)
    x = w - (distance - w - h)
    y = h
    rotation = 270
  } else {
    // Left edge (bottom to top)
    x = 0
    y = h - (distance - 2 * w - h)
    rotation = 0
  }

  return {
    left: `${x}px`,
    top: `${y}px`,
    transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
  }
})

let animationFrame: number | null = null
let startTime: number | null = null
const animationDuration = 3000 // 3 seconds for full loop

function animate(timestamp: number) {
  if (!startTime) startTime = timestamp
  const elapsed = timestamp - startTime
  cometProgress.value = (elapsed % animationDuration) / animationDuration

  if (isHovered.value) {
    animationFrame = requestAnimationFrame(animate)
  }
}

function onMouseEnter() {
  isHovered.value = true

  // Measure card dimensions
  if (cardRef.value) {
    cardWidth.value = cardRef.value.offsetWidth
    cardHeight.value = cardRef.value.offsetHeight
  }

  // Generate fire particles
  fireParticles.value = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    left: 8 + Math.random() * 84,
    delay: Math.random() * 2,
    duration: 1 + Math.random() * 1.5,
  }))

  // Start animation
  startTime = null
  animationFrame = requestAnimationFrame(animate)
}

function onMouseLeave() {
  isHovered.value = false
  if (animationFrame) {
    cancelAnimationFrame(animationFrame)
    animationFrame = null
  }
}

onUnmounted(() => {
  if (animationFrame) {
    cancelAnimationFrame(animationFrame)
  }
})
</script>

<style scoped>
.magic-card-wrapper {
  position: relative;
  border-radius: 16px;
  transition: transform 0.3s ease;
}

.magic-card-wrapper:hover {
  transform: translateY(-8px);
}

/* Outer glow effect */
.card-glow {
  position: absolute;
  inset: -2px;
  border-radius: 18px;
  background: transparent;
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
  z-index: 0;
}

.is-hovered .card-glow {
  opacity: 1;
  box-shadow:
    0 0 20px rgba(255, 100, 50, 0.4),
    0 0 40px rgba(255, 150, 50, 0.2),
    0 0 60px rgba(255, 100, 50, 0.1);
}

/* Magic border with rotating conic gradient */
.magic-border {
  position: absolute;
  inset: 0;
  border-radius: 16px;
  padding: 2px;
  background: conic-gradient(
    from var(--angle, 0deg),
    transparent 0%,
    transparent 30%,
    rgba(255, 100, 0, 0.1) 35%,
    rgba(255, 150, 50, 0.3) 40%,
    rgba(255, 200, 100, 0.5) 45%,
    rgba(255, 150, 50, 0.3) 50%,
    rgba(255, 100, 0, 0.1) 55%,
    transparent 60%,
    transparent 100%
  );
  mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  mask-composite: exclude;
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
  z-index: 1;
  animation: rotate-gradient 3s linear infinite;
  animation-play-state: paused;
}

.is-hovered .magic-border {
  opacity: 1;
  animation-play-state: running;
}

@keyframes rotate-gradient {
  0% {
    --angle: 0deg;
  }
  100% {
    --angle: 360deg;
  }
}

/* Comet container */
.comet-container {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.is-hovered .comet-container {
  opacity: 1;
}

/* The comet - bright glowing point with built-in trail */
.comet {
  position: absolute;
  width: 8px;
  height: 8px;
  background: radial-gradient(
    circle,
    rgba(255, 255, 220, 1) 0%,
    rgba(255, 200, 100, 1) 40%,
    rgba(255, 150, 50, 0.6) 70%,
    transparent 100%
  );
  border-radius: 50%;
  box-shadow:
    0 0 6px rgba(255, 255, 200, 1),
    0 0 12px rgba(255, 200, 100, 0.9),
    0 0 20px rgba(255, 150, 50, 0.7),
    0 0 30px rgba(255, 100, 0, 0.5),
    0 0 40px rgba(255, 50, 0, 0.3);
}

/* Trail effect using pseudo-element */
.comet::before {
  content: '';
  position: absolute;
  top: 50%;
  right: 50%;
  width: 40px;
  height: 4px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 100, 0, 0.1) 30%,
    rgba(255, 150, 50, 0.4) 70%,
    rgba(255, 200, 100, 0.8) 100%
  );
  transform: translateY(-50%);
  border-radius: 2px;
  filter: blur(2px);
}

/* Fire particles rising from bottom */
.fire-particles {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 80px;
  overflow: hidden;
  pointer-events: none;
  z-index: 2;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.is-hovered .fire-particles {
  opacity: 1;
}

.fire-particle {
  position: absolute;
  bottom: -10px;
  width: 4px;
  height: 4px;
  background: radial-gradient(
    circle,
    rgba(255, 200, 100, 1) 0%,
    rgba(255, 100, 0, 0.8) 50%,
    transparent 100%
  );
  border-radius: 50%;
  animation: rise-particle ease-out infinite;
  box-shadow:
    0 0 6px rgba(255, 150, 50, 0.8),
    0 0 12px rgba(255, 100, 0, 0.4);
}

@keyframes rise-particle {
  0% {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
  100% {
    transform: translateY(-80px) scale(0.2);
    opacity: 0;
  }
}

/* Card content wrapper */
.card-content {
  position: relative;
  z-index: 3;
  border-radius: 16px;
  overflow: hidden;
}

/* Remove default hover effects from inner card */
.card-content :deep(.adventure-card) {
  transform: none !important;
}

.card-content :deep(.adventure-card:hover) {
  transform: none !important;
}
</style>
