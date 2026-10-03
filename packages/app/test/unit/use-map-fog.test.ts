import { describe, it, expect, beforeEach, vi } from 'vitest'
import { computed, readonly, ref } from 'vue'
import type { MapFog } from '../../types/fog'

// The DM's fog composable: a change only ever lands on its own map, saves in order
vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('readonly', readonly)

const stored = new Map<number, MapFog>()
const puts: Array<{ mapId: number, fog: MapFog }> = []
let getDelay: Record<number, number> = {}
let putDelays: number[] = []

vi.stubGlobal('$fetch', async (url: string, options?: { method?: string, body?: MapFog }) => {
  const mapId = Number(url.split('/')[3])
  if (options?.method === 'PUT') {
    await new Promise(r => setTimeout(r, putDelays.shift() ?? 0))
    puts.push({ mapId, fog: options.body! })
    stored.set(mapId, options.body!)
    return { success: true }
  }
  await new Promise(r => setTimeout(r, getDelay[mapId] ?? 0))
  return stored.get(mapId) ?? { base: 'covered', strokes: [] }
})

const { useMapFog } = await import('../../app/composables/useMapFog')

const dab = (x: number): MapFog['strokes'][number] => ({ mode: 'reveal', radius: 4, points: [[x, x]] })

beforeEach(() => {
  stored.clear()
  puts.length = 0
  getDelay = {}
  putDelays = []
  stored.set(1, { base: 'covered', strokes: [dab(10)] })
  stored.set(2, { base: 'covered', strokes: [dab(20), dab(21)] })
})

describe('useMapFog', () => {
  it('closing a map before its fog arrived saves nothing over it (review #1)', async () => {
    const fog = useMapFog()
    await fog.load(1)
    getDelay[2] = 30
    const loading = fog.load(2)
    await fog.close()
    await loading
    expect(puts).toEqual([])
    expect(stored.get(2)!.strokes).toHaveLength(2)
  })

  it('a slow answer of the previous map never replaces the current one', async () => {
    const fog = useMapFog()
    getDelay[1] = 30
    const first = fog.load(1)
    await fog.load(2)
    await first
    expect(fog.fog.value.strokes).toHaveLength(2)
    // Painting now goes to map 2
    fog.addStroke(dab(50))
    await fog.flush()
    expect(puts.map(p => p.mapId)).toEqual([2])
  })

  it('no painting while loading; changes of a map are saved to that map before switching', async () => {
    const fog = useMapFog()
    await fog.load(1)
    fog.addStroke(dab(30))
    getDelay[2] = 10
    const switching = fog.load(2)
    expect(fog.addStroke(dab(99))).toBe(false)
    await switching
    expect(puts).toEqual([{ mapId: 1, fog: { base: 'covered', strokes: [dab(10), dab(30)] } }])
  })

  it('saves run one after another - a slow older save never overwrites a newer one (review #9)', async () => {
    const fog = useMapFog()
    await fog.load(1)
    putDelays = [40, 0]
    fog.addStroke(dab(40))
    const firstSave = fog.flush()
    fog.addStroke(dab(41))
    await Promise.all([firstSave, fog.flush()])
    expect(puts.filter(p => p.mapId === 1).map(p => p.fog.strokes.length)).toEqual([2, 3])
    expect(stored.get(1)!.strokes).toHaveLength(3)
  })

  it('refuses strokes once the fog is full, reveal all starts fresh (review #4)', async () => {
    const huge = Array.from({ length: 100 }, (_, i) => ({ mode: 'reveal' as const, radius: 4, points: Array.from({ length: 500 }, (_, j) => [i + j / 1000, j / 7] as [number, number]) }))
    stored.set(3, { base: 'covered', strokes: huge })
    const fog = useMapFog()
    await fog.load(3)
    expect(fog.size.value).toBe('full')
    expect(fog.addStroke(dab(1))).toBe(false)
    expect(fog.revealAll()).toBe(true)
    expect(fog.size.value).toBe('ok')
  })
})
