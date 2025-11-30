<template>
  <v-card v-if="sessionId" variant="outlined">
    <v-card-title class="d-flex align-center">
      <v-icon icon="mdi-image-multiple" class="mr-2" />
      {{ $t('sessions.coverImages') }}
      <v-spacer />
      <v-btn
        icon="mdi-creation"
        color="primary"
        size="small"
        class="mr-2"
        :disabled="!sessionTitle || !hasApiKey || generatingImage || uploadingImage"
        :loading="generatingImage"
        @click="generateImage"
      >
        <v-icon>mdi-creation</v-icon>
        <v-tooltip activator="parent" location="bottom">
          {{ $t('common.generateImage') }}
        </v-tooltip>
      </v-btn>
      <v-btn
        icon="mdi-plus"
        color="primary"
        size="small"
        :disabled="uploadingImage || generatingImage"
        @click="triggerImageUpload"
      >
        <v-icon>mdi-plus</v-icon>
        <v-tooltip activator="parent" location="bottom">
          {{ $t('common.uploadImage') }}
        </v-tooltip>
      </v-btn>
      <input
        ref="fileInputRef"
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
        multiple
        style="display: none"
        @change="handleImageUpload"
      />
    </v-card-title>
    <v-card-text>
      <v-progress-linear v-if="loadingImages" indeterminate />
      <v-list v-else-if="images.length > 0">
        <v-list-item v-for="image in images" :key="image.id" class="mb-3">
          <template #prepend>
            <div class="position-relative image-container mr-3">
              <v-avatar
                size="80"
                rounded="lg"
                style="cursor: pointer"
                @click="$emit('preview-image', `/uploads/${image.imageUrl}`, sessionTitle || 'Image')"
              >
                <v-img :src="`/uploads/${image.imageUrl}`" cover />
              </v-avatar>
              <v-btn
                icon="mdi-download"
                size="x-small"
                variant="tonal"
                class="image-download-btn"
                @click.stop="downloadImage(`/uploads/${image.imageUrl}`, sessionTitle || 'session')"
              />
            </div>
          </template>
          <v-list-item-title class="mb-2">
            <div class="d-flex align-center gap-2">
              <v-chip v-if="image.isPrimary" size="small" color="primary">
                <v-icon start icon="mdi-star" />
                {{ $t('common.primary') }}
              </v-chip>
              <span class="text-caption text-medium-emphasis">
                {{ new Date(image.createdAt).toLocaleDateString('de-DE') }}
              </span>
            </div>
          </v-list-item-title>
          <v-list-item-subtitle>
            <v-text-field
              :model-value="image.caption || ''"
              :placeholder="$t('common.caption')"
              variant="outlined"
              density="compact"
              hide-details
              @blur="(e: FocusEvent) => updateImageCaption(image.id, (e.target as HTMLInputElement).value)"
              @keyup.enter="(e: KeyboardEvent) => (e.target as HTMLInputElement).blur()"
            />
          </v-list-item-subtitle>
          <template #append>
            <div class="d-flex gap-1">
              <v-btn
                v-if="!image.isPrimary"
                icon="mdi-star-outline"
                variant="text"
                size="small"
                @click="setPrimaryImage(image.id)"
              >
                <v-icon>mdi-star-outline</v-icon>
                <v-tooltip activator="parent" location="bottom">
                  {{ $t('common.setPrimary') }}
                </v-tooltip>
              </v-btn>
              <v-btn
                icon="mdi-delete"
                variant="text"
                size="small"
                color="error"
                @click="deleteImage(image.id)"
              >
                <v-icon>mdi-delete</v-icon>
                <v-tooltip activator="parent" location="bottom">
                  {{ $t('common.delete') }}
                </v-tooltip>
              </v-btn>
            </div>
          </template>
        </v-list-item>
      </v-list>
      <v-empty-state
        v-else
        icon="mdi-image-off"
        :title="$t('common.noImages')"
        :text="$t('sessions.noCoverImagesText')"
      />
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { useImageDownload } from '~/composables/useImageDownload'

interface SessionImage {
  id: number
  sessionId: number
  imageUrl: string
  caption: string | null
  isPrimary: boolean
  displayOrder: number
  createdAt: string
}

interface Props {
  sessionId: number
  sessionTitle?: string
  sessionSummary?: string
}

const props = withDefaults(defineProps<Props>(), {
  sessionTitle: undefined,
  sessionSummary: undefined,
})

const emit = defineEmits<{
  'preview-image': [url: string, name: string]
  'images-updated': []
  generating: [isGenerating: boolean]
}>()

