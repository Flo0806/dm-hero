import { app, BrowserWindow, utilityProcess, ipcMain, dialog, shell } from 'electron'
import path from 'path'
import { existsSync, mkdirSync, copyFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const isDev = process.env.NODE_ENV === 'development'
const PROD_SERVER_PORT = 3456

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
 * Get user data paths for database and uploads
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

  return {
    databasePath: path.join(dataDir, 'dm-hero.db'),
    uploadPath: uploadsDir,
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

  // Start server as utility process with environment variables
  serverProcess = utilityProcess.fork(serverPath, [], {
    env: {
      ...process.env,
      NODE_ENV: 'production',
      HOST: '127.0.0.1',
      PORT: String(PROD_SERVER_PORT),
      DATABASE_PATH: paths.databasePath,
      UPLOAD_PATH: paths.uploadPath,
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

  // Start with dark theme (default)
  const currentTheme = THEME.dark

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: currentTheme.background,
    show: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: currentTheme.titleBarOverlay,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

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
