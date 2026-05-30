<script setup lang="ts">
const { t } = useI18n()

interface Highlight {
  key: string
  icon: string
  gradient: string
  badge: string
  isNew?: boolean
  glow: string
  /** When true, this slide cycles through the theme colours while shown. */
  cycleColors?: boolean
}

const highlights: Highlight[] = [
  {
    key: 'aiImport',
    icon: 'mdi-robot-happy-outline',
    gradient: 'linear-gradient(135deg, #0B2622 0%, #4DD0E1 50%, #D4A574 100%)',
    glow: 'rgba(77, 208, 225, 0.45)',
    badge: 'v1.4',
    isNew: true,
  },
  {
    key: 'climateZones',
    icon: 'mdi-weather-partly-snowy-rainy',
    gradient: 'linear-gradient(135deg, #1565C0 0%, #4FC3F7 50%, #B0BEC5 100%)',
    glow: 'rgba(79, 195, 247, 0.4)',
    badge: 'v1.4',
    isNew: true,
  },
  {
    key: 'folders',
    icon: 'mdi-folder-multiple',
    gradient: 'linear-gradient(135deg, #5D4037 0%, #D4A574 50%, #8D6E63 100%)',
    glow: 'rgba(212, 165, 116, 0.4)',
    badge: 'v1.4',
    isNew: true,
  },
  {
    key: 'tags',
    icon: 'mdi-tag-multiple',
    gradient: 'linear-gradient(135deg, #AD1457 0%, #FF4081 50%, #F50057 100%)',
    glow: 'rgba(255, 64, 129, 0.4)',
    badge: 'v1.4',
    isNew: true,
  },
  {
    key: 'themes',
    icon: 'mdi-palette',
    gradient: 'linear-gradient(135deg, #4DD0E1 0%, #B388FF 50%, #FF7043 100%)',
    glow: 'rgba(179, 136, 255, 0.45)',
    badge: 'v1.4',
    isNew: true,
    cycleColors: true,
  },
  {
    key: 'archive',
    icon: 'mdi-archive-arrow-down',
    gradient: 'linear-gradient(135deg, #D4A574 0%, #8B4513 50%, #D4A574 100%)',
    glow: 'rgba(212, 165, 116, 0.4)',
    badge: 'v1.3',
  },
  {
    key: 'multiclass',
    icon: 'mdi-sword-cross',
    gradient: 'linear-gradient(135deg, #7B1FA2 0%, #E040FB 50%, #AA00FF 100%)',
    glow: 'rgba(224, 64, 251, 0.4)',
    badge: 'v1.3',
  },
  {
    key: 'encounter',
    icon: 'mdi-shield-sword',
    gradient: 'linear-gradient(135deg, #B71C1C 0%, #FF1744 50%, #D50000 100%)',
    glow: 'rgba(255, 23, 68, 0.4)',
    badge: 'v1.2',
  },
  {
    key: 'statblocks',
    icon: 'mdi-clipboard-list-outline',
    gradient: 'linear-gradient(135deg, #0D47A1 0%, #2979FF 50%, #1565C0 100%)',
    glow: 'rgba(41, 121, 255, 0.4)',
    badge: 'v1.2',
  },
  {
    key: 'chaosGraph',
    icon: 'mdi-graph',
    gradient: 'linear-gradient(135deg, #004D40 0%, #1DE9B6 50%, #00BFA5 100%)',
    glow: 'rgba(29, 233, 182, 0.4)',
    badge: 'v1.0',
  },
  {
    key: 'maps',
    icon: 'mdi-map-marker-radius',
    gradient: 'linear-gradient(135deg, #E65100 0%, #FF9100 50%, #FF6D00 100%)',
    glow: 'rgba(255, 145, 0, 0.4)',
    badge: 'v1.0',
  },
  {
    key: 'search',
    icon: 'mdi-magnify',
    gradient: 'linear-gradient(135deg, #1A237E 0%, #536DFE 50%, #304FFE 100%)',
    glow: 'rgba(83, 109, 254, 0.4)',
    badge: 'v1.0',
  },
]

const currentIndex = ref(0)
let interval: ReturnType<typeof setInterval> | null = null

const currentHighlight = computed(() => highlights[currentIndex.value])

function next() {
  currentIndex.value = (currentIndex.value + 1) % highlights.length
}

function prev() {
  currentIndex.value = (currentIndex.value - 1 + highlights.length) % highlights.length
}

function goTo(index: number) {
  currentIndex.value = index
  resetInterval()
}

function resetInterval() {
  if (interval) clearInterval(interval)
  interval = setInterval(next, 7000)
}

onMounted(() => {
  interval = setInterval(next, 7000)
})

onUnmounted(() => {
  if (interval) clearInterval(interval)
})
</script>

