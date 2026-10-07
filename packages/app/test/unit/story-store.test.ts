import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useStoryStore } from '../../app/stores/story'
import type { StoryNodeListItem } from '../../types/story'

beforeEach(() => setActivePinia(createPinia()))
afterEach(() => vi.unstubAllGlobals())

describe.each(['create', 'move'] as const)('story store %s campaign guard', (operation) => {
  it.each([2, null])('does not start a reload after switching to campaign %s', async (nextCampaignId) => {
    const store = useStoryStore()
    store.lastFetchedCampaignId = 1
    let activeCampaignId: number | null = 1
    let resolveOperation!: (value: unknown) => void
    let rejectOperation!: (error: Error) => void
    const pendingOperation = new Promise((resolve, reject) => {
      resolveOperation = resolve
      rejectOperation = reject
    })
    let resolveLoad!: (nodes: StoryNodeListItem[]) => void
    const fetch = vi.fn()
      .mockReturnValueOnce(pendingOperation)
      .mockReturnValueOnce(new Promise<StoryNodeListItem[]>((resolve) => { resolveLoad = resolve }))
    vi.stubGlobal('$fetch', fetch)
    const isActive = () => activeCampaignId === 1
    const mutation = operation === 'create'
      ? store.createNode(1, 'Scene', 'scene', null, isActive)
      : store.moveNode(1, 10, null, 0, isActive)
    const completion = operation === 'create'
      ? expect(mutation).resolves.toEqual({ id: 10 })
      : expect(mutation).rejects.toThrow('Move failed')

    activeCampaignId = nextCampaignId
    store.nodes = []
    const load = nextCampaignId ? store.fetchNodes(nextCampaignId) : undefined
    if (!nextCampaignId) {
      store.treeRequest++
      store.loading = false
    }
    const request = store.treeRequest
    if (operation === 'create') resolveOperation({ id: 10 })
    else rejectOperation(new Error('Move failed'))
    await completion

    expect(fetch).toHaveBeenCalledTimes(nextCampaignId ? 2 : 1)
    expect(store.treeRequest).toBe(request)
    expect(store.nodes).toEqual([])
    expect(store.loading).toBe(Boolean(nextCampaignId))
    if (nextCampaignId) {
      resolveLoad([{ id: 20 }] as StoryNodeListItem[])
      await load
      expect(store.nodes).toEqual([{ id: 20 }])
      expect(store.lastFetchedCampaignId).toBe(nextCampaignId)
      expect(store.loading).toBe(false)
    }
  })

  it('reloads the operation campaign while it remains active', async () => {
    const store = useStoryStore()
    // The most recent successful load can still belong to a previous campaign.
    store.lastFetchedCampaignId = 2
    const fetch = vi.fn()
    if (operation === 'create') fetch.mockResolvedValueOnce({ id: 10 })
    else fetch.mockRejectedValueOnce(new Error('Move failed'))
    fetch.mockResolvedValueOnce([{ id: 10 }])
    vi.stubGlobal('$fetch', fetch)

    if (operation === 'create') {
      await expect(store.createNode(1, 'Scene', 'scene', null, () => true)).resolves.toEqual({ id: 10 })
    }
    else {
      await expect(store.moveNode(1, 10, null, 0, () => true)).rejects.toThrow('Move failed')
    }
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch).toHaveBeenLastCalledWith('/api/story', { query: { campaignId: 1 } })
    expect(store.nodes).toEqual([{ id: 10 }])
    expect(store.lastFetchedCampaignId).toBe(1)
  })
})

describe('story store deletion', () => {
  it.each(['resolve', 'reject'] as const)('ignores a pending tree load that later %ss', async (outcome) => {
    const store = useStoryStore()
    const nodes = [{ id: 1 }, { id: 2 }, { id: 3 }] as StoryNodeListItem[]
    store.nodes = nodes
    let resolve!: (nodes: StoryNodeListItem[]) => void
    let reject!: (error: Error) => void
    const pending = new Promise<StoryNodeListItem[]>((res, rej) => {
      resolve = res
      reject = rej
    })
    vi.stubGlobal('$fetch', vi.fn()
      .mockReturnValueOnce(pending)
      .mockResolvedValueOnce({ deletedIds: [1, 2] }))

    const load = store.fetchNodes(1)
    expect(store.loading).toBe(true)
    expect(await store.deleteNode(1)).toEqual([1, 2])
    expect(store.loading).toBe(false)
    expect(store.nodes.map(n => n.id)).toEqual([3])

    if (outcome === 'resolve') resolve(nodes)
    else reject(new Error('Stale request failed'))
    await load
    expect(store.nodes.map(n => n.id)).toEqual([3])
    expect(store.loading).toBe(false)
  })

  it('keeps a pending load valid when deletion fails', async () => {
    const store = useStoryStore()
    let resolve!: (nodes: StoryNodeListItem[]) => void
    vi.stubGlobal('$fetch', vi.fn()
      .mockReturnValueOnce(new Promise<StoryNodeListItem[]>((res) => { resolve = res }))
      .mockRejectedValueOnce(new Error('Delete failed')))
    const load = store.fetchNodes(1)
    const request = store.treeRequest
    await expect(store.deleteNode(1)).rejects.toThrow('Delete failed')
    expect(store.treeRequest).toBe(request)
    expect(store.loading).toBe(true)
    resolve([{ id: 1 }] as StoryNodeListItem[])
    await load
    expect(store.nodes.map(n => n.id)).toEqual([1])
    expect(store.loading).toBe(false)
  })
})
