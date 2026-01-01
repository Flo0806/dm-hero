import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Tests for useElectron composable.
 * Uses mocking for Electron APIs.
 */

// We need to test the module fresh each time
describe('useElectron - Browser Mode', () => {
  beforeEach(() => {
    // Reset module state
    vi.resetModules()
    // Ensure no electronAPI
    vi.stubGlobal('window', {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('isElectron should return false when no electronAPI', async () => {
    const { isElectron } = await import('../../app/composables/useElectron')
    expect(isElectron()).toBe(false)
  })

  it('getElectronAPI should return null in browser', async () => {
    const { getElectronAPI } = await import('../../app/composables/useElectron')
    expect(getElectronAPI()).toBeNull()
  })

  it('useElectron should have isElectron=false in browser', async () => {
    const { useElectron } = await import('../../app/composables/useElectron')
    const electron = useElectron()
    expect(electron.isElectron).toBe(false)
    expect(electron.electronAPI).toBeNull()
  })

  it('exportDatabase should return error in browser mode', async () => {
    const { useElectron } = await import('../../app/composables/useElectron')
    const electron = useElectron()
    const result = await electron.exportDatabase()
    expect(result.success).toBe(false)
    expect(result.error).toBe('Not running in Electron')
  })

  it('openUploadsFolder should return error in browser mode', async () => {
    const { useElectron } = await import('../../app/composables/useElectron')
    const electron = useElectron()
    const result = await electron.openUploadsFolder()
    expect(result.success).toBe(false)
    expect(result.error).toBe('Not running in Electron')
  })

  it('getDataPaths should return null in browser mode', async () => {
    const { useElectron } = await import('../../app/composables/useElectron')
    const electron = useElectron()
    const result = await electron.getDataPaths()
    expect(result).toBeNull()
  })
})

describe('useElectron - Electron Mode (Mocked)', () => {
  const mockElectronAPI = {
    isElectron: true,
    exportDatabase: vi.fn(),
    openUploadsFolder: vi.fn(),
    getDataPaths: vi.fn(),
    saveFileDialog: vi.fn(),
    openExternalUrl: vi.fn(),
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    installUpdate: vi.fn(),
    onUpdateAvailable: vi.fn(),
    onUpdateNotAvailable: vi.fn(),
    onUpdateDownloadProgress: vi.fn(),
    onUpdateDownloaded: vi.fn(),
    onUpdateError: vi.fn(),
    removeUpdateListeners: vi.fn(),
  }

  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal('window', { electronAPI: mockElectronAPI })
    // Reset all mocks
    Object.values(mockElectronAPI).forEach((fn) => {
      if (typeof fn === 'function' && 'mockClear' in fn) {
        fn.mockClear()
      }
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('isElectron should return true when electronAPI exists', async () => {
    const { isElectron } = await import('../../app/composables/useElectron')
    expect(isElectron()).toBe(true)
  })

  it('getElectronAPI should return the API', async () => {
    const { getElectronAPI } = await import('../../app/composables/useElectron')
    const api = getElectronAPI()
    expect(api).toBe(mockElectronAPI)
  })

  it('useElectron should have isElectron=true', async () => {
    const { useElectron } = await import('../../app/composables/useElectron')
    const electron = useElectron()
    expect(electron.isElectron).toBe(true)
    expect(electron.electronAPI).toBe(mockElectronAPI)
  })

  it('exportDatabase should call electronAPI.exportDatabase', async () => {
    mockElectronAPI.exportDatabase.mockResolvedValue({
      success: true,
      filePath: '/path/to/backup.db',
    })

    const { useElectron } = await import('../../app/composables/useElectron')
    const electron = useElectron()
    const result = await electron.exportDatabase()

    expect(mockElectronAPI.exportDatabase).toHaveBeenCalled()
    expect(result.success).toBe(true)
    expect(result.filePath).toBe('/path/to/backup.db')
  })

  it('openUploadsFolder should call electronAPI.openUploadsFolder', async () => {
    mockElectronAPI.openUploadsFolder.mockResolvedValue({ success: true })

    const { useElectron } = await import('../../app/composables/useElectron')
    const electron = useElectron()
    const result = await electron.openUploadsFolder()

    expect(mockElectronAPI.openUploadsFolder).toHaveBeenCalled()
    expect(result.success).toBe(true)
  })

  it('getDataPaths should call electronAPI.getDataPaths', async () => {
    mockElectronAPI.getDataPaths.mockResolvedValue({
      databasePath: '/data/dm-hero.db',
      uploadPath: '/data/uploads',
    })

    const { useElectron } = await import('../../app/composables/useElectron')
    const electron = useElectron()
    const result = await electron.getDataPaths()

    expect(mockElectronAPI.getDataPaths).toHaveBeenCalled()
    expect(result?.databasePath).toBe('/data/dm-hero.db')
    expect(result?.uploadPath).toBe('/data/uploads')
  })

  it('openExternalUrl should call electronAPI.openExternalUrl', async () => {
    mockElectronAPI.openExternalUrl.mockResolvedValue({ success: true })

    const { useElectron } = await import('../../app/composables/useElectron')
    const electron = useElectron()
    const result = await electron.openExternalUrl('https://example.com')

    expect(mockElectronAPI.openExternalUrl).toHaveBeenCalledWith('https://example.com')
    expect(result.success).toBe(true)
  })

  it('saveFile should use native dialog in Electron', async () => {
    mockElectronAPI.saveFileDialog.mockResolvedValue({
      success: true,
      filePath: '/downloads/export.dmhero',
    })

    const { useElectron } = await import('../../app/composables/useElectron')
    const electron = useElectron()

    const blob = new Blob(['test data'], { type: 'application/octet-stream' })
    const result = await electron.saveFile(blob, 'export.dmhero')

    expect(mockElectronAPI.saveFileDialog).toHaveBeenCalled()
    expect(result.success).toBe(true)
  })
})

describe('useElectron - Error Handling', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should handle electronAPI errors gracefully', async () => {
    const mockElectronAPI = {
      isElectron: true,
      exportDatabase: vi.fn().mockRejectedValue(new Error('Disk full')),
      openUploadsFolder: vi.fn(),
      getDataPaths: vi.fn(),
      saveFileDialog: vi.fn(),
      openExternalUrl: vi.fn(),
      checkForUpdates: vi.fn(),
      downloadUpdate: vi.fn(),
      installUpdate: vi.fn(),
      onUpdateAvailable: vi.fn(),
      onUpdateNotAvailable: vi.fn(),
      onUpdateDownloadProgress: vi.fn(),
      onUpdateDownloaded: vi.fn(),
      onUpdateError: vi.fn(),
      removeUpdateListeners: vi.fn(),
    }
    vi.stubGlobal('window', { electronAPI: mockElectronAPI })

    const { useElectron } = await import('../../app/composables/useElectron')
    const electron = useElectron()

    await expect(electron.exportDatabase()).rejects.toThrow('Disk full')
  })
})
