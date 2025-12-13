<template>
  <div v-if="showBanner" class="update-banner">
    <!-- Expanded view (when drawer is not in rail mode) -->
    <v-card
      v-if="!rail"
      color="primary"
      variant="tonal"
      class="ma-2 update-card"
    >
      <v-card-text class="pa-3">
        <div class="d-flex align-center mb-2">
          <v-icon icon="mdi-party-popper" class="mr-2" />
          <span class="text-body-2 font-weight-medium">
            {{ $t('update.newVersionAvailable') }}
          </span>
        </div>
        <div class="text-caption mb-2">
          {{ updateInfo?.latestVersion }}
        </div>
        <div class="d-flex gap-2">
          <v-btn
            size="small"
            color="primary"
            variant="flat"
            :href="updateInfo?.releaseUrl"
            target="_blank"
            block
          >
            <v-icon start icon="mdi-download" />
            {{ $t('update.download') }}
          </v-btn>
        </div>
        <v-btn
          size="x-small"
          variant="text"
          class="mt-2"
          block
          @click="dismissUpdate"
        >
          {{ $t('update.dismiss') }}
        </v-btn>
      </v-card-text>
    </v-card>

    <!-- Collapsed view (rail mode) - just an icon with tooltip -->
    <v-tooltip v-else location="right">
      <template #activator="{ props }">
        <v-btn
          v-bind="props"
          icon
          variant="text"
          color="primary"
          class="ma-2"
          :href="updateInfo?.releaseUrl"
          target="_blank"
        >
          <v-badge color="error" dot>
            <v-icon icon="mdi-download" />
          </v-badge>
        </v-btn>
      </template>
      <span>{{ $t('update.newVersionAvailable') }}: {{ updateInfo?.latestVersion }}</span>
    </v-tooltip>
  </div>
</template>

<script setup lang="ts">
import { useUpdateChecker } from '~/composables/useUpdateChecker'

defineProps<{
  rail: boolean
}>()

const { updateInfo, showBanner, checkForUpdates, dismissUpdate } = useUpdateChecker()

// Check for updates on mount
onMounted(() => {
  checkForUpdates()
})
</script>

<style scoped>
.update-banner {
  width: 100%;
}

.update-card {
  border-radius: 8px;
}
</style>
