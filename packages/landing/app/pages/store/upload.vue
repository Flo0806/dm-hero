<template>
  <div>
    <StoreBackground />
    <v-container class="py-8 position-relative" style="max-width: 900px; z-index: 1">
    <!-- Header -->
    <div class="d-flex align-center mb-8">
      <v-btn icon="mdi-arrow-left" variant="text" to="/store" class="mr-4" />
      <div>
        <h1 class="text-h4 font-weight-light">{{ $t('store.upload.title') }}</h1>
        <p class="text-body-2 text-medium-emphasis">{{ $t('store.upload.subtitle') }}</p>
      </div>
    </div>

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

            <!-- Cover Image -->
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
                  :label="$t('store.upload.fields.coverImage')"
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
                prepend-inner-icon="mdi-discord"
                persistent-hint
              />
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
          <v-file-input
            v-model="form.adventureFile"
            :label="$t('store.upload.fields.file')"
            :rules="[rules.required]"
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
          prepend-icon="mdi-upload"
        >
          {{ $t('store.upload.submit') }}
        </v-btn>
      </div>
    </v-form>
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
const router = useRouter()
const adventureStore = useAdventureStore()
const { user, isEmailVerified } = useAuth()
const api = useApiFetch()

const formRef = ref()
const submitting = ref(false)
const error = ref('')
const coverPreview = ref<string | null>(null)
const resending = ref(false)
const resendSuccess = ref(false)

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

  submitting.value = true
  error.value = ''

  try {
    const formData = new FormData()

    // Basic info
    formData.append('title', form.title)
    formData.append('shortDescription', form.shortDescription)
    formData.append('description', form.description)

    // Cover image
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

    // Adventure file
    const file = Array.isArray(form.adventureFile) ? form.adventureFile[0] : form.adventureFile
    if (file) {
      formData.append('adventureFile', file)
    }

    // Pricing
    formData.append('priceCents', form.isFree ? '0' : Math.round(form.priceEur * 100).toString())

    await api.fetch('/api/store/adventures', {
      method: 'POST',
      body: formData,
    })

    // Refresh store data and redirect
    await adventureStore.refresh()
    router.push('/store')
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
