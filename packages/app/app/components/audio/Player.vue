<template>
  <v-card variant="outlined" class="audio-player">
    <v-card-text class="pa-3">
      <!-- Title and Info -->
      <div class="d-flex align-center mb-2">
        <v-icon icon="mdi-music" class="mr-2" color="primary" />
        <span class="font-weight-medium text-truncate flex-grow-1">
          {{ title || $t('audio.untitled') }}
        </span>
        <v-chip v-if="duration > 0" size="x-small" variant="tonal" class="ml-2">
          {{ formatTime(duration) }}
        </v-chip>
      </div>

      <!-- Waveform / Progress Bar with Markers -->
      <div
        ref="progressContainer"
        class="progress-container mb-2"
        @click="seekTo"
        @mousedown="startDrag"
      >
        <v-progress-linear
          :model-value="progressPercent"
          color="primary"
          bg-color="surface-variant"
          height="24"
          rounded
          class="progress-bar"
        />

        <!-- Markers on progress bar -->
        <div
          v-for="marker in markers"
          :key="marker.id"
          class="marker"
          :style="{ left: `${(marker.timestampSeconds / duration) * 100}%` }"
          :title="marker.label"
          @click.stop="jumpToMarker(marker)"
        >
          <v-tooltip activator="parent" location="top">
            <strong>{{ marker.label }}</strong>
            <span v-if="marker.description" class="d-block text-caption">
              {{ marker.description }}
            </span>
            <span class="text-caption">{{ formatTime(marker.timestampSeconds) }}</span>
          </v-tooltip>
        </div>

        <!-- Current time indicator -->
        <div class="time-indicator">
          {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
        </div>
      </div>

      <!-- Controls -->
      <div class="d-flex align-center gap-1">
        <!-- Skip back 10s -->
        <v-btn icon size="small" variant="text" @click="skip(-10)">
          <v-icon>mdi-rewind-10</v-icon>
          <v-tooltip activator="parent" location="bottom">
            {{ $t('audio.skipBack') }}
          </v-tooltip>
        </v-btn>

        <!-- Play/Pause -->
        <v-btn icon size="large" color="primary" @click="togglePlay">
          <v-icon>{{ isPlaying ? 'mdi-pause' : 'mdi-play' }}</v-icon>
        </v-btn>

        <!-- Skip forward 10s -->
        <v-btn icon size="small" variant="text" @click="skip(10)">
          <v-icon>mdi-fast-forward-10</v-icon>
          <v-tooltip activator="parent" location="bottom">
            {{ $t('audio.skipForward') }}
          </v-tooltip>
        </v-btn>

        <!-- Stop -->
        <v-btn icon size="small" variant="text" @click="stop">
          <v-icon>mdi-stop</v-icon>
          <v-tooltip activator="parent" location="bottom">
            {{ $t('audio.stop') }}
          </v-tooltip>
        </v-btn>

        <v-divider vertical class="mx-2" />

        <!-- Playback Speed -->
        <v-menu>
          <template #activator="{ props }">
            <v-btn variant="tonal" size="small" v-bind="props">
              {{ playbackRate }}x
              <v-tooltip activator="parent" location="bottom">
                {{ $t('audio.playbackSpeed') }}
              </v-tooltip>
            </v-btn>
          </template>
          <v-list density="compact">
            <v-list-item
              v-for="speed in [0.5, 0.75, 1, 1.25, 1.5, 2]"
              :key="speed"
              :active="playbackRate === speed"
              @click="setPlaybackRate(speed)"
            >
              <v-list-item-title>{{ speed }}x</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>

        <v-spacer />

        <!-- Volume -->
        <v-btn icon size="small" variant="text" @click="toggleMute">
          <v-icon>{{ volumeIcon }}</v-icon>
        </v-btn>
        <v-slider
          v-model="volume"
          :max="1"
          :step="0.1"
          hide-details
          density="compact"
          class="volume-slider"
          style="max-width: 100px"
        />

        <v-divider vertical class="mx-2" />

        <!-- Add Marker -->
        <v-btn
          icon
          size="small"
          variant="text"
          color="primary"
          @click="showAddMarkerDialog = true"
        >
          <v-icon>mdi-bookmark-plus</v-icon>
          <v-tooltip activator="parent" location="bottom">
            {{ $t('audio.addMarker') }}
          </v-tooltip>
        </v-btn>
      </div>

      <!-- Markers List (collapsible) -->
      <v-expand-transition>
        <div v-if="markers.length > 0" class="mt-3">
          <v-divider class="mb-2" />
          <div class="text-caption text-medium-emphasis mb-2">
            {{ $t('audio.markers') }} ({{ markers.length }})
          </div>
          <div class="markers-list">
            <v-chip
              v-for="marker in sortedMarkers"
              :key="marker.id"
              size="small"
              class="ma-1"
              closable
              :style="{ borderColor: marker.color }"
              variant="outlined"
              @click="jumpToMarker(marker)"
              @click:close="deleteMarker(marker)"
            >
              <v-icon start size="x-small" :color="marker.color">mdi-bookmark</v-icon>
              {{ formatTime(marker.timestampSeconds) }} - {{ marker.label }}
            </v-chip>
          </div>
        </div>
      </v-expand-transition>

      <!-- Hidden audio element -->
      <audio
        ref="audioElement"
        :src="audioUrl"
        preload="metadata"
        @loadedmetadata="onLoadedMetadata"
        @timeupdate="onTimeUpdate"
        @ended="onEnded"
        @error="onError"
      />
    </v-card-text>

    <!-- Add Marker Dialog -->
    <v-dialog v-model="showAddMarkerDialog" max-width="400">
      <v-card>
        <v-card-title>{{ $t('audio.addMarker') }}</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="newMarker.label"
            :label="$t('audio.markerLabel')"
            variant="outlined"
            autofocus
            class="mb-3"
          />
          <v-text-field
            v-model="newMarker.description"
            :label="$t('audio.markerDescription')"
            variant="outlined"
            class="mb-3"
          />
          <div class="d-flex align-center gap-3">
            <v-text-field
              :model-value="formatTime(newMarker.timestampSeconds)"
              :label="$t('audio.timestamp')"
              variant="outlined"
              readonly
              style="max-width: 120px"
            />
            <v-btn variant="tonal" size="small" @click="newMarker.timestampSeconds = currentTime">
              {{ $t('audio.useCurrentTime') }}
            </v-btn>
          </div>
          <div class="mt-3">
            <v-label class="text-caption">{{ $t('audio.markerColor') }}</v-label>
            <div class="d-flex gap-2 mt-1">
              <v-btn
                v-for="color in markerColors"
                :key="color"
                icon
                size="small"
                :style="{ backgroundColor: color }"
                :class="{ 'border-primary': newMarker.color === color }"
                @click="newMarker.color = color"
              >
                <v-icon v-if="newMarker.color === color" color="white" size="small">
                  mdi-check
                </v-icon>
              </v-btn>
            </div>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showAddMarkerDialog = false">
            {{ $t('common.cancel') }}
          </v-btn>
          <v-btn
            color="primary"
            :disabled="!newMarker.label"
            :loading="savingMarker"
            @click="saveMarker"
          >
            {{ $t('common.save') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<script setup lang="ts">
interface AudioMarker {
  id: number
  timestampSeconds: number
  label: string
  description: string | null
  color: string
}

interface Props {
  audioId: number
  audioUrl: string
  title?: string
  initialMarkers?: AudioMarker[]
}

const props = withDefaults(defineProps<Props>(), {
  title: undefined,
  initialMarkers: () => [],
})

const emit = defineEmits<{
  'markers-updated': []
}>()

const { t } = useI18n()

// Audio element ref
const audioElement = ref<HTMLAudioElement | null>(null)
const progressContainer = ref<HTMLElement | null>(null)

// Playback state
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const volume = ref(1)
const previousVolume = ref(1)
const playbackRate = ref(1)

// Markers
const markers = ref<AudioMarker[]>([...props.initialMarkers])
const showAddMarkerDialog = ref(false)
const savingMarker = ref(false)
const newMarker = ref({
  label: '',
  description: '',
  timestampSeconds: 0,
  color: '#D4A574',
})

const markerColors = ['#D4A574', '#8B7355', '#4CAF50', '#2196F3', '#9C27B0', '#FF5722']

// Computed
const progressPercent = computed(() => {
  if (duration.value === 0) return 0
  return (currentTime.value / duration.value) * 100
})

const volumeIcon = computed(() => {
  if (volume.value === 0) return 'mdi-volume-off'
  if (volume.value < 0.5) return 'mdi-volume-low'
  return 'mdi-volume-high'
})

const sortedMarkers = computed(() => {
  return [...markers.value].sort((a, b) => a.timestampSeconds - b.timestampSeconds)
})

// Watch volume changes
watch(volume, (newVolume) => {
  if (audioElement.value) {
    audioElement.value.volume = newVolume
  }
})

// Watch markers prop
watch(
  () => props.initialMarkers,
  (newMarkers) => {
    markers.value = [...newMarkers]
  },
)

// Methods
function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function togglePlay() {
  if (!audioElement.value) return

  if (isPlaying.value) {
    audioElement.value.pause()
  } else {
    audioElement.value.play()
  }
  isPlaying.value = !isPlaying.value
}

function stop() {
  if (!audioElement.value) return
  audioElement.value.pause()
  audioElement.value.currentTime = 0
  isPlaying.value = false
}

function skip(seconds: number) {
  if (!audioElement.value) return
  audioElement.value.currentTime = Math.max(
    0,
    Math.min(duration.value, audioElement.value.currentTime + seconds),
  )
}

function setPlaybackRate(rate: number) {
  playbackRate.value = rate
  if (audioElement.value) {
    audioElement.value.playbackRate = rate
  }
}

function toggleMute() {
  if (volume.value > 0) {
    previousVolume.value = volume.value
    volume.value = 0
  } else {
    volume.value = previousVolume.value || 1
  }
}

function seekTo(event: MouseEvent) {
  if (!progressContainer.value || !audioElement.value) return

  const rect = progressContainer.value.getBoundingClientRect()
  const percent = (event.clientX - rect.left) / rect.width
  audioElement.value.currentTime = percent * duration.value
}

let isDragging = false

function startDrag() {
  isDragging = true
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
}

function onDrag(event: MouseEvent) {
  if (!isDragging || !progressContainer.value || !audioElement.value) return

  const rect = progressContainer.value.getBoundingClientRect()
  const percent = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
  audioElement.value.currentTime = percent * duration.value
}

function stopDrag() {
  isDragging = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

function jumpToMarker(marker: AudioMarker) {
  if (!audioElement.value) return
  audioElement.value.currentTime = marker.timestampSeconds
}

async function saveMarker() {
  if (!newMarker.value.label) return

  savingMarker.value = true
  try {
    const result = await $fetch<AudioMarker>(`/api/session-audio/${props.audioId}/markers`, {
      method: 'POST',
      body: {
        timestampSeconds: newMarker.value.timestampSeconds,
        label: newMarker.value.label,
        description: newMarker.value.description || null,
        color: newMarker.value.color,
      },
    })

    markers.value.push(result)
    showAddMarkerDialog.value = false
    newMarker.value = {
      label: '',
      description: '',
      timestampSeconds: currentTime.value,
      color: '#D4A574',
    }
    emit('markers-updated')
  } catch (error) {
    console.error('Failed to save marker:', error)
    alert(t('audio.saveMarkerError'))
  } finally {
    savingMarker.value = false
  }
}

async function deleteMarker(marker: AudioMarker) {
  try {
    await $fetch(`/api/audio-markers/${marker.id}`, {
      method: 'DELETE',
    })
    markers.value = markers.value.filter((m) => m.id !== marker.id)
    emit('markers-updated')
  } catch (error) {
    console.error('Failed to delete marker:', error)
  }
}

// Audio event handlers
function onLoadedMetadata() {
  if (audioElement.value) {
    duration.value = audioElement.value.duration
  }
}

function onTimeUpdate() {
  if (audioElement.value) {
    currentTime.value = audioElement.value.currentTime
  }
}

function onEnded() {
  isPlaying.value = false
  currentTime.value = 0
}

function onError() {
  console.error('Audio error')
  isPlaying.value = false
}

// Expose for parent
defineExpose({
  play: () => {
    if (audioElement.value) {
      audioElement.value.play()
      isPlaying.value = true
    }
  },
  pause: () => {
    if (audioElement.value) {
      audioElement.value.pause()
      isPlaying.value = false
    }
  },
})
</script>

<style scoped>
.audio-player {
  border-radius: 12px;
}

.progress-container {
  position: relative;
  cursor: pointer;
}

.progress-bar {
  cursor: pointer;
}

.marker {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 3px;
  background-color: v-bind('markerColors[0]');
  transform: translateX(-50%);
  cursor: pointer;
  z-index: 1;
  border-radius: 2px;
}

.marker:hover {
  width: 5px;
}

.time-indicator {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 0.75rem;
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface));
  pointer-events: none;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.volume-slider {
  min-width: 80px;
}

.markers-list {
  max-height: 120px;
  overflow-y: auto;
}

.border-primary {
  border: 2px solid rgb(var(--v-theme-primary)) !important;
}
</style>
