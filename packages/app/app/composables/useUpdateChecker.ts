/**
 * Composable for checking and installing updates.
 *
 * - In Electron: Uses electron-updater for auto-download and install
 * - In Browser: Falls back to GitHub API check + manual download link
 */

import { isElectron, getElectronAPI, type UpdateDownloadProgress } from './useElectron'

// Update states
type UpdateState = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error'

interface UpdateInfo {
  available: boolean
  currentVersion: string
  latestVersion: string
  releaseUrl: string
  releaseName: string
  isDevMode?: boolean
}

// For browser fallback
const GITHUB_REPO = 'Flo0806/dm-hero'
const STORAGE_KEY_DISMISSED = 'dm-hero-update-dismissed'

/**
 * Parse semver version string to comparable parts.
 */
function parseVersion(version: string): {
  major: number
  minor: number
  patch: number
  prerelease: string
  prereleaseNum: number
} {
  const clean = version.replace(/^v/, '')
  const [main, prerelease = ''] = clean.split('-')
  const [major = 0, minor = 0, patch = 0] = (main || '').split('.').map(Number)

  let prereleaseNum = 0
  if (prerelease) {
    const match = prerelease.match(/(\d+)$/)
    if (match) {
      prereleaseNum = parseInt(match[1] || '0', 10)
    }
  }

  return { major, minor, patch, prerelease, prereleaseNum }
}

/**
 * Compare two version strings.
 * Returns: 1 if a > b, -1 if a < b, 0 if equal
 */
function compareVersions(a: string, b: string): number {
  const vA = parseVersion(a)
  const vB = parseVersion(b)

  if (vA.major !== vB.major) return vA.major > vB.major ? 1 : -1
  if (vA.minor !== vB.minor) return vA.minor > vB.minor ? 1 : -1
  if (vA.patch !== vB.patch) return vA.patch > vB.patch ? 1 : -1

  if (!vA.prerelease && !vB.prerelease) return 0
  if (!vA.prerelease && vB.prerelease) return 1
  if (vA.prerelease && !vB.prerelease) return -1

  const prereleaseOrder: Record<string, number> = { alpha: 1, beta: 2, rc: 3 }
  const typeA = vA.prerelease.replace(/\.\d+$/, '')
  const typeB = vB.prerelease.replace(/\.\d+$/, '')
  const orderA = prereleaseOrder[typeA] || 0
  const orderB = prereleaseOrder[typeB] || 0

  if (orderA !== orderB) return orderA > orderB ? 1 : -1
  if (vA.prereleaseNum !== vB.prereleaseNum) {
    return vA.prereleaseNum > vB.prereleaseNum ? 1 : -1
  }

  return 0
}

