<script setup lang="ts">
/**
 * One-shot cinematic intro: a sword (from the left) and an axe (from the right)
 * fly into the center, CLASH with a flash + a burst of sparks, then settle and
 * fade. Plays once on load, sits behind the hero content, and is skipped when
 * the visitor prefers reduced motion.
 *
 * Drop /sword.png and /axe.png (transparent) into public/. The flash + sparks
 * play even if the images are missing.
 */
const playing = ref(false)
const showSword = ref(true)
const showAxe = ref(true)

interface Spark { id: number, style: Record<string, string> }
const sparks = ref<Spark[]>([])

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// Start a beat AFTER the hero copy begins to appear, so the clash feels like a
// deliberate flourish rather than firing instantly on load.
const START_DELAY_MS = 900
// Full on-screen lifetime of the clash (fly-in → impact → hold → fade).
const SEQUENCE_MS = 4600

onMounted(() => {
  if (prefersReducedMotion()) return

  // Spark burst — a big, dramatic shower; each shard flies out at a random
  // angle/distance from the impact point and lingers a moment.
  sparks.value = Array.from({ length: 48 }, (_, id) => {
    const angle = Math.random() * Math.PI * 2
    const dist = 120 + Math.random() * 360
    return {
      id,
      style: {
        '--tx': `${Math.cos(angle) * dist}px`,
        '--ty': `${Math.sin(angle) * dist}px`,
        '--sz': `${2 + Math.random() * 4}px`,
        '--dur': `${0.7 + Math.random() * 0.8}s`,
        '--delay': `${Math.random() * 0.12}s`,
      },
    }
  })

  setTimeout(() => {
    playing.value = true
    // Remove from the DOM once the whole sequence has finished.
    setTimeout(() => (playing.value = false), SEQUENCE_MS + 200)
  }, START_DELAY_MS)
})
</script>

<template>
  <div v-if="playing" class="clash" aria-hidden="true">
    <img
      v-if="showSword"
      src="/sword.png"
      alt=""
      class="weapon weapon--sword"
      @error="showSword = false"
    />
    <img
      v-if="showAxe"
      src="/axe.png"
      alt=""
      class="weapon weapon--axe"
      @error="showAxe = false"
    />

    <div class="impact-flash" />
    <div class="impact-ring" />

    <div class="sparks">
      <span v-for="s in sparks" :key="s.id" class="spark" :style="s.style" />
    </div>
  </div>
</template>

<style scoped>
.clash {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
  /* Impact point lives at the horizontal center, a touch above the middle so
     it reads behind the headline. Children animate relative to this. */
}

/* --- weapons --- */
.weapon {
  position: absolute;
  top: 18%;
  left: 50%;
  height: clamp(150px, 24vw, 340px);
  width: auto;
  transform-origin: center;
  filter: drop-shadow(0 10px 30px rgba(0, 0, 0, 0.55));
  opacity: 0;
}

.weapon--sword {
  /* enters from the left, tip pointing right toward center */
  animation: swordIn 4.6s cubic-bezier(0.2, 0.85, 0.2, 1) forwards;
}

.weapon--axe {
  animation: axeIn 4.6s cubic-bezier(0.2, 0.85, 0.2, 1) forwards;
}

/* Timeline: fly in → IMPACT (~19% ≈ 0.85s) → small recoil → long HOLD locked
   together → fade out. */
@keyframes swordIn {
  0% { opacity: 0; transform: translate(-170%, -50%) rotate(-18deg); }
  12% { opacity: 1; }
  19% { transform: translate(-72%, -50%) rotate(-6deg); } /* impact */
  22% { transform: translate(-82%, -50%) rotate(-11deg); } /* recoil */
  27% { transform: translate(-74%, -50%) rotate(-7deg); } /* settle */
  80% { opacity: 1; transform: translate(-74%, -50%) rotate(-7deg); } /* hold */
  100% { opacity: 0; transform: translate(-74%, -50%) rotate(-7deg); }
}

@keyframes axeIn {
  0% { opacity: 0; transform: translate(70%, -50%) rotate(18deg); }
  12% { opacity: 1; }
  19% { transform: translate(-28%, -50%) rotate(6deg); } /* impact */
  22% { transform: translate(-18%, -50%) rotate(11deg); } /* recoil */
  27% { transform: translate(-26%, -50%) rotate(7deg); } /* settle */
  80% { opacity: 1; transform: translate(-26%, -50%) rotate(7deg); } /* hold */
  100% { opacity: 0; transform: translate(-26%, -50%) rotate(7deg); }
}

/* --- impact flash + shockwave ring (fire at the clash moment) --- */
.impact-flash {
  position: absolute;
  top: 18%;
  left: 50%;
  width: 460px;
  height: 460px;
  margin: -230px 0 0 -230px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.98) 0%, rgba(255, 220, 150, 0.65) 22%, transparent 62%);
  opacity: 0;
  animation: flash 4.6s ease-out forwards;
}

/* impact at ~19% (≈0.87s into the 4.6s timeline) */
@keyframes flash {
  0%, 16% { opacity: 0; transform: scale(0.15); }
  19% { opacity: 1; transform: scale(1); }
  32% { opacity: 0; transform: scale(1.7); }
  100% { opacity: 0; }
}

.impact-ring {
  position: absolute;
  top: 18%;
  left: 50%;
  width: 44px;
  height: 44px;
  margin: -22px 0 0 -22px;
  border-radius: 50%;
  border: 3px solid rgba(255, 215, 130, 0.85);
  opacity: 0;
  animation: ring 4.6s ease-out forwards;
}

@keyframes ring {
  0%, 17% { opacity: 0; transform: scale(0.2); }
  19% { opacity: 0.95; }
  42% { opacity: 0; transform: scale(9); }
  100% { opacity: 0; }
}

/* --- spark shower --- */
.sparks {
  position: absolute;
  top: 18%;
  left: 50%;
}

.spark {
  position: absolute;
  width: var(--sz);
  height: var(--sz);
  border-radius: 50%;
  background: #ffe08a;
  box-shadow: 0 0 6px 1px rgba(255, 200, 90, 0.9);
  opacity: 0;
  /* delayed so the burst happens at the clash moment (~0.87s into the timeline) */
  animation: spark var(--dur) ease-out forwards;
  animation-delay: calc(0.85s + var(--delay));
}

@keyframes spark {
  0% { opacity: 1; transform: translate(0, 0) scale(1); }
  100% { opacity: 0; transform: translate(var(--tx), var(--ty)) scale(0.3); }
}

/* On phones the hero content stacks tall, so the logo sits much higher — raise
   the clash to meet it, and scale the flash down for the small viewport. */
@media (max-width: 600px) {
  .weapon,
  .impact-flash,
  .impact-ring,
  .sparks {
    top: 9%;
  }

  .weapon {
    height: clamp(110px, 30vw, 180px);
  }

  .impact-flash {
    width: 300px;
    height: 300px;
    margin: -150px 0 0 -150px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .clash { display: none; }
}
</style>
