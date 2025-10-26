import Database from 'better-sqlite3'
import { join } from 'path'
import { existsSync, mkdirSync, copyFileSync } from 'fs'

const DB_DIR = join(process.cwd(), 'data')
const DB_PATH = join(DB_DIR, 'dm-hero.db')
const BACKUP_DIR = join(DB_DIR, 'backups')

// Ensure directories exist
if (!existsSync(DB_DIR)) {
  mkdirSync(DB_DIR, { recursive: true })
}
if (!existsSync(BACKUP_DIR)) {
  mkdirSync(BACKUP_DIR, { recursive: true })
}

let db: Database.Database | null = null

export function getDb() {
  if (!db) {
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL') // Write-Ahead Logging for better performance
    db.pragma('foreign_keys = ON') // Enable foreign keys
  }
  return db
}

export function createBackup() {
  if (!existsSync(DB_PATH)) {
    console.log('No database to backup yet.')
    return null
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = join(BACKUP_DIR, `dm-hero-${timestamp}.db`)

  try {
    copyFileSync(DB_PATH, backupPath)
    console.log(`✅ Backup created: ${backupPath}`)
    return backupPath
  }
  catch (error) {
    console.error('❌ Backup failed:', error)
    return null
  }
}

export function getCurrentVersion(database: Database.Database): number {
  try {
    const result = database.prepare('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1').get() as { version: number } | undefined
    return result?.version || 0
  }
  catch {
    // Table doesn't exist yet
    return 0
  }
}

export function setVersion(database: Database.Database, version: number) {
  database.prepare('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)').run(version, new Date().toISOString())
}
