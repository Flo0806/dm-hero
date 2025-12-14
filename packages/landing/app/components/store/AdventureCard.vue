<template>
  <v-card
    class="adventure-card h-100"
    :to="`/store/${adventure.slug}`"
    elevation="0"
    hover
  >
    <!-- Cover Image -->
    <div class="cover-container">
      <v-img
        :src="adventure.coverImageUrl || '/images/store/default-cover.png'"
        :alt="adventure.title"
        aspect-ratio="16/10"
        cover
        class="cover-image"
      >
        <template #placeholder>
          <div class="d-flex align-center justify-center fill-height bg-surface-variant">
            <v-icon icon="mdi-treasure-chest" size="48" color="primary" />
          </div>
        </template>
      </v-img>

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
    </div>

    <v-card-text class="pa-4">
      <!-- Title -->
      <h3 class="text-h6 font-weight-medium mb-1 text-truncate-2">
        {{ adventure.title }}
      </h3>

      <!-- Author -->
      <div class="d-flex align-center mb-2">
        <v-icon icon="mdi-account" size="small" class="mr-1 text-medium-emphasis" />
        <span class="text-body-2 text-medium-emphasis">{{ adventure.authorName }}</span>
      </div>

      <!-- Short Description -->
      <p class="text-body-2 text-medium-emphasis mb-3 text-truncate-3">
        {{ adventure.shortDescription || adventure.description }}
      </p>

      <!-- Stats Row -->
      <div class="d-flex align-center justify-space-between">
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

      <!-- Tags -->
      <div v-if="adventure.tags?.length" class="mt-3 d-flex flex-wrap ga-1">
        <v-chip
          v-for="tag in adventure.tags.slice(0, 3)"
          :key="tag"
          size="x-small"
          variant="outlined"
          color="primary"
        >
          {{ tag }}
        </v-chip>
        <v-chip
          v-if="adventure.tags.length > 3"
          size="x-small"
          variant="text"
          color="primary"
        >
          +{{ adventure.tags.length - 3 }}
        </v-chip>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import type { AdventureCard } from '~/stores/adventureStore'

defineProps<{
  adventure: AdventureCard
}>()

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
</script>

<style scoped>
.adventure-card {
  background: rgba(var(--v-theme-surface-variant), 0.3);
  border: 1px solid rgba(var(--v-theme-outline), 0.1);
  border-radius: 16px;
  overflow: hidden;
  transition: all 0.3s ease;
}

.adventure-card:hover {
  transform: translateY(-4px);
  border-color: rgba(var(--v-theme-primary), 0.3);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
}

.cover-container {
  position: relative;
  overflow: hidden;
}

.cover-image {
  transition: transform 0.3s ease;
}

.adventure-card:hover .cover-image {
  transform: scale(1.05);
}

.price-badge {
  position: absolute;
  top: 12px;
  right: 12px;
}

.language-badge {
  position: absolute;
  top: 12px;
  left: 12px;
}

.text-truncate-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.4;
  min-height: 2.8em;
}

.text-truncate-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.5;
  min-height: 4.5em;
}
</style>
