<script setup lang="ts">
const { t } = useI18n()

// Floating notes – generated once on the client (SSR renders none, no hydration mismatch)
const NOTES = ['♪', '♫', '♩', '♬', '𝄞']
const COLORS = ['#FF8A3D', '#E0248F', '#00A6E0', '#FFC145']
const notes = ref<{ id: number, glyph: string, left: string, size: string, color: string, delay: string, duration: string, drift: string }[]>([])

onMounted(() => {
  notes.value = Array.from({ length: 22 }, (_, i) => ({
    id: i,
    glyph: NOTES[i % NOTES.length]!,
    left: `${Math.random() * 100}%`,
    size: `${16 + Math.random() * 22}px`,
    color: COLORS[i % COLORS.length]!,
    delay: `${-Math.random() * 18}s`,
    duration: `${12 + Math.random() * 10}s`,
    drift: `${(Math.random() - 0.5) * 160}px`,
  }))
})

const pillars = [
  { key: 'library', icon: 'mdi-folder-music', color: '#FF8A3D' },
  { key: 'scenes', icon: 'mdi-star-four-points', color: '#FFC145' },
  { key: 'mini', icon: 'mdi-play-circle', color: '#00A6E0' },
  { key: 'playlists', icon: 'mdi-youtube', color: '#E0248F' },
]

const steps = ['pick', 'star', 'play']

// Fake equaliser bars for the mock player
const bars = Array.from({ length: 14 }, (_, i) => ({ delay: `${(i * 0.13) % 1.1}s`, height: `${30 + ((i * 37) % 60)}%` }))
</script>

