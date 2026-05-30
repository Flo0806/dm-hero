<script setup lang="ts">
const { t } = useI18n()

interface Release {
  tag_name: string
  html_url: string
  assets: {
    name: string
    browser_download_url: string
    size: number
  }[]
}

const latestRelease = ref<Release | null>(null)
const loading = ref(true)
const error = ref(false)

// Fetch latest release from GitHub API (including pre-releases)
async function fetchLatestRelease() {
  try {
    loading.value = true
    error.value = false

    // Get all releases (includes pre-releases)
    const response = await fetch(
      'https://api.github.com/repos/Flo0806/dm-hero/releases',
    )

    if (!response.ok) {
      throw new Error('Failed to fetch releases')
    }

    const releases = await response.json()
    // Filter to only app releases (tag starts with "v", not "landing-v")
    const appReleases = releases.filter(
      (r: Release) => r.tag_name.startsWith('v') && !r.tag_name.startsWith('landing-v'),
    )
    if (appReleases.length > 0) {
      latestRelease.value = appReleases[0]
    }
  }
  catch {
    error.value = true
    console.error('Failed to fetch latest release')
  }
  finally {
    loading.value = false
  }
}

// Get download URL for specific platform
function getDownloadUrl(platform: 'windows' | 'linux' | 'mac-arm64' | 'mac-x64'): string | null {
  if (!latestRelease.value) return null

  const assets = latestRelease.value.assets

  if (platform === 'windows') {
    // Prefer .exe installer for auto-updates, fallback to .zip
    const exe = assets.find(a => a.name.endsWith('.exe'))
    if (exe) return exe.browser_download_url
    const zip = assets.find(a => a.name.endsWith('.zip') && a.name.toLowerCase().includes('win'))
    return zip?.browser_download_url || null
  }

  if (platform === 'linux') {
    const appImage = assets.find(a => a.name.endsWith('.AppImage'))
    return appImage?.browser_download_url || null
  }

  if (platform === 'mac-arm64') {
    const dmg = assets.find(a => a.name.endsWith('.dmg') && a.name.includes('arm64'))
    return dmg?.browser_download_url || null
  }

  if (platform === 'mac-x64') {
    const dmg = assets.find(a => a.name.endsWith('.dmg') && a.name.includes('x64'))
    return dmg?.browser_download_url || null
  }

  return null
}

// Format file size
function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  return `${mb.toFixed(1)} MB`
}

// Get file size for platform
function getFileSize(platform: 'windows' | 'linux' | 'mac-arm64' | 'mac-x64'): string | null {
  if (!latestRelease.value) return null

  const assets = latestRelease.value.assets
  let asset = null

  if (platform === 'windows') {
    // Prefer .exe installer size, fallback to .zip
    asset = assets.find(a => a.name.endsWith('.exe'))
    if (!asset) {
      asset = assets.find(a => a.name.endsWith('.zip') && a.name.toLowerCase().includes('win'))
    }
  }
  else if (platform === 'linux') {
    asset = assets.find(a => a.name.endsWith('.AppImage'))
  }
  else if (platform === 'mac-arm64') {
    asset = assets.find(a => a.name.endsWith('.dmg') && a.name.includes('arm64'))
  }
  else if (platform === 'mac-x64') {
    asset = assets.find(a => a.name.endsWith('.dmg') && a.name.includes('x64'))
  }

  return asset ? formatSize(asset.size) : null
}

const platforms = [
  {
    key: 'windows',
    icon: 'mdi-microsoft-windows',
    available: true,
    split: false,
  },
  {
    key: 'mac',
    icon: 'mdi-apple',
    available: true,
    split: true, // Split button for arm64/x64
  },
  {
    key: 'linux',
    icon: 'mdi-linux',
    available: true,
    split: false,
  },
]

onMounted(() => {
  fetchLatestRelease()
})
</script>

