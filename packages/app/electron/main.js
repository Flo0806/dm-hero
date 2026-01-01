import { app, BrowserWindow, utilityProcess, ipcMain, dialog, shell } from 'electron'
import pkg from 'electron-updater'
import path from 'path'
import { existsSync, mkdirSync, copyFileSync, writeFileSync, appendFileSync } from 'fs'
import { fileURLToPath } from 'url'
const { autoUpdater } = pkg

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const isDev = process.env.NODE_ENV === 'development'
const PROD_SERVER_PORT = 3456

// ============================================================================
// AUTO-UPDATER CONFIGURATION
// ============================================================================

// DEV MODE: Set to true to test auto-update UI (simulates update available)
// Set to false for real auto-update testing with nightly releases
const FORCE_DEV_UPDATE = false

// Configure auto-updater
autoUpdater.autoDownload = false // We control when to download
autoUpdater.autoInstallOnAppQuit = false // We control when to install
autoUpdater.logger = console

// Theme colors matching DM Hero
const THEME = {
  dark: {
    background: '#1A1D29',
    titleBarOverlay: {
      color: '#1A1D29',
      symbolColor: '#D4A574', // warm gold for window controls
    },
  },
  light: {
    background: '#F5F1E8',
    titleBarOverlay: {
      color: '#F5F1E8',
      symbolColor: '#8B4513', // saddle brown for window controls
    },
  },
}

let mainWindow = null
let serverProcess = null

/**
 * Get user data paths for database, uploads, and logs
 * In production, these are in app.getPath('userData')
 * In dev mode, these are not used (Nuxt dev server uses default paths)
 */
function getDataPaths() {
  if (isDev) {
    return null // Dev mode uses default paths
  }

  const userDataPath = app.getPath('userData')
  const dataDir = path.join(userDataPath, 'data')
  const uploadsDir = path.join(userDataPath, 'uploads')
  const logsDir = path.join(userDataPath, 'logs')

  const audioDir = path.join(uploadsDir, 'audio')

  // Ensure directories exist
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }
  if (!existsSync(uploadsDir)) {
    mkdirSync(uploadsDir, { recursive: true })
  }
  if (!existsSync(audioDir)) {
    mkdirSync(audioDir, { recursive: true })
  }
  if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true })
  }

  return {
    databasePath: path.join(dataDir, 'dm-hero.db'),
    uploadPath: uploadsDir,
    logsPath: logsDir,
  }
}

/**
 * Start the Nitro server as a utility process (production only)
 */
async function startServer() {
  if (isDev) {
    console.log('[Electron] Dev mode - using external Nuxt dev server')
    return
  }

  const paths = getDataPaths()

  // Find server path - check multiple locations for packaged vs dev
  const possiblePaths = [
    // Packaged with extraResources: resources/.output/...
    path.join(process.resourcesPath, '.output', 'server', 'index.mjs'),
    // Packaged without ASAR: resources/app/.output/...
    path.join(process.resourcesPath, 'app', '.output', 'server', 'index.mjs'),
    // Packaged with ASAR unpacked: resources/app.asar.unpacked/.output/...
    path.join(process.resourcesPath, 'app.asar.unpacked', '.output', 'server', 'index.mjs'),
    // Dev mode: project root/.output/...
    path.join(__dirname, '..', '.output', 'server', 'index.mjs'),
  ]

  let serverPath = null
  for (const p of possiblePaths) {
    console.log('[Electron] Checking path:', p, 'exists:', existsSync(p))
    if (existsSync(p)) {
      serverPath = p
      break
    }
  }

  if (!serverPath) {
    console.error('[Electron] Server not found! Checked paths:', possiblePaths)
    console.error('[Electron] Run "pnpm build" first!')
    app.quit()
    return
  }

  const serverDir = path.dirname(serverPath)
  const outputDir = path.dirname(serverDir) // .output folder

  console.log('[Electron] Starting Nitro server...')
  console.log('[Electron]   Server path:', serverPath)
  console.log('[Electron]   Output dir:', outputDir)
  console.log('[Electron]   DATABASE_PATH:', paths.databasePath)
  console.log('[Electron]   UPLOAD_PATH:', paths.uploadPath)
  console.log('[Electron]   LOG_PATH:', paths.logsPath)

  // Start server as utility process with environment variables
  serverProcess = utilityProcess.fork(serverPath, [], {
    env: {
      ...process.env,
      NODE_ENV: 'production',
      HOST: '127.0.0.1',
      PORT: String(PROD_SERVER_PORT),
      DATABASE_PATH: paths.databasePath,
      UPLOAD_PATH: paths.uploadPath,
      LOG_PATH: paths.logsPath,
      NITRO_OUTPUT_DIR: outputDir,
    },
    cwd: outputDir,
    stdio: 'pipe',
  })

  // Log server output
  serverProcess.stdout?.on('data', (data) => {
    console.log('[Server]', data.toString().trim())
  })

  serverProcess.stderr?.on('data', (data) => {
    console.error('[Server Error]', data.toString().trim())
  })

  serverProcess.on('exit', (code) => {
    console.log('[Electron] Server process exited with code:', code)
    serverProcess = null
  })

  // Wait for server to be ready
  await waitForServer(`http://127.0.0.1:${PROD_SERVER_PORT}`, 30000)
  console.log('[Electron] Server is ready!')
}

