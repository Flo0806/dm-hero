import { existsSync, mkdirSync, appendFileSync, statSync, renameSync, unlinkSync } from 'fs'
import { join, dirname } from 'path'

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL'

interface LoggerConfig {
  maxFileSize: number // Max size in bytes before rotation
  maxFiles: number // Number of rotated files to keep
}

const DEFAULT_CONFIG: LoggerConfig = {
  maxFileSize: 5 * 1024 * 1024, // 5MB
  maxFiles: 3,
}

let logPath: string | null = null
let config: LoggerConfig = DEFAULT_CONFIG

/**
 * Get the path to the log file
 */
export function getLogPath(): string {
  if (logPath) return logPath

  // Use LOG_PATH env var (set by Electron) or default to data/logs
  const logDir = process.env.LOG_PATH || join(process.cwd(), 'data', 'logs')

  // Ensure log directory exists
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true })
  }

  logPath = join(logDir, 'dm-hero.log')
  return logPath
}

/**
 * Get the log directory path (for opening in file explorer)
 */
export function getLogDir(): string {
  return dirname(getLogPath())
}

/**
 * Format a timestamp for log entries
 */
function formatTimestamp(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

/**
 * Format log arguments into a string
 */
function formatArgs(args: unknown[]): string {
  return args
    .map((arg) => {
      if (arg instanceof Error) {
        return `${arg.message}\n${arg.stack || ''}`
      }
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2)
        } catch {
          return String(arg)
        }
      }
      return String(arg)
    })
    .join(' ')
}

/**
 * Rotate log files if current file exceeds max size
 *
 * Rotation chain (for maxFiles=3):
 * 1. Delete .log.3 if exists (oldest)
 * 2. Rename .log.2 -> .log.3
 * 3. Rename .log.1 -> .log.2
 * 4. Rename .log -> .log.1 (current becomes .1)
 */
function rotateIfNeeded(): void {
  const path = getLogPath()

  if (!existsSync(path)) return

  try {
    const stats = statSync(path)
    if (stats.size < config.maxFileSize) return

    // Delete oldest file if it exists
    const oldestPath = `${path}.${config.maxFiles}`
    if (existsSync(oldestPath)) {
      try {
        unlinkSync(oldestPath)
      } catch {
        // Ignore deletion errors
      }
    }

    // Rotate existing numbered files: .log.2 -> .log.3, .log.1 -> .log.2
    for (let i = config.maxFiles - 1; i >= 1; i--) {
      const oldPath = `${path}.${i}`
      const newPath = `${path}.${i + 1}`

      if (existsSync(oldPath)) {
        renameSync(oldPath, newPath)
      }
    }

    // Rename current log to .1
    renameSync(path, `${path}.1`)
  } catch (err) {
    // Ignore rotation errors - logging should not break the app
    console.warn('[Logger] Rotation failed:', err)
  }
}

/**
 * Write a log entry to the file
 */
export function writeLog(level: LogLevel, ...args: unknown[]): void {
  try {
    rotateIfNeeded()

    const timestamp = formatTimestamp()
    const message = formatArgs(args)
    const logLine = `[${timestamp}] [${level}] ${message}\n`

    const path = getLogPath()
    appendFileSync(path, logLine, 'utf-8')
  } catch (err) {
    // Fallback to console if file logging fails
    console.warn('[Logger] Failed to write log:', err)
  }
}

/**
 * Log helper functions
 */
export const logger = {
  debug: (...args: unknown[]) => writeLog('DEBUG', ...args),
  info: (...args: unknown[]) => writeLog('INFO', ...args),
  warn: (...args: unknown[]) => writeLog('WARN', ...args),
  error: (...args: unknown[]) => writeLog('ERROR', ...args),
  fatal: (...args: unknown[]) => writeLog('FATAL', ...args),

  /**
   * Get the current log file path
   */
  getPath: getLogPath,

  /**
   * Get the log directory path
   */
  getDir: getLogDir,

  /**
   * Configure the logger
   */
  configure: (newConfig: Partial<LoggerConfig>) => {
    config = { ...config, ...newConfig }
  },

  /**
   * Reset logger state (for testing only)
   */
  _reset: () => {
    logPath = null
    config = { ...DEFAULT_CONFIG }
  },
}

export default logger
