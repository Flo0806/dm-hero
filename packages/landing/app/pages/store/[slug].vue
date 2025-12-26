<template>
  <div>
    <StoreBackground />
    <v-container class="py-8 position-relative" style="z-index: 1">
    <!-- Back Button -->
    <v-btn
      variant="text"
      color="primary"
      prepend-icon="mdi-arrow-left"
      to="/store"
      class="mb-6"
    >
      {{ $t('store.detail.backToStore') }}
    </v-btn>

    <!-- Loading -->
    <template v-if="pending">
      <v-skeleton-loader type="image" height="400" class="rounded-xl mb-6" />
      <v-skeleton-loader type="heading" class="mb-4" />
      <v-skeleton-loader type="paragraph" />
    </template>

    <!-- Error -->
    <v-alert v-else-if="error" type="error" variant="tonal">
      {{ error.message }}
    </v-alert>

    <!-- Content -->
    <template v-else-if="adventure">
      <!-- Hero Image -->
      <div v-if="adventure.coverImageUrl" class="hero-image-wrapper mb-6" @click="openImagePreview">
        <v-img
          :src="adventure.coverImageUrl"
          :aspect-ratio="16 / 9"
          cover
          class="rounded-xl hero-image"
        >
          <template #placeholder>
            <v-skeleton-loader type="image" height="100%" />
          </template>
        </v-img>

        <!-- Zoom Icon Overlay (positioned over the image) -->
        <div class="image-zoom-overlay">
          <v-icon icon="mdi-magnify-plus" size="32" color="white" />
        </div>
      </div>

      <!-- Placeholder when no image -->
      <div
        v-else
        class="hero-placeholder rounded-xl mb-6 d-flex align-center justify-center"
      >
        <div class="text-center">
          <v-icon icon="mdi-treasure-chest" size="80" color="primary" class="mb-2" />
          <p class="text-medium-emphasis">{{ $t('store.detail.noImage') }}</p>
        </div>
      </div>

      <v-row>
        <!-- Main Content -->
        <v-col cols="12" lg="8">
          <!-- Title & Meta -->
          <div class="mb-6">
            <h1 class="text-h3 font-weight-bold mb-2">
              {{ adventure.title }}
            </h1>
            <div class="d-flex align-center flex-wrap ga-3 text-medium-emphasis mb-3">
              <span class="d-flex align-center">
                <v-icon icon="mdi-account" size="small" class="mr-1" />
                {{ adventure.author }}
              </span>
            </div>

            <!-- Social Links -->
            <SharedSocialLinks
              v-if="adventure.authorDiscord"
              :discord="adventure.authorDiscord"
              class="mb-4"
            />

            <!-- Rating -->
            <StoreAdventureRating :adventure-id="adventure.id" />
          </div>

          <!-- Short Description -->
          <p v-if="adventure.shortDescription" class="text-h6 text-medium-emphasis mb-6">
            {{ adventure.shortDescription }}
          </p>

          <!-- Highlights -->
          <v-card v-if="adventure.highlights?.length" class="mb-6" elevation="0">
            <v-card-title class="d-flex align-center">
              <v-icon icon="mdi-star" class="mr-2" color="amber" />
              {{ $t('store.detail.highlights') }}
            </v-card-title>
            <v-card-text>
              <v-list density="compact">
                <v-list-item
                  v-for="(highlight, i) in adventure.highlights"
                  :key="i"
                  prepend-icon="mdi-check-circle"
                  :title="highlight"
                />
              </v-list>
            </v-card-text>
          </v-card>

          <!-- Full Description -->
          <v-card v-if="adventure.description" class="mb-6" elevation="0">
            <v-card-title class="d-flex align-center">
              <v-icon icon="mdi-text" class="mr-2" />
              {{ $t('store.detail.description') }}
            </v-card-title>
            <v-card-text>
              <!-- eslint-disable-next-line vue/no-v-html -->
              <div class="description-content" v-html="adventure.description" />
            </v-card-text>
          </v-card>

          <!-- Tags -->
          <div v-if="adventure.tags?.length" class="mb-6">
            <v-chip
              v-for="tag in adventure.tags"
              :key="tag"
              class="mr-2 mb-2"
              variant="tonal"
              size="small"
            >
              {{ tag }}
            </v-chip>
          </div>
        </v-col>

        <!-- Sidebar -->
        <v-col cols="12" lg="4">
          <!-- Download Card -->
          <v-card class="mb-4 download-card" elevation="0">
            <v-card-text class="text-center py-6">
              <div class="d-flex justify-center ga-2 mb-4">
                <v-chip color="success" variant="flat" size="large">
                  {{ $t('store.card.free') }}
                </v-chip>
                <v-chip color="primary" variant="tonal" size="large" prepend-icon="mdi-tag-outline">
                  v{{ adventure.versionNumber || latestFile?.versionNumber || 1 }}
                </v-chip>
              </div>
              <v-btn
                color="primary"
                size="x-large"
                block
                prepend-icon="mdi-download"
                :loading="downloading"
                @click="handleDownload"
              >
                {{ $t('store.detail.download') }}
              </v-btn>
              <p class="text-caption text-medium-emphasis mt-3">
                {{ formatFileSize(latestFile?.fileSize || 0) }}
              </p>
              <p class="text-caption text-medium-emphasis">
                {{ adventure.downloadCount }} {{ $t('store.detail.downloads') }}
              </p>
              <p v-if="adventure.publishedAt" class="text-caption text-medium-emphasis mt-1">
                {{ $t('store.detail.publishedAt') }}: {{ formatDate(adventure.publishedAt) }}
              </p>
            </v-card-text>
          </v-card>

          <!-- Game Details Card -->
          <v-card elevation="0">
            <v-card-title class="d-flex align-center">
              <v-icon icon="mdi-information" class="mr-2" />
              {{ $t('store.detail.gameDetails') }}
            </v-card-title>
            <v-card-text>
              <v-list density="compact">
                <v-list-item>
                  <template #prepend>
                    <v-icon icon="mdi-dice-d20" />
                  </template>
                  <v-list-item-title>{{ $t('store.upload.fields.system') }}</v-list-item-title>
                  <v-list-item-subtitle>{{ systemLabel }}</v-list-item-subtitle>
                </v-list-item>

                <v-list-item>
                  <template #prepend>
                    <v-icon icon="mdi-sword-cross" />
                  </template>
                  <v-list-item-title>{{ $t('store.upload.fields.difficulty') }}</v-list-item-title>
                  <v-list-item-subtitle>{{ difficultyLabel }}</v-list-item-subtitle>
                </v-list-item>

                <v-list-item>
                  <template #prepend>
                    <v-icon icon="mdi-account-group" />
                  </template>
                  <v-list-item-title>{{ $t('store.upload.fields.players') }}</v-list-item-title>
                  <v-list-item-subtitle>
                    {{ adventure.playersMin }}-{{ adventure.playersMax }}
                  </v-list-item-subtitle>
                </v-list-item>

                <v-list-item>
                  <template #prepend>
                    <v-icon icon="mdi-arrow-up-bold" />
                  </template>
                  <v-list-item-title>{{ $t('store.upload.fields.characterLevel') }}</v-list-item-title>
                  <v-list-item-subtitle>
                    {{ adventure.levelMin }}-{{ adventure.levelMax }}
                  </v-list-item-subtitle>
                </v-list-item>

                <v-list-item>
                  <template #prepend>
                    <v-icon icon="mdi-clock-outline" />
                  </template>
                  <v-list-item-title>{{ $t('store.upload.fields.duration') }}</v-list-item-title>
                  <v-list-item-subtitle>{{ durationLabel }}</v-list-item-subtitle>
                </v-list-item>

                <v-list-item>
                  <template #prepend>
                    <v-icon icon="mdi-translate" />
                  </template>
                  <v-list-item-title>{{ $t('store.upload.fields.language') }}</v-list-item-title>
                  <v-list-item-subtitle>
                    {{ adventure.language === 'de' ? 'Deutsch' : 'English' }}
                  </v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </template>
  </v-container>

  <!-- Image Preview Dialog -->
  <v-dialog v-model="showImagePreview" max-width="1200" content-class="image-preview-dialog">
    <v-card class="bg-transparent" elevation="0">
      <v-img
        :src="adventure?.coverImageUrl || '/images/store/default-cover.png'"
        :alt="adventure?.title"
        max-height="85vh"
        contain
        class="rounded-lg"
        @click="showImagePreview = false"
      />
      <v-card-actions class="justify-center pt-4">
        <v-btn variant="tonal" color="white" prepend-icon="mdi-close" @click="showImagePreview = false">
          {{ $t('common.close') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Footer -->
  <FooterSection />
  </div>
</template>

<script setup lang="ts">
import { useAdventureStore } from '~/stores/adventureStore'

const { t } = useI18n()
const route = useRoute()
const store = useAdventureStore()

const pending = ref(true)
const error = ref<Error | null>(null)
const downloading = ref(false)
const showImagePreview = ref(false)

function openImagePreview() {
  if (adventure.value?.coverImageUrl) {
    showImagePreview.value = true
  }
}

// Fetch adventure detail from store
onMounted(async () => {
  try {
    await store.fetchAdventureDetail(route.params.slug as string)
  } catch (e) {
    error.value = e as Error
  } finally {
    pending.value = false
  }
})

// Reactive adventure from store
const adventure = computed(() => store.getAdventureBySlug(route.params.slug as string))
const latestFile = computed(() => adventure.value?.files[0])

const systemLabel = computed(() => {
  const systems: Record<string, string> = {
    dnd5e: 'D&D 5e',
    pf2e: 'Pathfinder 2e',
    dnd3_5: 'D&D 3.5',
    coc: 'Call of Cthulhu',
    other: t('store.detail.otherSystem'),
  }
  return systems[adventure.value?.system || 'dnd5e'] || adventure.value?.system
})

const { getDifficultyLabel } = useDifficulty()
const difficultyLabel = computed(() => getDifficultyLabel(adventure.value?.difficulty || 3))

const durationLabel = computed(() => {
  const hours = adventure.value?.durationHours || 4
  if (hours >= 20) return t('store.upload.multiSession')
  if (hours >= 8) return '8+ ' + t('store.upload.hours')
  if (hours >= 6) return '6-8 ' + t('store.upload.hours')
  if (hours >= 4) return '4-6 ' + t('store.upload.hours')
  if (hours >= 2) return '2-4 ' + t('store.upload.hours')
  return '1-2 ' + t('store.upload.hours')
})

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

async function handleDownload() {
  if (!adventure.value) return

  downloading.value = true
  try {
    // Store handles the full download process now (blob + trigger)
    await store.downloadAdventure(adventure.value.slug, adventure.value.title)
  } catch (err) {
    console.error('Download failed:', err)
  } finally {
    downloading.value = false
  }
}
</script>

<style scoped>
.hero-image-wrapper {
  position: relative;
  cursor: zoom-in;
}

.hero-image {
  max-height: 500px;
  transition: transform 0.3s ease;
}

.hero-image-wrapper:hover .hero-image {
  transform: scale(1.01);
}

.hero-placeholder {
  aspect-ratio: 16 / 9;
  max-height: 500px;
  background: rgba(var(--v-theme-surface-variant), 0.5);
  border: 2px dashed rgba(var(--v-theme-outline), 0.3);
  cursor: default;
}

.image-zoom-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.6);
  border-radius: 50%;
  padding: 16px;
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
}

.hero-image-wrapper:hover .image-zoom-overlay {
  opacity: 1;
}

/* Dialog styling */
:deep(.image-preview-dialog) {
  background: transparent !important;
  box-shadow: none !important;
}

.download-card {
  background: linear-gradient(
    135deg,
    rgba(var(--v-theme-primary), 0.1) 0%,
    rgba(var(--v-theme-primary), 0.05) 100%
  );
  border: 1px solid rgba(var(--v-theme-primary), 0.2);
}

.description-content {
  line-height: 1.8;
}

.description-content :deep(h1),
.description-content :deep(h2),
.description-content :deep(h3) {
  margin-top: 1.5rem;
  margin-bottom: 0.75rem;
}

.description-content :deep(p) {
  margin-bottom: 1rem;
}

.description-content :deep(ul),
.description-content :deep(ol) {
  margin-bottom: 1rem;
  padding-left: 1.5rem;
}
</style>
