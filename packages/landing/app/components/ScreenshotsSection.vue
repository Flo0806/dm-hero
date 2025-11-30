<script setup lang="ts">
const { t } = useI18n()

const screenshots = [
  { key: 'dashboard', placeholder: 'dashboard.png' },
  { key: 'npcs', placeholder: 'npcs.png' },
  { key: 'chaos', placeholder: 'chaos-graph.png' },
  { key: 'calendar', placeholder: 'calendar.png' },
]

const activeScreenshot = ref(0)

// Auto-rotate screenshots
let interval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  interval = setInterval(() => {
    activeScreenshot.value = (activeScreenshot.value + 1) % screenshots.length
  }, 5000)
})

onUnmounted(() => {
  if (interval) clearInterval(interval)
})

function selectScreenshot(index: number) {
  activeScreenshot.value = index
  // Reset interval when user clicks
  if (interval) clearInterval(interval)
  interval = setInterval(() => {
    activeScreenshot.value = (activeScreenshot.value + 1) % screenshots.length
  }, 5000)
}
</script>

<template>
  <section id="screenshots" class="screenshots-section py-16">
    <v-container>
      <!-- Section Header -->
      <div class="text-center mb-12">
        <h2
          v-motion
          :initial="{ opacity: 0, y: 20 }"
          :visible-once="{ opacity: 1, y: 0 }"
          class="section-title mb-4"
        >
          {{ t('screenshots.title') }}
        </h2>
        <p
          v-motion
          :initial="{ opacity: 0, y: 20 }"
          :visible-once="{ opacity: 1, y: 0, transition: { delay: 200 } }"
          class="section-subtitle mx-auto"
          style="max-width: 600px"
        >
          {{ t('screenshots.subtitle') }}
        </p>
      </div>

      <!-- Screenshot Display -->
      <div
        v-motion
        :initial="{ opacity: 0, y: 30 }"
        :visible-once="{ opacity: 1, y: 0, transition: { delay: 300 } }"
        class="screenshot-container"
      >
        <!-- Main Screenshot Frame -->
        <div class="screenshot-frame">
          <div class="screenshot-frame-header">
            <div class="frame-dots">
              <span class="dot dot--red" />
              <span class="dot dot--yellow" />
              <span class="dot dot--green" />
            </div>
            <div class="frame-title">DM Hero</div>
            <div class="frame-spacer" />
          </div>

          <div class="screenshot-content">
            <!-- Placeholder for actual screenshots -->
            <div class="screenshot-placeholder">
              <v-icon size="80" color="primary" class="mb-4">mdi-image-outline</v-icon>
              <p class="text-h6 mb-2">{{ t(`screenshots.items.${screenshots[activeScreenshot].key}`) }}</p>
              <p class="text-body-2 text-medium-emphasis">{{ t('screenshots.comingSoon') }}</p>
            </div>
          </div>
        </div>

        <!-- Screenshot Navigation -->
        <div class="screenshot-nav mt-6">
          <v-btn
            v-for="(screenshot, index) in screenshots"
            :key="screenshot.key"
            :variant="activeScreenshot === index ? 'flat' : 'tonal'"
            :color="activeScreenshot === index ? 'primary' : 'default'"
            size="small"
            class="mx-1"
            @click="selectScreenshot(index)"
          >
            {{ t(`screenshots.items.${screenshot.key}`) }}
          </v-btn>
        </div>

        <!-- Progress Bar -->
        <div class="screenshot-progress mt-4">
          <div
            v-for="(_, index) in screenshots"
            :key="index"
            class="progress-segment"
            :class="{ 'progress-segment--active': activeScreenshot === index }"
          />
        </div>
      </div>
    </v-container>
  </section>
</template>

<style scoped>
.screenshots-section {
  position: relative;
}

.section-title {
  font-size: clamp(2rem, 5vw, 3rem);
  font-weight: 700;
  color: rgb(var(--v-theme-on-background));
}

.section-subtitle {
  font-size: 1.1rem;
  color: rgba(var(--v-theme-on-background), 0.7);
  line-height: 1.6;
}

.screenshot-container {
  max-width: 1000px;
  margin: 0 auto;
}

.screenshot-frame {
  background: rgb(var(--v-theme-surface));
  border-radius: 16px;
  overflow: hidden;
  box-shadow:
    0 25px 80px rgba(0, 0, 0, 0.4),
    0 0 0 1px rgba(212, 165, 116, 0.1);
}

.screenshot-frame-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.frame-dots {
  display: flex;
  gap: 8px;
}

.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.dot--red {
  background: #ff5f57;
}

.dot--yellow {
  background: #ffbd2e;
}

.dot--green {
  background: #28c940;
}

.frame-title {
  flex: 1;
  text-align: center;
  font-size: 0.85rem;
  color: rgba(var(--v-theme-on-surface), 0.6);
  font-weight: 500;
}

.frame-spacer {
  width: 52px;
}

.screenshot-content {
  aspect-ratio: 16 / 10;
  position: relative;
  overflow: hidden;
}

.screenshot-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(
    135deg,
    rgba(212, 165, 116, 0.05) 0%,
    rgba(26, 29, 41, 0.5) 100%
  );
}

.screenshot-nav {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 8px;
}

.screenshot-progress {
  display: flex;
  gap: 4px;
  justify-content: center;
}

.progress-segment {
  width: 60px;
  height: 3px;
  background: rgba(var(--v-theme-primary), 0.2);
  border-radius: 2px;
  overflow: hidden;
  position: relative;
}

.progress-segment--active::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgb(var(--v-theme-primary));
  animation: progressFill 5s linear;
}

@keyframes progressFill {
  from {
    transform: scaleX(0);
    transform-origin: left;
  }
  to {
    transform: scaleX(1);
    transform-origin: left;
  }
}
</style>
