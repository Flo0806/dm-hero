// Runs the cleanup of abandoned games/sessions at start and then every hour
const HOUR_MS = 60 * 60 * 1000

export default defineNitroPlugin((nitro) => {
  // Never during build/prerender - no database there
  if (import.meta.prerender || process.env.NUXT_BUILD || process.env.NITRO_PRERENDER) return

  const run = () => cleanupExpired()
    .then(({ games, sessions }) => {
      if (games || sessions) console.log(`[Cleanup] Removed ${games} abandoned game(s), ${sessions} unused session(s)`)
    })
    .catch(error => console.error('[Cleanup] Failed:', error))

  run()
  const timer = setInterval(run, HOUR_MS)
  nitro.hooks.hook('close', () => clearInterval(timer))
})
