<template>
  <!-- Today's in-game weather as a quiet background - decoration only, never in the way -->
  <div v-if="effect" class="weather" :class="[`weather--${effect}`, { 'weather--paused': hidden }]" aria-hidden="true">
    <template v-if="glow">
      <div class="weather__warmth" />
      <div class="weather__rays" />
      <div class="weather__glow" />
    </template>
    <div v-if="dim" class="weather__dim" :style="{ opacity: dim }" />
    <span v-for="cloud in clouds" :key="`c${cloud.i}`" class="weather__cloud" :class="{ 'weather__cloud--far': cloud.far }" :style="cloud.style" />
    <span v-for="fog in fogBands" :key="`f${fog.i}`" class="weather__fog" :style="fog.style" />
    <span v-for="p in particles" :key="`p${p.i}`" :class="particleClass" :style="p.style" />
    <div v-if="effect === 'thunderstorm'" class="weather__flash" />
  </div>
</template>

<script setup lang="ts">
import { TABLE_WEATHER_TYPES, type TableWeather, type TableWeatherType } from '@dm-hero/seal'

const props = defineProps<{ weather: TableWeather | null }>()

const effect = computed<TableWeatherType | null>(() =>
  props.weather && TABLE_WEATHER_TYPES.includes(props.weather.type) ? props.weather.type : null)

// Same "random" spread on every render (no flicker when the weather is re-sent)
const spread = (i: number, salt: number) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453
  return x - Math.floor(x)
}

// Phones get half the particles; a hidden tab pauses everything (battery)
const small = ref(false)
const hidden = ref(false)
function onVisibility() {
  hidden.value = document.hidden
}
onMounted(() => {
  small.value = window.matchMedia('(max-width: 640px)').matches
  onVisibility()
  document.addEventListener('visibilitychange', onVisibility)
})
onBeforeUnmount(() => document.removeEventListener('visibilitychange', onVisibility))

const COUNTS: Partial<Record<TableWeatherType, number>> = { rain: 70, heavyRain: 120, thunderstorm: 110, snow: 45, heavySnow: 110, windy: 24, hail: 60 }
const isSnow = computed(() => effect.value === 'snow' || effect.value === 'heavySnow')
const particleClass = computed(() => isSnow.value
  ? 'weather__flake'
  : effect.value === 'windy' ? 'weather__gust' : effect.value === 'hail' ? 'weather__hail' : 'weather__drop')

const particles = computed(() => {
  const count = Math.round((COUNTS[effect.value!] ?? 0) * (small.value ? 0.5 : 1))
  const fast = effect.value === 'thunderstorm' || effect.value === 'heavySnow' || effect.value === 'heavyRain' || effect.value === 'hail'
  return Array.from({ length: count }, (_, i) => {
    const duration = isSnow.value
      ? (fast ? 5 : 9) + spread(i, 3) * 6
      : effect.value === 'windy' ? 2 + spread(i, 3) * 2 : (fast ? 0.5 : 0.8) + spread(i, 3) * 0.5
    const flake = (fast ? 3 : 2) + spread(i, 5) * 4
    return {
      i,
      style: {
        left: `${spread(i, 1) * 100}%`,
        top: effect.value === 'windy' ? `${spread(i, 2) * 100}%` : undefined,
        animationDelay: `${-spread(i, 4) * duration}s`,
        animationDuration: `${duration}s`,
        ...(isSnow.value && { width: `${flake}px`, height: `${flake}px` }),
      },
    }
  })
})

// Two depths: far clouds (every other one) are smaller, paler and slower - that gives the sky depth
const CLOUDS: Partial<Record<TableWeatherType, number>> = { partlyCloudy: 3, cloudy: 7, thunderstorm: 6, rain: 4, heavyRain: 6, hail: 5 }
const clouds = computed(() => Array.from({ length: CLOUDS[effect.value!] ?? 0 }, (_, i) => {
  const far = i % 2 === 1
  const duration = (far ? 140 : 80) + spread(i, 8) * 60
  return {
    i,
    far,
    style: {
      'top': `${(far ? 0 : 8) + spread(i, 6) * 45}%`,
      'animationDelay': `${-spread(i, 7) * duration}s`,
      'animationDuration': `${duration}s`,
      '--cloud-scale': String((far ? 0.55 : 0.9) + spread(i, 9) * 0.5),
      // Where it rests when motion is reduced
      '--still-left': `${spread(i, 10) * 80 - 10}vw`,
    },
  }
}))

const fogBands = computed(() => effect.value === 'fog'
  ? Array.from({ length: 3 }, (_, i) => ({
      i,
      style: { 'top': `${15 + i * 28}%`, 'animationDelay': `${-i * 14}s`, 'animationDuration': `${40 + i * 12}s`, '--still-left': `${-20 + i * 15}vw` },
    }))
  : [])

const glow = computed(() => effect.value === 'sunny' || effect.value === 'partlyCloudy')
const DIM: Partial<Record<TableWeatherType, number>> = { thunderstorm: 0.35, heavyRain: 0.25, hail: 0.2, rain: 0.15, cloudy: 0.12, heavySnow: 0.1 }
const dim = computed(() => DIM[effect.value!] ?? 0)
</script>

