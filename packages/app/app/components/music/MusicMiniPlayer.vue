<template>
  <!-- Minimized: a single note button bottom-LEFT (next to the drawer) that brings
       the pill back. Bottom-right belongs to the pages' "+" FABs. -->
  <v-btn
    v-if="currentTrack && minimized"
    class="music-mini-fab"
    :class="{ 'music-mini-fab-playing': isPlaying }"
    :style="{ left: `${mainRect.left + 16}px` }"
    icon
    color="primary"
    variant="flat"
    size="small"
    :title="currentTrack.name"
    @click="setMinimized(false)"
  >
    <v-icon :icon="isPlaying ? 'mdi-music-note' : 'mdi-music-note-off'" />
  </v-btn>

  <!-- Floating mini player shown on every page except /music while a track is loaded.
       Draggable along the x axis (kept inside the main area – never over the drawer
       or the scrollbar); position, compact and minimized state are remembered. -->
  <div
    v-else-if="currentTrack"
    ref="pill"
    class="music-mini elevation-8"
    :class="{ 'music-mini-dragging': dragging, 'music-mini-compact': compact }"
    :style="{ left: `${left}px` }"
  >
    <div
      class="music-mini-handle d-flex align-center px-1"
      :title="$t('music.mini.drag')"
      @pointerdown="onDragStart"
    >
      <v-icon icon="mdi-drag-vertical" size="small" />
    </div>

    <v-progress-linear
      :model-value="duration ? (currentTime / duration) * 100 : 0"
      color="primary"
      height="2"
      class="music-mini-progress"
    />

    <div class="music-mini-body">
      <!-- Title row (above the controls, capped to the pill's own width) → queue popup -->
      <v-menu v-model="queueOpen" :close-on-content-click="false" location="top" offset="12">
        <template #activator="{ props: menuProps }">
          <button v-bind="menuProps" type="button" class="music-mini-title" :title="$t('music.mini.queue')">
            <v-icon :icon="isPlaying ? 'mdi-music-note' : 'mdi-music-note-off'" size="x-small" color="primary" class="mr-1 flex-shrink-0" />
            <span class="music-mini-text text-body-small font-weight-medium">{{ currentTrack.name }}</span>
            <span v-if="!compact" class="music-mini-sub text-body-small text-medium-emphasis">· {{ currentTrack.folderPath || library?.rootName }}</span>
            <v-icon icon="mdi-chevron-up" size="x-small" class="ml-1 flex-shrink-0 text-medium-emphasis" />
          </button>
        </template>
        <v-card min-width="320" max-width="420">
          <v-card-title class="d-flex align-center text-body-medium py-2">
            <v-icon icon="mdi-playlist-play" size="small" class="mr-2" />
            {{ scopeFolder ? scopeFolder.name : library?.rootName }}
            <v-spacer />
            <v-chip size="x-small" variant="tonal">{{ currentIndex + 1 }} / {{ queue.length }}</v-chip>
            <v-btn icon size="x-small" variant="text" class="ml-1" to="/music" :title="$t('music.mini.open')" @click="queueOpen = false">
              <v-icon icon="mdi-open-in-app" size="small" />
            </v-btn>
          </v-card-title>
          <v-divider />
          <v-list density="compact" class="music-mini-queue py-0">
            <v-list-item
              v-for="(track, index) in queue"
              :id="`music-queue-${index}`"
              :key="track.id"
              :title="track.name"
              :subtitle="track.folderPath !== currentTrack.folderPath ? track.folderPath : undefined"
              :active="index === currentIndex"
              color="primary"
              @click="playAt(index)"
            >
              <template #prepend>
                <v-icon
                  :icon="index === currentIndex ? (isPlaying ? 'mdi-volume-high' : 'mdi-pause') : index === currentIndex + 1 ? 'mdi-skip-next' : 'mdi-music-note-outline'"
                  size="small"
                />
              </template>
            </v-list-item>
          </v-list>
        </v-card>
      </v-menu>

      <div class="d-flex align-center">
        <v-btn v-if="!compact" icon size="small" variant="text" :title="$t('music.previous')" @click="prev">
          <v-icon icon="mdi-skip-previous" />
        </v-btn>
        <v-btn v-if="!compact" icon size="small" variant="text" :title="$t('music.back10')" @click="skip(-10)">
          <v-icon icon="mdi-rewind-10" size="small" />
        </v-btn>
        <v-btn icon size="small" color="primary" variant="flat" :title="isPlaying ? $t('music.pause') : $t('music.play')" @click="togglePlay">
          <v-icon :icon="isPlaying ? 'mdi-pause' : 'mdi-play'" />
        </v-btn>
        <v-btn v-if="!compact" icon size="small" variant="text" :title="$t('music.forward10')" @click="skip(10)">
          <v-icon icon="mdi-fast-forward-10" size="small" />
        </v-btn>
        <v-btn icon size="small" variant="text" :title="$t('music.next')" @click="next">
          <v-icon icon="mdi-skip-next" />
        </v-btn>

        <v-menu v-if="!compact" :close-on-content-click="false" location="top">
          <template #activator="{ props: menuProps }">
            <v-btn v-bind="menuProps" icon size="small" variant="text" :title="$t('music.volume')">
              <v-icon :icon="volume === 0 ? 'mdi-volume-off' : volume < 0.5 ? 'mdi-volume-medium' : 'mdi-volume-high'" size="small" />
            </v-btn>
          </template>
          <v-card class="pa-3" min-width="180">
            <v-slider :model-value="volume" :max="1" :step="0.01" color="primary" hide-details density="compact" @update:model-value="setVolume" />
          </v-card>
        </v-menu>

        <v-btn icon size="x-small" variant="text" :title="compact ? $t('music.mini.expand') : $t('music.mini.compact')" @click="toggleCompact">
          <v-icon :icon="compact ? 'mdi-arrow-expand-horizontal' : 'mdi-arrow-collapse-horizontal'" size="small" />
        </v-btn>
        <v-btn icon size="x-small" variant="text" :title="$t('music.mini.minimize')" @click="setMinimized(true)">
          <v-icon icon="mdi-chevron-double-down" size="small" />
        </v-btn>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useLayout } from 'vuetify'

