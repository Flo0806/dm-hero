import { runMigrations } from '../utils/migrations'

export default defineNitroPlugin(async () => {
  console.log('[Plugin] Running database migrations...')
  try {
    await runMigrations()
    console.log('[Plugin] Database migrations completed')
  } catch (error) {
    console.error('[Plugin] Database migrations failed:', error)
    // Don't crash the server - allow it to start for debugging
  }
})
