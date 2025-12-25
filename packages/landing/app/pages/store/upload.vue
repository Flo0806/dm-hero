<template>
  <div>
    <StoreBackground />
    <v-container class="py-8 position-relative" style="max-width: 900px; z-index: 1">
    <!-- Header -->
    <div class="d-flex align-center mb-8">
      <v-btn icon="mdi-arrow-left" variant="text" to="/store" class="mr-4" />
      <div>
        <h1 class="text-h4 font-weight-light">
          {{ isEditMode ? $t('store.upload.titleEdit') : $t('store.upload.title') }}
        </h1>
        <p class="text-body-2 text-medium-emphasis">
          {{ isEditMode ? $t('store.upload.subtitleEdit') : $t('store.upload.subtitle') }}
        </p>
      </div>
    </div>

    <!-- Loading state for edit mode -->
    <div v-if="loading" class="d-flex justify-center py-12">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <template v-if="!loading">
    <!-- Email verification required alert -->
    <v-alert
      v-if="!isEmailVerified"
      type="warning"
      variant="tonal"
      class="mb-6"
      icon="mdi-email-alert"
    >
      <div class="d-flex align-center justify-space-between flex-wrap ga-4">
        <span>{{ $t('store.upload.verifyRequired') }}</span>
        <v-btn
          variant="outlined"
          color="warning"
          size="small"
          :loading="resending"
          @click="handleResend"
        >
          {{ $t('auth.verifyEmail.resendButton') }}
        </v-btn>
      </div>
      <v-alert
        v-if="resendSuccess"
        type="success"
        variant="tonal"
        density="compact"
        class="mt-3"
      >
        {{ $t('auth.verifyEmail.resendSuccess') }}
      </v-alert>
    </v-alert>

    <v-form ref="formRef" @submit.prevent="handleSubmit">
      <!-- Basic Info Card -->
      <v-card class="mb-6" elevation="0">
        <v-card-title class="d-flex align-center">
          <v-icon icon="mdi-information-outline" class="mr-2" />
          {{ $t('store.upload.basicInfo') }}
        </v-card-title>
        <v-card-text>
          <v-row>
            <!-- Title -->
            <v-col cols="12">
              <v-text-field
                v-model="form.title"
                :label="$t('store.upload.fields.title')"
                :rules="[rules.required]"
                variant="outlined"
                density="comfortable"
              />
            </v-col>

            <!-- Short Description -->
            <v-col cols="12">
              <v-textarea
                v-model="form.shortDescription"
                :label="$t('store.upload.fields.shortDescription')"
                :hint="$t('store.upload.hints.shortDescription')"
                :rules="[rules.required, rules.maxLength(500)]"
                variant="outlined"
                rows="2"
                counter="500"
                persistent-hint
              />
            </v-col>

            <!-- Cover Image (Required) -->
            <v-col cols="12">
              <div class="cover-upload">
                <div
                  v-if="coverPreview"
                  class="cover-preview"
                  :style="{ backgroundImage: `url(${coverPreview})` }"
                >
                  <v-btn
                    icon="mdi-close"
                    size="small"
                    color="error"
                    class="remove-cover"
                    @click="removeCover"
                  />
                </div>
                <v-file-input
                  v-else
                  v-model="form.coverImage"
                  :label="$t('store.upload.fields.coverImage') + ' *'"
                  :rules="[rules.requiredFile]"
                  accept="image/*"
                  prepend-icon="mdi-image"
                  variant="outlined"
                  @update:model-value="onCoverSelected"
                />
                <p class="text-caption text-medium-emphasis mt-1">
                  {{ $t('store.upload.hints.coverImage') }}
                </p>
              </div>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>

      <!-- Description Card -->
      <v-card class="mb-6" elevation="0">
        <v-card-title class="d-flex align-center">
          <v-icon icon="mdi-text-box-outline" class="mr-2" />
          {{ $t('store.upload.description') }}
        </v-card-title>
        <v-card-text>
          <StoreRichTextEditor
            v-model="form.description"
            :placeholder="$t('store.upload.fields.descriptionPlaceholder')"
          />
        </v-card-text>
      </v-card>

      <!-- Highlights Card -->
      <v-card class="mb-6" elevation="0">
        <v-card-title class="d-flex align-center">
          <v-icon icon="mdi-star-outline" class="mr-2" />
          {{ $t('store.upload.highlights') }}
        </v-card-title>
        <v-card-text>
          <div v-for="(highlight, index) in form.highlights" :key="index" class="d-flex align-center mb-2">
            <v-text-field
              v-model="form.highlights[index]"
              :placeholder="$t('store.upload.fields.highlightPlaceholder')"
              variant="outlined"
              density="compact"
              hide-details
              class="flex-grow-1"
            />
            <v-btn
              icon="mdi-close"
              variant="text"
              size="small"
              color="error"
              class="ml-2"
              @click="removeHighlight(index)"
            />
          </div>
          <v-btn
            v-if="form.highlights.length < 6"
            variant="tonal"
            size="small"
            prepend-icon="mdi-plus"
            @click="addHighlight"
          >
            {{ $t('store.upload.addHighlight') }}
          </v-btn>
        </v-card-text>
      </v-card>

      <!-- Game Details Card -->
      <v-card class="mb-6" elevation="0">
        <v-card-title class="d-flex align-center">
          <v-icon icon="mdi-dice-d20" class="mr-2" />
          {{ $t('store.upload.gameDetails') }}
        </v-card-title>
        <v-card-text>
          <v-row>
            <!-- System -->
            <v-col cols="12" md="6">
              <v-select
                v-model="form.system"
                :items="systemOptions"
                :label="$t('store.upload.fields.system')"
                variant="outlined"
                density="comfortable"
              />
            </v-col>

            <!-- Language -->
            <v-col cols="12" md="6">
              <v-select
                v-model="form.language"
                :items="languageOptions"
                :label="$t('store.upload.fields.language')"
                variant="outlined"
                density="comfortable"
              />
            </v-col>

            <!-- Difficulty -->
            <v-col cols="12">
              <div class="mb-2 text-body-2">{{ $t('store.upload.fields.difficulty') }}</div>
              <StoreDifficultyRating v-model="form.difficulty" />
            </v-col>

            <!-- Players -->
            <v-col cols="12" md="6">
              <div class="mb-2 text-body-2">{{ $t('store.upload.fields.players') }}</div>
              <div class="d-flex align-center ga-4">
                <v-text-field
                  v-model.number="form.playersMin"
                  type="number"
                  :label="$t('store.upload.fields.min')"
                  variant="outlined"
                  density="compact"
                  style="max-width: 100px"
                  min="1"
                  max="20"
                />
                <span class="text-medium-emphasis">–</span>
                <v-text-field
                  v-model.number="form.playersMax"
                  type="number"
                  :label="$t('store.upload.fields.max')"
                  variant="outlined"
                  density="compact"
                  style="max-width: 100px"
                  min="1"
                  max="20"
                />
              </div>
            </v-col>

            <!-- Character Level -->
            <v-col cols="12" md="6">
              <div class="mb-2 text-body-2">{{ $t('store.upload.fields.characterLevel') }}</div>
              <div class="d-flex align-center ga-4">
                <v-text-field
                  v-model.number="form.levelMin"
                  type="number"
                  :label="$t('store.upload.fields.min')"
                  variant="outlined"
                  density="compact"
                  style="max-width: 100px"
                  min="1"
                  max="20"
                />
                <span class="text-medium-emphasis">–</span>
                <v-text-field
                  v-model.number="form.levelMax"
                  type="number"
                  :label="$t('store.upload.fields.max')"
                  variant="outlined"
                  density="compact"
                  style="max-width: 100px"
                  min="1"
                  max="20"
                />
              </div>
            </v-col>

            <!-- Duration -->
            <v-col cols="12" md="6">
              <v-select
                v-model="form.durationHours"
                :items="durationOptions"
                :label="$t('store.upload.fields.duration')"
                variant="outlined"
                density="comfortable"
              />
            </v-col>

            <!-- Tags -->
            <v-col cols="12" md="6">
              <v-combobox
                v-model="form.tags"
                :items="suggestedTags"
                :label="$t('store.upload.fields.tags')"
                variant="outlined"
                density="comfortable"
                chips
                multiple
                closable-chips
              />
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>

      <!-- Author Info Card -->
      <v-card class="mb-6" elevation="0">
        <v-card-title class="d-flex align-center">
          <v-icon icon="mdi-account-outline" class="mr-2" />
          {{ $t('store.upload.authorInfo') }}
        </v-card-title>
        <v-card-text>
          <v-row>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="form.authorName"
                :label="$t('store.upload.fields.authorName')"
                :hint="$t('store.upload.hints.authorName')"
                variant="outlined"
                density="comfortable"
                persistent-hint
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="form.authorDiscord"
                :label="$t('store.upload.fields.discord')"
                :hint="$t('store.upload.hints.discord')"
                variant="outlined"
                density="comfortable"
                persistent-hint
              >
                <template #prepend-inner>
                  <IconsDiscordIcon :size="20" class="text-medium-emphasis" />
                </template>
              </v-text-field>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>

      <!-- Adventure File Card -->
      <v-card class="mb-6" elevation="0">
        <v-card-title class="d-flex align-center">
          <v-icon icon="mdi-file-upload-outline" class="mr-2" />
          {{ $t('store.upload.adventureFile') }}
        </v-card-title>
        <v-card-text>
          <!-- Show existing file in edit mode -->
          <div v-if="isEditMode && existingFileName && !form.adventureFile" class="mb-4">
            <v-chip
              color="success"
              variant="tonal"
              prepend-icon="mdi-check-circle"
              class="mb-2"
            >
              {{ existingFileName }}
              <span v-if="existingVersion" class="ml-1 text-medium-emphasis">(v{{ existingVersion }})</span>
            </v-chip>
            <p class="text-caption text-medium-emphasis">
              {{ $t('store.upload.hints.fileExists') }}
            </p>
          </div>

          <v-file-input
            v-model="form.adventureFile"
            :label="isEditMode && existingFileName ? $t('store.upload.fields.fileReplace') : $t('store.upload.fields.file')"
            :rules="isEditMode && existingFileName ? [] : [rules.required]"
            accept=".dmhero"
            prepend-icon="mdi-treasure-chest"
            variant="outlined"
            :hint="$t('store.upload.hints.file')"
            persistent-hint
          />
        </v-card-text>
      </v-card>

      <!-- Price Card -->
      <v-card class="mb-6" elevation="0">
        <v-card-title class="d-flex align-center">
          <v-icon icon="mdi-cash" class="mr-2" />
          {{ $t('store.upload.pricing') }}
        </v-card-title>
        <v-card-text>
          <v-chip color="success" variant="flat" prepend-icon="mdi-check" class="mb-3">
            {{ $t('store.upload.fields.freeAdventure') }}
          </v-chip>
          <p class="text-body-2 text-medium-emphasis">
            {{ $t('store.upload.hints.freeOnly') }}
          </p>
        </v-card-text>
      </v-card>

      <!-- Error Alert -->
      <v-alert v-if="error" type="error" variant="tonal" class="mb-6" closable @click:close="error = ''">
        {{ error }}
      </v-alert>

      <!-- Actions -->
      <div class="d-flex justify-end ga-4">
        <v-btn variant="text" to="/store" size="large">
          {{ $t('common.cancel') }}
        </v-btn>
        <v-btn
          type="submit"
          color="primary"
          variant="flat"
          size="large"
          :loading="submitting"
          :disabled="!isEmailVerified"
          :prepend-icon="isEditMode ? 'mdi-content-save' : 'mdi-upload'"
        >
          {{ isEditMode ? $t('store.upload.submitEdit') : $t('store.upload.submit') }}
        </v-btn>
      </div>
    </v-form>
    </template>
  </v-container>
  </div>
