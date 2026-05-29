import { existsSync } from 'fs'
import { resolve } from 'path'

/**
 * Tells the dashboard "Connect your AI" dialog the exact values to put into the
 * MCP registration commands:
 *   - appUrl: where this DM Hero serves its API (Electron 127.0.0.1:3456, dev :3000)
 *   - mcpPath: absolute path to the dm-hero-mcp bin (set by Electron main via
 *     env; in dev, resolved from the monorepo if it's been built)
 *   - isElectron / mcpAvailable: so the UI can adapt its hints
 *
 * The Electron main process passes DM_HERO_APP_URL + DM_HERO_MCP_PATH; in the
 * browser dev server those are absent and we fall back sensibly.
 */
export default defineEventHandler((event) => {
  const envUrl = process.env.DM_HERO_APP_URL
  const envMcp = process.env.DM_HERO_MCP_PATH
  const isElectron = !!process.env.DM_HERO_MCP_PATH || process.env.NODE_ENV === 'production'

  // App URL: env (Electron) → request origin → dev default.
  let appUrl = envUrl
  if (!appUrl) {
    try {
      appUrl = new URL(getRequestURL(event)).origin
    }
    catch {
      appUrl = 'http://localhost:3000'
    }
  }
  // Prefer the IPv4 loopback for reliability (Node fetch resolves localhost → ::1).
  appUrl = appUrl.replace('localhost', '127.0.0.1')

  // MCP bin path: env (Electron resources) → dev monorepo build output.
  let mcpPath = envMcp ?? null
  if (!mcpPath) {
    const devPath = resolve(process.cwd(), '../mcp/dist/mcp.mjs')
    if (existsSync(devPath)) mcpPath = devPath
  }

  return {
    appUrl,
    mcpPath,
    mcpAvailable: !!mcpPath && existsSync(mcpPath),
    isElectron,
  }
})
