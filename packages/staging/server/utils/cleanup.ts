// Abandoned games and sessions don't stay on the server forever:
// - a game without contact from DM Hero for gameTtlDays is removed with everything
//   in it (players, shares, map, encrypted files); connected players see "game ended"
// - a player session unused for sessionTtlDays ends (the player joins again with the PIN)
// A game DM Hero is connected to right now is never removed.

const DAY_MS = 24 * 60 * 60 * 1000

export async function cleanupExpired(now = Date.now()) {
  const config = useRuntimeConfig()
  const db = useRelayDb()
  const gameCutoff = now - Number(config.gameTtlDays) * DAY_MS
  const sessionCutoff = now - Number(config.sessionTtlDays) * DAY_MS

  const expired = (db.prepare('SELECT id FROM games WHERE COALESCE(last_seen_at, created_at) < ?').all(gameCutoff) as Array<{ id: string }>)
    .filter(game => !hasDmStream(game.id))
  for (const { id } of expired) {
    db.prepare('DELETE FROM games WHERE id = ?').run(id)
    removeGameFiles(id)
    await closeGame(id)
  }

  const sessions = db.prepare('DELETE FROM player_sessions WHERE COALESCE(last_used_at, created_at) < ?').run(sessionCutoff).changes
  return { games: expired.length, sessions: Number(sessions) }
}
