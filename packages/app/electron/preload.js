const { contextBridge, ipcRenderer } = require('electron')

// Expose safe APIs to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Check if running in Electron
  isElectron: true,

  // Export database to user-selected location
  exportDatabase: () => ipcRenderer.invoke('export-database'),

  // Open uploads folder in file explorer
  openUploadsFolder: () => ipcRenderer.invoke('open-uploads-folder'),

  // Open logs folder in file explorer
  openLogsFolder: () => ipcRenderer.invoke('open-logs-folder'),

  // Get data paths info
  getDataPaths: () => ipcRenderer.invoke('get-data-paths'),

  // Save file with dialog (for campaign exports)
  saveFileDialog: (options) => ipcRenderer.invoke('save-file-dialog', options),

  // Open external URL in system browser
  openExternalUrl: (url) => ipcRenderer.invoke('open-external-url', url),

  // ========================================
  // AUTO-UPDATER APIs
  // ========================================

  // Check for updates (returns { updateAvailable, version, releaseNotes, isDevMode })
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),

  // Start downloading the update
  downloadUpdate: () => ipcRenderer.invoke('download-update'),

  // Install update and restart app
  installUpdate: () => ipcRenderer.invoke('install-update'),

  // Event listeners for update progress
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', (_, data) => callback(data))
  },
  onUpdateNotAvailable: (callback) => {
    ipcRenderer.on('update-not-available', () => callback())
  },
  onUpdateDownloadProgress: (callback) => {
    ipcRenderer.on('update-download-progress', (_, progress) => callback(progress))
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update-downloaded', (_, data) => callback(data))
  },
  onUpdateError: (callback) => {
    ipcRenderer.on('update-error', (_, error) => callback(error))
  },

  // Remove all update listeners (cleanup)
  removeUpdateListeners: () => {
    ipcRenderer.removeAllListeners('update-available')
    ipcRenderer.removeAllListeners('update-not-available')
    ipcRenderer.removeAllListeners('update-download-progress')
    ipcRenderer.removeAllListeners('update-downloaded')
    ipcRenderer.removeAllListeners('update-error')
  },
})
