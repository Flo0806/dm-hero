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
  } catch {
    error.value = true
    console.error('Failed to fetch latest release')
  } finally {
    loading.value = false
  }
}

// Get download URL for specific platform
function getDownloadUrl(platform: 'windows' | 'linux' | 'mac'): string | null {
  if (!latestRelease.value) return null

  const assets = latestRelease.value.assets

  if (platform === 'windows') {
    const zip = assets.find((a) => a.name.endsWith('.zip') && a.name.toLowerCase().includes('win'))
    return zip?.browser_download_url || null
  }

  if (platform === 'linux') {
    const appImage = assets.find((a) => a.name.endsWith('.AppImage'))
    return appImage?.browser_download_url || null
  }

  if (platform === 'mac') {
    const dmg = assets.find((a) => a.name.endsWith('.dmg'))
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
function getFileSize(platform: 'windows' | 'linux' | 'mac'): string | null {
  if (!latestRelease.value) return null

  const assets = latestRelease.value.assets
  let asset = null

  if (platform === 'windows') {
    asset = assets.find((a) => a.name.endsWith('.zip') && a.name.toLowerCase().includes('win'))
  } else if (platform === 'linux') {
    asset = assets.find((a) => a.name.endsWith('.AppImage'))
  } else if (platform === 'mac') {
    asset = assets.find((a) => a.name.endsWith('.dmg'))
  }

  return asset ? formatSize(asset.size) : null
}

const platforms = [
  {
    key: 'windows',
    icon: 'mdi-microsoft-windows',
    available: true,
  },
  {
    key: 'mac',
    icon: 'mdi-apple',
    available: false, // Coming soon
  },
  {
    key: 'linux',
    icon: 'mdi-linux',
    available: true,
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

            <h3 class="text-h5 font-weight-bold mb-2">
              {{ t(`download.platforms.${platform.key}.title`) }}
            </h3>

            <p class="text-body-2 text-medium-emphasis mb-4">
              {{ t(`download.platforms.${platform.key}.description`) }}
              <template v-if="platform.available && latestRelease">
                <br />
                <v-chip size="x-small" color="primary" variant="outlined" class="mt-1">
                  {{ latestRelease.tag_name }}
                </v-chip>
                <span v-if="getFileSize(platform.key as 'windows' | 'linux' | 'mac')" class="text-caption ml-2">
                  {{ getFileSize(platform.key as 'windows' | 'linux' | 'mac') }}
                </span>
              </template>
            </p>

            <v-btn
              v-if="platform.available"
              :href="getDownloadUrl(platform.key as 'windows' | 'linux' | 'mac') || '#'"
              :disabled="!getDownloadUrl(platform.key as 'windows' | 'linux' | 'mac') && !loading"
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
            <h3 class="text-h6 font-weight-bold">{{ t('download.docker.title') }}</h3>
          </div>

          <p class="text-body-2 text-medium-emphasis mb-4">
            {{ t('download.docker.description') }}
          </p>

          <v-sheet color="grey-darken-4" rounded class="pa-3">
            <code class="text-primary">docker pull ghcr.io/flo0806/dm-hero</code>
          </v-sheet>
        </v-card>
      </div>

      <!-- All Releases Link -->
      <div
        v-motion
        :initial="{ opacity: 0 }"
        :visible-once="{ opacity: 1, transition: { delay: 800 } }"
        class="text-center mt-8"
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
</style>
