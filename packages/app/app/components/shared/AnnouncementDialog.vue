<template>
  <v-dialog v-model="showDialog" max-width="500" persistent>
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon icon="mdi-party-popper" color="primary" class="mr-2" />
        {{ $t(currentAnnouncement?.titleKey || '') }}
      </v-card-title>

      <v-card-text>
        <p class="text-body-1 mb-4">
          {{ $t(currentAnnouncement?.contentKey || '') }}
        </p>

        <!-- OS-specific installer path -->
        <template v-if="currentAnnouncement?.showInstallerPath">
          <v-alert type="info" variant="tonal" class="mb-4">
            <div class="text-subtitle-2 mb-1">
              {{ $t('announcements.installerPath', { os: osName }) }}
            </div>
            <code class="text-body-2">{{ installerPath }}</code>
          </v-alert>

          <p class="text-body-2 text-medium-emphasis">
            {{ $t('announcements.autoUpdateHint') }}
          </p>
        </template>
      </v-card-text>

      <v-divider />

      <v-card-actions class="pa-4">
        <v-checkbox
          v-model="dontShowAgain"
          :label="$t('announcements.dontShowAgain')"
          density="compact"
          hide-details
        />
        <v-spacer />
        <v-btn color="primary" variant="flat" @click="dismissAnnouncement">
          {{ $t('common.ok') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { useAnnouncements } from '~/composables/useAnnouncements'

const {
  showDialog,
  dontShowAgain,
  currentAnnouncement,
  installerPath,
  osName,
  checkForAnnouncements,
  dismissAnnouncement,
} = useAnnouncements()

// Check for announcements on mount
onMounted(() => {
  // Small delay to let app fully load first
  setTimeout(() => {
    checkForAnnouncements()
  }, 500)
})
</script>
