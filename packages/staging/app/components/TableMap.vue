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
      <p v-if="!src" role="status" class="absolute inset-x-0 bottom-4 m-0 text-center text-sm text-muted">
        {{ $t('play.map.loading') }}
      </p>
    </div>
    <p :id="hintId" class="m-0 text-xs text-muted">
      {{ $t('play.map.hint') }}
    </p>
  </section>
</template>

<script setup lang="ts">
const props = defineProps<{ map: TableMapContent, fog: TableFogContent | null }>()

const uid = useId()
const hintId = `${uid}-hint`
const src = useSharedImage(() => props.map.image)

// Fog of another (previous) map must never uncover this one
const fog = computed<MapFog>(() =>
  props.fog?.mapId === props.map.mapId ? props.fog.fog : { base: 'covered', strokes: [] })

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
}

function onPointerMove(event: PointerEvent) {
  const previous = pointers.get(event.pointerId)
  if (!previous) return
  const current = local(event)

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
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  observer?.disconnect()
})

// Another map: start with the whole map in view
watch(() => props.map.mapId, () => nextTick(fit))
</script>
