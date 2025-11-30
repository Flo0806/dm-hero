import { join } from 'path'

/**
 * Path utilities for cross-environment support (Web vs Electron)
 *
 * In Web mode: Uses default relative paths
 * In Electron mode: Uses app.getPath('userData') via environment variables
 *
 * Environment variables (set by Electron main process):
 * - DATABASE_PATH: Full path to SQLite database file
 * - UPLOAD_PATH: Full path to uploads directory
 */

/**
 * Get the path to the SQLite database file
 * @returns Absolute or relative path to dm-hero.db
 */
export function getDatabasePath(): string {
  return process.env.DATABASE_PATH || join(process.cwd(), 'data', 'dm-hero.db')
}

/**
 * Get the path to the uploads directory
 * @returns Absolute or relative path to uploads folder
 */
export function getUploadPath(): string {
  return process.env.UPLOAD_PATH || join(process.cwd(), 'uploads')
}

/**
 * Check if running in Electron environment
 * @returns true if DATABASE_PATH or UPLOAD_PATH is set (indicating Electron)
 */
export function isElectronEnvironment(): boolean {
  return !!(process.env.DATABASE_PATH || process.env.UPLOAD_PATH)
}
