<script setup lang="ts">
const { t } = useI18n()

// Floating particles for background effect
const particles = ref<{ id: number; left: string; size: number; delay: number }[]>([])

onMounted(() => {
  // Generate random particles
  particles.value = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    size: Math.random() * 4 + 2,
    delay: Math.random() * 8,
  }))
})
</script>

<template>
  <section class="hero-section">
    <!-- Animated background -->
    <div class="hero-bg">
      <div class="hero-gradient" />
      <div class="hero-grid" />

      <!-- Floating particles -->
      <div class="particles-container">
        <div
          v-for="particle in particles"
          :key="particle.id"
          class="particle"
          :style="{
            left: particle.left,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            animationDelay: `${particle.delay}s`,
          }"
        />
      </div>

      <!-- Glowing orbs -->
      <div class="orb orb-1" />
      <div class="orb orb-2" />
      <div class="orb orb-3" />
    </div>

    <v-container class="hero-content">
      <v-row align="center" justify="center" class="min-h-screen">
        <v-col cols="12" lg="10" xl="8" class="text-center">
          <!-- Logo -->
          <div
            v-motion
            :initial="{ opacity: 0, scale: 0.8 }"
            :enter="{ opacity: 1, scale: 1, transition: { delay: 100, duration: 500 } }"
            class="hero-logo mb-6"
          >
            <img src="/logo.png" alt="DM Hero" class="hero-logo-img" />
          </div>

          <!-- Badge -->
          <div
            v-motion
            :initial="{ opacity: 0, y: -20 }"
            :enter="{ opacity: 1, y: 0, transition: { delay: 300 } }"
            class="hero-badge mb-6"
          >
            <v-chip color="primary" variant="tonal" size="large" class="px-6 py-2">
              <v-icon start size="small">mdi-open-source-initiative</v-icon>
              {{ t('hero.badge') }}
            </v-chip>
          </div>

          <!-- Main Title -->
          <h1 class="hero-title mb-6">
            <span
              v-motion
              :initial="{ opacity: 0, y: 30 }"
              :enter="{ opacity: 1, y: 0, transition: { delay: 400 } }"
              class="title-line d-block"
            >
              {{ t('hero.title.line1') }}
            </span>
            <span
              v-motion
              :initial="{ opacity: 0, y: 30 }"
              :enter="{ opacity: 1, y: 0, transition: { delay: 600 } }"
              class="title-line d-block"
            >
              {{ t('hero.title.line2') }}
            </span>
            <span
              v-motion
              :initial="{ opacity: 0, y: 30 }"
              :enter="{ opacity: 1, y: 0, transition: { delay: 800 } }"
              class="title-line gradient-text-animated d-block"
            >
              {{ t('hero.title.line3') }}
            </span>
          </h1>

          <!-- Subtitle -->
          <p
            v-motion
            :initial="{ opacity: 0, y: 20 }"
            :enter="{ opacity: 1, y: 0, transition: { delay: 1000 } }"
            class="hero-subtitle mx-auto mb-10"
            style="max-width: 700px"
          >
            {{ t('hero.subtitle') }}
          </p>

          <!-- CTA Buttons -->
          <div
            v-motion
            :initial="{ opacity: 0, y: 20 }"
            :enter="{ opacity: 1, y: 0, transition: { delay: 1200 } }"
            class="hero-cta d-flex flex-wrap justify-center ga-4 mb-12"
          >
            <v-btn
              color="primary"
              size="x-large"
              class="download-btn px-8"
              href="#download"
            >
              <v-icon start>mdi-download</v-icon>
              {{ t('hero.cta.download') }}
            </v-btn>
            <v-btn
              variant="outlined"
              color="primary"
              size="x-large"
              class="px-8"
              href="https://github.com/Flo0806/dm-hero"
              target="_blank"
            >
              <v-icon start>mdi-github</v-icon>
              {{ t('hero.cta.github') }}
            </v-btn>
          </div>

          <!-- Stats -->
          <div
            v-motion
            :initial="{ opacity: 0, y: 20 }"
            :enter="{ opacity: 1, y: 0, transition: { delay: 1400 } }"
          >
            <v-row justify="center" class="hero-stats">
              <v-col cols="6" sm="3">
                <div class="stat-item">
                  <div class="stat-number gradient-text">7+</div>
                  <div class="stat-label">{{ t('hero.stats.entities') }}</div>
                </div>
              </v-col>
              <v-col cols="6" sm="3">
                <div class="stat-item">
                  <div class="stat-number gradient-text">FTS5</div>
                  <div class="stat-label">{{ t('hero.stats.search') }}</div>
                </div>
              </v-col>
              <v-col cols="6" sm="3">
                <div class="stat-item">
                  <div class="stat-number gradient-text">
                    <v-icon color="primary">mdi-shield-check</v-icon>
                  </div>
                  <div class="stat-label">{{ t('hero.stats.local') }}</div>
                </div>
              </v-col>
              <v-col cols="6" sm="3">
                <div class="stat-item">
                  <div class="stat-number gradient-text">
                    <v-icon color="primary">mdi-heart</v-icon>
                  </div>
                  <div class="stat-label">{{ t('hero.stats.free') }}</div>
                </div>
              </v-col>
            </v-row>
          </div>
        </v-col>
      </v-row>

      <!-- Scroll indicator -->
      <div
        v-motion
        :initial="{ opacity: 0 }"
        :enter="{ opacity: 1, transition: { delay: 2000 } }"
        class="scroll-indicator"
      >
        <v-icon class="animate-bounce-subtle" size="32" color="primary">
          mdi-chevron-double-down
        </v-icon>
      </div>
    </v-container>
  </section>
