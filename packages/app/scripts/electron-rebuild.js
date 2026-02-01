/**
 * Cross-platform script to rebuild better-sqlite3 for Electron
 * Works on Windows, Linux, and macOS
 */

import { execSync } from 'child_process'
import { existsSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')

/**
 * Find better-sqlite3 dynamically in pnpm's node_modules structure
 */
function findBetterSqlite() {
  const pnpmDir = join(projectRoot, 'node_modules', '.pnpm')

  if (!existsSync(pnpmDir)) {
    // Fallback: direct node_modules (non-pnpm or hoisted)
    const directPath = join(projectRoot, 'node_modules', 'better-sqlite3')
    if (existsSync(directPath)) {
      return directPath
    }
    return null
  }

  // Find better-sqlite3@* folder dynamically
  const entries = readdirSync(pnpmDir)
  const betterSqliteFolder = entries.find((entry) => entry.startsWith('better-sqlite3@'))

  if (!betterSqliteFolder) {
    return null
  }

  const betterSqlitePath = join(pnpmDir, betterSqliteFolder, 'node_modules', 'better-sqlite3')

  if (existsSync(betterSqlitePath)) {
    return betterSqlitePath
  }

  return null
}

const betterSqlitePath = findBetterSqlite()

if (!betterSqlitePath) {
  console.error('❌ better-sqlite3 not found in node_modules')
  console.error('   Searched in:', join(projectRoot, 'node_modules'))
  process.exit(1)
}

console.log('🔧 Rebuilding better-sqlite3 for Electron...')
console.log('   Path:', betterSqlitePath)

// Electron version must match package.json
const electronVersion = '39.2.3'

// Support cross-compilation for different architectures (x64, arm64)
// Set via: npm_config_arch=arm64 node scripts/electron-rebuild.js
const arch = process.env.npm_config_arch || process.arch
console.log('   Architecture:', arch)

try {
  execSync(
    `npx node-gyp rebuild --target=${electronVersion} --arch=${arch} --dist-url=https://electronjs.org/headers`,
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