<style scoped>
.weather {
  position: fixed;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
}

.weather__dim {
  position: absolute;
  inset: 0;
  background: #05060a;
}

.weather__warmth {
  position: absolute;
  inset: 0;
  background: linear-gradient(200deg, rgb(255 196 110 / 0.07), rgb(255 196 110 / 0) 55%);
}

.weather__glow {
  position: absolute;
  top: -22vmax;
  right: -22vmax;
  width: 64vmax;
  height: 64vmax;
  border-radius: 50%;
  background: radial-gradient(circle, rgb(255 226 150 / 0.3), rgb(255 200 110 / 0.12) 35%, rgb(255 190 90 / 0) 68%);
  animation: weather-pulse 9s ease-in-out infinite alternate;
}

/* Soft sun rays from the corner, turning very slowly */
.weather__rays {
  position: absolute;
  top: -70vmax;
  right: -70vmax;
  width: 140vmax;
  height: 140vmax;
  background: repeating-conic-gradient(from 0deg, rgb(255 225 160 / 0.07) 0deg 5deg, rgb(255 225 160 / 0) 5deg 17deg);
  mask-image: radial-gradient(circle, rgb(0 0 0) 8%, rgb(0 0 0 / 0) 48%);
  animation: weather-turn 160s linear infinite;
}

/* A puffy cloud: several soft blobs, slightly blurred */
.weather__cloud {
  position: absolute;
  left: -50vw;
  width: 46vw;
  height: 20vw;
  background:
    radial-gradient(closest-side at 26% 62%, rgb(216 221 233 / 0.16), rgb(216 221 233 / 0)),
    radial-gradient(closest-side at 48% 42%, rgb(222 226 238 / 0.2), rgb(222 226 238 / 0)),
    radial-gradient(closest-side at 70% 58%, rgb(216 221 233 / 0.15), rgb(216 221 233 / 0)),
    radial-gradient(closest-side at 50% 72%, rgb(200 206 220 / 0.12), rgb(200 206 220 / 0));
  scale: var(--cloud-scale, 1);
  animation: weather-drift linear infinite;
}

.weather__cloud--far {
  opacity: 0.55;
}

.weather__fog {
  position: absolute;
  left: -60vw;
  width: 120vw;
  height: 30vh;
  background: radial-gradient(ellipse, rgb(210 214 225 / 0.14), rgb(210 214 225 / 0) 70%);
  animation: weather-drift linear infinite;
}

.weather__drop {
  position: absolute;
  top: -10vh;
  width: 1px;
  height: 7vh;
  background: linear-gradient(rgb(170 190 220 / 0), rgb(170 190 220 / 0.45));
  animation: weather-fall linear infinite;
}

.weather__flake {
  position: absolute;
  top: -5vh;
  border-radius: 50%;
  background: rgb(240 244 255 / 0.7);
  animation: weather-snow linear infinite;
}

.weather__gust {
  position: absolute;
  left: -20vw;
  width: 18vw;
  height: 1px;
  background: linear-gradient(90deg, rgb(220 225 235 / 0), rgb(220 225 235 / 0.35), rgb(220 225 235 / 0));
  animation: weather-gust linear infinite;
}

.weather__hail {
  position: absolute;
  top: -5vh;
  width: 4px;
  height: 4px;
  border-radius: 1px;
  background: rgb(235 242 255 / 0.75);
  animation: weather-fall linear infinite;
}

.weather__flash {
  position: absolute;
  inset: 0;
  background: rgb(220 230 255);
  opacity: 0;
  animation: weather-flash 9s infinite;
}

/* Tab hidden: everything stands still (no work for nobody watching) */
.weather--paused,
.weather--paused * {
  animation-play-state: paused !important;
}

@keyframes weather-fall {
  to { transform: translate(-4vh, 115vh); }
}

@keyframes weather-snow {
  50% { transform: translate(3vw, 55vh); }
  to { transform: translate(-2vw, 110vh); }
}

@keyframes weather-gust {
  to { transform: translateX(140vw); }
}

@keyframes weather-drift {
  to { transform: translateX(180vw); }
}

@keyframes weather-pulse {
  to { opacity: 0.7; transform: scale(1.08); }
}

@keyframes weather-turn {
  to { rotate: 360deg; }
}

@keyframes weather-flash {
  0%, 90%, 93%, 95%, 100% { opacity: 0; }
  91%, 94% { opacity: 0.12; }
}

/* Reduced motion: only the calm parts (tint, glow, a still layer of clouds/fog) */
@media (prefers-reduced-motion: reduce) {
  .weather__drop,
  .weather__flake,
  .weather__hail,
  .weather__gust,
  .weather__flash {
    display: none;
  }

  .weather__glow,
  .weather__rays,
  .weather__cloud,
  .weather__fog {
    animation: none;
  }

  /* Spread over the sky instead of drifting in */
  .weather__cloud,
  .weather__fog {
    left: var(--still-left, 10vw);
  }
}
</style>