export function useUpdateChecker() {
  const config = useRuntimeConfig()
  const APP_VERSION = config.public.appVersion as string

  // State
  const updateState = ref<UpdateState>('idle')
  const updateInfo = ref<UpdateInfo | null>(null)
  const downloadProgress = ref<UpdateDownloadProgress | null>(null)
  const error = ref<string | null>(null)
  const isDismissed = ref(false)

  const isBrowser = typeof window !== 'undefined'
  const electronAPI = isBrowser ? getElectronAPI() : null

  // ========================================
  // ELECTRON: Auto-Update with electron-updater
  // ========================================

  function setupElectronListeners() {
    if (!electronAPI) return

    electronAPI.onUpdateDownloadProgress((progress) => {
      downloadProgress.value = progress
    })

    electronAPI.onUpdateDownloaded(() => {
      updateState.value = 'ready'
      downloadProgress.value = null
    })

    electronAPI.onUpdateError((err) => {
      error.value = err.message
      updateState.value = 'error'
    })
  }

  async function checkForUpdatesElectron(): Promise<UpdateInfo | null> {
    if (!electronAPI) return null

    updateState.value = 'checking'
    error.value = null

    try {
      const result = await electronAPI.checkForUpdates()

      if (result.error) {
        error.value = result.error
        updateState.value = 'error'
        return null
      }

      if (result.updateAvailable && result.version) {
        const dismissed = getDismissedVersion()
        isDismissed.value = dismissed === result.version

        updateInfo.value = {
          available: true,
          currentVersion: APP_VERSION,
          latestVersion: result.version,
          releaseUrl: 'https://dm-hero.com/#download',
          releaseName: `DM Hero ${result.version}`,
          isDevMode: result.isDevMode,
        }
        updateState.value = 'available'
        return updateInfo.value
      }

      updateState.value = 'idle'
      return null
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
      updateState.value = 'error'
      return null
    }
  }

  async function downloadUpdate(): Promise<boolean> {
    console.log('[UpdateChecker] downloadUpdate called, electronAPI:', !!electronAPI)
    if (!electronAPI) {
      console.error('[UpdateChecker] electronAPI is null!')
      return false
    }

    updateState.value = 'downloading'
    downloadProgress.value = { percent: 0, bytesPerSecond: 0, transferred: 0, total: 0 }
    console.log('[UpdateChecker] State set to downloading, calling electronAPI.downloadUpdate()')

    try {
      const result = await electronAPI.downloadUpdate()
      console.log('[UpdateChecker] downloadUpdate result:', result)
      if (result.error) {
        console.error('[UpdateChecker] Download error:', result.error)
        error.value = result.error
        updateState.value = 'error'
        return false
      }
      // Progress events will update state to 'ready' when done
      return result.started
    } catch (e) {
      console.error('[UpdateChecker] Download exception:', e)
      error.value = e instanceof Error ? e.message : 'Download failed'
      updateState.value = 'error'
      return false
    }
  }

  async function installUpdate(): Promise<boolean> {
    if (!electronAPI) return false

    try {
      const result = await electronAPI.installUpdate()
      return result.installed
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Install failed'
      return false
    }
  }

  // ========================================
  // BROWSER: Fallback to GitHub API
  // ========================================

  async function checkForUpdatesBrowser(): Promise<UpdateInfo | null> {
    updateState.value = 'checking'
    error.value = null

    try {
      const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases`)
      if (!response.ok) throw new Error(`GitHub API error: ${response.status}`)

      const releases = await response.json()
      const appRelease = releases.find(
        (r: { tag_name: string }) => r.tag_name.startsWith('v') && !r.tag_name.includes('landing'),
      )

      if (!appRelease) {
        updateState.value = 'idle'
        return null
      }

      const latestVersion = appRelease.tag_name
      const isNewer = compareVersions(latestVersion, APP_VERSION) > 0

      if (isNewer) {
        const dismissed = getDismissedVersion()
        isDismissed.value = dismissed === latestVersion

        updateInfo.value = {
          available: true,
          currentVersion: APP_VERSION,
          latestVersion,
          releaseUrl: 'https://dm-hero.com/#download',
          releaseName: appRelease.name || `DM Hero ${latestVersion}`,
        }
        updateState.value = 'available'
        return updateInfo.value
      }

      updateState.value = 'idle'
      return null
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
      updateState.value = 'error'
      return null
    }
  }

  // ========================================
  // SHARED
  // ========================================

  function getDismissedVersion(): string | null {
    if (!isBrowser) return null
    return localStorage.getItem(STORAGE_KEY_DISMISSED)
  }

  function dismissUpdate() {
    if (!isBrowser || !updateInfo.value) return
    localStorage.setItem(STORAGE_KEY_DISMISSED, updateInfo.value.latestVersion)
    isDismissed.value = true
  }

  async function checkForUpdates(): Promise<UpdateInfo | null> {
    if (!isBrowser) return null

    if (isElectron()) {
      return checkForUpdatesElectron()
    } else {
      return checkForUpdatesBrowser()
    }
  }

  // Setup listeners on mount (Electron only)
  if (isBrowser && isElectron()) {
    setupElectronListeners()
  }

  // Computed
  const showBanner = computed(() => {
    return updateInfo.value?.available && !isDismissed.value
  })

  const isChecking = computed(() => updateState.value === 'checking')
  const isDownloading = computed(() => updateState.value === 'downloading')
  const isReadyToInstall = computed(() => updateState.value === 'ready')
  const canAutoUpdate = computed(() => isElectron())

  return {
    // State
    updateState,
    updateInfo,
    downloadProgress,
    error,
    isDismissed,

    // Computed
    showBanner,
    isChecking,
    isDownloading,
    isReadyToInstall,
    canAutoUpdate,

    // Actions
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    dismissUpdate,
  }
}