</template>

<script setup lang="ts">
import { useAdventureStore } from '~/stores/adventureStore'
import { useApiFetch } from '~/composables/useApiFetch'

definePageMeta({
  middleware: 'auth',
})

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const adventureStore = useAdventureStore()
const { user, isEmailVerified } = useAuth()
const api = useApiFetch()

// Edit mode detection
const editId = computed(() => {
  const id = route.query.id
  return id ? Number(id) : null
})
const isEditMode = computed(() => !!editId.value)
// Initialize loading to true if in edit mode to avoid SSR hydration mismatch
const loading = ref(!!route.query.id)

const formRef = ref()
const submitting = ref(false)
const error = ref('')
const coverPreview = ref<string | null>(null)
const existingCoverUrl = ref<string | null>(null)
const existingFileName = ref<string | null>(null)
const existingVersion = ref<number | null>(null)
const resending = ref(false)
const resendSuccess = ref(false)

// Load existing adventure for edit mode
async function loadAdventure(id: number) {
  loading.value = true
  error.value = ''

  try {
    // Fetch adventure data - server will verify ownership
    const adventure = await api.get<{
      id: number
      title: string
      shortDescription: string
      description: string
      coverImageUrl: string | null
      highlights: string[]
      system: string
      language: string
      difficulty: number
      playersMin: number
      playersMax: number
      levelMin: number
      levelMax: number
      durationHours: number
      tags: string[]
      authorName: string | null
      authorDiscord: string | null
      authorId: number
      currentFileName: string | null
      currentVersion: number | null
    }>(`/api/store/adventures/${id}/edit`)

    // Verify ownership on client side too (server already checked)
    if (adventure.authorId !== user.value?.id) {
      error.value = t('store.upload.errors.notOwner')
      router.push('/store')
      return
    }

    // Populate form
    form.title = adventure.title
    form.shortDescription = adventure.shortDescription
    form.description = adventure.description || ''
    form.highlights = adventure.highlights?.length ? adventure.highlights : ['']
    form.system = adventure.system || 'dnd5e'
    form.language = adventure.language || 'de'
    form.difficulty = adventure.difficulty || 3
    form.playersMin = adventure.playersMin || 3
    form.playersMax = adventure.playersMax || 5
    form.levelMin = adventure.levelMin || 1
    form.levelMax = adventure.levelMax || 5
    form.durationHours = adventure.durationHours || 5
    form.tags = adventure.tags || []
    form.authorName = adventure.authorName || ''
    form.authorDiscord = adventure.authorDiscord || ''

    // Store existing cover URL for display
    if (adventure.coverImageUrl) {
      existingCoverUrl.value = adventure.coverImageUrl
      coverPreview.value = adventure.coverImageUrl
    }

    // Store existing file info for display
    if (adventure.currentFileName) {
      existingFileName.value = adventure.currentFileName
      existingVersion.value = adventure.currentVersion
    }
  } catch (err: unknown) {
    const fetchError = err as { statusCode?: number; data?: { message?: string } }
    if (fetchError.statusCode === 403) {
      error.value = t('store.upload.errors.notOwner')
      router.push('/store')
    } else if (fetchError.statusCode === 404) {
      error.value = t('store.upload.errors.notFound')
      router.push('/store')
    } else {
      error.value = fetchError.data?.message || t('common.error')
    }
  } finally {
    loading.value = false
  }
}

