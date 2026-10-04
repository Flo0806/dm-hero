<script setup lang="ts">
const { t, locale } = useI18n()

// Docs live per language (/docs/... and /docs/de/...)
const docsPath = computed(() => (locale.value === 'de' ? '/docs/de/game-table' : '/docs/game-table'))

// Stars of the night sky - generated once on the client (SSR renders none, no hydration mismatch)
const stars = ref<{ id: number, left: string, top: string, size: string, delay: string, duration: string }[]>([])
onMounted(() => {
  stars.value = Array.from({ length: 60 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    top: `${Math.pow(Math.random(), 1.5) * 90}%`,
    size: `${1 + Math.random() * 2}px`,
    delay: `${-Math.random() * 6}s`,
    duration: `${3 + Math.random() * 4}s`,
  }))
})

// The reveal on the mock phone flips between the alias and the true name
const revealed = ref(false)
let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  timer = setInterval(() => (revealed.value = !revealed.value), 3200)
})
onBeforeUnmount(() => timer && clearInterval(timer))

const pillars = [
  { key: 'share', icon: 'mdi-share-variant', color: '#C8D3F5' },
  { key: 'maps', icon: 'mdi-map-search', color: '#5EEAD4' },
  { key: 'handouts', icon: 'mdi-email-lock', color: '#A78BFA' },
  { key: 'secure', icon: 'mdi-shield-lock', color: '#7DD3FC' },
]

const steps = ['start', 'invite', 'play']
</script>

<template>
  <section id="game-table" class="table-section">
    <!-- Night sky: aurora + twinkling stars (decorative) -->
    <div class="table-bg" aria-hidden="true">
      <div class="table-aurora" />
      <span
        v-for="s in stars"
        :key="s.id"
        class="table-star"
        :style="{ left: s.left, top: s.top, width: s.size, height: s.size, animationDelay: s.delay, animationDuration: s.duration }"
      />
    </div>

    <v-container class="table-content py-16">
      <!-- Header -->
      <div class="text-center mb-12">
        <div
          v-motion
          :initial="{ opacity: 0, scale: 0.8 }"
          :visible-once="{ opacity: 1, scale: 1 }"
          class="table-kicker mb-4"
        >
          <v-icon size="18" class="mr-2">mdi-table-furniture</v-icon>
          {{ t('gameTable.kicker') }}
          <v-chip size="x-small" variant="elevated" color="success" class="ml-2">{{ t('common.new') }} · v1.6 Nocturne</v-chip>
        </div>
        <h2
          v-motion
          :initial="{ opacity: 0, y: 20 }"
          :visible-once="{ opacity: 1, y: 0, transition: { delay: 100 } }"
          class="table-title mb-4"
        >
          {{ t('gameTable.title') }}
        </h2>
        <p
          v-motion
          :initial="{ opacity: 0, y: 20 }"
          :visible-once="{ opacity: 1, y: 0, transition: { delay: 200 } }"
          class="table-subtitle mx-auto"
        >
          {{ t('gameTable.subtitle') }}
        </p>
      </div>

      <!-- Mock: the DM shares, the player's phone lights up with the reveal -->
      <div
        v-motion
        :initial="{ opacity: 0, y: 40 }"
        :visible-once="{ opacity: 1, y: 0, transition: { delay: 300 } }"
        class="table-demo mx-auto mb-14"
      >
        <div class="table-dm">
          <div class="table-dm-label">
            <v-icon size="16" class="mr-1">mdi-dice-d20</v-icon>{{ t('gameTable.mock.dm') }}
          </div>
          <div class="table-dm-card">
            <v-icon size="28" color="#C8D3F5">mdi-incognito</v-icon>
            <div>
              <div class="table-dm-name">{{ t('gameTable.mock.realName') }}</div>
              <div class="table-dm-alias">{{ t('gameTable.mock.sharedAs') }}</div>
            </div>
          </div>
          <div class="table-dm-hint">
            <v-icon size="14" class="mr-1">mdi-share-variant</v-icon>{{ t('gameTable.mock.shareHint') }}
          </div>
        </div>

        <div class="table-beam" aria-hidden="true">
          <span v-for="i in 3" :key="i" :style="{ animationDelay: `${i * 0.4}s` }" />
        </div>

        <div class="table-phone">
          <div class="table-phone-notch" />
          <div class="table-phone-screen">
            <div class="table-phone-top">
              <span class="table-phone-dot" /> {{ t('gameTable.mock.connected') }}
              <span class="ml-auto">🔒</span>
            </div>
            <Transition name="table-reveal" mode="out-in">
              <div v-if="revealed" key="real" class="table-phone-card table-phone-card--revealed">
                <div class="table-phone-banner">✨ {{ t('gameTable.mock.reveal') }}</div>
                <div class="table-phone-name">{{ t('gameTable.mock.realName') }}</div>
              </div>
              <div v-else key="alias" class="table-phone-card">
                <div class="table-phone-type">NPC</div>
                <div class="table-phone-name">{{ t('gameTable.mock.alias') }}</div>
              </div>
            </Transition>
            <div class="table-phone-weather">🌧️ {{ t('gameTable.mock.weather') }}</div>
          </div>
        </div>
      </div>

      <!-- Four pillars -->
      <v-row class="mb-12">
        <v-col v-for="(p, index) in pillars" :key="p.key" cols="12" sm="6" lg="3">
          <v-card
            v-motion
            :initial="{ opacity: 0, y: 30 }"
            :visible-once="{ opacity: 1, y: 0, transition: { delay: 120 * index } }"
            class="table-card h-100 pa-6"
            :style="{ '--accent': p.color }"
          >
            <div class="table-card-icon mb-4">
              <v-icon size="30" :color="p.color">{{ p.icon }}</v-icon>
            </div>
            <h3 class="table-card-title mb-2">{{ t(`gameTable.pillars.${p.key}.title`) }}</h3>
            <p class="table-card-text">{{ t(`gameTable.pillars.${p.key}.text`) }}</p>
          </v-card>
        </v-col>
      </v-row>

      <!-- Three steps -->
      <div
        v-motion
        :initial="{ opacity: 0, y: 30 }"
        :visible-once="{ opacity: 1, y: 0 }"
        class="table-steps mx-auto"
      >
        <div v-for="(s, i) in steps" :key="s" class="table-step">
          <div class="table-step-num">{{ i + 1 }}</div>
          <div>
            <div class="table-step-title">{{ t(`gameTable.steps.${s}.title`) }}</div>
            <div class="table-step-text">{{ t(`gameTable.steps.${s}.text`) }}</div>
          </div>
        </div>
      </div>

      <div class="d-flex flex-wrap justify-center ga-3 mt-10">
        <v-btn size="large" color="#C8D3F5" variant="flat" class="table-cta" href="https://table.dm-hero.com" target="_blank" rel="noopener" prepend-icon="mdi-open-in-new">
          table.dm-hero.com
        </v-btn>
        <v-btn size="large" variant="outlined" color="#C8D3F5" :to="docsPath" prepend-icon="mdi-book-open-variant">
          {{ t('gameTable.docs') }}
        </v-btn>
      </div>

      <p class="table-footnote text-center mt-8">
        <v-icon size="16" class="mr-1">mdi-shield-lock</v-icon>
        {{ t('gameTable.footnote') }}
      </p>
    </v-container>
  </section>