const {
  library, scopeFolder, currentTrack, isPlaying, currentTime, duration, volume, queue, currentIndex,
  togglePlay, next, prev, skip, setVolume, playAt,
} = useMusicPlayer()
const { mainRect } = useLayout()

const POS_KEY = 'dm-hero:music:mini-x'
const COMPACT_KEY = 'dm-hero:music:mini-compact'
const MINIMIZED_KEY = 'dm-hero:music:mini-minimized'
const SCROLLBAR_GAP = 20 // keep clear of the content scrollbar on the right

const pill = ref<HTMLElement | null>(null)
const left = ref(0)
const dragging = ref(false)
const compact = ref(false)
const minimized = ref(false)
const queueOpen = ref(false)
let dragOffset = 0
let savedLeft: number | null = null

/** Keep the pill inside the main content area (right of the drawer, left of the scrollbar) */
function clampLeft(x: number): number {
  const width = pill.value?.offsetWidth ?? 420
  const min = mainRect.value.left + 8
  const max = window.innerWidth - mainRect.value.right - width - SCROLLBAR_GAP
  return Math.max(min, Math.min(x, max))
}

function reposition() {
  nextTick(() => {
    const width = pill.value?.offsetWidth ?? 420
    const fallback = mainRect.value.left + (window.innerWidth - mainRect.value.left - mainRect.value.right - width) / 2
    left.value = clampLeft(savedLeft ?? fallback)
  })
}

function onDragStart(e: PointerEvent) {
  if (!pill.value) return
  dragging.value = true
  dragOffset = e.clientX - pill.value.getBoundingClientRect().left
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', onDragEnd, { once: true })
  e.preventDefault()
}

function onDragMove(e: PointerEvent) {
  left.value = clampLeft(e.clientX - dragOffset)
}

function onDragEnd() {
  dragging.value = false
  window.removeEventListener('pointermove', onDragMove)
  savedLeft = left.value
  try {
    localStorage.setItem(POS_KEY, String(left.value))
  }
  catch {
    // non-critical
  }
}

function setMinimized(value: boolean) {
  minimized.value = value
  try {
    localStorage.setItem(MINIMIZED_KEY, value ? '1' : '0')
  }
  catch {
    // non-critical
  }
  if (!value) reposition()
}

function toggleCompact() {
  compact.value = !compact.value
  try {
    localStorage.setItem(COMPACT_KEY, compact.value ? '1' : '0')
  }
  catch {
    // non-critical
  }
  reposition()
}

// Scroll the current track into view when the queue opens
watch(queueOpen, (open) => {
  if (!open) return
  nextTick(() => {
    document.getElementById(`music-queue-${currentIndex.value}`)?.scrollIntoView({ block: 'center' })
  })
})

// Drawer opened/closed or window resized → stay inside the main area
watch(() => [mainRect.value.left, mainRect.value.right], () => reposition())
function onResize() {
  reposition()
}

onMounted(() => {
  try {
    const raw = localStorage.getItem(POS_KEY)
    savedLeft = raw !== null ? Number(raw) : null
    compact.value = localStorage.getItem(COMPACT_KEY) === '1'
    minimized.value = localStorage.getItem(MINIMIZED_KEY) === '1'
  }
  catch {
    // ignore
  }
  reposition()
  window.addEventListener('resize', onResize)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  window.removeEventListener('pointermove', onDragMove)
})
</script>

<style scoped>
.music-mini-fab {
  position: fixed;
  bottom: 16px;
  z-index: 1005;
}
.music-mini-fab-playing .v-icon {
  animation: music-fab-bounce 1.2s ease-in-out infinite;
}
@keyframes music-fab-bounce {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-3px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .music-mini-fab-playing .v-icon {
    animation: none;
  }
}
.music-mini {
  position: fixed;
  bottom: 16px;
  z-index: 1005;
  display: flex;
  align-items: stretch;
  gap: 2px;
  padding: 3px 6px 5px 0;
  border-radius: 20px;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  overflow: hidden;
  max-width: calc(100vw - 16px);
}
.music-mini-dragging {
  user-select: none;
  cursor: grabbing;
}
.music-mini-handle {
  cursor: grab;
  align-self: stretch;
  color: rgba(var(--v-theme-on-surface), 0.5);
  touch-action: none;
}
.music-mini-progress {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
}
/* Column: title row on top, controls below. The controls define the width,
   the title is capped to exactly that width (long names get an ellipsis). */
.music-mini-body {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.music-mini-title {
  display: flex;
  align-items: center;
  /* width:0 + min-width:100% → the title never contributes to the pill's
     intrinsic width, it only fills what the controls row defines */
  width: 0;
  min-width: 100%;
  overflow: hidden;
  padding: 5px 8px 3px;
  margin-bottom: 2px;
  border-radius: 10px;
  color: rgb(var(--v-theme-on-surface));
  background: none;
  border: none;
  cursor: pointer;
  font: inherit;
  text-align: left;
  line-height: 1.3;
}
.music-mini-title:hover {
  background: rgba(var(--v-theme-on-surface), 0.06);
}
.music-mini-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.music-mini-sub {
  flex-shrink: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-left: 4px;
}

.music-mini-queue {
  max-height: 50vh;
  overflow-y: auto;
}
</style>
