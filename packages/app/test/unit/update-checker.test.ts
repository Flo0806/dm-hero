import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref, computed } from 'vue'

// Import AFTER mocks are set up
import { useUpdateChecker } from '../../app/composables/useUpdateChecker'

/**
 * Tests for the Update Checker functionality.
 * Tests version comparison logic through the checkForUpdates() function.
 */

// Mock fetch globally
const mockFetch = vi.fn()
globalThis.fetch = mockFetch

// Mock window to enable browser-specific code (isBrowser check)
Object.defineProperty(globalThis, 'window', { value: {}, configurable: true })

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      store[key] = ''
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

// Mock Vue reactivity globals (auto-imported in Nuxt)
;(globalThis as Record<string, unknown>).ref = ref
;(globalThis as Record<string, unknown>).computed = computed

// Mock useRuntimeConfig globally - use object so it can be mutated
const mockConfig = { appVersion: '1.0.0-beta.2' }
;(globalThis as Record<string, unknown>).useRuntimeConfig = () => ({
  public: mockConfig,
})

// Helper to set mock app version
function setMockAppVersion(version: string) {
  mockConfig.appVersion = version
}

// Helper to create a mock GitHub release response
function createMockRelease(tagName: string, name?: string) {
  return {
    tag_name: tagName,
    html_url: `https://github.com/Flo0806/dm-hero/releases/tag/${tagName}`,
    name: name || `DM Hero ${tagName}`,
    published_at: new Date().toISOString(),
  }
}

// Helper to mock GitHub API response
function mockGitHubResponse(releases: Array<{ tag_name: string; name?: string }>) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => releases.map((r) => createMockRelease(r.tag_name, r.name)),
  })
}