</template>

<style scoped>
.table-section {
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(ellipse 40% 45% at 90% 8%, rgba(200, 211, 245, 0.14) 0%, transparent 70%),
    linear-gradient(180deg, #070b1a 0%, #0f1530 60%, #1e245c 100%);
  color: #e8ecfa;
}

.table-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.table-aurora {
  position: absolute;
  top: -12vh;
  left: -10%;
  width: 120%;
  height: 40vh;
  background:
    radial-gradient(55% 55% at 35% 55%, rgba(94, 234, 212, 0.18), transparent 70%),
    radial-gradient(45% 45% at 70% 50%, rgba(167, 139, 250, 0.15), transparent 70%);
  animation: table-aurora 24s ease-in-out infinite alternate;
}
@keyframes table-aurora {
  from { transform: translateX(-4%) skewX(-6deg); }
  to { transform: translateX(5%) skewX(7deg); }
}
.table-star {
  position: absolute;
  border-radius: 50%;
  background: #e8ecfa;
  animation: table-twinkle ease-in-out infinite alternate;
}
@keyframes table-twinkle {
  from { opacity: 0.15; }
  to { opacity: 0.9; }
}
@media (prefers-reduced-motion: reduce) {
  .table-aurora, .table-star, .table-beam span { animation: none !important; }
}

.table-content {
  position: relative;
  z-index: 1;
}

.table-kicker {
  display: inline-flex;
  align-items: center;
  padding: 6px 14px;
  border-radius: 999px;
  background: rgba(200, 211, 245, 0.08);
  border: 1px solid rgba(200, 211, 245, 0.2);
  font-size: 0.85rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.table-title {
  font-size: clamp(2.2rem, 6vw, 3.6rem);
  font-weight: 800;
  line-height: 1.1;
  background: linear-gradient(90deg, #e3e9fc 0%, #c8d3f5 35%, #5eead4 70%, #a78bfa 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.table-subtitle {
  max-width: 700px;
  font-size: 1.15rem;
  line-height: 1.6;
  color: rgba(232, 236, 250, 0.8);
}

/* Demo: DM card -> beam -> phone */
.table-demo {
  max-width: 820px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  flex-wrap: wrap;
}
.table-dm {
  flex: 1 1 280px;
  max-width: 340px;
  padding: 18px;
  border-radius: 18px;
  background: rgba(15, 21, 48, 0.85);
  border: 1px solid rgba(200, 211, 245, 0.15);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45);
}
.table-dm-label {
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #5eead4;
  margin-bottom: 12px;
}
.table-dm-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  background: rgba(26, 34, 70, 0.9);
}
.table-dm-name {
  font-weight: 700;
}
.table-dm-alias {
  font-size: 0.85rem;
  color: rgba(232, 236, 250, 0.6);
}
.table-dm-hint {
  margin-top: 10px;
  font-size: 0.8rem;
  color: rgba(232, 236, 250, 0.55);
}

.table-beam {
  display: flex;
  gap: 8px;
}
.table-beam span {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #c8d3f5;
  box-shadow: 0 0 12px #c8d3f5;
  animation: table-beam 1.2s ease-in-out infinite;
}
@keyframes table-beam {
  0%, 100% { opacity: 0.2; transform: scale(0.7); }
  50% { opacity: 1; transform: scale(1); }
}

.table-phone {
  position: relative;
  width: 220px;
  height: 380px;
  padding: 12px;
  border-radius: 34px;
  background: #050816;
  border: 2px solid rgba(200, 211, 245, 0.25);
  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.55), 0 0 60px rgba(94, 234, 212, 0.18);
}
.table-phone-notch {
  width: 70px;
  height: 6px;
  margin: 2px auto 10px;
  border-radius: 3px;
  background: rgba(200, 211, 245, 0.2);
}
.table-phone-screen {
  height: calc(100% - 18px);
  border-radius: 22px;
  padding: 14px 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: linear-gradient(180deg, #121933, #0b1024);
}
.table-phone-top {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.72rem;
  color: rgba(232, 236, 250, 0.7);
}
.table-phone-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #5eead4;
}
.table-phone-card {
  padding: 14px 12px;
  border-radius: 14px;
  background: rgba(26, 34, 70, 0.95);
  border: 1px solid rgba(200, 211, 245, 0.15);
}
.table-phone-card--revealed {
  border-color: #d4a574;
  box-shadow: 0 0 0 3px rgba(212, 165, 116, 0.35), 0 0 30px rgba(212, 165, 116, 0.4);
}
.table-phone-type {
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(232, 236, 250, 0.5);
}
.table-phone-banner {
  font-size: 0.75rem;
  color: #d4a574;
  margin-bottom: 4px;
}
.table-phone-name {
  font-size: 1.05rem;
  font-weight: 700;
}
.table-phone-weather {
  margin-top: auto;
  font-size: 0.8rem;
  color: rgba(232, 236, 250, 0.65);
}
.table-reveal-enter-active,
.table-reveal-leave-active {
  transition: opacity 0.4s ease, transform 0.4s ease;
}
.table-reveal-enter-from,
.table-reveal-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.97);
}

