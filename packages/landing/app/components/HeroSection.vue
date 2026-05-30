<script setup lang="ts">
const { t } = useI18n()

// Floating particles for background effect — coloured from the app's theme
// palette (teal, purple, coral, blue, gold) for a vivid, modern feel.
const PARTICLE_PALETTE = ['#4DD0E1', '#B388FF', '#FF7B69', '#4FC3F7', '#D4A574']
const particles = ref<{ id: number, left: string, size: number, delay: number, color: string }[]>([])

onMounted(() => {
  particles.value = Array.from({ length: 26 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    size: Math.random() * 4 + 2,
    delay: Math.random() * 8,
    color: PARTICLE_PALETTE[Math.floor(Math.random() * PARTICLE_PALETTE.length)]!,
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
            background: particle.color,
            boxShadow: `0 0 8px ${particle.color}`,
          }"
        />
      </div>

      <!-- Glowing colour orbs (animated aurora) -->
      <div class="orb orb-1" />
      <div class="orb orb-2" />
      <div class="orb orb-3" />
      <div class="orb orb-4" />
      <div class="orb orb-5" />

      <!-- One-shot sword × axe clash on load (client-only) -->
      <ClientOnly>
        <HeroWeaponClash />
      </ClientOnly>
    </div>

    <v-container class="hero-content">
      <v-row align="center" justify="center" class="min-h-screen">
        <v-col cols="12" lg="10" xl="8" class="text-center">
          <!-- Logo -->
          <div
            v-motion
            :initial="{ opacity: 0, scale: 0.35 }"
            :enter="{ opacity: 1, scale: 1, transition: { delay: 1750, duration: 650, type: 'spring', stiffness: 260, damping: 14 } }"
            class="hero-logo hero-logo--forged mb-6"
          >
            <img src="/logo.png" alt="DM Hero" class="hero-logo-img" />
          </div>

          <!-- Badge -->
          <div
            v-motion
            :initial="{ opacity: 0, y: -20 }"
            :enter="{ opacity: 1, y: 0, transition: { delay: 2050 } }"
            class="hero-badge mb-6"
          >
            <v-chip color="primary" variant="tonal" size="large" class="px-6 py-2 hero-badge-chip">
              <v-icon start size="small">mdi-open-source-initiative</v-icon>
              {{ t('hero.badge') }}
            </v-chip>
          </div>

          <!-- Main Title -->
          <h1 class="hero-title mb-6">
            <span
              v-motion
              :initial="{ opacity: 0, y: 30 }"
              :enter="{ opacity: 1, y: 0, transition: { delay: 2150 } }"
              class="title-line d-block"
            >
              {{ t('hero.title.line1') }}
            </span>
            <span
              v-motion
              :initial="{ opacity: 0, y: 30 }"
              :enter="{ opacity: 1, y: 0, transition: { delay: 2280 } }"
              class="title-line d-block"
            >
              {{ t('hero.title.line2') }}
            </span>
            <span
              v-motion
              :initial="{ opacity: 0, y: 30 }"
              :enter="{ opacity: 1, y: 0, transition: { delay: 2410 } }"
              class="title-line gradient-text-animated d-block"
            >
              {{ t('hero.title.line3') }}
            </span>
          </h1>

          <!-- Subtitle -->
          <p
            v-motion
            :initial="{ opacity: 0, y: 20 }"
            :enter="{ opacity: 1, y: 0, transition: { delay: 2600 } }"
            class="hero-subtitle mx-auto mb-10"
            style="max-width: 700px"
          >
            {{ t('hero.subtitle') }}
          </p>

          <!-- CTA Buttons -->
          <div
            v-motion
            :initial="{ opacity: 0, y: 20 }"
            :enter="{ opacity: 1, y: 0, transition: { delay: 2780 } }"
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
            :enter="{ opacity: 1, y: 0, transition: { delay: 2950 } }"
          >
            <v-row justify="center" class="hero-stats">
              <v-col cols="6" sm="3">
                <div class="stat-item">
                  <div class="stat-number gradient-text">8+</div>
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
                  <div class="stat-number stat-icon">
                    <v-icon size="32">mdi-lock</v-icon>
                  </div>
                  <div class="stat-label">{{ t('hero.stats.local') }}</div>
                </div>
              </v-col>
              <v-col cols="6" sm="3">
                <div class="stat-item">
                  <div class="stat-number stat-icon">
                    <v-icon size="32">mdi-infinity</v-icon>
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
        :enter="{ opacity: 1, transition: { delay: 3300 } }"
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
  min-height: calc(100vh - 220px);
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
  background: radial-gradient(ellipse at 50% 0%, rgba(77, 208, 225, 0.12) 0%, transparent 55%),
    radial-gradient(ellipse at 82% 45%, rgba(255, 123, 105, 0.1) 0%, transparent 45%),
    radial-gradient(ellipse at 15% 80%, rgba(179, 136, 255, 0.12) 0%, transparent 45%);
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
  border-radius: 50%;
  opacity: 0;
  animation: particleFloat 12s ease-in-out infinite;
}

/* Animated colour aurora — vivid theme-palette blobs that slowly drift and
   morph behind the hero. */
.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(90px);
  opacity: 0.45;
  animation: orbMorph 18s ease-in-out infinite;
}

.orb-1 {
  width: 460px;
  height: 460px;
  background: #4dd0e1; /* teal */
  top: -130px;
  right: -90px;
  animation-delay: 0s;
}

.orb-2 {
  width: 400px;
  height: 400px;
  background: #b388ff; /* purple */
  bottom: -80px;
  left: -70px;
  animation-delay: -4s;
}

.orb-3 {
  width: 300px;
  height: 300px;
  background: #ff7b69; /* coral */
  top: 42%;
  right: 6%;
  animation-delay: -8s;
}

.orb-4 {
  width: 360px;
  height: 360px;
  background: #4fc3f7; /* blue */
  top: 8%;
  left: 10%;
  animation-delay: -12s;
}

.orb-5 {
  width: 320px;
  height: 320px;
  background: #d4a574; /* gold */
  bottom: 14%;
  right: 28%;
  animation-delay: -16s;
}

@keyframes orbMorph {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(50px, -36px) scale(1.18); }
  66% { transform: translate(-36px, 28px) scale(0.88); }
}

.hero-content {
  position: relative;
  z-index: 1;
}

.min-h-screen {
  min-height: calc(100vh - 220px);
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

/* Gentle glow pulse to draw the eye to the 1.4 / AI hook. */
.hero-badge-chip {
  animation: badgePulse 2.6s ease-in-out infinite;
}

@keyframes badgePulse {
  0%, 100% { box-shadow: 0 0 0 rgba(212, 165, 116, 0); }
  50% { box-shadow: 0 0 18px rgba(212, 165, 116, 0.5); }
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

/* Gold color for stat icons - matches gradient-text visually */
.stat-icon {
  color: #ffd700;
}

.stat-icon :deep(.v-icon) {
  color: #ffd700 !important;
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
