/**
 * Cross-platform script to rebuild better-sqlite3 for Electron
 * Works on Windows, Linux, and macOS
 */

import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')

// Find better-sqlite3 in node_modules
const betterSqlitePath = join(
  projectRoot,
  'node_modules',
  '.pnpm',
  'better-sqlite3@12.4.6',
  'node_modules',
  'better-sqlite3',
)

if (!existsSync(betterSqlitePath)) {
  console.error('❌ better-sqlite3 not found at:', betterSqlitePath)
  process.exit(1)
}

console.log('🔧 Rebuilding better-sqlite3 for Electron...')
console.log('   Path:', betterSqlitePath)

// Electron version must match package.json
const electronVersion = '39.2.3'

try {
  execSync(
    `npx node-gyp rebuild --target=${electronVersion} --arch=x64 --dist-url=https://electronjs.org/headers`,
    {
      cwd: betterSqlitePath,
      stdio: 'inherit',
      env: {
        ...process.env,
        // Set HOME for node-gyp cache (works on all platforms)
        HOME: process.env.HOME || process.env.USERPROFILE,
      },
    },
  )
  console.log('✅ better-sqlite3 rebuilt for Electron successfully!')
} catch (error) {
  console.error('❌ Failed to rebuild better-sqlite3:', error.message)
  process.exit(1)
}