/* Pillars */
.table-card {
  background: rgba(15, 21, 48, 0.75) !important;
  border: 1px solid rgba(200, 211, 245, 0.12);
  color: #e8ecfa;
  transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
}
.table-card:hover {
  transform: translateY(-8px);
  border-color: var(--accent);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.35), 0 0 30px color-mix(in srgb, var(--accent) 35%, transparent);
}
.table-card-icon {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--accent) 16%, transparent);
}
.table-card-title {
  font-size: 1.15rem;
  font-weight: 700;
}
.table-card-text {
  color: rgba(232, 236, 250, 0.72);
  line-height: 1.6;
}

/* Steps */
.table-steps {
  max-width: 900px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}
@media (max-width: 800px) {
  .table-steps { grid-template-columns: 1fr; }
}
.table-step {
  display: flex;
  gap: 14px;
  align-items: flex-start;
}
.table-step-num {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-weight: 800;
  flex-shrink: 0;
  background: linear-gradient(135deg, #e3e9fc, #5eead4);
  color: #0a0f24;
}
.table-step-title {
  font-weight: 700;
  margin-bottom: 2px;
}
.table-step-text {
  color: rgba(232, 236, 250, 0.7);
  line-height: 1.5;
}
.table-cta {
  color: #0a0f24 !important;
  font-weight: 700;
}
.table-footnote {
  color: rgba(232, 236, 250, 0.6);
  font-size: 0.9rem;
}
</style>
