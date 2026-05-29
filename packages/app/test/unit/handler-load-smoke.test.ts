import { describe, it, expect, beforeAll, afterAll } from 'vitest'

/**
 * Smoke-load tests for the export/import handlers.
 *
 * The other tests in this folder re-implement the SQL parts of the handlers in
 * local helpers — useful for unit-testing the rules, blind to anything else.
 * If the real handler file fails to LOAD (bad import, missing dep, wrong ESM
 * shape, archiver/unzipper changing its export surface), those tests stay
 * green while the feature is completely broken in production.
 *
 * These smoke tests just `import()` the handler modules. If the file can't be
 * loaded, the test fails — which is exactly the signal we want.
 *
 * Auto-imports (`defineEventHandler`, `readBody`, `getQuery`, …) are Nuxt-time
 * macros so we stub them on globalThis before loading the file, otherwise the
 * import would throw on `defineEventHandler is not defined` and mask the real
 * "is this module shape valid?" question.
 */

// Keys we stub on globalThis — restored on afterAll so the stubs don't leak
// into the other test files.
const STUBBED_KEYS = [
  'defineEventHandler',
  'defineNitroPlugin',
  'readBody',
  'readMultipartFormData',
  'getQuery',
  'getRouterParam',
  'getRequestURL',
  'getHeader',
  'setResponseStatus',
  'setResponseHeader',
  'sendStream',
  'createError',
] as const

const originalGlobals = new Map<string, { had: boolean, value: unknown }>()

beforeAll(() => {
  const g = globalThis as Record<string, unknown>
  for (const key of STUBBED_KEYS) {
    originalGlobals.set(key, {
      had: Object.hasOwn(g, key),
      value: g[key],
    })
  }
  // Stub Nuxt/h3 auto-imports just enough for module-level code to run.
  g.defineEventHandler = (handler: unknown) => handler
  g.defineNitroPlugin = (handler: unknown) => handler
  g.readBody = async () => ({})
  g.readMultipartFormData = async () => []
  g.getQuery = () => ({})
  g.getRouterParam = () => undefined
  g.getRequestURL = () => new URL('http://localhost/')
  g.getHeader = () => undefined
  g.setResponseStatus = () => undefined
  g.setResponseHeader = () => undefined
  g.sendStream = () => undefined
  g.createError = (opts: { message?: string }) => new Error(opts?.message ?? 'error')
})

afterAll(() => {
  const g = globalThis as Record<string, unknown>
  for (const [key, snapshot] of originalGlobals) {
    if (snapshot.had) g[key] = snapshot.value
    else Reflect.deleteProperty(g, key)
  }
  originalGlobals.clear()
})

describe('handler module load smoke', () => {
  it('campaigns/[id]/export.post.ts loads', async () => {
    // Whole point of this test: catch breakage in the top-level imports
    // (e.g. `archiver` changing its ESM shape).
    await expect(
      import('../../server/api/campaigns/[id]/export.post.ts'),
    ).resolves.toBeDefined()
  })

  it('campaigns/import.post.ts loads', async () => {
    await expect(
      import('../../server/api/campaigns/import.post.ts'),
    ).resolves.toBeDefined()
  })

  it('folders crud handlers load', async () => {
    await expect(import('../../server/api/folders/index.get.ts')).resolves.toBeDefined()
    await expect(import('../../server/api/folders/index.post.ts')).resolves.toBeDefined()
    await expect(import('../../server/api/folders/[id].patch.ts')).resolves.toBeDefined()
    await expect(import('../../server/api/folders/[id].delete.ts')).resolves.toBeDefined()
    await expect(import('../../server/api/entities/[id]/folder.patch.ts')).resolves.toBeDefined()
  })

  it('climate-zone + weather + climate-area handlers load', async () => {
    await expect(import('../../server/api/campaigns/[id]/climate-zones/index.get.ts')).resolves.toBeDefined()
    await expect(import('../../server/api/campaigns/[id]/climate-zones/index.post.ts')).resolves.toBeDefined()
    await expect(import('../../server/api/climate-zones/[id]/index.patch.ts')).resolves.toBeDefined()
    await expect(import('../../server/api/climate-zones/[id]/index.delete.ts')).resolves.toBeDefined()
    await expect(import('../../server/api/climate-zones/[id]/profile.patch.ts')).resolves.toBeDefined()
    await expect(import('../../server/api/campaigns/[id]/active-climate-zone.patch.ts')).resolves.toBeDefined()
    await expect(import('../../server/api/calendar/weather/generate.post.ts')).resolves.toBeDefined()
    await expect(import('../../server/api/calendar/weather/index.get.ts')).resolves.toBeDefined()
    await expect(import('../../server/api/maps/[id]/climate-areas/index.post.ts')).resolves.toBeDefined()
    await expect(import('../../server/api/maps/[id]/climate-areas/[areaId].patch.ts')).resolves.toBeDefined()
    await expect(import('../../server/api/maps/[id]/climate-areas/[areaId].delete.ts')).resolves.toBeDefined()
  })
})
