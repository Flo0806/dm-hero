<template>
  <!-- All wrapped — strike state drives both the flash overlay and the bolt SVG -->
  <div v-if="active" class="emily-strike" aria-hidden="true" :style="strikeStyle">
    <!-- Atmospheric flash: a directional radial gradient from where the bolt
         touched down. Multi-stage opacity is animated via keyframes so we get
         pre-flash → peak → aftershocks → fade. -->
    <div class="emily-strike__flash" />

    <!-- Procedural bolt — a zig-zag path with one optional side branch,
         freshly generated for every strike so no two ever look the same. -->
    <svg
      class="emily-strike__bolt"
      :viewBox="`0 0 ${vw} ${vh}`"
      preserveAspectRatio="none"
    >
      <defs>
        <filter :id="filterId" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <!-- Outer glow stroke -->
      <path
        :d="boltPath"
        stroke="rgba(232, 250, 255, 0.35)"
        stroke-width="6"
        fill="none"
        stroke-linecap="round"
        stroke-linejoin="round"
        :filter="`url(#${filterId})`"
      />
      <!-- Branch (if any) — slightly thinner -->
      <path
        v-if="branchPath"
        :d="branchPath"
        stroke="rgba(232, 250, 255, 0.25)"
        stroke-width="3"
        fill="none"
        stroke-linecap="round"
        stroke-linejoin="round"
        :filter="`url(#${filterId})`"
      />
      <!-- Inner bright core -->
      <path
        :d="boltPath"
        stroke="rgba(255, 255, 255, 0.95)"
        stroke-width="1.6"
        fill="none"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </div>
</template>

<script setup lang="ts">
/**
 * Emily theme's centerpiece easter egg: distant lightning.
 *
 * Each strike has its own personality:
 *  - randomly placed origin near the top of the viewport
 *  - procedural zig-zag bolt path (never repeats) with an optional side branch
 *  - directional flash that brightens the whole scene from the bolt's side
 *  - multi-stroke flicker (real lightning rarely is a single pulse)
 *  - random screen rotation/offset per strike, never aligned with the last
 *
 * Gates on: theme === 'emily', prefers-reduced-motion off, animations toggle on.
 * Self-cleans on unmount and on theme change mid-strike.
 */
import { useThemePreference } from '~/composables/useThemePreference'

// Dashboard-only deployment: shorter cadence (4–15 s) because the user is
// idling there and the strikes are part of the ambience. On work pages this
// component is simply not mounted, so list/edit screens stay focused.
const MIN_INTERVAL_MS = 4_000
const MAX_INTERVAL_MS = 15_000
const STRIKE_DURATION_MS = 900 // matches CSS keyframe length

const ANIMATIONS_DISABLED_KEY = 'dm-hero-folder-animations-disabled'

const { current } = useThemePreference()

const active = ref(false)
const boltPath = ref('')
const branchPath = ref<string | null>(null)
const vw = ref(1920)
const vh = ref(1080)
const animationsEnabled = ref(true)
// Each strike rotates the flash origin slightly so a sequence feels alive.
const strikeStyle = ref<Record<string, string>>({})
const filterId = ref('emily-bolt-glow-0')

let intervalTimer: ReturnType<typeof setTimeout> | null = null
let endTimer: ReturnType<typeof setTimeout> | null = null
let strikeCounter = 0

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function pickInterval(): number {
  return MIN_INTERVAL_MS + Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS)
}

function hydrateAnimationToggle() {
  if (typeof localStorage === 'undefined') return
  try {
    animationsEnabled.value = localStorage.getItem(ANIMATIONS_DISABLED_KEY) !== '1'
  }
  catch {
    // ignore quota / privacy errors
  }
}

/**
 * Generate a single jagged bolt path. We work in viewport-unit coordinates so
 * the bolt scales naturally with the SVG's viewBox.
 */
function generateBolt(originX: number, height: number): string {
  const segments = 7 + Math.floor(Math.random() * 5)
  // Pulls the bolt toward the center so it doesn't always disappear sideways.
  const targetX = vw.value * (0.3 + Math.random() * 0.4)
  let x = originX
  let y = 0
  let path = `M ${x.toFixed(0)} 0`
  for (let i = 1; i <= segments; i++) {
    const ratio = i / segments
    const expectedX = originX + (targetX - originX) * ratio
    const jitter = (Math.random() - 0.5) * 80
    x = expectedX + jitter
    y = (height * ratio) * (0.85 + Math.random() * 0.3)
    path += ` L ${x.toFixed(0)} ${y.toFixed(0)}`
  }
  return path
}

/**
 * Optional side-branch — sprouts from a random mid-point of the main bolt and
 * runs off at an angle. Only happens half the time, so strikes look varied.
 */
