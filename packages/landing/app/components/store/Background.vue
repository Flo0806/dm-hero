<template>
  <div class="store-background">
    <!-- Mouse-following light -->
    <div
      class="mouse-light"
      :style="{
        left: mouseX + 'px',
        top: mouseY + 'px',
        opacity: isMouseInside ? 1 : 0,
      }"
    />

    <!-- Sparkler sparks on mouse movement -->
    <div class="sparks-container">
      <div
        v-for="spark in sparks"
        :key="spark.id"
        class="spark"
        :style="{
          left: spark.x + 'px',
          top: spark.y + 'px',
          '--spark-dx': spark.dx + 'px',
          '--spark-dy': spark.dy + 'px',
          '--spark-color': spark.color,
        }"
      />
    </div>

    <!-- Floating particles -->
    <div class="particles">
      <div
        v-for="particle in particles"
        :key="particle.id"
        class="particle"
        :style="{
          left: particle.x + '%',
          top: particle.y + '%',
          width: particle.size + 'px',
          height: particle.size + 'px',
          animationDelay: particle.delay + 's',
          animationDuration: particle.duration + 's',
          opacity: particle.opacity,
        }"
      />
    </div>

    <!-- Magical orbs -->
    <div class="orbs">
      <div class="orb orb-1" />
      <div class="orb orb-2" />
      <div class="orb orb-3" />
    </div>

    <!-- Gradient mesh -->
    <div class="gradient-mesh" />

    <!-- Grid pattern overlay -->
    <div class="grid-pattern" />
  </div>
</template>

<script setup lang="ts">
interface Particle {
  id: number
  x: number
  y: number
  size: number
  delay: number
  duration: number
  opacity: number
}

interface Spark {
  id: number
  x: number
  y: number
  dx: number
  dy: number
  color: string
}

const mouseX = ref(0)
const mouseY = ref(0)
const isMouseInside = ref(false)

// Generate random particles
const particles = ref<Particle[]>([])

// Sparkler effect
const sparks = ref<Spark[]>([])
let sparkId = 0
let lastMouseX = 0
let lastMouseY = 0
let isMoving = false
let moveTimeout: ReturnType<typeof setTimeout> | null = null

// Blue-violet color palette for sparks
const sparkColors = [
  '#8B5CF6', // violet
  '#A78BFA', // light violet
  '#7C3AED', // purple
  '#6366F1', // indigo
  '#818CF8', // light indigo
  '#C4B5FD', // lavender
  '#60A5FA', // blue
  '#93C5FD', // light blue
]

function createSparks(x: number, y: number) {
  const numSparks = 3 + Math.floor(Math.random() * 4) // 3-6 sparks

  for (let i = 0; i < numSparks; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = 30 + Math.random() * 50
    const spark: Spark = {
      id: sparkId++,
      x,
      y,
      dx: Math.cos(angle) * speed,
      dy: Math.sin(angle) * speed,
      color: sparkColors[Math.floor(Math.random() * sparkColors.length)]!,
    }
    sparks.value.push(spark)

    // Remove spark after animation
    setTimeout(() => {
      sparks.value = sparks.value.filter((s) => s.id !== spark.id)
    }, 600)
  }
}

function onMouseMove(e: MouseEvent) {
  isMouseInside.value = true
  mouseX.value = e.clientX
  mouseY.value = e.clientY

  // Detect movement start
  const dx = e.clientX - lastMouseX
  const dy = e.clientY - lastMouseY
  const distance = Math.sqrt(dx * dx + dy * dy)

  // Only create sparks if mouse moved significantly and wasn't already moving
  if (distance > 5 && !isMoving) {
    isMoving = true
    createSparks(e.clientX, e.clientY)
  }

  // Reset "isMoving" after mouse stops
  if (moveTimeout) clearTimeout(moveTimeout)
  moveTimeout = setTimeout(() => {
    isMoving = false
  }, 100)

  lastMouseX = e.clientX
  lastMouseY = e.clientY
}

function onMouseLeave() {
  isMouseInside.value = false
}

onMounted(() => {
  // Generate particles
  particles.value = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 4 + 2,
    delay: Math.random() * 5,
    duration: Math.random() * 10 + 15,
    opacity: Math.random() * 0.5 + 0.2,
  }))

  // Track mouse on whole document
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseleave', onMouseLeave)
})

