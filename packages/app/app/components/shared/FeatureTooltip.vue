<template>
  <div ref="wrapper" class="feature-bubble-wrapper" @click.capture="onWrapperClick">
    <slot />

    <ClientOnly>
      <Teleport to="body">
        <Transition name="bubble-fade">
          <div
            v-if="shouldShow && anchor"
            ref="bubbleEl"
            class="feature-bubble"
            :class="`feature-bubble--${effectiveLocation}`"
            :style="bubbleStyle"
            role="status"
            @click.stop="onBubbleClick"
          >
            <div class="feature-bubble__arrow" :style="arrowStyle" />
            <div class="feature-bubble__header">
              <i class="mdi mdi-sparkles feature-bubble__icon" aria-hidden="true" />
              <span class="feature-bubble__title">
                {{ $t('featureTooltips.newBadge') }}
              </span>
            </div>
            <div class="feature-bubble__text">
              {{ text }}
            </div>
            <v-checkbox
              v-model="dontShowAgain"
              :label="$t('featureTooltips.dontShowAgain')"
              density="compact"
              hide-details
              color="on-primary"
              class="feature-bubble__checkbox"
              @click.stop
            />
          </div>
        </Transition>
      </Teleport>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import type { CSSProperties } from 'vue'
import { useFeatureTooltip } from '~/composables/useFeatureTooltips'

type Location = 'top' | 'bottom' | 'start' | 'end'

const props = withDefaults(defineProps<{
  featureKey: string
  text: string
  /** Preferred side; will flip automatically if there's no room. */
  location?: Location
}>(), {
  location: 'end',
})

const { shouldShow, dismissForSession, dismissPermanent } = useFeatureTooltip(props.featureKey)

const wrapper = ref<HTMLElement | null>(null)
const bubbleEl = ref<HTMLElement | null>(null)

const dontShowAgain = ref(false)
const anchor = ref<DOMRect | null>(null)
const bubbleSize = ref<{ w: number, h: number }>({ w: 0, h: 0 })
const effectiveLocation = ref<Location>(props.location)

const GAP = 14
const VIEWPORT_MARGIN = 12 // keep bubble at least this far from edges

/** Side preference may flip when there's no room. */
function pickEffectiveLocation(rect: DOMRect, bw: number, bh: number): Location {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const preferred = props.location

  // Fits in preferred direction?
  const fits = {
    end: rect.right + GAP + bw <= vw - VIEWPORT_MARGIN,
    start: rect.left - GAP - bw >= VIEWPORT_MARGIN,
    bottom: rect.bottom + GAP + bh <= vh - VIEWPORT_MARGIN,
    top: rect.top - GAP - bh >= VIEWPORT_MARGIN,
  }
  if (fits[preferred]) return preferred

  // Try opposite axis first, then the orthogonal sides.
  const order: Record<Location, Location[]> = {
    end: ['start', 'bottom', 'top'],
    start: ['end', 'bottom', 'top'],
    bottom: ['top', 'end', 'start'],
    top: ['bottom', 'end', 'start'],
  }
  for (const candidate of order[preferred]) {
    if (fits[candidate]) return candidate
  }
  return preferred
}

const bubbleStyle = computed<CSSProperties>(() => {
  const rect = anchor.value
  if (!rect) return {}
  const { w: bw, h: bh } = bubbleSize.value
  const vw = window.innerWidth
  const vh = window.innerHeight

  const loc = effectiveLocation.value
  let top: number
  let left: number

  if (loc === 'end' || loc === 'start') {
    const idealTop = rect.top + rect.height / 2 - bh / 2
    top = clamp(idealTop, VIEWPORT_MARGIN, vh - bh - VIEWPORT_MARGIN)
    left = loc === 'end' ? rect.right + GAP : rect.left - GAP - bw
  }
  else {
    const idealLeft = rect.left + rect.width / 2 - bw / 2
    left = clamp(idealLeft, VIEWPORT_MARGIN, vw - bw - VIEWPORT_MARGIN)
    top = loc === 'bottom' ? rect.bottom + GAP : rect.top - GAP - bh
  }
  return { top: `${top}px`, left: `${left}px` }
})