function generateBranch(mainBolt: string): string | null {
  if (Math.random() > 0.5) return null
  const points = mainBolt
    .split(/[ML]\s*/)
    .filter(Boolean)
    .map((s) => {
      const [x, y] = s.trim().split(/\s+/).map(Number)
      return { x: x ?? 0, y: y ?? 0 }
    })
  if (points.length < 3) return null
  const sproutIdx = 1 + Math.floor(Math.random() * (points.length - 2))
  const sprout = points[sproutIdx]!
  const branchSegments = 3 + Math.floor(Math.random() * 3)
  // Random sideways drift for the branch direction
  const direction = Math.random() < 0.5 ? -1 : 1
  let x = sprout.x
  let y = sprout.y
  let path = `M ${x.toFixed(0)} ${y.toFixed(0)}`
  for (let i = 1; i <= branchSegments; i++) {
    x += direction * (40 + Math.random() * 60)
    y += 40 + Math.random() * 80
    path += ` L ${x.toFixed(0)} ${y.toFixed(0)}`
  }
  return path
}

function triggerStrike() {
  if (current.value !== 'emily') return scheduleNext()
  if (!animationsEnabled.value) return scheduleNext()
  if (prefersReducedMotion()) return scheduleNext()
  if (active.value) return scheduleNext()

  // Refresh viewport size each strike (handles resize).
  vw.value = window.innerWidth
  vh.value = window.innerHeight

  // Origin: anywhere across the top of the viewport.
  const originX = vw.value * (0.15 + Math.random() * 0.7)
  const main = generateBolt(originX, vh.value * 0.55)
  boltPath.value = main
  branchPath.value = generateBranch(main)

  // Bias the flash gradient toward the bolt's side so the room "lights from
  // that direction" rather than uniformly.
  const flashFromLeft = originX < vw.value / 2
  strikeStyle.value = {
    '--emily-flash-from': `${(originX / vw.value) * 100}%`,
    '--emily-flash-bias': flashFromLeft ? '0%' : '100%',
  }
  // Unique filter id per strike so React/Vue's diffing definitely re-creates it.
  strikeCounter++
  filterId.value = `emily-bolt-glow-${strikeCounter}`

  active.value = true
  if (endTimer) clearTimeout(endTimer)
  endTimer = setTimeout(() => {
    active.value = false
    scheduleNext()
  }, STRIKE_DURATION_MS)
}

function scheduleNext() {
  if (intervalTimer) clearTimeout(intervalTimer)
  intervalTimer = setTimeout(triggerStrike, pickInterval())
}

onMounted(() => {
  if (!import.meta.client) return
  hydrateAnimationToggle()
  vw.value = window.innerWidth
  vh.value = window.innerHeight
  scheduleNext()
})

onBeforeUnmount(() => {
  if (intervalTimer) {
    clearTimeout(intervalTimer)
    intervalTimer = null
  }
  if (endTimer) {
    clearTimeout(endTimer)
    endTimer = null
  }
})

watch(current, (next) => {
  if (next !== 'emily' && active.value) active.value = false
})
</script>

<style scoped>
.emily-strike {
  position: fixed;
  inset: 0;
  pointer-events: none;
  /* Background-layer only: must never paint over cards or main content. The
     cards' own background-color + document-flow stacking cover this. The flash
     uses mix-blend-mode: screen so it brightens the lagoon between cards
     without bleeding through their opaque surfaces. */
  z-index: 0;
  overflow: hidden;
}

.emily-strike__flash {
  position: absolute;
  inset: 0;
  /* Directional radial — `--emily-flash-from` is the X of the bolt origin */
  background: radial-gradient(
    ellipse 100% 70% at var(--emily-flash-from, 50%) 0%,
    rgba(232, 250, 255, 0.55) 0%,
    rgba(232, 250, 255, 0.15) 40%,
    rgba(232, 250, 255, 0) 80%
  );
  opacity: 0;
  animation: emily-flash 900ms ease-out forwards;
  mix-blend-mode: screen;
}

.emily-strike__bolt {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  animation: emily-bolt 900ms ease-out forwards;
}

/* Multi-stroke flash — real lightning isn't a single pulse. The bolt fades
   faster than the lingering glow so the brain reads "bright snap" then
   "afterglow on the clouds". */
@keyframes emily-flash {
  0%   { opacity: 0; }
  4%   { opacity: 0.15; }   /* pre-flash */
  8%   { opacity: 0.02; }
  12%  { opacity: 0.95; }   /* main strike */
  20%  { opacity: 0.35; }
  26%  { opacity: 0.75; }   /* secondary stroke */
  34%  { opacity: 0.25; }
  42%  { opacity: 0.55; }   /* tail flicker */
  60%  { opacity: 0.15; }
  100% { opacity: 0; }
}

@keyframes emily-bolt {
  0%   { opacity: 0; }
  10%  { opacity: 1; }
  18%  { opacity: 0.1; }
  24%  { opacity: 0.8; }
  32%  { opacity: 0; }
  100% { opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .emily-strike { display: none !important; }
}
</style>