<template>
  <section id="music" class="music-section">
    <!-- Sunset rays + floating notes (decorative) -->
    <div class="music-bg" aria-hidden="true">
      <span
        v-for="n in notes"
        :key="n.id"
        class="music-note"
        :style="{ 'left': n.left, 'fontSize': n.size, 'color': n.color, 'animationDelay': n.delay, 'animationDuration': n.duration, '--drift': n.drift }"
      >{{ n.glyph }}</span>
    </div>

    <v-container class="music-content py-16">
      <!-- Header -->
      <div class="text-center mb-12">
        <div
          v-motion
          :initial="{ opacity: 0, scale: 0.8 }"
          :visible-once="{ opacity: 1, scale: 1 }"
          class="music-kicker mb-4"
        >
          <v-icon size="18" class="mr-2">mdi-music</v-icon>
          {{ t('music.kicker') }}
          <v-chip size="x-small" variant="elevated" color="success" class="ml-2">NEW · v1.5</v-chip>
        </div>
        <h2
          v-motion
          :initial="{ opacity: 0, y: 20 }"
          :visible-once="{ opacity: 1, y: 0, transition: { delay: 100 } }"
          class="music-title mb-4"
        >
          {{ t('music.title') }}
        </h2>
        <p
          v-motion
          :initial="{ opacity: 0, y: 20 }"
          :visible-once="{ opacity: 1, y: 0, transition: { delay: 200 } }"
          class="music-subtitle mx-auto"
        >
          {{ t('music.subtitle') }}
        </p>
      </div>

      <!-- Mock player -->
      <div
        v-motion
        :initial="{ opacity: 0, y: 40 }"
        :visible-once="{ opacity: 1, y: 0, transition: { delay: 300 } }"
        class="music-player mx-auto mb-14"
      >
        <div class="music-player-top">
          <div class="music-player-cover">
            <div class="music-eq">
              <span v-for="(b, i) in bars" :key="i" :style="{ 'animationDelay': b.delay, '--h': b.height }" />
            </div>
          </div>
          <div class="music-player-meta">
            <div class="music-player-scene">
              <v-icon size="14" color="#FFC145">mdi-star</v-icon>
              {{ t('music.mock.scene') }}
            </div>
            <div class="music-player-track">{{ t('music.mock.track') }}</div>
            <div class="music-player-folder">{{ t('music.mock.folder') }}</div>
          </div>
          <div class="music-player-controls">
            <v-icon size="22">mdi-shuffle-variant</v-icon>
            <v-icon size="26">mdi-skip-previous</v-icon>
            <span class="music-player-play"><v-icon size="26">mdi-pause</v-icon></span>
            <v-icon size="26">mdi-skip-next</v-icon>
            <v-icon size="22" color="#FF8A3D">mdi-folder-sync</v-icon>
          </div>
        </div>
        <div class="music-player-progress">
          <span class="music-player-time">1:42</span>
          <div class="music-player-bar"><div class="music-player-fill" /></div>
          <span class="music-player-time">4:10</span>
        </div>
        <div class="music-player-hint">
          <v-icon size="14" class="mr-1">mdi-swap-horizontal</v-icon>{{ t('music.mock.crossfade') }}
          <span class="mx-2">·</span>
          <v-icon size="14" class="mr-1">mdi-keyboard</v-icon>{{ t('music.mock.shortcuts') }}
        </div>
      </div>

      <!-- Four pillars -->
      <v-row class="mb-12">
        <v-col
          v-for="(p, index) in pillars"
          :key="p.key"
          cols="12"
          sm="6"
          lg="3"
        >
          <v-card
            v-motion
            :initial="{ opacity: 0, y: 30 }"
            :visible-once="{ opacity: 1, y: 0, transition: { delay: 120 * index } }"
            class="music-card h-100 pa-6"
            :style="{ '--accent': p.color }"
          >
            <div class="music-card-icon mb-4">
              <v-icon size="30" :color="p.color">{{ p.icon }}</v-icon>
            </div>
            <h3 class="music-card-title mb-2">{{ t(`music.pillars.${p.key}.title`) }}</h3>
            <p class="music-card-text">{{ t(`music.pillars.${p.key}.text`) }}</p>
          </v-card>
        </v-col>
      </v-row>

      <!-- Three steps -->
      <div
        v-motion
        :initial="{ opacity: 0, y: 30 }"
        :visible-once="{ opacity: 1, y: 0 }"
        class="music-steps mx-auto"
      >
        <div v-for="(s, i) in steps" :key="s" class="music-step">
          <div class="music-step-num">{{ i + 1 }}</div>
          <div>
            <div class="music-step-title">{{ t(`music.steps.${s}.title`) }}</div>
            <div class="music-step-text">{{ t(`music.steps.${s}.text`) }}</div>
          </div>
        </div>
      </div>

      <p class="music-footnote text-center mt-10">
        <v-icon size="16" class="mr-1">mdi-shield-lock</v-icon>
        {{ t('music.footnote') }}
      </p>
    </v-container>
  </section>
</template>

<style scoped>
.music-section {
  position: relative;
  overflow: hidden;
  background:
    linear-gradient(118deg, rgba(224, 36, 143, 0.22) 0%, rgba(224, 36, 143, 0.06) 30%, transparent 48%),
    linear-gradient(296deg, rgba(255, 138, 61, 0.2) 0%, rgba(232, 69, 44, 0.07) 32%, transparent 52%),
    radial-gradient(ellipse 90% 45% at 50% 105%, rgba(0, 140, 200, 0.35) 0%, rgba(0, 50, 120, 0.15) 45%, transparent 75%),
    #0f1233;
  color: #f5f0ff;
}