const arrowStyle = computed<CSSProperties>(() => {
  const rect = anchor.value
  if (!rect) return {}
  const styleObj = bubbleStyle.value
  const bubbleTop = parseFloat(String(styleObj.top ?? '0'))
  const bubbleLeft = parseFloat(String(styleObj.left ?? '0'))

  const loc = effectiveLocation.value
  if (loc === 'end' || loc === 'start') {
    // Pin arrow vertically at anchor center
    const arrowTop = rect.top + rect.height / 2 - bubbleTop
    return { top: `${arrowTop}px` }
  }
  // top/bottom — pin horizontally at anchor center
  const arrowLeft = rect.left + rect.width / 2 - bubbleLeft
  return { left: `${arrowLeft}px` }
})

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function measure() {
  if (!wrapper.value) return
  // Anchor on the first child (= the wrapped target), so the arrow points at it.
  const el = (wrapper.value.firstElementChild as HTMLElement) ?? wrapper.value
  const rect = el.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) {
    anchor.value = null
    return
  }
  anchor.value = rect

  // Measure bubble size if mounted, then pick best side.
  nextTick(() => {
    if (bubbleEl.value) {
      const br = bubbleEl.value.getBoundingClientRect()
      bubbleSize.value = { w: br.width, h: br.height }
    }
    effectiveLocation.value = pickEffectiveLocation(
      rect,
      bubbleSize.value.w || 260,
      bubbleSize.value.h || 140,
    )
  })
}

/** rAF-throttled measure so we don't getBoundingClientRect on every scroll pixel */
let rafId: number | null = null
function scheduleMeasure() {
  if (rafId !== null) return
  rafId = requestAnimationFrame(() => {
    rafId = null
    measure()
  })
}

function close() {
  if (dontShowAgain.value) dismissPermanent()
  else dismissForSession()
}

function onBubbleClick() {
  close()
}

function onWrapperClick(e: MouseEvent) {
  if (!shouldShow.value || !wrapper.value) return
  const target = e.target as HTMLElement | null
  if (target && wrapper.value.contains(target)) close()
}

onMounted(() => {
  nextTick(measure)
  window.addEventListener('resize', scheduleMeasure)
  window.addEventListener('scroll', scheduleMeasure, true)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', scheduleMeasure)
  window.removeEventListener('scroll', scheduleMeasure, true)
  if (rafId !== null) cancelAnimationFrame(rafId)
})
watch(shouldShow, (v) => {
  if (v) nextTick(measure)
})
</script>

<script lang="ts">
export default { name: 'FeatureTooltip' }
</script>

<style scoped>
.feature-bubble-wrapper {
  position: relative;
}
</style>

<!-- Global because the bubble is teleported to <body> and would lose scoped styles -->
<style>
.feature-bubble {
  position: fixed;
  z-index: 2400;
  min-width: 240px;
  max-width: 320px;
  padding: 12px 14px;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  border-radius: 10px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.3);
  cursor: pointer;
  user-select: none;
  font-family: inherit;
}

.feature-bubble__arrow {
  position: absolute;
  width: 12px;
  height: 12px;
  background: rgb(var(--v-theme-primary));
}

/* arrow sits on the side facing the anchor */
.feature-bubble--end .feature-bubble__arrow {
  inset-inline-start: -6px;
  transform: translateY(-50%) rotate(45deg);
}
.feature-bubble--start .feature-bubble__arrow {
  inset-inline-end: -6px;
  transform: translateY(-50%) rotate(45deg);
}
.feature-bubble--bottom .feature-bubble__arrow {
  top: -6px;
  transform: translateX(-50%) rotate(45deg);
}
.feature-bubble--top .feature-bubble__arrow {
  bottom: -6px;
  transform: translateX(-50%) rotate(45deg);
}

.feature-bubble__header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}
.feature-bubble__icon {
  font-size: 18px;
  line-height: 1;
}
.feature-bubble__title {
  font-weight: 700;
  font-size: 0.875rem;
  letter-spacing: 0.02em;
}
.feature-bubble__text {
  font-size: 0.85rem;
  line-height: 1.4;
  margin-bottom: 8px;
}
.feature-bubble__checkbox .v-label {
  font-size: 0.75rem;
  opacity: 0.9;
  color: rgb(var(--v-theme-on-primary));
}

.bubble-fade-enter-active,
.bubble-fade-leave-active {
  transition: opacity 0.2s ease;
}
.bubble-fade-enter-from,
.bubble-fade-leave-to {
  opacity: 0;
}
</style>
