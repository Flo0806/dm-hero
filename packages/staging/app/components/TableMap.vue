<template>
  <!-- The map the DM shows: drag to pan, wheel / two fingers to zoom, fog on top -->
  <section ref="sectionRef" class="flex flex-col gap-3 bg-bg" :class="{ 'p-3 h-dvh': fullscreen }" :aria-label="$t('play.map.label', { name: map.name })">
    <div class="flex flex-wrap items-center gap-2">
      <h2 class="m-0 mr-auto text-lg font-bold truncate">
        {{ map.name }}
      </h2>
      <button type="button" class="btn-map" :aria-label="$t('play.map.zoomOut')" @click="zoomCenter(1 / 1.4)">
        −
      </button>
      <button type="button" class="btn-map" :aria-label="$t('play.map.zoomIn')" @click="zoomCenter(1.4)">
        +
      </button>
      <button type="button" class="btn-map px-3" @click="fit">
        {{ $t('play.map.fit') }}
      </button>
      <button v-if="canFullscreen" type="button" class="btn-map px-3" @click="toggleFullscreen">
        {{ fullscreen ? $t('play.map.exitFullscreen') : $t('play.map.fullscreen') }}
      </button>
    </div>

    <div
      ref="viewportRef"
      class="relative overflow-hidden rounded-xl border border-line bg-[#0b0d14] touch-none select-none cursor-grab active:cursor-grabbing focus-ring"
      :class="fullscreen ? 'flex-1' : 'h-[70dvh]'"
      tabindex="0"
      :aria-describedby="hintId"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @wheel.prevent="onWheel"
      @dblclick="onDoubleClick"
      @keydown="onKey"
      @contextmenu.prevent
    >
      <div
        class="absolute left-0 top-0 origin-top-left"
        :style="{ width: `${map.width}px`, height: `${map.height}px`, transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }"
      >
        <img v-if="src" :src="src" :width="map.width" :height="map.height" alt="" draggable="false" class="block size-full" />
        <!-- Fog: covered = dark, revealed strokes cut holes (soft edges) -->
        <svg class="absolute inset-0 size-full" :viewBox="`0 0 ${map.width} ${map.height}`" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <filter :id="`${uid}-soft`" x="-5%" y="-5%" width="110%" height="110%">
              <feGaussianBlur :stdDeviation="map.width * 0.004" />
            </filter>
            <mask :id="`${uid}-mask`" maskUnits="userSpaceOnUse" x="0" y="0" :width="map.width" :height="map.height">
              <g :filter="`url(#${uid}-soft)`">
                <rect x="0" y="0" :width="map.width" :height="map.height" :fill="fog.base === 'covered' ? 'white' : 'black'" />
                <path
                  v-for="(stroke, i) in fog.strokes"
                  :key="i"
                  :d="fogStrokePath(stroke, map.width, map.height)"
                  fill="none"
                  :stroke="stroke.mode === 'cover' ? 'white' : 'black'"
                  :stroke-width="stroke.radius * 2 * map.width / 100"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </g>
            </mask>
          </defs>
          <rect x="0" y="0" :width="map.width" :height="map.height" fill="#0b0d14" :mask="`url(#${uid}-mask)`" />
        </svg>
      </div>
      <!-- Pings: fixed size on screen, so they sit outside the zoomed layer -->
      <div
        v-for="item in visiblePings"
        :key="item.id"
        class="absolute pointer-events-none"
        :style="{ 'left': `${view.x + item.x / 100 * map.width * view.scale}px`, 'top': `${view.y + item.y / 100 * map.height * view.scale}px`, '--ping-color': pingColor(item.from) }"
        aria-hidden="true"
      >
        <span class="ping-ring" />
        <span class="ping-label" :class="{ 'ping-note': item.text }">{{ item.text ?? pingName(item) }}</span>
      </div>
      <p v-if="!src" role="status" class="absolute inset-x-0 bottom-4 m-0 text-center text-sm text-muted">
        {{ $t('play.map.loading') }}
      </p>
    </div>
    <p class="sr-only" aria-live="polite">
      {{ lastPing ? (lastPing.text ? $t('play.map.note', { name: pingName(lastPing), text: lastPing.text }) : $t('play.map.pinged', { name: pingName(lastPing) })) : '' }}
    </p>
    <p :id="hintId" class="m-0 text-xs text-muted">
      {{ $t('play.map.hint') }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { EMPTY_FOG, fogStrokePath, pingColor, type MapFog, type TableFogContent, type TableMapContent } from '@dm-hero/seal'

const props = defineProps<{ map: TableMapContent, fog: TableFogContent | null, pings: TablePing[] }>()
const emit = defineEmits<{ ping: [position: { x: number, y: number }] }>()
const { t } = useI18n()

const uid = useId()
const hintId = `${uid}-hint`
const src = useSharedImage(() => props.map.image)

// Fog of another (previous) map must never uncover this one
const fog = computed<MapFog>(() =>
  props.fog?.mapId === props.map.mapId ? props.fog.fog : EMPTY_FOG)

// ---------------------------------------------------------------------------
// Pings: long press anywhere on the map, everyone sees it pulse three times
// ---------------------------------------------------------------------------

const pingName = (ping: TablePing) => ping.from === 'dm' ? t('play.map.dm') : ping.name
const visiblePings = computed(() => props.pings.filter(p => p.mapId === props.map.mapId))
const lastPing = computed(() => visiblePings.value.at(-1) ?? null)

const LONG_PRESS_MS = 500
const LONG_PRESS_MOVE_PX = 8
let pressTimer: ReturnType<typeof setTimeout> | null = null
let pressStart: { x: number, y: number } | null = null

function cancelPress() {
  if (pressTimer) clearTimeout(pressTimer)
  pressTimer = null
  pressStart = null
}

function startPress(point: { x: number, y: number }) {
  cancelPress()
  pressStart = point
  pressTimer = setTimeout(() => {
    pressTimer = null
    const x = (point.x - view.x) / view.scale / props.map.width * 100
    const y = (point.y - view.y) / view.scale / props.map.height * 100
    pressStart = null
    if (x < 0 || x > 100 || y < 0 || y > 100) return
    navigator.vibrate?.(30)
    emit('ping', { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 })
  }, LONG_PRESS_MS)
}

// ---------------------------------------------------------------------------
// Pan + zoom (CSS transform, no library)
// ---------------------------------------------------------------------------

const viewportRef = ref<HTMLElement>()
const view = reactive({ x: 0, y: 0, scale: 1 })
let fitScale = 1
// Until the player zooms/pans, the map follows size changes (rotate phone, fullscreen)
let fitted = true

function fit() {
  const el = viewportRef.value
  if (!el) return
  fitScale = Math.min(el.clientWidth / props.map.width, el.clientHeight / props.map.height)
  view.scale = fitScale
  view.x = (el.clientWidth - props.map.width * fitScale) / 2
  view.y = (el.clientHeight - props.map.height * fitScale) / 2
  fitted = true
}

function zoomAt(factor: number, cx: number, cy: number) {
  const scale = Math.min(Math.max(view.scale * factor, fitScale * 0.5), Math.max(fitScale * 10, 2))
  view.x = cx - (cx - view.x) * (scale / view.scale)
  view.y = cy - (cy - view.y) * (scale / view.scale)
  view.scale = scale
  fitted = false
}

function zoomCenter(factor: number) {
  const el = viewportRef.value
  if (el) zoomAt(factor, el.clientWidth / 2, el.clientHeight / 2)
}

function local(event: { clientX: number, clientY: number }) {
  const rect = viewportRef.value!.getBoundingClientRect()
  return { x: event.clientX - rect.left, y: event.clientY - rect.top }
}

const pointers = new Map<number, { x: number, y: number }>()

function onPointerDown(event: PointerEvent) {
  viewportRef.value?.setPointerCapture(event.pointerId)
  pointers.set(event.pointerId, local(event))
  // One finger / mouse held still = ping, a second finger means pinch
  if (pointers.size === 1 && event.button === 0) startPress(local(event))
  else cancelPress()
}

function onPointerMove(event: PointerEvent) {
  const previous = pointers.get(event.pointerId)
  if (!previous) return
  const current = local(event)
  if (pressStart && Math.hypot(current.x - pressStart.x, current.y - pressStart.y) > LONG_PRESS_MOVE_PX) cancelPress()

  if (pointers.size === 1) {
    view.x += current.x - previous.x
    view.y += current.y - previous.y
    fitted = false
  }
  else if (pointers.size === 2) {
    // Pinch: zoom by the change of finger distance around their middle, pan with the middle
    const other = [...pointers.entries()].find(([id]) => id !== event.pointerId)![1]
    const before = Math.hypot(previous.x - other.x, previous.y - other.y)
    const after = Math.hypot(current.x - other.x, current.y - other.y)
    const mid = { x: (current.x + other.x) / 2, y: (current.y + other.y) / 2 }
    view.x += (current.x - previous.x) / 2
    view.y += (current.y - previous.y) / 2
    if (before > 0) zoomAt(after / before, mid.x, mid.y)
  }
  pointers.set(event.pointerId, current)
}

function onPointerUp(event: PointerEvent) {
  pointers.delete(event.pointerId)
  cancelPress()
}

function onWheel(event: WheelEvent) {
  const point = local(event)
  zoomAt(Math.exp(-event.deltaY * 0.0015), point.x, point.y)
}

function onDoubleClick(event: MouseEvent) {
  const point = local(event)
  zoomAt(2, point.x, point.y)
}

// Keyboard: arrows pan, +/- zoom, 0 shows the whole map
function onKey(event: KeyboardEvent) {
  const step = 60
  const actions: Record<string, () => void> = {
    'ArrowLeft': () => view.x += step,
    'ArrowRight': () => view.x -= step,
    'ArrowUp': () => view.y += step,
    'ArrowDown': () => view.y -= step,
    '+': () => zoomCenter(1.4),
    '=': () => zoomCenter(1.4),
    '-': () => zoomCenter(1 / 1.4),
    '0': fit,
  }
  const action = actions[event.key]
  if (!action) return
  event.preventDefault()
  action()
  if (event.key !== '0') fitted = false
}

// ---------------------------------------------------------------------------
// Fullscreen (phones: the map gets the whole screen)
// ---------------------------------------------------------------------------

const sectionRef = ref<HTMLElement>()
const fullscreen = ref(false)
const canFullscreen = ref(false)

function toggleFullscreen() {
  if (document.fullscreenElement) void document.exitFullscreen()
  else void sectionRef.value?.requestFullscreen()
}

function onFullscreenChange() {
  fullscreen.value = document.fullscreenElement === sectionRef.value
  // Layout changes after the switch
  requestAnimationFrame(() => fitted && fit())
}

let observer: ResizeObserver | null = null
onMounted(() => {
  canFullscreen.value = !!document.documentElement.requestFullscreen
  document.addEventListener('fullscreenchange', onFullscreenChange)
  observer = new ResizeObserver(() => fitted && fit())
  if (viewportRef.value) observer.observe(viewportRef.value)
  fit()
})
onBeforeUnmount(() => {
  cancelPress()
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  observer?.disconnect()
})

// Another map: start with the whole map in view
watch(() => props.map.mapId, () => nextTick(fit))
</script>

<style scoped>
/* Long press must not open the phone's image/text menu */
[tabindex] {
  -webkit-touch-callout: none;
}

.ping-ring {
  position: absolute;
  left: -30px;
  top: -30px;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  border: 4px solid var(--ping-color);
  box-shadow: 0 0 12px var(--ping-color);
  animation: ping-pulse 0.8s ease-out 3 forwards;
}

.ping-label {
  position: absolute;
  top: 34px;
  left: 0;
  transform: translateX(-50%);
  padding: 2px 8px;
  border-radius: 8px;
  background: rgb(0 0 0 / 0.75);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.ping-note {
  max-width: 16rem;
  padding: 6px 12px;
  white-space: normal;
  text-align: center;
  font-size: 14px;
  background: rgb(26 29 41 / 0.92);
  border: 1px solid var(--ping-color);
}

@keyframes ping-pulse {
  from { transform: scale(0.2); opacity: 1; }
  to { transform: scale(1.4); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .ping-ring {
    animation: none;
  }
}
</style>