// Watch for edit mode and load data - client only to avoid SSR hydration issues
if (import.meta.client) {
  watch(editId, (id) => {
    if (id) {
      loadAdventure(id)
    }
  }, { immediate: true })
}

async function handleResend() {
  if (!user.value?.email) return

  resending.value = true
  resendSuccess.value = false

  try {
    await $fetch('/api/auth/resend-verification', {
      method: 'POST',
      body: { email: user.value.email, locale: locale.value },
    })
    resendSuccess.value = true
  } catch (err) {
    console.error('Failed to resend verification email:', err)
  } finally {
    resending.value = false
  }
}

const form = reactive({
  title: '',
  shortDescription: '',
  description: '',
  coverImage: null as File | null,
  highlights: [''] as string[],
  system: 'dnd5e',
  language: 'de',
  difficulty: 3,
  playersMin: 3,
  playersMax: 5,
  levelMin: 1,
  levelMax: 5,
  durationHours: 5,
  tags: [] as string[],
  authorName: '',
  authorDiscord: '',
  adventureFile: null as File | File[] | null,
  isFree: true,
  priceEur: 0,
})

const rules = {
  required: (v: unknown) => !!v || t('auth.validation.required'),
  requiredFile: (v: File | File[] | null) => {
    if (!v) return t('auth.validation.required')
    if (Array.isArray(v) && v.length === 0) return t('auth.validation.required')
    return true
  },
  maxLength: (max: number) => (v: string) => !v || v.length <= max || t('auth.validation.maxLength', { max }),
}

