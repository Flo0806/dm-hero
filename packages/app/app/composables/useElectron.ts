/**
 * Composable for Electron-specific functionality
 *
 * Provides access to Electron APIs when running in desktop mode.
 * Falls back gracefully in browser mode.
 */

// Types for Electron API exposed via preload
export interface SaveFileOptions {
  defaultFileName: string
  fileData: ArrayBuffer
  filters?: Array<{ name: string; extensions: string[] }>
}

export interface SaveFileResult {
  success: boolean
  canceled?: boolean
  filePath?: string
  error?: string
}

export interface ElectronAPI {
  isElectron: boolean
  exportDatabase: () => Promise<{ success: boolean; filePath?: string; error?: string }>
  openUploadsFolder: () => Promise<{ success: boolean; error?: string }>
  getDataPaths: () => Promise<{ databasePath: string; uploadPath: string }>
  saveFileDialog: (options: SaveFileOptions) => Promise<SaveFileResult>
}

// Extend Window interface with electronAPI
declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

// Singleton to avoid repeated window checks
let _isElectron: boolean | null = null
let _electronAPI: ElectronAPI | null = null

/**
 * Check if running in Electron
 */
export function isElectron(): boolean {
  if (_isElectron === null) {
    _isElectron = typeof window !== 'undefined' && !!window.electronAPI?.isElectron
  }
  return _isElectron
}

/**
 * Get the Electron API (only available in Electron)
 */
export function getElectronAPI(): ElectronAPI | null {
  if (!isElectron()) return null

  if (_electronAPI === null) {
    _electronAPI = window.electronAPI!
  }
  return _electronAPI
}

/**
 * Composable for Electron functionality
 */
export function useElectron() {
  const electronAPI = getElectronAPI()

  return {
    isElectron: isElectron(),
    electronAPI,

    /**
     * Save a file with a save dialog (Electron only)
     * Falls back to browser download if not in Electron
     */
    async saveFile(blob: Blob, defaultFileName: string): Promise<{ success: boolean; error?: string }> {
      if (electronAPI) {
        // Electron: Show save dialog
        const arrayBuffer = await blob.arrayBuffer()
        const result = await electronAPI.saveFileDialog({
          defaultFileName,
          fileData: arrayBuffer,
        })
        return result
      } else {
        // Browser: Standard download
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = defaultFileName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        return { success: true }
      }
    },

    /**
     * Export the database (Electron only)
     */
    async exportDatabase(): Promise<{ success: boolean; filePath?: string; error?: string }> {
      if (!electronAPI) {
        return { success: false, error: 'Not running in Electron' }
      }
      return electronAPI.exportDatabase()
    },

    /**
     * Open the uploads folder in file explorer (Electron only)
     */
    async openUploadsFolder(): Promise<{ success: boolean; error?: string }> {
      if (!electronAPI) {
        return { success: false, error: 'Not running in Electron' }
      }
      return electronAPI.openUploadsFolder()
    },

    /**
     * Get data paths (database and uploads)
     */
    async getDataPaths(): Promise<{ databasePath: string; uploadPath: string } | null> {
      if (!electronAPI) return null
      return electronAPI.getDataPaths()
    },
  }
}
