import { runMigrations } from '../utils/migrations'

export default defineNitroPlugin(async () => {
  // Don't run during build or prerender
  if (process.env.NUXT_BUILD || process.env.NITRO_PRERENDER || import.meta.prerender) {
    console.log('[Plugin] Skipping migrations during build/prerender')
    return
  }

  console.log('[Plugin] Running database migrations...')
  try {
    await runMigrations()
    console.log('[Plugin] Database migrations completed')
  } catch (error) {
    console.error('[Plugin] Database migrations failed:', error)
    // Don't crash the server - allow it to start for debugging
  }
})