.music-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.music-note {
  position: absolute;
  bottom: -40px;
  opacity: 0;
  line-height: 1;
  text-shadow: 0 0 14px currentColor;
  animation: music-note-rise linear infinite;
  will-change: transform, opacity;
}
@keyframes music-note-rise {
  0% { transform: translate(0, 0) rotate(0deg); opacity: 0; }
  10% { opacity: 0.75; }
  50% { transform: translate(calc(var(--drift) * 0.5), -50vh) rotate(-12deg); }
  90% { opacity: 0.75; }
  100% { transform: translate(var(--drift), -105vh) rotate(14deg); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .music-note, .music-eq span { animation: none !important; }
}

.music-content {
  position: relative;
  z-index: 1;
}

.music-kicker {
  display: inline-flex;
  align-items: center;
  padding: 6px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  font-size: 0.85rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.music-title {
  font-size: clamp(2.2rem, 6vw, 3.6rem);
  font-weight: 800;
  line-height: 1.1;
  background: linear-gradient(90deg, #ffc145 0%, #ff8a3d 35%, #e0248f 70%, #00a6e0 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.music-subtitle {
  max-width: 680px;
  font-size: 1.15rem;
  line-height: 1.6;
  color: rgba(245, 240, 255, 0.8);
}

/* Mock player */
.music-player {
  max-width: 760px;
  padding: 18px 22px 14px;
  border-radius: 20px;
  background: rgba(24, 27, 72, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow:
    0 30px 60px rgba(0, 0, 0, 0.45),
    0 0 60px rgba(0, 140, 200, 0.25);
  backdrop-filter: blur(6px);
}
.music-player-top {
  display: flex;
  align-items: center;
  gap: 18px;
  flex-wrap: wrap;
}
.music-player-cover {
  width: 72px;
  height: 72px;
  border-radius: 14px;
  background: linear-gradient(135deg, #ff8a3d, #e0248f 60%, #6a1b70);
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.music-eq {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 36px;
}
.music-eq span {
  width: 3px;
  height: var(--h);
  background: rgba(255, 255, 255, 0.9);
  border-radius: 2px;
  animation: music-eq 1.1s ease-in-out infinite alternate;
}
@keyframes music-eq {
  from { height: 15%; }
  to { height: var(--h); }
}
.music-player-meta {
  flex: 1 1 200px;
  min-width: 0;
}
.music-player-scene {
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #ffc145;
}
.music-player-track {
  font-size: 1.25rem;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.music-player-folder {
  font-size: 0.9rem;
  color: rgba(245, 240, 255, 0.6);
}
.music-player-controls {
  display: flex;
  align-items: center;
  gap: 14px;
  color: rgba(245, 240, 255, 0.85);
}
.music-player-play {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: linear-gradient(120deg, #ff8a3d, #f0562e);
  color: #1a0b2e;
  box-shadow: 0 0 24px rgba(255, 138, 61, 0.5);
}
.music-player-progress {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
}
.music-player-time {
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
  color: rgba(245, 240, 255, 0.6);
}
.music-player-bar {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.12);
  overflow: hidden;
}
.music-player-fill {
  width: 41%;
  height: 100%;
  background: linear-gradient(90deg, #00a6e0, #ff8a3d);
}
.music-player-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 10px;
  font-size: 0.8rem;
  color: rgba(245, 240, 255, 0.55);
}

/* Pillars */
.music-card {
  background: rgba(24, 27, 72, 0.7) !important;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #f5f0ff;
  transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
}
.music-card:hover {
  transform: translateY(-8px);
  border-color: var(--accent);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.35), 0 0 30px color-mix(in srgb, var(--accent) 35%, transparent);
}
.music-card-icon {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--accent) 18%, transparent);
}
.music-card-title {
  font-size: 1.15rem;
  font-weight: 700;
}
.music-card-text {
  color: rgba(245, 240, 255, 0.72);
  line-height: 1.6;
}

/* Steps */
.music-steps {
  max-width: 900px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}
@media (max-width: 800px) {
  .music-steps { grid-template-columns: 1fr; }
}
.music-step {
  display: flex;
  gap: 14px;
  align-items: flex-start;
}
.music-step-num {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-weight: 800;
  flex-shrink: 0;
  background: linear-gradient(135deg, #ff8a3d, #e0248f);
  color: #1a0b2e;
}
.music-step-title {
  font-weight: 700;
  margin-bottom: 2px;
}
.music-step-text {
  color: rgba(245, 240, 255, 0.7);
  line-height: 1.5;
}
.music-footnote {
  color: rgba(245, 240, 255, 0.6);
  font-size: 0.9rem;
}
</style>
