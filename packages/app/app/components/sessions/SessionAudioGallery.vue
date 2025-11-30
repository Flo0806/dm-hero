<template>
  <v-card v-if="sessionId" variant="outlined">
    <v-card-title class="d-flex align-center">
      <v-icon icon="mdi-microphone" class="mr-2" />
      {{ $t('audio.sessionAudio') }}
      <v-spacer />
      <v-btn
        icon="mdi-plus"
        color="primary"
        size="small"
        :disabled="uploadingAudio"
        :loading="uploadingAudio"
        @click="triggerAudioUpload"
      >
        <v-icon>mdi-plus</v-icon>
        <v-tooltip activator="parent" location="bottom">
          {{ $t('audio.uploadAudio') }}
        </v-tooltip>
      </v-btn>
      <input
        ref="fileInputRef"
        type="file"
        accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/m4a,audio/mp4,audio/aac,audio/flac,audio/webm"
        multiple
        style="display: none"
        @change="handleAudioUpload"
      />
    </v-card-title>
    <v-card-text>
      <!-- Upload Progress -->
      <v-progress-linear
        v-if="uploadingAudio"
        indeterminate
        color="primary"
        class="mb-4"
      />

      <!-- Audio Files List -->
      <div v-if="loadingAudio" class="text-center py-4">
        <v-progress-circular indeterminate />
      </div>

      <div v-else-if="audioFiles.length > 0" class="audio-list">
        <div v-for="audio in audioFiles" :key="audio.id" class="mb-4">
          <!-- Audio Info Header -->
          <div class="d-flex align-center mb-2">
            <v-text-field
              :model-value="audio.title || ''"
              :placeholder="$t('audio.untitled')"
              variant="outlined"
              density="compact"
              hide-details
              class="flex-grow-1 mr-2"
              @blur="(e: FocusEvent) => updateAudioTitle(audio.id, (e.target as HTMLInputElement).value)"
              @keyup.enter="(e: KeyboardEvent) => (e.target as HTMLInputElement).blur()"
            />
            <v-chip v-if="audio.fileSizeBytes" size="x-small" variant="tonal" class="mr-2">
              {{ formatFileSize(audio.fileSizeBytes) }}
            </v-chip>
            <v-btn
              icon="mdi-delete"
              size="small"
              variant="text"
              color="error"
              @click="deleteAudio(audio)"
            >
              <v-icon>mdi-delete</v-icon>
              <v-tooltip activator="parent" location="bottom">
                {{ $t('common.delete') }}
              </v-tooltip>
            </v-btn>
          </div>

          <!-- Audio Player -->
          <AudioPlayer
            :audio-id="audio.id"
            :audio-url="`/uploads/${audio.audioUrl}`"
            :title="audio.title || undefined"
            :initial-markers="audio.markers"
            @markers-updated="loadAudioFiles"
          />
        </div>
      </div>

      <v-empty-state
        v-else
        icon="mdi-microphone-off"
        :title="$t('audio.noAudio')"
        :text="$t('audio.noAudioText')"
      />
    </v-card-text>
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

interface SessionAudio {
  id: number
  sessionId: number
  audioUrl: string
  title: string | null
  description: string | null
  durationSeconds: number | null
  fileSizeBytes: number | null
  mimeType: string | null
  displayOrder: number
  createdAt: string
  markers: AudioMarker[]
}

interface Props {
  sessionId: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'audio-updated': []
  uploading: [isUploading: boolean]
}>()

const { t } = useI18n()

// State
const audioFiles = ref<SessionAudio[]>([])
const loadingAudio = ref(false)
const uploadingAudio = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

// Load audio files on mount
onMounted(() => {
  loadAudioFiles()
})

// Reload when sessionId changes
watch(
  () => props.sessionId,
  () => {
    if (props.sessionId) {
      loadAudioFiles()
    }
  },
)

// Methods
async function loadAudioFiles() {
  if (!props.sessionId) return

  loadingAudio.value = true
  try {
    const result = await $fetch<SessionAudio[]>(`/api/session-audio/by-session/${props.sessionId}`)
    audioFiles.value = result
  } catch (error) {
    console.error('Failed to load session audio:', error)
  } finally {
    loadingAudio.value = false
  }
}

function triggerAudioUpload() {
  fileInputRef.value?.click()
}

async function handleAudioUpload(event: Event) {
  const target = event.target as HTMLInputElement
  const files = target.files
  if (!files || files.length === 0) return

  uploadingAudio.value = true
  emit('uploading', true)
  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (!file) continue

      const formData = new FormData()
      formData.append('audio', file)
      formData.append('sessionId', props.sessionId.toString())
      formData.append('title', file.name.replace(/\.[^/.]+$/, ''))

      await fetch('/api/session-audio/upload', {
        method: 'POST',
        body: formData,
      })
    }

    await loadAudioFiles()
    emit('audio-updated')
  } catch (error) {
    console.error('Failed to upload audio:', error)
    alert(t('audio.uploadError'))
  } finally {
    uploadingAudio.value = false
    emit('uploading', false)
    if (target) target.value = ''
  }
}

async function updateAudioTitle(audioId: number, title: string) {
  try {
    await $fetch(`/api/session-audio/${audioId}`, {
      method: 'PATCH',
      body: { title },
    })

    const audio = audioFiles.value.find((a) => a.id === audioId)
    if (audio) {
      audio.title = title
    }
  } catch (error) {
    console.error('Failed to update audio title:', error)
  }
}

async function deleteAudio(audio: SessionAudio) {
  if (!confirm(t('audio.deleteConfirm'))) return

  try {
    await $fetch(`/api/session-audio/${audio.id}`, {
      method: 'DELETE',
    })

    audioFiles.value = audioFiles.value.filter((a) => a.id !== audio.id)
    emit('audio-updated')
  } catch (error) {
    console.error('Failed to delete audio:', error)
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

// Expose for parent
defineExpose({ loadAudioFiles })
</script>

<style scoped>
.audio-list {
  max-height: 600px;
  overflow-y: auto;
}
</style>
