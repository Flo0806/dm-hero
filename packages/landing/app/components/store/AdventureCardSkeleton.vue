<template>
  <v-card class="adventure-card-skeleton h-100" elevation="0">
    <!-- Cover Skeleton -->
    <v-skeleton-loader type="image" class="cover-skeleton" />

    <v-card-text class="pa-4">
      <!-- Title -->
      <v-skeleton-loader type="heading" class="mb-2" />

      <!-- Author -->
      <v-skeleton-loader type="text" width="40%" class="mb-2" />

      <!-- Description -->
      <v-skeleton-loader type="paragraph" class="mb-3" />

      <!-- Stats -->
      <div class="d-flex justify-space-between">
        <v-skeleton-loader type="chip" width="100px" />
        <v-skeleton-loader type="chip" width="60px" />
      </div>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.adventure-card-skeleton {
  background: rgba(var(--v-theme-surface-variant), 0.3);
  border: 1px solid rgba(var(--v-theme-outline), 0.1);
  border-radius: 16px;
  overflow: hidden;
}

.cover-skeleton {
  aspect-ratio: 16/10;
}
</style>
