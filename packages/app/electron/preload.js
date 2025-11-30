const { contextBridge, ipcRenderer } = require('electron')

// Expose safe APIs to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Check if running in Electron
  isElectron: true,

  // Export database to user-selected location
  exportDatabase: () => ipcRenderer.invoke('export-database'),

  // Open uploads folder in file explorer
  openUploadsFolder: () => ipcRenderer.invoke('open-uploads-folder'),

  // Get data paths info
  getDataPaths: () => ipcRenderer.invoke('get-data-paths'),
})
