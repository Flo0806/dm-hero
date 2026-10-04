import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'

// "New" badges: shown until the feature was looked at, remembered in localStorage
const storage = new Map<string, string>()
vi.stubGlobal('ref', ref)
vi.stubGlobal('onMounted', (fn: () => void) => fn())
vi.stubGlobal('localStorage', {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => storage.set(k, v),
})

beforeEach(() => {
  storage.clear()
  vi.resetModules()
})

describe('useNewBadges', () => {
  it('a badge shows until it was seen - also after a reload', async () => {
    const { useNewBadges } = await import('../../app/composables/useNewBadges')
    const badges = useNewBadges()
    expect(badges.isNew('gameTable')).toBe(true)
    badges.markSeen('gameTable')
    expect(badges.isNew('gameTable')).toBe(false)
    expect(badges.isNew('playerApp')).toBe(true)

    vi.resetModules()
    const reloaded = (await import('../../app/composables/useNewBadges')).useNewBadges()
    expect(reloaded.isNew('gameTable')).toBe(false)
  })

  it('blocked storage: badges still work for this session', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    })
    const { useNewBadges } = await import('../../app/composables/useNewBadges')
    const badges = useNewBadges()
    expect(badges.isNew('gameTable')).toBe(true)
    badges.markSeen('gameTable')
    expect(badges.isNew('gameTable')).toBe(false)
  })
})
