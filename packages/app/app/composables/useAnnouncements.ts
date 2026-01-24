/**
 * Composable for managing app announcements/what's new dialogs.
 *
 * Announcements are hardcoded in the app with unique IDs.
 * Users can dismiss them, and the last seen ID is stored in localStorage.
 * Settings page can reset to show announcements again.
 */

export interface Announcement {
  id: number
  titleKey: string // i18n key for title
  contentKey: string // i18n key for content
  showInstallerPath?: boolean // Show OS-specific installer path
  html?: boolean // Render content as HTML (for formatted announcements)
}

// Hardcoded announcements - add new ones here with incrementing IDs
const ANNOUNCEMENTS: Announcement[] = [
  {
    id: 1,
    titleKey: 'announcements.installer.title',
    contentKey: 'announcements.installer.content',
    showInstallerPath: true,
  },
  {
    id: 2,
    titleKey: 'announcements.v110.title',
    contentKey: 'announcements.v110.content',
    html: true,
  },
]

const STORAGE_KEY = 'dm-hero-last-seen-announcement'

/**
 * Get the current (latest) announcement
 */
function getCurrentAnnouncement(): Announcement | null {
  if (ANNOUNCEMENTS.length === 0) return null
  return ANNOUNCEMENTS[ANNOUNCEMENTS.length - 1] || null
}

/**
 * Get the last seen announcement ID from localStorage
 */
function getLastSeenId(): number {
  if (typeof window === 'undefined') return 0
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored ? parseInt(stored, 10) : 0
}

/**
 * Set the last seen announcement ID in localStorage
 */
function setLastSeenId(id: number): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, String(id))
}

/**
 * Get OS-specific installer path
 */
function getInstallerPath(): string {
  if (typeof window === 'undefined') return ''

  const platform = navigator.platform.toLowerCase()

  if (platform.includes('win')) {
    return 'C:\\Users\\{User}\\AppData\\Local\\Programs\\DM Hero\\'
  } else if (platform.includes('mac')) {
    return '/Applications/DM Hero.app'
  } else {
    // Linux - AppImage is typically run from wherever it's placed
    return '~/Applications/ oder /opt/'
  }
}

/**
 * Get OS name for display
 */
function getOSName(): string {
  if (typeof window === 'undefined') return ''

  const platform = navigator.platform.toLowerCase()

  if (platform.includes('win')) {
    return 'Windows'
  } else if (platform.includes('mac')) {
    return 'macOS'
  } else {
    return 'Linux'
  }
}

export function useAnnouncements() {
  const showDialog = ref(false)
  const dontShowAgain = ref(false)
  const currentAnnouncement = ref<Announcement | null>(null)

  /**
   * Check if there's an unseen announcement and show dialog if needed
   */
  function checkForAnnouncements(): void {
    const announcement = getCurrentAnnouncement()
    if (!announcement) return

    const lastSeenId = getLastSeenId()

    if (announcement.id > lastSeenId) {
      currentAnnouncement.value = announcement
      showDialog.value = true
    }
  }

  /**
   * Dismiss the current announcement
   */
  function dismissAnnouncement(): void {
    if (currentAnnouncement.value && dontShowAgain.value) {
      setLastSeenId(currentAnnouncement.value.id)
    }
    showDialog.value = false
    dontShowAgain.value = false
  }

  /**
   * Reset to show announcements again (called from settings)
   */
  function resetAnnouncements(): void {
    setLastSeenId(0)
  }

  /**
   * Check if user has seen the latest announcement
   */
  function hasSeenLatest(): boolean {
    const announcement = getCurrentAnnouncement()
    if (!announcement) return true
    return getLastSeenId() >= announcement.id
  }

  return {
    // State
    showDialog,
    dontShowAgain,
    currentAnnouncement,

    // Computed
    installerPath: getInstallerPath(),
    osName: getOSName(),

    // Actions
    checkForAnnouncements,
    dismissAnnouncement,
    resetAnnouncements,
    hasSeenLatest,
  }
}
