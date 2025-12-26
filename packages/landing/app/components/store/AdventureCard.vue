<template>
  <v-card
    class="adventure-card d-flex flex-column"
    :to="`/store/${adventure.slug}`"
    elevation="0"
    hover
  >
    <!-- Cover Image - Fixed 16:9 -->
    <div class="cover-wrapper flex-shrink-0">
      <div class="cover-frame" @click.prevent="openImagePreview">
        <v-img
          :src="adventure.coverImageUrl || '/images/store/default-cover.png'"
          :alt="adventure.title"
          aspect-ratio="16/9"
          cover
          class="cover-image"
        >
          <template #placeholder>
            <div class="d-flex align-center justify-center fill-height bg-surface-variant">
              <v-icon icon="mdi-treasure-chest" size="48" color="primary" />
            </div>
          </template>

          <!-- Zoom Icon Overlay -->
          <div class="image-zoom-overlay">
            <v-icon icon="mdi-magnify-plus" size="24" color="white" />
          </div>
        </v-img>
      </div>

      <!-- Price Badge -->
      <div class="price-badge">
        <v-chip
          :color="adventure.priceCents === 0 ? 'success' : 'primary'"
          size="small"
          variant="flat"
        >
          {{ adventure.priceCents === 0 ? $t('store.card.free') : formatPrice(adventure.priceCents, adventure.currency) }}
        </v-chip>
      </div>

      <!-- Language Badge -->
      <div class="language-badge">
        <v-chip size="x-small" variant="tonal">
          {{ adventure.language?.toUpperCase() }}
        </v-chip>
      </div>

      <!-- Favorite Star (only if logged in) -->
      <div v-if="isAuthenticated" class="favorite-badge">
        <v-btn
          :icon="isFavorite ? 'mdi-star' : 'mdi-star-outline'"
          :color="isFavorite ? 'amber' : 'white'"
          size="small"
          variant="text"
          :loading="favoriteLoading"
          @click.prevent="toggleFavorite"
        />
      </div>
    </div>

    <v-card-text class="card-content pa-3 d-flex flex-column flex-grow-1">
      <!-- Title - Fixed height -->
      <h3 class="text-subtitle-1 font-weight-medium mb-1 title-text">
        {{ adventure.title }}
      </h3>

      <!-- Author -->
      <div class="d-flex align-center mb-2">
        <v-icon icon="mdi-account" size="x-small" class="mr-1 text-medium-emphasis" />
        <span class="text-caption text-medium-emphasis">{{ adventure.authorName }}</span>
      </div>

      <!-- Players & Difficulty Row -->
      <div class="d-flex align-center ga-3 mb-2">
        <!-- Players -->
        <div class="d-flex align-center text-medium-emphasis">
          <v-icon icon="mdi-account-group" size="small" class="mr-1" />
          <span class="text-caption">{{ formatPlayers(adventure.playersMin, adventure.playersMax) }}</span>
        </div>

        <!-- Difficulty -->
        <div class="d-flex align-center">
          <v-icon :icon="getDifficultyIcon(adventure.difficulty)" :color="getDifficultyColor(adventure.difficulty)" size="small" class="mr-1" />
          <span class="text-caption" :class="`text-${getDifficultyColor(adventure.difficulty)}`">
            {{ $t(`store.difficulty.${getDifficultyKey(adventure.difficulty)}`) }}
          </span>
        </div>
      </div>

      <!-- Spacer to push bottom content down -->
      <div class="flex-grow-1" />

      <!-- Stats Row -->
      <div class="d-flex align-center justify-space-between mb-2">
        <!-- Rating -->
        <div class="d-flex align-center">
          <v-rating
            :model-value="adventure.avgRating || 0"
            density="compact"
            size="small"
            color="amber"
            half-increments
            readonly
          />
          <span class="text-caption text-medium-emphasis ml-1">
            ({{ adventure.ratingCount || 0 }})
          </span>
        </div>

        <!-- Downloads -->
        <div class="d-flex align-center text-medium-emphasis">
          <v-icon icon="mdi-download" size="small" class="mr-1" />
          <span class="text-caption">{{ formatDownloads(adventure.downloadCount) }}</span>
        </div>
      </div>

      <!-- Tags - Always show container for consistent height -->
      <div class="tags-container d-flex flex-wrap ga-1">
        <template v-if="adventure.tags?.length">
          <v-chip
            v-for="tag in adventure.tags.slice(0, 2)"
            :key="tag"
            size="x-small"
            variant="outlined"
            color="primary"
          >
            {{ tag }}
          </v-chip>
          <v-chip
            v-if="adventure.tags.length > 2"
            size="x-small"
            variant="text"
            color="primary"
          >
            +{{ adventure.tags.length - 2 }}
          </v-chip>
        </template>
        <span v-else class="text-caption">&nbsp;</span>
      </div>

      <!-- Version & Date Row -->
      <div class="d-flex align-center justify-space-between mt-2 text-caption text-medium-emphasis">
        <span class="d-flex align-center">
          <v-icon icon="mdi-tag-outline" size="x-small" class="mr-1" />
          v{{ adventure.versionNumber || 1 }}
        </span>
        <span v-if="adventure.publishedAt">
          {{ formatDate(adventure.publishedAt) }}
        </span>
      </div>
    </v-card-text>
  </v-card>

  <!-- Image Preview Dialog -->
  <v-dialog v-model="showImagePreview" max-width="900" content-class="image-preview-dialog">
    <v-card class="bg-transparent" elevation="0">
      <v-img
        :src="adventure.coverImageUrl || '/images/store/default-cover.png'"
        :alt="adventure.title"
        max-height="80vh"
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
</template>

