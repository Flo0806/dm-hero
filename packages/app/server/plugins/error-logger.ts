import { logger } from '../utils/logger'

// Store original console methods
const originalConsoleError = console.error
const originalConsoleWarn = console.warn

export default defineNitroPlugin((nitroApp) => {
  // Skip during build/prerender
  if (process.env.NUXT_BUILD || process.env.NITRO_PRERENDER || import.meta.prerender) {
    return
  }

  console.log('📝 Initializing error logger...')

  // Intercept console.error
  console.error = (...args: unknown[]) => {
    // Write to log file
    logger.error(...args)
    // Still output to console
    originalConsoleError(...args)
  }

  // Intercept console.warn
  console.warn = (...args: unknown[]) => {
    // Write to log file
    logger.warn(...args)
    // Still output to console
    originalConsoleWarn(...args)
  }

  // Hook into Nitro errors (unhandled API errors)
  nitroApp.hooks.hook('error', (error) => {
    logger.error('[Unhandled API Error]', error)
  })

  // Log startup info
  logger.info('DM Hero started')
  logger.info(`Log file: ${logger.getPath()}`)

  console.log(`✅ Error logger ready (${logger.getPath()})`)
})