<template>
  <section id="download" class="download-section py-16">
    <!-- Background decoration -->
    <div class="download-bg">
      <div class="download-gradient" />
    </div>

    <v-container class="position-relative">
      <!-- Section Header -->
      <div class="text-center mb-12">
        <h2
          v-motion
          :initial="{ opacity: 0, y: 20 }"
          :visible-once="{ opacity: 1, y: 0 }"
          class="section-title mb-4"
        >
          {{ t('download.title') }}
        </h2>
        <p
          v-motion
          :initial="{ opacity: 0, y: 20 }"
          :visible-once="{ opacity: 1, y: 0, transition: { delay: 200 } }"
          class="section-subtitle mx-auto"
          style="max-width: 600px"
        >
          {{ t('download.subtitle') }}
        </p>

        <!-- Version Badge -->
        <div
          v-motion
          :initial="{ opacity: 0, scale: 0.9 }"
          :visible-once="{ opacity: 1, scale: 1, transition: { delay: 400 } }"
          class="mt-6"
        >
          <v-chip
            v-if="latestRelease"
            color="primary"
            variant="tonal"
            size="large"
            class="px-6"
          >
            <v-icon start>mdi-tag</v-icon>
            {{ t('download.version') }}: {{ latestRelease.tag_name }}
          </v-chip>
          <v-progress-circular
            v-else-if="loading"
            indeterminate
            size="24"
            color="primary"
          />
        </div>

        <!-- Discord Info -->
        <v-alert
          v-motion
          :initial="{ opacity: 0, y: 10 }"
          :visible-once="{ opacity: 1, y: 0, transition: { delay: 500 } }"
          color="#5865F2"
          variant="tonal"
          class="mt-6 mx-auto text-left"
          style="max-width: 600px"
          density="compact"
        >
          <template #prepend>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M19.27 5.33C17.94 4.71 16.5 4.26 15 4a.09.09 0 0 0-.07.03c-.18.33-.39.76-.53 1.09a16.09 16.09 0 0 0-4.8 0c-.14-.34-.35-.76-.54-1.09c-.01-.02-.04-.03-.07-.03c-1.5.26-2.93.71-4.27 1.33c-.01 0-.02.01-.03.02c-2.72 4.07-3.47 8.03-3.1 11.95c0 .02.01.04.03.05c1.8 1.32 3.53 2.12 5.24 2.65c.03.01.06 0 .07-.02c.4-.55.76-1.13 1.07-1.74c.02-.04 0-.08-.04-.09c-.57-.22-1.11-.48-1.64-.78c-.04-.02-.04-.08-.01-.11c.11-.08.22-.17.33-.25c.02-.02.05-.02.07-.01c3.44 1.57 7.15 1.57 10.55 0c.02-.01.05-.01.07.01c.11.09.22.17.33.26c.04.03.04.09-.01.11c-.52.31-1.07.56-1.64.78c-.04.01-.05.06-.04.09c.32.61.68 1.19 1.07 1.74c.03.01.06.02.09.01c1.72-.53 3.45-1.33 5.25-2.65c.02-.01.03-.03.03-.05c.44-4.53-.73-8.46-3.1-11.95c-.01-.01-.02-.02-.04-.02zM8.52 14.91c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12c0 1.17-.84 2.12-1.89 2.12zm6.97 0c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12c0 1.17-.83 2.12-1.89 2.12z" />
            </svg>
          </template>
          <span>{{ t('download.discordHint') }}</span>
          <v-btn
            href="https://discord.gg/66JKJQEcSx"
            target="_blank"
            size="small"
            variant="flat"
            style="background-color: #5865F2; color: white;"
            class="ml-0 mt-2"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="mr-1">
              <path d="M19.27 5.33C17.94 4.71 16.5 4.26 15 4a.09.09 0 0 0-.07.03c-.18.33-.39.76-.53 1.09a16.09 16.09 0 0 0-4.8 0c-.14-.34-.35-.76-.54-1.09c-.01-.02-.04-.03-.07-.03c-1.5.26-2.93.71-4.27 1.33c-.01 0-.02.01-.03.02c-2.72 4.07-3.47 8.03-3.1 11.95c0 .02.01.04.03.05c1.8 1.32 3.53 2.12 5.24 2.65c.03.01.06 0 .07-.02c.4-.55.76-1.13 1.07-1.74c.02-.04 0-.08-.04-.09c-.57-.22-1.11-.48-1.64-.78c-.04-.02-.04-.08-.01-.11c.11-.08.22-.17.33-.25c.02-.02.05-.02.07-.01c3.44 1.57 7.15 1.57 10.55 0c.02-.01.05-.01.07.01c.11.09.22.17.33.26c.04.03.04.09-.01.11c-.52.31-1.07.56-1.64.78c-.04.01-.05.06-.04.09c.32.61.68 1.19 1.07 1.74c.03.01.06.02.09.01c1.72-.53 3.45-1.33 5.25-2.65c.02-.01.03-.03.03-.05c.44-4.53-.73-8.46-3.1-11.95c-.01-.01-.02-.02-.04-.02zM8.52 14.91c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12c0 1.17-.84 2.12-1.89 2.12zm6.97 0c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12c0 1.17-.83 2.12-1.89 2.12z" />
            </svg>
            Discord
          </v-btn>
        </v-alert>
      </div>

      <!-- Download Cards -->
      <v-row justify="center" class="mb-8">
        <v-col
          v-for="(platform, index) in platforms"
          :key="platform.key"
          cols="12"
          sm="6"
          md="4"
        >
          <v-card
            v-motion
            :initial="{ opacity: 0, y: 30 }"
            :visible-once="{ opacity: 1, y: 0, transition: { delay: 200 + index * 100 } }"
            class="download-card h-100 pa-6 text-center"
            :class="{ 'download-card--disabled': !platform.available }"
            color="surface"
          >
            <v-icon size="64" :color="platform.available ? 'primary' : 'grey'" class="mb-4">
              {{ platform.icon }}
            </v-icon>

            <h3 class="text-headline-medium font-weight-bold mb-2">
              {{ t(`download.platforms.${platform.key}.title`) }}
            </h3>

            <p class="text-body-medium text-medium-emphasis mb-4">
              {{ t(`download.platforms.${platform.key}.description`) }}
              <template v-if="platform.available && latestRelease">
                <br />
                <v-chip size="x-small" color="primary" variant="outlined" class="mt-1">
                  {{ latestRelease.tag_name }}
                </v-chip>
                <span v-if="!platform.split && getFileSize(platform.key as 'windows' | 'linux' | 'mac-arm64' | 'mac-x64')" class="text-body-small ml-2">
                  {{ getFileSize(platform.key as 'windows' | 'linux' | 'mac-arm64' | 'mac-x64') }}
                </span>
              </template>
            </p>

            <!-- Split button for Mac (arm64 / x64) -->
            <div v-if="platform.available && platform.split" class="mac-split-btn">
              <v-row density="comfortable">
                <v-col cols="6">
                  <v-tooltip location="bottom">
                    <template #activator="{ props: tooltipProps }">
                      <v-btn
                        v-bind="tooltipProps"
                        :href="getDownloadUrl('mac-arm64') || '#'"
                        :disabled="!getDownloadUrl('mac-arm64') && !loading"
                        :loading="loading"
                        color="primary"
                        size="large"
                        class="download-btn"
                        block
                      >
                        <v-icon start size="small">mdi-download</v-icon>
                        Apple Silicon
                      </v-btn>
                    </template>
                    <span>{{ t('download.platforms.mac.tooltipArm64') }}</span>
                  </v-tooltip>
                  <div v-if="getFileSize('mac-arm64')" class="text-body-small text-center mt-1 text-medium-emphasis">
                    {{ getFileSize('mac-arm64') }}
                  </div>
                </v-col>
                <v-col cols="6">
                  <v-tooltip location="bottom">
                    <template #activator="{ props: tooltipProps }">
                      <v-btn
                        v-bind="tooltipProps"
                        :href="getDownloadUrl('mac-x64') || '#'"
                        :disabled="!getDownloadUrl('mac-x64') && !loading"
                        :loading="loading"
                        color="primary"
                        size="large"
                        class="download-btn"
                        block
                      >
                        <v-icon start size="small">mdi-download</v-icon>
                        Intel
                      </v-btn>
                    </template>
                    <span>{{ t('download.platforms.mac.tooltipX64') }}</span>
                  </v-tooltip>
                  <div v-if="getFileSize('mac-x64')" class="text-body-small text-center mt-1 text-medium-emphasis">
                    {{ getFileSize('mac-x64') }}
                  </div>
                </v-col>
              </v-row>
            </div>

            <!-- Regular button for Windows/Linux -->
            <v-btn
              v-else-if="platform.available"
              :href="getDownloadUrl(platform.key as 'windows' | 'linux' | 'mac-arm64' | 'mac-x64') || '#'"
              :disabled="!getDownloadUrl(platform.key as 'windows' | 'linux' | 'mac-arm64' | 'mac-x64') && !loading"
              :loading="loading"
              color="primary"
              size="large"
              class="download-btn"
              block
            >
              <v-icon start>mdi-download</v-icon>
              {{ t(`download.platforms.${platform.key}.button`) }}
            </v-btn>
            <v-btn
              v-else
              disabled
              color="grey"
              size="large"
              variant="tonal"
              block
            >
              {{ t(`download.platforms.${platform.key}.button`) }}
            </v-btn>
          </v-card>
        </v-col>
      </v-row>

      <!-- Docker Section -->
      <div
        v-motion
        :initial="{ opacity: 0, y: 20 }"
        :visible-once="{ opacity: 1, y: 0, transition: { delay: 600 } }"
        class="docker-section text-center"
      >
        <v-card color="surface" class="pa-6 mx-auto" style="max-width: 600px">
          <div class="d-flex align-center justify-center mb-4">
            <v-icon size="32" color="info" class="mr-3">mdi-docker</v-icon>
            <h3 class="text-headline-small font-weight-bold">{{ t('download.docker.title') }}</h3>
          </div>

          <p class="text-body-medium text-medium-emphasis mb-4">
            {{ t('download.docker.description') }}
          </p>

          <v-sheet color="grey-darken-4" rounded class="pa-3">
            <code class="text-primary">docker pull ghcr.io/flo0806/dm-hero</code>
          </v-sheet>
        </v-card>
      </div>

      <!-- GitHub Star CTA -->
      <div
        v-motion
        :initial="{ opacity: 0, y: 20 }"
        :visible-once="{ opacity: 1, y: 0, transition: { delay: 700 } }"
        class="text-center mt-10"
      >
        <p class="text-body-large text-medium-emphasis mb-3">
          {{ t('download.starHint') }}
        </p>
        <v-btn
          href="https://github.com/Flo0806/dm-hero"
          target="_blank"
          color="warning"
          variant="tonal"
          size="large"
        >
          <v-icon start>mdi-star</v-icon>
          {{ t('download.starButton') }}
        </v-btn>
      </div>

      <!-- All Releases Link -->
      <div
        v-motion
        :initial="{ opacity: 0 }"
        :visible-once="{ opacity: 1, transition: { delay: 900 } }"
        class="text-center mt-6"
      >
        <v-btn
          variant="text"
          color="primary"
          href="https://github.com/Flo0806/dm-hero/releases"
          target="_blank"
        >
          {{ t('download.allReleases') }}
          <v-icon end>mdi-open-in-new</v-icon>
        </v-btn>
      </div>
    </v-container>
  </section>
