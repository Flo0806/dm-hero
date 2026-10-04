<template>
  <!-- Nocturne's own night sky behind the dashboard: a crescent moon with a
       breathing halo, an aurora that slowly waves, twinkling stars in two depths
       and now and then a shooting star. Background only - never over the cards. -->
  <div class="nocturne-sky" :class="{ 'nocturne-sky--paused': hidden }" aria-hidden="true">
    <div class="nocturne-sky__aurora nocturne-sky__aurora--one" />
    <div class="nocturne-sky__aurora nocturne-sky__aurora--two" />

    <span
      v-for="star in stars"
      :key="star.i"
      class="nocturne-sky__star"
      :class="{ 'nocturne-sky__star--bright': star.bright }"
      :style="star.style"
    />

    <div class="nocturne-sky__moon">
      <div class="nocturne-sky__halo" />
      <div class="nocturne-sky__crescent" />
    </div>

    <span v-for="s in 3" :key="`s${s}`" class="nocturne-sky__shooting" :class="`nocturne-sky__shooting--${s}`" />
  </div>
</template>

<script setup lang="ts">
// Same spread on every render - no stars jumping around when the page re-renders
const spread = (i: number, salt: number) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453
  return x - Math.floor(x)
}

// Fewer stars on small screens; a hidden tab pauses everything (battery)
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

const stars = computed(() => Array.from({ length: small.value ? 45 : 90 }, (_, i) => {
  const bright = spread(i, 1) > 0.88
  const size = bright ? 2.5 + spread(i, 2) * 1.5 : 1 + spread(i, 2) * 1.2
  return {
    i,
    bright,
    style: {
      left: `${spread(i, 3) * 100}%`,
      // Denser towards the top, like a real night sky over a horizon
      top: `${Math.pow(spread(i, 4), 1.6) * 85}%`,
      width: `${size}px`,
      height: `${size}px`,
      animationDuration: `${3 + spread(i, 5) * 5}s`,
      animationDelay: `${-spread(i, 6) * 8}s`,
    },
  }
}))
</script>

<style scoped>
.nocturne-sky {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}

/* Aurora: soft ribbons of teal and violet, waving very slowly along the top */
.nocturne-sky__aurora {
  position: absolute;
  left: -10%;
  width: 120%;
  height: 38vh;
  border-radius: 50%;
  mix-blend-mode: screen;
  transform-origin: 50% 0;
}

.nocturne-sky__aurora--one {
  top: -14vh;
  background: radial-gradient(60% 55% at 35% 55%, rgb(94 234 212 / 0.16), rgb(94 234 212 / 0) 70%);
  animation: nocturne-aurora 26s ease-in-out infinite alternate;
}

.nocturne-sky__aurora--two {
  top: -8vh;
  background: radial-gradient(50% 45% at 68% 50%, rgb(167 139 250 / 0.13), rgb(167 139 250 / 0) 70%);
  animation: nocturne-aurora 34s ease-in-out -12s infinite alternate-reverse;
}

/* Stars: tiny points that breathe; the bright ones get a soft four-point glint */
.nocturne-sky__star {
  position: absolute;
  border-radius: 50%;
  background: rgb(232 236 250);
  opacity: 0.35;
  animation: nocturne-twinkle ease-in-out infinite alternate;
}

.nocturne-sky__star--bright {
  box-shadow: 0 0 6px 1px rgb(200 211 245 / 0.6);
}

.nocturne-sky__star--bright::before,
.nocturne-sky__star--bright::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 14px;
  height: 1px;
  background: linear-gradient(90deg, rgb(232 236 250 / 0), rgb(232 236 250 / 0.6), rgb(232 236 250 / 0));
  transform: translate(-50%, -50%);
}

.nocturne-sky__star--bright::after {
  transform: translate(-50%, -50%) rotate(90deg);
}

/* Crescent moon top right: a bright disc, half covered by a "night" disc */
.nocturne-sky__moon {
  position: absolute;
  top: 7vh;
  right: 8vw;
  width: 92px;
  height: 92px;
}

.nocturne-sky__halo {
  position: absolute;
  inset: -90px;
  border-radius: 50%;
  background: radial-gradient(circle, rgb(200 211 245 / 0.22), rgb(200 211 245 / 0.06) 40%, rgb(200 211 245 / 0) 70%);
  animation: nocturne-breathe 7s ease-in-out infinite alternate;
}

.nocturne-sky__crescent {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  /* The lit part is the shadow - the element itself stays sky-coloured */
  box-shadow: inset -18px 10px 0 0 rgb(236 240 255 / 0.92);
  transform: rotate(-20deg);
  filter: drop-shadow(0 0 10px rgb(200 211 245 / 0.55));
}

/* Shooting stars: long pauses, a quick silver streak, different places */
.nocturne-sky__shooting {
  position: absolute;
  width: 140px;
  height: 1.5px;
  background: linear-gradient(90deg, rgb(232 236 250 / 0), rgb(232 236 250 / 0.9));
  border-radius: 1px;
  opacity: 0;
  /* Head (bright end) leads: down to the right */
  transform: rotate(28deg);
  animation: nocturne-shoot 17s linear infinite;
}

.nocturne-sky__shooting--1 {
  top: 14vh;
  left: 18vw;
  animation-delay: 3s;
}

.nocturne-sky__shooting--2 {
  top: 26vh;
  left: 52vw;
  animation-duration: 23s;
  animation-delay: 11s;
}

.nocturne-sky__shooting--3 {
  top: 9vh;
  left: 70vw;
  animation-duration: 29s;
  animation-delay: 19s;
}

.nocturne-sky--paused,
.nocturne-sky--paused * {
  animation-play-state: paused !important;
}

@keyframes nocturne-aurora {
  from { transform: translateX(-4%) skewX(-6deg) scaleY(0.9); opacity: 0.7; }
  to { transform: translateX(5%) skewX(7deg) scaleY(1.15); opacity: 1; }
}

@keyframes nocturne-twinkle {
  from { opacity: 0.2; }
  to { opacity: 0.95; }
}

@keyframes nocturne-breathe {
  from { opacity: 0.7; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1.04); }
}

@keyframes nocturne-shoot {
  0% { opacity: 0; translate: 0 0; }
  1% { opacity: 1; }
  5% { opacity: 0; translate: 260px 140px; }
  100% { opacity: 0; translate: 260px 140px; }
}

/* Reduced motion: a still, calm sky - moon, aurora and stars without movement */
@media (prefers-reduced-motion: reduce) {
  .nocturne-sky__aurora,
  .nocturne-sky__star,
  .nocturne-sky__halo {
    animation: none;
  }

  .nocturne-sky__star {
    opacity: 0.6;
  }

  .nocturne-sky__shooting {
    display: none;
  }
}
</style>