<script setup lang="ts">
import type { AdventureCard } from '~/stores/adventureStore'
import { useFavoritesStore } from '~/stores/favoritesStore'

const props = defineProps<{
  adventure: AdventureCard
}>()

const { isAuthenticated } = useAuth()
const favoritesStore = useFavoritesStore()
const { getDifficultyKey, getDifficultyColor, getDifficultyIcon } = useDifficulty()

const showImagePreview = ref(false)
const favoriteLoading = ref(false)

const isFavorite = computed(() => favoritesStore.isFavorite(props.adventure.id))

async function toggleFavorite(event: Event) {
  event.preventDefault()
  event.stopPropagation()

  favoriteLoading.value = true
  try {
    await favoritesStore.toggleFavorite(props.adventure.id)
  } catch (error) {
    console.error('Failed to toggle favorite:', error)
  } finally {
    favoriteLoading.value = false
  }
}

function openImagePreview(event: Event) {
  event.preventDefault()
  event.stopPropagation()
  showImagePreview.value = true
}

function formatPrice(cents: number, currency: string): string {
  const amount = cents / 100
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: currency || 'EUR',
  }).format(amount)
}

function formatDownloads(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`
  }
  return count.toString()
}

function formatPlayers(min: number, max: number): string {
  if (!min && !max) return '?'
  if (min === max) return `${min}`
  if (!min) return `1-${max}`
  if (!max) return `${min}+`
  return `${min}-${max}`
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}
</script>

<style scoped>
.adventure-card {
  background: rgba(var(--v-theme-surface-variant), 0.3);
  border: 1px solid rgba(var(--v-theme-outline), 0.1);
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.3s ease;
}

.adventure-card:hover {
  transform: translateY(-4px);
  border-color: rgba(var(--v-theme-primary), 0.3);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
}

.cover-wrapper {
  position: relative;
  padding: 0.75rem;
  padding-bottom: 0;
}

.cover-frame {
  position: relative;
  aspect-ratio: 16 / 9;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(var(--v-theme-primary), 0.2);
  cursor: zoom-in;
}

.cover-frame :deep(.v-img) {
  width: 100%;
  height: 100%;
}

.cover-image {
  transition: transform 0.3s ease;
}

.adventure-card:hover .cover-image {
  transform: scale(1.05);
}

.image-zoom-overlay {
  position: absolute;
  bottom: 50%;
  right: 50%;
  transform: translate(50%, 50%);
  background: rgba(0, 0, 0, 0.5);
  border-radius: 50%;
  padding: 6px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.cover-image:hover .image-zoom-overlay {
  opacity: 1;
}

.price-badge {
  position: absolute;
  top: 1rem;
  right: 1rem;
}

.language-badge {
  position: absolute;
  top: 1rem;
  left: 1rem;
}

.favorite-badge {
  position: absolute;
  bottom: 0.5rem;
  right: 0.5rem;
}

.favorite-badge :deep(.v-btn) {
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
}

.text-truncate-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.3;
  min-height: 2.6em;
}

/* Dialog styling */
:deep(.image-preview-dialog) {
  background: transparent !important;
  box-shadow: none !important;
}
</style>