</template>

<style scoped>
.hero-section {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  display: flex;
  align-items: center;
}

.hero-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.hero-gradient {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 50% 0%, rgba(212, 165, 116, 0.15) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 50%, rgba(212, 165, 116, 0.08) 0%, transparent 40%),
    radial-gradient(ellipse at 20% 80%, rgba(139, 115, 85, 0.1) 0%, transparent 40%);
}

.hero-grid {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(rgba(212, 165, 116, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(212, 165, 116, 0.03) 1px, transparent 1px);
  background-size: 60px 60px;
  mask-image: radial-gradient(ellipse at center, black 0%, transparent 70%);
}

.particles-container {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.particle {
  position: absolute;
  bottom: -10px;
  background: var(--dm-gold);
  border-radius: 50%;
  opacity: 0;
  animation: particleFloat 12s ease-in-out infinite;
}

.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.3;
  animation: float 8s ease-in-out infinite;
}

.orb-1 {
  width: 400px;
  height: 400px;
  background: var(--dm-gold);
  top: -100px;
  right: -100px;
  animation-delay: 0s;
}

.orb-2 {
  width: 300px;
  height: 300px;
  background: rgba(139, 115, 85, 0.5);
  bottom: 10%;
  left: -50px;
  animation-delay: 2s;
}

.orb-3 {
  width: 200px;
  height: 200px;
  background: var(--dm-gold);
  top: 50%;
  right: 10%;
  animation-delay: 4s;
}

.hero-content {
  position: relative;
  z-index: 1;
}

.min-h-screen {
  min-height: 100vh;
}

.hero-logo {
  display: flex;
  justify-content: center;
}

.hero-logo-img {
  width: 120px;
  height: 120px;
  border-radius: 24px;
  box-shadow: 0 20px 60px rgba(212, 165, 116, 0.3),
    0 0 100px rgba(212, 165, 116, 0.15);
  animation: logoGlow 3s ease-in-out infinite alternate;
}

@keyframes logoGlow {
  from {
    box-shadow: 0 20px 60px rgba(212, 165, 116, 0.3),
      0 0 100px rgba(212, 165, 116, 0.15);
  }
  to {
    box-shadow: 0 20px 80px rgba(212, 165, 116, 0.4),
      0 0 120px rgba(212, 165, 116, 0.25);
  }
}

.hero-badge :deep(.v-chip) {
  font-weight: 600;
  letter-spacing: 0.5px;
}

.hero-title {
  font-size: clamp(2.5rem, 8vw, 5rem);
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.02em;
}

.title-line {
  color: rgb(var(--v-theme-on-background));
}

.hero-subtitle {
  font-size: clamp(1.1rem, 2.5vw, 1.4rem);
  line-height: 1.6;
  color: rgba(var(--v-theme-on-background), 0.8);
}

.hero-cta :deep(.v-btn) {
  text-transform: none;
  font-weight: 600;
  letter-spacing: 0.3px;
}

.stat-item {
  text-align: center;
  padding: 16px;
}

.stat-number {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 0.9rem;
  color: rgba(var(--v-theme-on-background), 0.7);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.scroll-indicator {
  position: absolute;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
}

@keyframes particleFloat {
  0% {
    opacity: 0;
    transform: translateY(0) rotate(0deg);
  }
  10% {
    opacity: 0.6;
  }
  90% {
    opacity: 0.6;
  }
  100% {
    opacity: 0;
    transform: translateY(-100vh) rotate(720deg);
  }
}
</style>