const systemOptions = [
  { title: 'Dungeons & Dragons 5e', value: 'dnd5e' },
  { title: 'Dungeons & Dragons 5.5e (2024)', value: 'dnd55e' },
  { title: 'Pathfinder 2e', value: 'pf2e' },
  { title: 'Das Schwarze Auge 5', value: 'dsa5' },
  { title: 'Call of Cthulhu', value: 'coc' },
  { title: 'Shadowrun', value: 'shadowrun' },
  { title: 'Other', value: 'other' },
]

const languageOptions = [
  { title: 'Deutsch', value: 'de' },
  { title: 'English', value: 'en' },
]

const durationOptions = computed(() => [
  { title: '1-2 ' + t('store.upload.hours'), value: 1.5 },
  { title: '2-4 ' + t('store.upload.hours'), value: 3 },
  { title: '4-6 ' + t('store.upload.hours'), value: 5 },
  { title: '6-8 ' + t('store.upload.hours'), value: 7 },
  { title: '8+ ' + t('store.upload.hours'), value: 10 },
  { title: t('store.upload.multiSession'), value: 20 },
])

const suggestedTags = [
  'Dungeon', 'Combat', 'Roleplay', 'Mystery', 'Horror', 'Comedy',
  'Urban', 'Wilderness', 'Underdark', 'Naval', 'Planar',
  'Dragons', 'Undead', 'Demons', 'Giants', 'Fey',
]