describe('Update Checker - Version Comparisons', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
    setMockAppVersion('1.0.0-beta.2')
  })

  describe('Beta to Stable Updates', () => {
    it('should detect update from beta.2 to stable 1.0.0', async () => {
      setMockAppVersion('1.0.0-beta.2')
      mockGitHubResponse([{ tag_name: 'v1.0.0' }])

      const { checkForUpdates, updateInfo } = useUpdateChecker()
      await checkForUpdates(true)

      expect(updateInfo.value?.available).toBe(true)
      expect(updateInfo.value?.latestVersion).toBe('v1.0.0')
      expect(updateInfo.value?.currentVersion).toBe('1.0.0-beta.2')
    })

    it('should detect update from beta.1 to stable 1.0.0', async () => {
      setMockAppVersion('1.0.0-beta.1')
      mockGitHubResponse([{ tag_name: 'v1.0.0' }])

      const { checkForUpdates, updateInfo } = useUpdateChecker()
      await checkForUpdates(true)

      expect(updateInfo.value?.available).toBe(true)
    })

    it('should detect update from alpha.5 to stable 1.0.0', async () => {
      setMockAppVersion('1.0.0-alpha.5')
      mockGitHubResponse([{ tag_name: 'v1.0.0' }])

      const { checkForUpdates, updateInfo } = useUpdateChecker()
      await checkForUpdates(true)

      expect(updateInfo.value?.available).toBe(true)
    })
  })

  describe('Beta to Beta Updates', () => {
    it('should detect update from beta.1 to beta.2', async () => {
      setMockAppVersion('1.0.0-beta.1')
      mockGitHubResponse([{ tag_name: 'v1.0.0-beta.2' }])

      const { checkForUpdates, updateInfo } = useUpdateChecker()
      await checkForUpdates(true)

      expect(updateInfo.value?.available).toBe(true)
    })

    it('should detect update from beta.2 to beta.10', async () => {
      setMockAppVersion('1.0.0-beta.2')
      mockGitHubResponse([{ tag_name: 'v1.0.0-beta.10' }])

      const { checkForUpdates, updateInfo } = useUpdateChecker()
      await checkForUpdates(true)

      expect(updateInfo.value?.available).toBe(true)
    })

    it('should NOT detect update when already on latest beta', async () => {
      setMockAppVersion('1.0.0-beta.2')
      mockGitHubResponse([{ tag_name: 'v1.0.0-beta.2' }])

      const { checkForUpdates, updateInfo } = useUpdateChecker()
      await checkForUpdates(true)

      expect(updateInfo.value?.available).toBe(false)
    })

    it('should NOT detect update when on newer beta', async () => {
      setMockAppVersion('1.0.0-beta.3')
      mockGitHubResponse([{ tag_name: 'v1.0.0-beta.2' }])

      const { checkForUpdates, updateInfo } = useUpdateChecker()
      await checkForUpdates(true)

      expect(updateInfo.value?.available).toBe(false)
    })
  })

  describe('Alpha to Beta Updates', () => {
    it('should detect update from alpha to beta', async () => {
      setMockAppVersion('1.0.0-alpha.5')
      mockGitHubResponse([{ tag_name: 'v1.0.0-beta.1' }])

      const { checkForUpdates, updateInfo } = useUpdateChecker()
      await checkForUpdates(true)

      expect(updateInfo.value?.available).toBe(true)
    })

    it('should detect update from alpha.19 to beta.1', async () => {
      setMockAppVersion('1.0.0-alpha.19')
      mockGitHubResponse([{ tag_name: 'v1.0.0-beta.1' }])

      const { checkForUpdates, updateInfo } = useUpdateChecker()
      await checkForUpdates(true)

      expect(updateInfo.value?.available).toBe(true)
    })
  })

  describe('Major/Minor Version Updates', () => {
    it('should detect update from 1.0.0 to 1.1.0', async () => {
      setMockAppVersion('1.0.0')
      mockGitHubResponse([{ tag_name: 'v1.1.0' }])

      const { checkForUpdates, updateInfo } = useUpdateChecker()
      await checkForUpdates(true)

      expect(updateInfo.value?.available).toBe(true)
    })

    it('should detect update from 1.0.0 to 2.0.0', async () => {
      setMockAppVersion('1.0.0')
      mockGitHubResponse([{ tag_name: 'v2.0.0' }])

      const { checkForUpdates, updateInfo } = useUpdateChecker()
      await checkForUpdates(true)

      expect(updateInfo.value?.available).toBe(true)
    })

    it('should detect update from 1.0.0-beta.2 to 1.1.0', async () => {
      setMockAppVersion('1.0.0-beta.2')
      mockGitHubResponse([{ tag_name: 'v1.1.0' }])

      const { checkForUpdates, updateInfo } = useUpdateChecker()
      await checkForUpdates(true)

      expect(updateInfo.value?.available).toBe(true)
    })

    it('should detect update from 1.0.0-beta.2 to 2.0.0-alpha.1', async () => {
      setMockAppVersion('1.0.0-beta.2')
      mockGitHubResponse([{ tag_name: 'v2.0.0-alpha.1' }])

      const { checkForUpdates, updateInfo } = useUpdateChecker()
      await checkForUpdates(true)

      expect(updateInfo.value?.available).toBe(true)
    })
  })

  describe('Patch Version Updates', () => {
    it('should detect update from 1.0.0 to 1.0.1', async () => {
      setMockAppVersion('1.0.0')
      mockGitHubResponse([{ tag_name: 'v1.0.1' }])

      const { checkForUpdates, updateInfo } = useUpdateChecker()
      await checkForUpdates(true)

      expect(updateInfo.value?.available).toBe(true)
    })

    it('should detect update from 1.0.5 to 1.0.10', async () => {
      setMockAppVersion('1.0.5')
      mockGitHubResponse([{ tag_name: 'v1.0.10' }])

      const { checkForUpdates, updateInfo } = useUpdateChecker()
      await checkForUpdates(true)

      expect(updateInfo.value?.available).toBe(true)
    })
  })

  describe('No Update Needed', () => {
    it('should NOT detect update when versions are equal', async () => {
      setMockAppVersion('1.0.0')
      mockGitHubResponse([{ tag_name: 'v1.0.0' }])

      const { checkForUpdates, updateInfo } = useUpdateChecker()
      await checkForUpdates(true)

      expect(updateInfo.value?.available).toBe(false)
    })

    it('should NOT detect update when local is newer', async () => {
      setMockAppVersion('1.0.1')
      mockGitHubResponse([{ tag_name: 'v1.0.0' }])

      const { checkForUpdates, updateInfo } = useUpdateChecker()
      await checkForUpdates(true)

      expect(updateInfo.value?.available).toBe(false)
    })

    it('should NOT detect update when on stable and latest is older beta', async () => {
      setMockAppVersion('1.0.0')
      mockGitHubResponse([{ tag_name: 'v1.0.0-beta.5' }])

      const { checkForUpdates, updateInfo } = useUpdateChecker()
      await checkForUpdates(true)

      expect(updateInfo.value?.available).toBe(false)
    })
  })

  describe('Version Format Edge Cases', () => {
    it('should handle version with v prefix in latest', async () => {
      setMockAppVersion('1.0.0-beta.1')
      mockGitHubResponse([{ tag_name: 'v1.0.0-beta.2' }])

      const { checkForUpdates, updateInfo } = useUpdateChecker()
      await checkForUpdates(true)

      expect(updateInfo.value?.available).toBe(true)
    })

    it('should handle version without v prefix in current', async () => {
      setMockAppVersion('1.0.0-beta.1')
      mockGitHubResponse([{ tag_name: 'v1.0.0' }])

      const { checkForUpdates, updateInfo } = useUpdateChecker()
      await checkForUpdates(true)

      expect(updateInfo.value?.available).toBe(true)
    })

    it('should handle rc (release candidate) versions', async () => {
      setMockAppVersion('1.0.0-beta.5')
      mockGitHubResponse([{ tag_name: 'v1.0.0-rc.1' }])

      const { checkForUpdates, updateInfo } = useUpdateChecker()
      await checkForUpdates(true)

      expect(updateInfo.value?.available).toBe(true) // rc > beta
    })
  })

  describe('GitHub API Response Filtering', () => {
    it('should ignore landing page releases', async () => {
      setMockAppVersion('1.0.0-beta.1')
      mockGitHubResponse([
        { tag_name: 'landing-v1.0.0' }, // Should be ignored
        { tag_name: 'v1.0.0-beta.2' }, // Should be used
      ])

      const { checkForUpdates, updateInfo } = useUpdateChecker()
      await checkForUpdates(true)

      expect(updateInfo.value?.latestVersion).toBe('v1.0.0-beta.2')
      expect(updateInfo.value?.available).toBe(true)
    })

    it('should use first app release when multiple exist', async () => {
      setMockAppVersion('1.0.0-beta.1')
      mockGitHubResponse([
        { tag_name: 'v1.0.0' }, // Latest app release
        { tag_name: 'v1.0.0-beta.2' }, // Older release
      ])

      const { checkForUpdates, updateInfo } = useUpdateChecker()
      await checkForUpdates(true)

      expect(updateInfo.value?.latestVersion).toBe('v1.0.0')
    })
  })
})