onUnmounted(() => {
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseleave', onMouseLeave)
  if (moveTimeout) clearTimeout(moveTimeout)
})
</script>

<style scoped>
.store-background {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  z-index: 0;
  background: radial-gradient(ellipse at 50% 0%, #1e2235 0%, #1A1D29 50%, #13151d 100%);
}


/* Mouse-following light */
.mouse-light {
  position: fixed;
  width: 600px;
  height: 600px;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(212, 165, 116, 0.15) 0%,
    rgba(212, 165, 116, 0.05) 40%,
    transparent 70%
  );
  transform: translate(-50%, -50%);
  pointer-events: none;
  transition: opacity 0.3s ease;
  z-index: 0;
}

/* Sparkler sparks */
.sparks-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
  overflow: hidden;
}

.spark {
  position: absolute;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--spark-color);
  box-shadow:
    0 0 6px var(--spark-color),
    0 0 12px var(--spark-color),
    0 0 20px var(--spark-color);
  animation: spark-fly 0.6s ease-out forwards;
  transform: translate(-50%, -50%);
}

@keyframes spark-fly {
  0% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(
      calc(-50% + var(--spark-dx)),
      calc(-50% + var(--spark-dy))
    ) scale(0.3);
  }
}

/* Floating particles */
.particles {
  position: absolute;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.particle {
  position: absolute;
  background: radial-gradient(circle, rgba(212, 165, 116, 0.8) 0%, rgba(212, 165, 116, 0) 70%);
  border-radius: 50%;
  animation: float linear infinite;
  pointer-events: none;
}

@keyframes float {
  0%, 100% {
    transform: translateY(0) translateX(0) scale(1);
  }
  25% {
    transform: translateY(-30px) translateX(15px) scale(1.1);
  }
  50% {
    transform: translateY(-10px) translateX(-10px) scale(0.9);
  }
  75% {
    transform: translateY(-40px) translateX(20px) scale(1.05);
  }
}

/* Magical orbs */
.orbs {
  position: absolute;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.4;
  animation: orbFloat 20s ease-in-out infinite;
}

.orb-1 {
  width: 500px;
  height: 500px;
  background: linear-gradient(135deg, #D4A574 0%, #8B7355 100%);
  top: -10%;
  right: -5%;
  animation-delay: 0s;
}

.orb-2 {
  width: 400px;
  height: 400px;
  background: linear-gradient(135deg, #FFD700 0%, #B8860B 100%);
  bottom: -10%;
  left: -5%;
  animation-delay: -7s;
}

.orb-3 {
  width: 350px;
  height: 350px;
  background: linear-gradient(135deg, #8B4513 0%, #D4A574 100%);
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  animation-delay: -14s;
}

@keyframes orbFloat {
  0%, 100% {
    transform: translate(0, 0) scale(1);
  }
  33% {
    transform: translate(30px, -30px) scale(1.1);
  }
  66% {
    transform: translate(-20px, 20px) scale(0.95);
  }
}

/* Gradient mesh */
.gradient-mesh {
  position: absolute;
  width: 100%;
  height: 100%;
  background:
    radial-gradient(at 20% 30%, rgba(212, 165, 116, 0.1) 0%, transparent 50%),
    radial-gradient(at 80% 70%, rgba(139, 115, 85, 0.1) 0%, transparent 50%),
    radial-gradient(at 50% 50%, rgba(255, 215, 0, 0.05) 0%, transparent 50%);
  pointer-events: none;
}

/* Grid pattern */
.grid-pattern {
  position: absolute;
  width: 100%;
  height: 100%;
  background-image:
    linear-gradient(rgba(212, 165, 116, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(212, 165, 116, 0.03) 1px, transparent 1px);
  background-size: 50px 50px;
  pointer-events: none;
  opacity: 0.5;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .mouse-light {
    display: none;
  }

  .orb-1 {
    width: 300px;
    height: 300px;
  }

  .orb-2 {
    width: 250px;
    height: 250px;
  }

  .orb-3 {
    width: 200px;
    height: 200px;
  }
}
</style>

<style>
/* Global overrides when StoreBackground is present */
.v-application {
  background: transparent !important;
}

.v-main {
  background: transparent !important;
}
</style>
