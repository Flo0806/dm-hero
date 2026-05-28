import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref, computed } from 'vue'

// Mock vue auto-imports used by the composable
;(globalThis as Record<string, unknown>).ref = ref
;(globalThis as Record<string, unknown>).computed = computed

Object.defineProperty(globalThis, 'window', { value: {}, configurable: true })

// In-memory localStorage mock
const storage: Record<string, string> = {}
const localStorageMock = {
  getItem: (k: string) => (k in storage ? storage[k] : null),
  setItem: (k: string, v: string) => {
    storage[k] = v
  },
  removeItem: (k: string) => {
    delete storage[k]
  },
  clear: () => {
    for (const k of Object.keys(storage)) delete storage[k]
  },
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, configurable: true })

describe('useFeatureTooltips', () => {
  beforeEach(async () => {
    localStorageMock.clear()
    vi.resetModules()
  })

  it('shouldShow=true initially when not dismissed', async () => {
    const { useFeatureTooltip } = await import('../../app/composables/useFeatureTooltips')
    const { shouldShow } = useFeatureTooltip('test-key')
    expect(shouldShow.value).toBe(true)
  })

  it('session dismiss hides for current session but does not persist', async () => {
    const { useFeatureTooltip } = await import('../../app/composables/useFeatureTooltips')
    const { shouldShow, dismissForSession } = useFeatureTooltip('test-key')

    expect(shouldShow.value).toBe(true)
    dismissForSession()
    expect(shouldShow.value).toBe(false)
    // Nothing written to localStorage
    expect(localStorageMock.getItem('dm-hero-feature-tips-dismissed')).toBe(null)
  })

  it('permanent dismiss persists to localStorage', async () => {
    const { useFeatureTooltip } = await import('../../app/composables/useFeatureTooltips')
    const { shouldShow, dismissPermanent } = useFeatureTooltip('test-key')

    dismissPermanent()
    expect(shouldShow.value).toBe(false)
    expect(localStorageMock.getItem('dm-hero-feature-tips-dismissed')).toContain('test-key')
  })

  it('permanent dismiss survives module reload', async () => {
    const mod1 = await import('../../app/composables/useFeatureTooltips')
    mod1.useFeatureTooltip('persistent-key').dismissPermanent()

    vi.resetModules()
    const mod2 = await import('../../app/composables/useFeatureTooltips')
    const { shouldShow } = mod2.useFeatureTooltip('persistent-key')
    expect(shouldShow.value).toBe(false)
  })

  it('session dismiss does NOT survive module reload', async () => {
    const mod1 = await import('../../app/composables/useFeatureTooltips')
    mod1.useFeatureTooltip('session-only').dismissForSession()

    vi.resetModules()
    const mod2 = await import('../../app/composables/useFeatureTooltips')
    const { shouldShow } = mod2.useFeatureTooltip('session-only')
    expect(shouldShow.value).toBe(true)
  })

  it('global disable hides all tooltips regardless of key', async () => {
    const mod = await import('../../app/composables/useFeatureTooltips')
    const a = mod.useFeatureTooltip('feature-a')
    const b = mod.useFeatureTooltip('feature-b')
    expect(a.shouldShow.value).toBe(true)
    expect(b.shouldShow.value).toBe(true)

    mod.useFeatureTooltipSettings().setGloballyEnabled(false)

    expect(a.shouldShow.value).toBe(false)
    expect(b.shouldShow.value).toBe(false)
  })

  it('global disable persists to localStorage', async () => {
    const mod = await import('../../app/composables/useFeatureTooltips')
    mod.useFeatureTooltipSettings().setGloballyEnabled(false)
    expect(localStorageMock.getItem('dm-hero-feature-tips-disabled')).toBe('1')
  })

  it('resetAllDismissed clears both permanent and session dismissals', async () => {
    const mod = await import('../../app/composables/useFeatureTooltips')
    const { shouldShow: showA, dismissPermanent } = mod.useFeatureTooltip('a')
    const { shouldShow: showB, dismissForSession } = mod.useFeatureTooltip('b')

    dismissPermanent()
    dismissForSession()
    expect(showA.value).toBe(false)
    expect(showB.value).toBe(false)

    mod.useFeatureTooltipSettings().resetAllDismissed()

    expect(showA.value).toBe(true)
    expect(showB.value).toBe(true)
    expect(localStorageMock.getItem('dm-hero-feature-tips-dismissed')).toBe('')
  })

  it('multiple composable calls for same key share state', async () => {
    const { useFeatureTooltip } = await import('../../app/composables/useFeatureTooltips')
    const a = useFeatureTooltip('shared')
    const b = useFeatureTooltip('shared')

    a.dismissForSession()
    expect(b.shouldShow.value).toBe(false)
  })
})