function onCoverSelected(files: File | File[] | null) {
  const file = Array.isArray(files) ? files[0] : files
  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      coverPreview.value = e.target?.result as string
    }
    reader.readAsDataURL(file)
    form.coverImage = file
  }
}

function removeCover() {
  coverPreview.value = null
  existingCoverUrl.value = null
  form.coverImage = null
}

function addHighlight() {
  if (form.highlights.length < 6) {
    form.highlights.push('')
  }
}

function removeHighlight(index: number) {
  form.highlights.splice(index, 1)
  if (form.highlights.length === 0) {
    form.highlights.push('')
  }
}

async function handleSubmit() {
  const { valid } = await formRef.value.validate()
  if (!valid) return

  // Check for cover image - required for new uploads, optional for edits if existing
  const hasCover = form.coverImage || existingCoverUrl.value
  if (!hasCover) {
    error.value = t('store.upload.errors.coverRequired')
    return
  }

  // Adventure file required for new uploads, optional for edits
  if (!isEditMode.value && !form.adventureFile) {
    error.value = t('store.upload.errors.fileRequired')
    return
  }

  submitting.value = true
  error.value = ''

  try {
    const formData = new FormData()

    // Basic info
    formData.append('title', form.title)
    formData.append('shortDescription', form.shortDescription)
    formData.append('description', form.description)

    // Cover image - only send if new one selected
    if (form.coverImage) {
      formData.append('coverImage', form.coverImage)
    }

    // Highlights (filter empty)
    const highlights = form.highlights.filter((h) => h.trim())
    formData.append('highlights', JSON.stringify(highlights))

    // Game details
    formData.append('system', form.system)
    formData.append('language', form.language)
    formData.append('difficulty', form.difficulty.toString())
    formData.append('playersMin', form.playersMin.toString())
    formData.append('playersMax', form.playersMax.toString())
    formData.append('levelMin', form.levelMin.toString())
    formData.append('levelMax', form.levelMax.toString())
    formData.append('durationHours', form.durationHours.toString())
    formData.append('tags', JSON.stringify(form.tags))

    // Author info
    formData.append('authorName', form.authorName)
    formData.append('authorDiscord', form.authorDiscord)

    // Adventure file - only send if new one selected
    const file = Array.isArray(form.adventureFile) ? form.adventureFile[0] : form.adventureFile
    if (file) {
      formData.append('adventureFile', file)
    }

    // Pricing
    formData.append('priceCents', form.isFree ? '0' : Math.round(form.priceEur * 100).toString())

    let adventureId: number

    if (isEditMode.value && editId.value) {
      // Update existing adventure
      const result = await api.fetch<{ adventureId: number }>(`/api/store/adventures/${editId.value}`, {
        method: 'PUT',
        body: formData,
      })
      adventureId = result.adventureId
    } else {
      // Create new adventure
      const result = await api.fetch<{ adventureId: number }>('/api/store/adventures', {
        method: 'POST',
        body: formData,
      })
      adventureId = result.adventureId
    }

    // Refresh store data and redirect to profile with highlight
    await adventureStore.refresh()
    router.push(`/profile?highlight=${adventureId}`)
  } catch (err: unknown) {
    const fetchError = err as { data?: { message?: string } }
    error.value = fetchError.data?.message || t('common.error')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.v-card {
  background: rgba(var(--v-theme-surface-variant), 0.3);
  border: 1px solid rgba(var(--v-theme-outline), 0.1);
}

.cover-upload .cover-preview {
  position: relative;
  width: 100%;
  max-width: 400px;
  aspect-ratio: 16/10;
  background-size: cover;
  background-position: center;
  border-radius: 8px;
  border: 1px solid rgba(var(--v-theme-outline), 0.2);
}

.cover-upload .remove-cover {
  position: absolute;
  top: 8px;
  right: 8px;
}
</style>