<template>
  <section class="highlights-banner">
    <div
      :key="currentIndex"
      class="highlight-slide"
      :class="{ 'slide--cycle': currentHighlight?.cycleColors }"
      :style="{
        background: currentHighlight?.gradient,
        boxShadow: `inset 0 0 60px ${currentHighlight?.glow}, 0 4px 20px ${currentHighlight?.glow}`,
      }"
    >
      <v-container class="highlight-container">
        <v-btn
          icon
          variant="text"
          color="white"
          class="nav-btn nav-btn--left"
          @click="prev"
        >
          <v-icon size="28">mdi-chevron-left</v-icon>
        </v-btn>

        <div class="highlight-content">
          <v-icon color="white" size="36" class="highlight-icon">
            {{ currentHighlight?.icon }}
          </v-icon>
          <div class="highlight-text">
            <div class="highlight-title">
              {{ t(`highlights.${currentHighlight?.key}.title`) }}
            </div>
            <div class="highlight-subtitle">
              {{ t(`highlights.${currentHighlight?.key}.subtitle`) }}
            </div>
          </div>
          <div class="highlight-badges">
            <v-chip size="small" variant="elevated" color="white">
              {{ currentHighlight?.badge }}
            </v-chip>
            <v-chip
              v-if="currentHighlight?.isNew"
              size="small"
              variant="elevated"
              color="success"
              class="new-badge"
            >
              NEW
            </v-chip>
          </div>
        </div>

        <v-btn
          icon
          variant="text"
          color="white"
          class="nav-btn nav-btn--right"
          @click="next"
        >
          <v-icon size="28">mdi-chevron-right</v-icon>
        </v-btn>
      </v-container>

      <!-- Dots -->
      <div class="dots">
        <button
          v-for="(h, i) in highlights"
          :key="h.key"
          :class="['dot', { active: i === currentIndex }]"
          @click="goTo(i)"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.highlights-banner {
  position: relative;
  overflow: hidden;
}

.highlight-slide {
  padding: 10px 0 4px;
  animation: slideIn 0.5s ease;
  background-size: 200% 200%;
  animation: slideIn 0.5s ease, gradientShift 8s ease infinite;
}

@keyframes gradientShift {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

/* The "Themes" slide literally shows off the colour themes — it cycles through
   each theme's palette a few times while it's on screen. */
.slide--cycle {
  animation: slideIn 0.5s ease, themeCycle 4.5s linear infinite;
}

@keyframes themeCycle {
  0% { background: linear-gradient(135deg, #1a1d29 0%, #d4a574 100%); } /* dark / gold */
  16% { background: linear-gradient(135deg, #0f1f1a 0%, #4caf7c 100%); } /* forest */
  33% { background: linear-gradient(135deg, #0d1b2a 0%, #4fc3f7 100%); } /* ocean */
  50% { background: linear-gradient(135deg, #1a0f2e 0%, #b388ff 100%); } /* arcane */
  66% { background: linear-gradient(135deg, #1f1410 0%, #ff7043 100%); } /* forge */
  83% { background: linear-gradient(135deg, #2c001e 0%, #e95420 100%); } /* ubuntu */
  100% { background: linear-gradient(135deg, #0b2622 0%, #4dd0e1 100%); } /* emily lagoon */
}

@keyframes slideIn {
  from { opacity: 0; transform: translateX(20px); }
  to { opacity: 1; transform: translateX(0); }
}

.highlight-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 80px;
  position: relative;
}

.nav-btn {
  position: absolute;
  z-index: 2;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.nav-btn:hover {
  opacity: 1;
}

.nav-btn--left {
  left: 0;
}

.nav-btn--right {
  right: 0;
}

.highlight-content {
  display: flex;
  align-items: center;
  gap: 16px;
  max-width: 700px;
  text-align: center;
  flex-direction: column;
}

.highlight-icon {
  filter: drop-shadow(0 0 12px rgba(255, 255, 255, 0.6));
  animation: iconGlow 2s ease-in-out infinite alternate;
}

@keyframes iconGlow {
  from { filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.4)); }
  to { filter: drop-shadow(0 0 20px rgba(255, 255, 255, 0.8)); }
}

.highlight-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.highlight-title {
  color: white;
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.highlight-subtitle {
  color: rgba(255, 255, 255, 0.85);
  font-size: 0.875rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 420px;
}

.highlight-badges {
  display: flex;
  gap: 6px;
}

.new-badge {
  animation: pulse 1.5s infinite;
  font-weight: 700;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); box-shadow: 0 0 0 rgba(76, 175, 80, 0); }
  50% { transform: scale(1.1); box-shadow: 0 0 12px rgba(76, 175, 80, 0.6); }
}

.dots {
  display: flex;
  justify-content: center;
  gap: 8px;
  padding: 8px 0 4px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.35);
  cursor: pointer;
  transition: all 0.3s ease;
  padding: 0;
}

.dot.active {
  background: white;
  transform: scale(1.4);
  box-shadow: 0 0 8px rgba(255, 255, 255, 0.6);
}

/* Desktop */
@media (min-width: 600px) {
  .highlight-content {
    flex-direction: row;
    text-align: left;
  }

  .highlight-title {
    font-size: 1.4rem;
  }

  .highlight-subtitle {
    font-size: 1rem;
  }

  .nav-btn--left {
    left: -8px;
  }

  .nav-btn--right {
    right: -8px;
  }
}

/* Mobile */
@media (max-width: 599px) {
  /* Keep the arrows at the edges and give the text room so it never slides
     under them or gets clipped. */
  .nav-btn--left {
    left: 0;
  }

  .nav-btn--right {
    right: 0;
  }

  .highlight-container {
    padding-left: 44px;
    padding-right: 44px;
  }

  .highlight-icon {
    display: none;
  }

  .highlight-title {
    font-size: 1.1rem;
  }

  /* Let the subtitle wrap instead of being cut off with an ellipsis. */
  .highlight-subtitle {
    white-space: normal;
    max-width: 100%;
    overflow: visible;
    text-overflow: clip;
    text-align: center;
  }
}
</style>
