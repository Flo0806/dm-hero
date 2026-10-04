import { describe, it, expect, beforeEach } from 'vitest'
import { useRelayDb, touchGame } from '../server/utils/database'
import { requirePlayer } from '../server/utils/auth'
import { cleanupExpired } from '../server/utils/cleanup'
import { addDmStream } from '../server/utils/presence'
import { rateLimit } from '../server/utils/rateLimit'
import { sha256 } from '../server/utils/tokens'
import { runtimeConfig, testCookies } from './setup'

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.UTC(2026, 9, 4)

function addGame(id: string, { createdAt = NOW, lastSeen = null as number | null } = {}) {
  useRelayDb().prepare('INSERT INTO games (id, code, dm_token_hash, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, id.slice(0, 6).toUpperCase(), sha256('dm'), createdAt, lastSeen)
  useRelayDb().prepare('INSERT INTO players (game_id, id, name, pin_hash) VALUES (?, ?, ?, ?)').run(id, '1', 'Anna', 'x')
}

function addSession(gameId: string, token: string, { createdAt = NOW, lastUsed = null as number | null } = {}) {
  useRelayDb().prepare('INSERT INTO player_sessions (token_hash, game_id, player_id, created_at, last_used_at) VALUES (?, ?, ?, ?, ?)')
    .run(sha256(token), gameId, '1', createdAt, lastUsed)
}

const gameIds = () => (useRelayDb().prepare('SELECT id FROM games ORDER BY id').all() as Array<{ id: string }>).map(g => g.id)

beforeEach(() => {
  const db = useRelayDb()
  db.exec('DELETE FROM player_sessions; DELETE FROM threads; DELETE FROM handouts; DELETE FROM inbox; DELETE FROM players; DELETE FROM games;')
  testCookies.clear()
  runtimeConfig.trustProxy = false
})

describe('cleanup of abandoned games', () => {
  it('removes games without DM contact for 30 days, keeps recent and connected ones', async () => {
    addGame('old-game', { createdAt: NOW - 60 * DAY, lastSeen: NOW - 31 * DAY })
    addGame('never-seen', { createdAt: NOW - 31 * DAY })
    addGame('recent-game', { createdAt: NOW - 60 * DAY, lastSeen: NOW - 29 * DAY })
    addGame('live-game', { createdAt: NOW - 60 * DAY, lastSeen: NOW - 40 * DAY })
    // DM Hero is connected right now
    addDmStream('live-game', { push: async () => {}, close: async () => {} } as never)

    const result = await cleanupExpired(NOW)
    expect(result.games).toBe(2)
    expect(gameIds()).toEqual(['live-game', 'recent-game'])
    // Players went with their game
    expect(useRelayDb().prepare('SELECT COUNT(*) AS n FROM players').get()).toEqual({ n: 2 })
  })

  it('ends sessions unused for 90 days', async () => {
    addGame('game-1')
    addSession('game-1', 'stale', { createdAt: NOW - 200 * DAY, lastUsed: NOW - 91 * DAY })
    addSession('game-1', 'old-but-used', { createdAt: NOW - 200 * DAY, lastUsed: NOW - 5 * DAY })
    addSession('game-1', 'fresh', { createdAt: NOW - 10 * DAY })

    expect((await cleanupExpired(NOW)).sessions).toBe(1)
    const left = useRelayDb().prepare('SELECT token_hash FROM player_sessions').all() as Array<{ token_hash: string }>
    expect(left.map(s => s.token_hash).sort()).toEqual([sha256('fresh'), sha256('old-but-used')].sort())
  })

  it('DM contact keeps a game alive, stamped at most every 10 minutes', () => {
    addGame('game-1', { lastSeen: NOW - 31 * DAY })
    touchGame('game-1', NOW)
    touchGame('game-1', NOW + 5 * 60 * 1000)
    expect(useRelayDb().prepare('SELECT last_seen_at FROM games').get()).toEqual({ last_seen_at: NOW })
  })
})

describe('player sessions', () => {
  it('using a session renews it and its cookie (sliding 90 days)', () => {
    addGame('game-1')
    addSession('game-1', 'token-1', { lastUsed: NOW - 60 * DAY })
    testCookies.set('dmh_player', 'token-1')

    expect(requirePlayer({} as never, 'game-1')).toMatchObject({ player_id: '1', name: 'Anna' })
    const session = useRelayDb().prepare('SELECT last_used_at FROM player_sessions').get() as { last_used_at: number }
    expect(session.last_used_at).toBeGreaterThan(NOW - DAY)
    expect(globalThis.setCookie).toHaveBeenCalledWith(expect.anything(), 'dmh_player', 'token-1', expect.objectContaining({ maxAge: 90 * 24 * 60 * 60 }))
  })

  it('no session, no entry', () => {
    addGame('game-1')
    expect(() => requirePlayer({} as never, 'game-1')).toThrow('Not joined')
  })
})

describe('rate limit', () => {
  const event = (ip: string, forwarded: string) => ({ ip, headers: { 'x-forwarded-for': forwarded } }) as never

  it('a faked X-Forwarded-For does not give fresh tries', () => {
    for (let i = 0; i < 3; i++) rateLimit(event('1.2.3.4', `10.0.0.${i}`), 'test-spoof', 3, 60_000)
    expect(() => rateLimit(event('1.2.3.4', '10.0.0.99'), 'test-spoof', 3, 60_000)).toThrow()
  })

  it('behind the trusted proxy every player has their own limit', () => {
    runtimeConfig.trustProxy = true
    for (let i = 0; i < 3; i++) rateLimit(event('127.0.0.1', '5.5.5.5'), 'test-proxy', 3, 60_000)
    expect(() => rateLimit(event('127.0.0.1', '6.6.6.6'), 'test-proxy', 3, 60_000)).not.toThrow()
    expect(() => rateLimit(event('127.0.0.1', '5.5.5.5'), 'test-proxy', 3, 60_000)).toThrow()
  })
})

describe('removing a player on the relay', () => {
  it('drops their conversation, handouts and unread messages', async () => {
    addGame('game-1')
    const db = useRelayDb()
    db.prepare('INSERT INTO players (game_id, id, name, pin_hash) VALUES (?, ?, ?, ?)').run('game-1', '2', 'Ben', 'x')
    for (const player of ['1', '2']) {
      db.prepare('INSERT INTO threads (game_id, player_id, envelopes, updated_at) VALUES (?, ?, ?, ?)').run('game-1', player, '{}', NOW)
      db.prepare('INSERT INTO handouts (game_id, id, player_id, envelopes, updated_at) VALUES (?, ?, ?, ?, ?)').run('game-1', 'h1', player, '{}', NOW)
      db.prepare('INSERT INTO inbox (game_id, id, player_id, public_key, envelope, created_at) VALUES (?, ?, ?, ?, ?, ?)').run('game-1', `m${player}`, player, 'k', '{}', NOW)
    }

    const handler = (await import('../server/api/v1/games/[id]/players.put')).default as (event: unknown) => Promise<unknown>
    await handler({
      headers: { authorization: 'Bearer dm' },
      params: { id: 'game-1' },
      body: { players: [{ id: '1', name: 'Anna', pinHash: 'a'.repeat(64) }] },
    })

    for (const table of ['threads', 'handouts', 'inbox']) {
      expect(db.prepare(`SELECT player_id FROM ${table} WHERE game_id = ?`).all('game-1')).toEqual([{ player_id: '1' }])
    }
  })
})