/**
 * Wait for server to respond
 */
async function waitForServer(url, timeout = 30000) {
  const start = Date.now()

  while (Date.now() - start < timeout) {
    try {
      const response = await fetch(url, { method: 'HEAD' })
      if (response.ok || response.status === 404) {
        return true
      }
    } catch {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  throw new Error(`Server did not start within ${timeout}ms`)
}

/**
 * Stop the server process
 */
function stopServer() {
  if (serverProcess) {
    console.log('[Electron] Stopping server...')
    serverProcess.kill()
    serverProcess = null
  }
}

function createWindow() {
  console.log('[Electron] Creating window...')
  console.log('[Electron] isDev:', isDev)
  console.log('[Electron] Platform:', process.platform)

  // Start with dark theme (default)
  const currentTheme = THEME.dark

  // Platform-specific window options
  // Windows: Custom titlebar with overlay controls
  // Linux/macOS: Native titlebar (titleBarOverlay not supported on Linux)
  const isWindows = process.platform === 'win32'

  const windowOptions = {
    width: 1400,
    height: 900,
    backgroundColor: currentTheme.background,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  }

  if (isWindows) {
    windowOptions.titleBarStyle = 'hidden'
    windowOptions.titleBarOverlay = currentTheme.titleBarOverlay
  } else {
    // Linux/macOS: Hide menu bar for cleaner look
    windowOptions.autoHideMenuBar = true
    // Set window icon (Linux needs this explicitly, Windows/macOS use app bundle icon)
    windowOptions.icon = path.join(__dirname, 'icons', 'icon.png')
  }

  mainWindow = new BrowserWindow(windowOptions)

  mainWindow.once('ready-to-show', () => {
    console.log('[Electron] Window ready to show')
    mainWindow.show()
  })

  mainWindow.webContents.on('did-fail-load', (_, errorCode, errorDescription) => {
    console.error(`[Electron] Failed to load: ${errorCode} ${errorDescription}`)
  })

  // Load the appropriate URL
  const serverUrl = isDev ? 'http://localhost:3000' : `http://127.0.0.1:${PROD_SERVER_PORT}`
  console.log('[Electron] Loading URL:', serverUrl)
  mainWindow.loadURL(serverUrl)

  if (isDev) {
    mainWindow.webContents.openDevTools()
  }
}

// IPC Handlers for data management
ipcMain.handle('get-data-paths', () => {
  if (isDev) {
    // Dev mode uses project-local paths
    return {
      databasePath: path.join(process.cwd(), 'data', 'dm-hero.db'),
      uploadPath: path.join(process.cwd(), 'uploads'),
      logsPath: path.join(process.cwd(), 'data', 'logs'),
    }
  }
  return getDataPaths()
})

ipcMain.handle('export-database', async () => {
  const paths = isDev
    ? { databasePath: path.join(process.cwd(), 'data', 'dm-hero.db') }
    : getDataPaths()

  if (!existsSync(paths.databasePath)) {
    return { success: false, error: 'Database file not found' }
  }

  // Generate default filename with timestamp
  const timestamp = new Date().toISOString().split('T')[0]
  const defaultFilename = `dm-hero-backup-${timestamp}.db`

  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Database',
    defaultPath: defaultFilename,
    filters: [{ name: 'SQLite Database', extensions: ['db'] }],
  })

  if (result.canceled || !result.filePath) {
    return { success: false, canceled: true }
  }

  try {
    copyFileSync(paths.databasePath, result.filePath)
    return { success: true, filePath: result.filePath }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('open-uploads-folder', async () => {
  const paths = isDev
    ? { uploadPath: path.join(process.cwd(), 'uploads') }
    : getDataPaths()

  if (!existsSync(paths.uploadPath)) {
    mkdirSync(paths.uploadPath, { recursive: true })
  }

  try {
    await shell.openPath(paths.uploadPath)
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('open-logs-folder', async () => {
  const paths = isDev
    ? { logsPath: path.join(process.cwd(), 'data', 'logs') }
    : getDataPaths()

  if (!existsSync(paths.logsPath)) {
    mkdirSync(paths.logsPath, { recursive: true })
  }

  try {
    await shell.openPath(paths.logsPath)
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// Open external URL in system browser
ipcMain.handle('open-external-url', async (event, url) => {
  try {
    await shell.openExternal(url)
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// ============================================================================
// AUTO-UPDATER IPC HANDLERS
// ============================================================================

// Check for updates
ipcMain.handle('check-for-updates', async () => {
  if (isDev && FORCE_DEV_UPDATE) {
    // DEV MODE: Simulate update available
    console.log('[AutoUpdater] DEV MODE: Simulating update available')
    return {
      updateAvailable: true,
      version: '99.0.0-test',
      releaseNotes: 'This is a test update for development',
      isDevMode: true,
    }
  }

  try {
    const result = await autoUpdater.checkForUpdates()
    if (result?.updateInfo) {
      const currentVersion = app.getVersion()
      const latestVersion = result.updateInfo.version
      // Only show update if latest version is actually newer
      const isNewer = latestVersion !== currentVersion
      console.log(`[AutoUpdater] Current: ${currentVersion}, Latest: ${latestVersion}, isNewer: ${isNewer}`)
      return {
        updateAvailable: isNewer,
        version: latestVersion,
        releaseNotes: result.updateInfo.releaseNotes,
        isDevMode: false,
      }
    }
    return { updateAvailable: false }
  } catch (error) {
    console.error('[AutoUpdater] Check failed:', error.message)
    return { updateAvailable: false, error: error.message }
  }
})

// Start downloading the update
ipcMain.handle('download-update', async () => {
  if (isDev && FORCE_DEV_UPDATE) {
    // DEV MODE: Simulate download progress
    console.log('[AutoUpdater] DEV MODE: Simulating download...')

    // Simulate progress events
    const simulateProgress = async () => {
      for (let percent = 0; percent <= 100; percent += 10) {
        await new Promise((resolve) => setTimeout(resolve, 300))
        if (mainWindow) {
          mainWindow.webContents.send('update-download-progress', {
            percent,
            bytesPerSecond: 1024 * 1024 * 2, // 2 MB/s
            transferred: percent * 10000,
            total: 1000000,
          })
        }
      }
      // Simulate download complete
      if (mainWindow) {
        mainWindow.webContents.send('update-downloaded')
      }
    }

    simulateProgress()
    return { started: true, isDevMode: true }
  }

  try {
    await autoUpdater.downloadUpdate()
    return { started: true }
  } catch (error) {
    console.error('[AutoUpdater] Download failed:', error.message)
    return { started: false, error: error.message }
  }
})

// Install update and restart
ipcMain.handle('install-update', async () => {
  if (isDev && FORCE_DEV_UPDATE) {
    // DEV MODE: Just show a message, don't actually restart
    console.log('[AutoUpdater] DEV MODE: Would install and restart here')
    if (mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Dev Mode',
        message: 'In production, the app would now restart and install the update.',
        buttons: ['OK'],
      })
    }
    return { installed: false, isDevMode: true }
  }

  autoUpdater.quitAndInstall(false, true)
  return { installed: true }
})

// Auto-updater events -> send to renderer
autoUpdater.on('update-available', (info) => {
  console.log('[AutoUpdater] Update available:', info.version)
  if (mainWindow) {
    mainWindow.webContents.send('update-available', {
      version: info.version,
      releaseNotes: info.releaseNotes,
    })
  }
})

autoUpdater.on('update-not-available', () => {
  console.log('[AutoUpdater] No update available')
  if (mainWindow) {
    mainWindow.webContents.send('update-not-available')
  }
})

autoUpdater.on('download-progress', (progress) => {
  console.log(`[AutoUpdater] Download progress: ${progress.percent.toFixed(1)}%`)
  if (mainWindow) {
    mainWindow.webContents.send('update-download-progress', progress)
  }
})

autoUpdater.on('update-downloaded', (info) => {
  console.log('[AutoUpdater] Update downloaded:', info.version)
  if (mainWindow) {
    mainWindow.webContents.send('update-downloaded', {
      version: info.version,
    })
  }
})

autoUpdater.on('error', (error) => {
  console.error('[AutoUpdater] Error:', error.message)
  if (mainWindow) {
    mainWindow.webContents.send('update-error', {
      message: error.message,
    })
  }
})

// ============================================================================
// FILE DIALOG IPC HANDLERS
// ============================================================================

// Save file with dialog (for campaign exports)
ipcMain.handle('save-file-dialog', async (event, options) => {
  const { defaultFileName, fileData, filters } = options

  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultFileName,
    filters: filters || [
      { name: 'DM Hero Campaign', extensions: ['dmhero'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  })

  if (result.canceled || !result.filePath) {
    return { success: false, canceled: true }
  }

  try {
    // fileData is an ArrayBuffer from the renderer
    const buffer = Buffer.from(fileData)
    writeFileSync(result.filePath, buffer)
    return { success: true, filePath: result.filePath }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// ============================================================================
// UNCAUGHT EXCEPTION HANDLER
// ============================================================================

function logToFile(message) {
  try {
    const paths = getDataPaths()
    const logsDir = paths?.logsPath || path.join(process.cwd(), 'data', 'logs')

    if (!existsSync(logsDir)) {
      mkdirSync(logsDir, { recursive: true })
    }

    const logFile = path.join(logsDir, 'dm-hero.log')
    const now = new Date()
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
    const logLine = `[${timestamp}] [FATAL] [Electron Main] ${message}\n`

    appendFileSync(logFile, logLine, 'utf-8')
  } catch (err) {
    console.error('[Electron] Failed to write to log file:', err)
  }
}

process.on('uncaughtException', (error) => {
  const message = `Uncaught Exception: ${error.message}\n${error.stack || ''}`
  console.error('[Electron]', message)
  logToFile(message)
})

process.on('unhandledRejection', (reason) => {
  const message = `Unhandled Rejection: ${reason instanceof Error ? reason.message + '\n' + reason.stack : String(reason)}`
  console.error('[Electron]', message)
  logToFile(message)
})

// App lifecycle
app.whenReady().then(async () => {
  try {
    await startServer()
    createWindow()
  } catch (error) {
    console.error('[Electron] Failed to start:', error)
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  stopServer()
})

app.on('quit', () => {
  stopServer()
})
