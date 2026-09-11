<template>
  <v-footer v-if="currentTrack && route.path === '/music'" app class="music-player-bar px-4 py-2" height="72">
    <!-- Now playing -->
    <div class="d-flex align-center music-now" style="min-width: 0; flex: 1 1 0">
      <v-avatar color="primary" size="40" class="mr-3 flex-shrink-0" :class="{ 'music-spin': isPlaying }">
        <v-icon icon="mdi-music" color="on-primary" />
      </v-avatar>
      <div class="music-bar-title">
        <div class="text-body-medium font-weight-medium text-truncate">{{ currentTrack.name }}</div>
        <div class="text-body-small text-medium-emphasis text-truncate">{{ currentTrack.folderPath || library?.rootName }}</div>
      </div>
    </div>

    <!-- Transport + seek -->
    <div class="d-flex flex-column align-center music-center" style="flex: 2 1 0; min-width: 0">
      <div class="d-flex align-center ga-1">
        <v-btn icon size="small" variant="text" :color="random ? 'primary' : undefined" :title="$t('music.shuffle')" @click="toggleRandom">
          <v-icon icon="mdi-shuffle-variant" />
        </v-btn>
        <v-btn icon size="small" variant="text" :title="$t('music.previous')" @click="prev">
          <v-icon icon="mdi-skip-previous" />
        </v-btn>
        <v-btn icon size="small" variant="text" :title="$t('music.back10')" @click="skip(-10)">
          <v-icon icon="mdi-rewind-10" />
        </v-btn>
        <v-btn icon color="primary" variant="flat" :title="isPlaying ? $t('music.pause') : $t('music.play')" @click="togglePlay">
          <v-icon :icon="isPlaying ? 'mdi-pause' : 'mdi-play'" />
        </v-btn>
        <v-btn icon size="small" variant="text" :title="$t('music.forward10')" @click="skip(10)">
          <v-icon icon="mdi-fast-forward-10" />
        </v-btn>
        <v-btn icon size="small" variant="text" :title="$t('music.next')" @click="next">
          <v-icon icon="mdi-skip-next" />
        </v-btn>
        <v-btn icon size="small" variant="text" :color="loopMode !== 'all' ? 'primary' : undefined" :title="$t(`music.loop.${loopMode}`)" @click="cycleLoop">
          <v-icon :icon="loopIcon" />
        </v-btn>
      </div>
      <div class="d-flex align-center ga-2 w-100">
        <span class="text-body-small text-medium-emphasis music-time">{{ fmt(currentTime) }}</span>
        <v-slider
          :model-value="currentTime"
          :aria-label="$t('music.seek')"
          :max="duration || 0"
          :step="0.1"
          :disabled="!duration"
          color="primary"
          hide-details
          density="compact"
          class="flex-grow-1"
          @update:model-value="seek"
        />
        <span class="text-body-small text-medium-emphasis music-time">{{ fmt(duration) }}</span>
      </div>
    </div>

    <!-- Volume + link to page -->
    <div class="d-flex align-center ga-1 music-right" style="flex: 1 1 0; justify-content: flex-end">
      <v-btn icon size="small" variant="text" :title="$t('music.mute')" @click="toggleMute">
        <v-icon :icon="volume === 0 ? 'mdi-volume-off' : volume < 0.5 ? 'mdi-volume-medium' : 'mdi-volume-high'" />
      </v-btn>
      <v-slider
        :model-value="volume"
        :aria-label="$t('music.volume')"
        :max="1"
        :step="0.01"
        color="primary"
        hide-details
        density="compact"
        class="music-volume"
        @update:model-value="setVolume"
      />
      <v-btn icon size="small" variant="text" :title="$t('music.stop')" @click="stop">
        <v-icon icon="mdi-close" />
      </v-btn>
    </div>
  </v-footer>
</template>

<script setup lang="ts">
import { useHotkey } from 'vuetify'

const route = useRoute()
const {
  library, hasLibrary, currentTrack, isPlaying, currentTime, duration, volume, random, loopMode,
  togglePlay, next, prev, seek, skip, setVolume, toggleMute, toggleRandom, cycleLoop, stop,
} = useMusicPlayer()

// Global keyboard shortcuts via Vuetify's useHotkey – the bar lives in the layout,
// so they work on every page while a track is loaded (on /music also before, so
// Space starts playback). useHotkey already ignores inputs/textareas/contentEditable.
function active(): boolean {
  if (!hasLibrary.value) return false
  return !!currentTrack.value || route.path === '/music'
}

// preventDefault is done manually so arrows/space keep their native behaviour
// (scrolling, button clicks) on pages where the player is idle.
function hotkey(keys: string, action: () => void) {
  useHotkey(keys, (e) => {
    if (!active()) return
    e.preventDefault()
    action()
  }, { preventDefault: false })
}

hotkey('space', togglePlay)
hotkey('left', () => skip(-10))
hotkey('right', () => skip(10))
hotkey('shift+left', prev)
hotkey('shift+right', next)
hotkey('up', () => setVolume(volume.value + 0.05))
hotkey('down', () => setVolume(volume.value - 0.05))
hotkey('r', toggleRandom)
hotkey('l', cycleLoop)

const loopIcon = computed(() =>
  loopMode.value === 'one' ? 'mdi-repeat-once' : loopMode.value === 'folder' ? 'mdi-folder-sync' : 'mdi-repeat',
)

function fmt(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}
</script>

<style scoped>
.music-player-bar {
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  gap: 16px;
}
.music-bar-title {
  min-width: 0;
  max-width: 320px; /* hard cap – long file names get an ellipsis */
  overflow: hidden;
}
.music-time {
  font-variant-numeric: tabular-nums;
  min-width: 36px;
  text-align: center;
}
.music-volume {
  max-width: 110px;
  min-width: 70px;
}
.music-spin {
  animation: music-spin 6s linear infinite;
}
@keyframes music-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .music-spin {
    animation: none;
  }
}
@media (max-width: 900px) {
  .music-now .text-body-small,
  .music-volume {
    display: none;
  }
}
</style>
