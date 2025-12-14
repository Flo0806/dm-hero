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
      <v-img
        v-if="adventure.coverImageUrl"
        :src="adventure.coverImageUrl"
        :aspect-ratio="16 / 10"
        cover
        class="rounded-xl mb-6 hero-image"
      >
        <template #placeholder>
          <v-skeleton-loader type="image" height="100%" />
        </template>
      </v-img>

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
              <v-chip color="success" variant="flat" size="large" class="mb-4">
                {{ $t('store.card.free') }}
              </v-chip>
              <v-btn
                color="primary"
                size="x-large"
                block
                prepend-icon="mdi-download"
                :href="latestFile?.filePath"
                :download="adventure.title + '.dmhero'"
              >
                {{ $t('store.detail.download') }}
              </v-btn>
              <p class="text-caption text-medium-emphasis mt-2">
                {{ formatFileSize(latestFile?.fileSize || 0) }} · v{{ latestFile?.versionNumber || 1 }}
              </p>
              <p class="text-caption text-medium-emphasis">
                {{ adventure.downloadCount }} {{ $t('store.detail.downloads') }}
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
  </div>
</template>

<script setup lang="ts">
import { useAdventureStore } from '~/stores/adventureStore'

const { t } = useI18n()
const route = useRoute()
const store = useAdventureStore()

const pending = ref(true)
const error = ref<Error | null>(null)

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

const difficultyLabel = computed(() => {
  const levels = ['easy', 'moderate', 'challenging', 'hard', 'deadly']
  const level = levels[Math.min((adventure.value?.difficulty || 3) - 1, 4)]
  return t(`store.difficulty.${level}`)
})

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
</script>

<style scoped>
.hero-image {
  max-height: 500px;
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