</template>

<style scoped>
.download-section {
  position: relative;
  overflow: hidden;
}

.download-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.download-gradient {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 50% 100%, rgba(212, 165, 116, 0.1) 0%, transparent 50%);
}

.section-title {
  font-size: clamp(2rem, 5vw, 3rem);
  font-weight: 700;
  color: rgb(var(--v-theme-on-background));
}

.section-subtitle {
  font-size: 1.1rem;
  color: rgba(var(--v-theme-on-background), 0.7);
  line-height: 1.6;
}

.download-card {
  transition:
    transform 0.3s ease,
    box-shadow 0.3s ease,
    border-color 0.3s ease;
  border: 1px solid rgba(var(--v-theme-primary), 0.1);
}

.download-card:not(.download-card--disabled):hover {
  transform: translateY(-8px);
  box-shadow:
    0 20px 40px rgba(0, 0, 0, 0.2),
    0 0 40px rgba(212, 165, 116, 0.15);
  border-color: rgba(var(--v-theme-primary), 0.3);
}

.download-card--disabled {
  opacity: 0.7;
}

.download-btn {
  text-transform: none;
  font-weight: 600;
  position: relative;
  overflow: hidden;
}

.download-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transition: left 0.5s ease;
}

.download-btn:hover::before {
  left: 100%;
}

.docker-section :deep(.v-card) {
  border: 1px solid rgba(var(--v-theme-info), 0.2);
}

.mac-split-btn .v-btn {
  text-transform: none;
  font-weight: 600;
}
</style>
