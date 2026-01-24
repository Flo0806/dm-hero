<template>
  <div v-if="showBanner || isDownloading || isReadyToInstall" class="update-banner">
    <!-- Expanded view (when drawer is not in rail mode) -->
    <v-card
      v-if="!rail"
      color="primary"
      variant="tonal"
      class="ma-2 update-card"
    >
      <v-card-text class="pa-3">
        <!-- Header -->
        <div class="d-flex align-center mb-2">
          <v-icon :icon="headerIcon" class="mr-2" />
          <span class="text-body-2 font-weight-medium">
            {{ headerText }}
          </span>
        </div>

        <!-- Version info -->
        <div v-if="updateInfo" class="text-caption mb-2">
          {{ updateInfo.latestVersion }}
          <v-chip
            v-if="updateInfo.isDevMode"
            size="x-small"
            color="warning"
            class="ml-1"
          >
            DEV
          </v-chip>
        </div>

        <!-- Progress bar (downloading) -->
        <div v-if="isDownloading && downloadProgress" class="mb-2">
          <v-progress-linear
            :model-value="downloadProgress.percent"
            color="primary"
            height="8"
            rounded
          />
          <div class="text-caption mt-1 d-flex justify-space-between">
            <span>{{ Math.round(downloadProgress.percent) }}%</span>
            <span>{{ formatSpeed(downloadProgress.bytesPerSecond) }}</span>
          </div>
        </div>

        <!-- Action buttons -->
        <div class="d-flex ga-2">
          <!-- State: Update available - show download button (Electron) or external link (Browser) -->
          <template v-if="!isDownloading && !isReadyToInstall">
            <v-btn
              v-if="canAutoUpdate"
              size="small"
              color="primary"
              variant="flat"
              block
              @click="startDownload"
            >
              <v-icon start icon="mdi-download" />
              {{ $t('update.downloadNow') }}
            </v-btn>
            <v-btn
              v-else
              size="small"
              color="primary"
              variant="flat"
              block
              @click="openDownloadPage"
            >
              <v-icon start icon="mdi-open-in-new" />
              {{ $t('update.download') }}
            </v-btn>
          </template>

          <!-- State: Downloading - show cancel (disabled for now) -->
          <template v-else-if="isDownloading">
            <v-btn
              size="small"
              color="primary"
              variant="flat"
              block
              disabled
            >
              <v-progress-circular
                indeterminate
                size="16"
                width="2"
                class="mr-2"
              />
              {{ $t('update.downloading') }}
            </v-btn>
          </template>

          <!-- State: Ready to install -->
          <template v-else-if="isReadyToInstall">
            <v-btn
              size="small"
              color="success"
              variant="flat"
              block
              @click="restartAndInstall"
            >
              <v-icon start icon="mdi-restart" />
              {{ $t('update.restartNow') }}
            </v-btn>
          </template>
        </div>

        <!-- Dismiss button (only when not downloading/ready) -->
        <v-btn
          v-if="!isDownloading && !isReadyToInstall"
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
          :color="railButtonColor"
          class="ma-2"
          @click="handleRailClick"
        >
          <v-badge v-if="!isDownloading" color="error" dot>
            <v-icon :icon="railIcon" />
          </v-badge>
          <v-progress-circular
            v-else
            :model-value="downloadProgress?.percent || 0"
            size="24"
            width="3"
            color="primary"
          />
        </v-btn>
      </template>
      <span>{{ railTooltip }}</span>
    </v-tooltip>
  </div>
</template>

<script setup lang="ts">
import { useUpdateChecker } from '~/composables/useUpdateChecker'
import { useElectron } from '~/composables/useElectron'

defineProps<{
  rail: boolean
}>()

const { t } = useI18n()

const {
  updateInfo,
  showBanner,
  downloadProgress,
  isDownloading,
  isReadyToInstall,
  canAutoUpdate,
  checkForUpdates,
  downloadUpdate,
  installUpdate,
  dismissUpdate,
} = useUpdateChecker()

const { openExternalUrl } = useElectron()

// Computed
const headerIcon = computed(() => {
  if (isReadyToInstall.value) return 'mdi-check-circle'
  if (isDownloading.value) return 'mdi-download'
  return 'mdi-party-popper'
})

const headerText = computed(() => {
  if (isReadyToInstall.value) return t('update.readyToInstall')
  if (isDownloading.value) return t('update.downloading')
  return t('update.newVersionAvailable')
})

const railIcon = computed(() => {
  if (isReadyToInstall.value) return 'mdi-restart'
  return 'mdi-download'
})

const railButtonColor = computed(() => {
  if (isReadyToInstall.value) return 'success'
  return 'primary'
})

const railTooltip = computed(() => {
  if (isReadyToInstall.value) return t('update.clickToRestart')
  if (isDownloading.value) return `${t('update.downloading')} ${Math.round(downloadProgress.value?.percent || 0)}%`
  return `${t('update.newVersionAvailable')}: ${updateInfo.value?.latestVersion}`
})

// Actions
function openDownloadPage() {
  if (updateInfo.value?.releaseUrl) {
    openExternalUrl(updateInfo.value.releaseUrl)
  }
}

async function startDownload() {
  await downloadUpdate()
}

async function restartAndInstall() {
  await installUpdate()
}

function handleRailClick() {
  if (isReadyToInstall.value) {
    restartAndInstall()
  } else if (!isDownloading.value && canAutoUpdate.value) {
    startDownload()
  } else if (!canAutoUpdate.value) {
    openDownloadPage()
  }
}

// Format bytes per second to human readable
function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond >= 1024 * 1024) {
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`
  }
  if (bytesPerSecond >= 1024) {
    return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`
  }
  return `${bytesPerSecond} B/s`
}

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
