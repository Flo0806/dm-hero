<template>
  <v-card v-if="entityId" variant="outlined">
    <v-card-title class="d-flex align-center">
      <v-icon icon="mdi-image-multiple" class="mr-2" />
      {{ $t('common.images') }}
      <v-spacer />
      <v-btn
        v-if="canGenerateImage"
        icon="mdi-creation"
        color="primary"
        size="small"
        class="mr-2"
        :disabled="!entityName || !hasApiKey || generatingImage || uploadingImage"
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
      >
    </v-card-title>
    <v-card-text>
      <v-progress-linear v-if="loadingImages" indeterminate />
      <v-list v-else-if="images.length > 0">
        <v-list-item
          v-for="image in images"
          :key="image.id"
          class="mb-3"
        >
          <template #prepend>
            <div class="position-relative image-container mr-3">
              <v-avatar
                size="80"
                rounded="lg"
                style="cursor: pointer;"
                @click="$emit('preview-image', `/uploads/${image.image_url}`, entityName || 'Image')"
              >
                <v-img :src="`/uploads/${image.image_url}`" cover />
              </v-avatar>
              <v-btn
                icon="mdi-download"
                size="x-small"
                variant="tonal"
                class="image-download-btn"
                @click.stop="downloadImage(`/uploads/${image.image_url}`, entityName || 'image')"
              />
            </div>
          </template>
          <v-list-item-title class="mb-2">
            <div class="d-flex align-center gap-2">
              <v-chip v-if="image.is_primary" size="small" color="primary">
                <v-icon start icon="mdi-star" />
                {{ $t('common.primary') }}
              </v-chip>
              <span class="text-caption text-medium-emphasis">
                {{ new Date(image.created_at).toLocaleDateString('de-DE') }}
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
                v-if="!image.is_primary"
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
        :text="$t('common.noImagesText')"
      />
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { useImageDownload } from '~/composables/useImageDownload'

interface EntityImage {
  id: number
  entity_id: number
  image_url: string
  caption: string | null
  is_primary: number
  sort_order: number
  created_at: string
}

interface Props {
  entityId: number
  entityType: string
  entityName?: string
  entityDescription?: string
  canGenerateImage?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  canGenerateImage: true,
  entityName: undefined,
  entityDescription: undefined,
})

const emit = defineEmits<{
  'preview-image': [url: string, name: string]
  'images-updated': []
  'generating': [isGenerating: boolean]
}>()

const { t } = useI18n()
const { downloadImage } = useImageDownload()

// Image state
const images = ref<EntityImage[]>([])
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
  }
  catch {
    hasApiKey.value = false
  }

  loadImages()
})

// Load images for this entity
async function loadImages() {
  if (!props.entityId) return

  loadingImages.value = true
  try {
    const result = await $fetch<EntityImage[]>(`/api/entity-images/${props.entityId}`)
    images.value = result
  }
  catch (error) {
    console.error('Failed to load images:', error)
  }
  finally {
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
    formData.append('entityId', props.entityId.toString())
    formData.append('entityType', props.entityType)

    // Use native fetch for FormData uploads
    const response = await fetch('/api/entity-images/upload', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error('Upload failed')
    }

    await loadImages()
  }
  catch (error) {
    console.error('Failed to upload images:', error)
    alert(t('common.uploadImageError'))
  }
  finally {
    uploadingImage.value = false
    if (target) target.value = ''
  }
}

// Generate image with AI
async function generateImage() {
  if (!props.entityName) return

  generatingImage.value = true
  emit('generating', true)

  try {
    const details = []
    if (props.entityDescription) {
      details.push(props.entityDescription)
    }
    details.push(props.entityName)

    const prompt = details.filter(d => d).join(', ')

    const result = await $fetch<{ imageUrl: string }>('/api/ai/generate-image', {
      method: 'POST',
      body: {
        prompt,
        entityName: props.entityName,
        entityType: props.entityType,
        style: 'fantasy-art',
      },
    })

    if (result.imageUrl) {
      const filename = result.imageUrl.replace('/uploads/', '')

      // Add generated image to entity_images table
      await $fetch('/api/entity-images/add-generated', {
        method: 'POST',
        body: {
          entityId: props.entityId,
          imageUrl: filename,
        },
      })

      await loadImages()
    }
  }
  catch (error) {
    console.error('Failed to generate image:', error)
    alert(t('common.generateImageError'))
  }
  finally {
    generatingImage.value = false
    emit('generating', false)
  }
}

// Update image caption
async function updateImageCaption(imageId: number, caption: string) {
  try {
    await $fetch(`/api/entity-images/${imageId}/caption`, {
      method: 'PATCH',
      body: { caption },
    })

    const image = images.value.find(img => img.id === imageId)
    if (image) {
      image.caption = caption
    }
  }
  catch (error) {
    console.error('Failed to update caption:', error)
  }
}

// Set image as primary
async function setPrimaryImage(imageId: number) {
  try {
    await $fetch(`/api/entity-images/${imageId}/set-primary`, {
      method: 'PATCH',
    })

    // Update local state
    images.value.forEach((img) => {
      img.is_primary = img.id === imageId ? 1 : 0
    })
  }
  catch (error) {
    console.error('Failed to set primary image:', error)
  }
}

// Delete image
async function deleteImage(imageId: number) {
  try {
    await $fetch(`/api/entity-images/${imageId}`, {
      method: 'DELETE',
    })

    images.value = images.value.filter(img => img.id !== imageId)
  }
  catch (error) {
    console.error('Failed to delete image:', error)
    alert(t('common.deleteImageError'))
  }
}

// Watch for entity ID changes
watch(() => props.entityId, () => {
  if (props.entityId) {
    loadImages()
  }
})
</script>

<style scoped>
.image-container {
  position: relative;
}

.image-download-btn {
  position: absolute;
  bottom: 4px;
  right: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.image-container:hover .image-download-btn {
  opacity: 1;
}
</style>