const { t } = useI18n()
const { downloadImage } = useImageDownload()

// Image state
const images = ref<SessionImage[]>([])
const loadingImages = ref(false)
const uploadingImage = ref(false)
const generatingImage = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

// Check if API key is available
const hasApiKey = ref(false)
onMounted(async () => {
  try {
    const result = await $fetch<{ hasKey: boolean }>('/api/settings/openai-key/check')
    hasApiKey.value = result.hasKey
  } catch {
    hasApiKey.value = false
  }

  loadImages()
})

// Reload images when sessionId changes
watch(
  () => props.sessionId,
  () => {
    if (props.sessionId) {
      loadImages()
    }
  },
)

// Load images for this session
async function loadImages() {
  if (!props.sessionId) return

  loadingImages.value = true
  try {
    const result = await $fetch<SessionImage[]>(`/api/session-images/${props.sessionId}`)
    images.value = result
  } catch (error) {
    console.error('Failed to load session images:', error)
  } finally {
    loadingImages.value = false
  }
}

// Trigger file input
function triggerImageUpload() {
  fileInputRef.value?.click()
}

// Handle image upload
async function handleImageUpload(event: Event) {
  const target = event.target as HTMLInputElement
  const files = target.files
  if (!files || files.length === 0) return

  uploadingImage.value = true
  try {
    const formData = new FormData()
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file) {
        formData.append('images', file)
      }
    }
    formData.append('sessionId', props.sessionId.toString())

    // Use native fetch for FormData uploads
    const response = await fetch('/api/session-images/upload', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error('Upload failed')
    }

    await loadImages()
    emit('images-updated')
  } catch (error) {
    console.error('Failed to upload session images:', error)
    alert(t('common.uploadImageError'))
  } finally {
    uploadingImage.value = false
    if (target) target.value = ''
  }
}

// Generate image with AI
async function generateImage() {
  if (!props.sessionTitle) return

  generatingImage.value = true
  emit('generating', true)

  try {
    const details = []
    if (props.sessionSummary) {
      details.push(props.sessionSummary.slice(0, 500))
    }
    details.push(`D&D session: ${props.sessionTitle}`)

    const prompt = details.filter((d) => d).join('. ')

    const result = await $fetch<{ imageUrl: string }>('/api/ai/generate-image', {
      method: 'POST',
      body: {
        prompt,
        entityName: props.sessionTitle,
        entityType: 'session',
        style: 'fantasy-art',
      },
    })

    if (result.imageUrl) {
      const filename = result.imageUrl.replace('/uploads/', '')

      // Add generated image to session_images table
      await $fetch('/api/session-images/add-generated', {
        method: 'POST',
        body: {
          sessionId: props.sessionId,
          imageUrl: filename,
        },
      })

      await loadImages()
      emit('images-updated')
    }
  } catch (error) {
    console.error('Failed to generate session image:', error)
    alert(t('common.generateImageError'))
  } finally {
    generatingImage.value = false
    emit('generating', false)
  }
}

// Update image caption
async function updateImageCaption(imageId: number, caption: string) {
  try {
    await $fetch(`/api/session-images/${imageId}/caption`, {
      method: 'PATCH',
      body: { caption },
    })

    const image = images.value.find((img) => img.id === imageId)
    if (image) {
      image.caption = caption
    }
  } catch (error) {
    console.error('Failed to update caption:', error)
  }
}

// Set image as primary
async function setPrimaryImage(imageId: number) {
  try {
    await $fetch(`/api/session-images/${imageId}/set-primary`, {
      method: 'PATCH',
    })

    // Update local state
    images.value.forEach((img) => {
      img.isPrimary = img.id === imageId
    })
    emit('images-updated')
  } catch (error) {
    console.error('Failed to set primary image:', error)
  }
}

// Delete image
async function deleteImage(imageId: number) {
  try {
    await $fetch(`/api/session-images/${imageId}`, {
      method: 'DELETE',
    })

    images.value = images.value.filter((img) => img.id !== imageId)
    emit('images-updated')
  } catch (error) {
    console.error('Failed to delete session image:', error)
  }
}

// Expose for parent to reload
defineExpose({ loadImages })
</script>

<style scoped>
.image-container {
  position: relative;
}

.image-download-btn {
  position: absolute;
  bottom: 2px;
  right: 2px;
  opacity: 0;
  transition: opacity 0.2s;
}

.image-container:hover .image-download-btn {
  opacity: 1;
}
</style>
