/**
 * Composable for checking GitHub releases for updates.
 * Compares current app version with latest release.
 */

interface GitHubRelease {
  tag_name: string
  html_url: string
  name: string
  published_at: string
}

interface UpdateInfo {
  available: boolean
  currentVersion: string
  latestVersion: string
  releaseUrl: string
  releaseName: string
}

const GITHUB_REPO = 'Flo0806/dm-hero'
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000 // 24 hours
const STORAGE_KEY_DISMISSED = 'dm-hero-update-dismissed'
const STORAGE_KEY_LAST_CHECK = 'dm-hero-update-last-check'
const STORAGE_KEY_CACHED_VERSION = 'dm-hero-update-cached-version'

/**
 * Parse semver version string to comparable parts.
 * Handles formats like: 1.0.0, 1.0.0-beta.1, 1.0.0-alpha.5
 */
function parseVersion(version: string): { major: number; minor: number; patch: number; prerelease: string; prereleaseNum: number } {
  // Remove 'v' prefix if present
  const clean = version.replace(/^v/, '')

  // Split into main version and prerelease
  const [main, prerelease = ''] = clean.split('-')
  const [major = 0, minor = 0, patch = 0] = (main || '').split('.').map(Number)

  // Parse prerelease (e.g., "beta.2" -> type="beta", num=2)
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

  // Compare major.minor.patch
  if (vA.major !== vB.major) return vA.major > vB.major ? 1 : -1
  if (vA.minor !== vB.minor) return vA.minor > vB.minor ? 1 : -1
  if (vA.patch !== vB.patch) return vA.patch > vB.patch ? 1 : -1

  // Both stable releases
  if (!vA.prerelease && !vB.prerelease) return 0

  // Stable > prerelease
  if (!vA.prerelease && vB.prerelease) return 1
  if (vA.prerelease && !vB.prerelease) return -1

  // Compare prerelease type (beta > alpha)
  const prereleaseOrder: Record<string, number> = { alpha: 1, beta: 2, rc: 3 }
  const typeA = vA.prerelease.replace(/\.\d+$/, '')
  const typeB = vB.prerelease.replace(/\.\d+$/, '')
  const orderA = prereleaseOrder[typeA] || 0
  const orderB = prereleaseOrder[typeB] || 0

  if (orderA !== orderB) return orderA > orderB ? 1 : -1

  // Same prerelease type, compare number
  if (vA.prereleaseNum !== vB.prereleaseNum) {
    return vA.prereleaseNum > vB.prereleaseNum ? 1 : -1
  }

  return 0
}

export function useUpdateChecker() {
  const config = useRuntimeConfig()
  const APP_VERSION = config.public.appVersion as string

  const updateInfo = ref<UpdateInfo | null>(null)
  const isChecking = ref(false)
  const error = ref<string | null>(null)
  const isDismissed = ref(false)

  // Check if we're in browser environment
  const isBrowser = typeof window !== 'undefined'

  /**
   * Get dismissed version from localStorage
   */
  function getDismissedVersion(): string | null {
    if (!isBrowser) return null
    return localStorage.getItem(STORAGE_KEY_DISMISSED)
  }

  /**
   * Dismiss update notification for current latest version
   */
  function dismissUpdate() {
    if (!isBrowser || !updateInfo.value) return
    localStorage.setItem(STORAGE_KEY_DISMISSED, updateInfo.value.latestVersion)
    isDismissed.value = true
  }

  /**
   * Check if enough time has passed since last check
   */
  function shouldCheck(): boolean {
    if (!isBrowser) return false

    const lastCheck = localStorage.getItem(STORAGE_KEY_LAST_CHECK)
    if (!lastCheck) return true

    const lastCheckTime = parseInt(lastCheck, 10)
    return Date.now() - lastCheckTime > CHECK_INTERVAL_MS
  }

  /**
   * Fetch latest release from GitHub API
   */
  async function fetchLatestRelease(): Promise<GitHubRelease | null> {
    try {
      // Filter for app releases (not landing page releases)
      const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases`)

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`)
      }

      const releases: GitHubRelease[] = await response.json()

      // Find first release that starts with 'v' (app release, not 'landing-v')
      const appRelease = releases.find(r => r.tag_name.startsWith('v') && !r.tag_name.includes('landing'))

      return appRelease || null
    } catch (e) {
      console.error('[UpdateChecker] Failed to fetch releases:', e)
      return null
    }
  }

  /**
   * Check for updates
   */
  async function checkForUpdates(force = false): Promise<UpdateInfo | null> {
    if (!isBrowser) return null
    if (isChecking.value) return null

    // Skip if we checked recently (unless forced)
    if (!force && !shouldCheck()) {
      // Use cached version if available
      const cachedVersion = localStorage.getItem(STORAGE_KEY_CACHED_VERSION)
      if (cachedVersion && compareVersions(cachedVersion, APP_VERSION) > 0) {
        const dismissed = getDismissedVersion()
        isDismissed.value = dismissed === cachedVersion

        updateInfo.value = {
          available: true,
          currentVersion: APP_VERSION,
          latestVersion: cachedVersion,
          releaseUrl: 'https://dm-hero.com/#download',
          releaseName: `DM Hero ${cachedVersion}`,
        }
        return updateInfo.value
      }
      return null
    }

    isChecking.value = true
    error.value = null

    try {
      const release = await fetchLatestRelease()

      if (!release) {
        error.value = 'Could not fetch release info'
        return null
      }

      // Update last check timestamp
      localStorage.setItem(STORAGE_KEY_LAST_CHECK, Date.now().toString())
      localStorage.setItem(STORAGE_KEY_CACHED_VERSION, release.tag_name)

      const latestVersion = release.tag_name
      const isNewer = compareVersions(latestVersion, APP_VERSION) > 0

      // Check if this version was dismissed
      const dismissed = getDismissedVersion()
      isDismissed.value = dismissed === latestVersion

      updateInfo.value = {
        available: isNewer,
        currentVersion: APP_VERSION,
        latestVersion,
        releaseUrl: 'https://dm-hero.com/#download',
        releaseName: release.name || `DM Hero ${latestVersion}`,
      }

      return updateInfo.value
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
      return null
    } finally {
      isChecking.value = false
    }
  }

  // Show banner if update available and not dismissed
  const showBanner = computed(() => {
    return updateInfo.value?.available && !isDismissed.value
  })

  return {
    updateInfo,
    isChecking,
    error,
    isDismissed,
    showBanner,
    checkForUpdates,
    dismissUpdate,
  }
}