describe('Update Checker - Dismiss Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
    setMockAppVersion('1.0.0-beta.1')
  })

  it('should show banner when update is available', async () => {
    mockGitHubResponse([{ tag_name: 'v1.0.0-beta.2' }])

    const { checkForUpdates, showBanner } = useUpdateChecker()
    await checkForUpdates(true)

    expect(showBanner.value).toBe(true)
  })

  it('should hide banner after dismissing', async () => {
    mockGitHubResponse([{ tag_name: 'v1.0.0-beta.2' }])

    const { checkForUpdates, showBanner, dismissUpdate } = useUpdateChecker()
    await checkForUpdates(true)

    expect(showBanner.value).toBe(true)

    dismissUpdate()

    expect(showBanner.value).toBe(false)
  })

  it('should remember dismissed version in localStorage', async () => {
    mockGitHubResponse([{ tag_name: 'v1.0.0-beta.2' }])

    const { checkForUpdates, dismissUpdate } = useUpdateChecker()
    await checkForUpdates(true)
    dismissUpdate()

    expect(localStorageMock.getItem('dm-hero-update-dismissed')).toBe('v1.0.0-beta.2')
  })

  it('should show banner again for new version after dismiss', async () => {
    // First check and dismiss beta.2
    mockGitHubResponse([{ tag_name: 'v1.0.0-beta.2' }])
    const checker1 = useUpdateChecker()
    await checker1.checkForUpdates(true)
    checker1.dismissUpdate()
    expect(checker1.showBanner.value).toBe(false)

    // New version beta.3 released
    mockGitHubResponse([{ tag_name: 'v1.0.0-beta.3' }])
    const checker2 = useUpdateChecker()
    await checker2.checkForUpdates(true)

    // Should show banner for new version
    expect(checker2.showBanner.value).toBe(true)
    expect(checker2.updateInfo.value?.latestVersion).toBe('v1.0.0-beta.3')
  })
})

describe('Update Checker - Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
    setMockAppVersion('1.0.0-beta.1')
  })

  it('should handle API error gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
    })

    const { checkForUpdates, updateInfo } = useUpdateChecker()
    const result = await checkForUpdates(true)

    expect(result).toBeNull()
    expect(updateInfo.value).toBeNull()
  })

  it('should handle network error gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const { checkForUpdates, updateInfo } = useUpdateChecker()
    const result = await checkForUpdates(true)

    expect(result).toBeNull()
    expect(updateInfo.value).toBeNull()
  })

  it('should handle empty releases array', async () => {
    mockGitHubResponse([])

    const { checkForUpdates } = useUpdateChecker()
    const result = await checkForUpdates(true)
    expect(result).toBeNull()
  })
})
