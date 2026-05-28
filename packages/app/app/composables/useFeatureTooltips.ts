/**
 * Per-feature "new feature" hint state, with two dismissal modes:
 *
 * - **Session dismiss** — user clicked the bubble (or the wrapped element) once.
 *   Stored in-memory only, so the hint reappears on the next app start.
 * - **Permanent dismiss** — user checked "Don't show again" before closing.
 *   Persisted in localStorage `dm-hero-feature-tips-dismissed`.
 *
 * A global on/off switch (`dm-hero-feature-tips-disabled`) suppresses all
 * hints — toggled from the Settings page.
 */

const GLOBAL_KEY = 'dm-hero-feature-tips-disabled'
const DISMISSED_KEY = 'dm-hero-feature-tips-dismissed'

// Module-level reactive state — shared across all composable callers.
const permanentDismissed = ref<Set<string>>(new Set())
const sessionDismissed = ref<Set<string>>(new Set())
const globallyEnabled = ref(true)
let hydrated = false

function hydrate() {
  if (hydrated || typeof localStorage === 'undefined') return
  hydrated = true
  try {
    const raw = localStorage.getItem(DISMISSED_KEY)
    if (raw) permanentDismissed.value = new Set(raw.split(',').filter(Boolean))
    globallyEnabled.value = localStorage.getItem(GLOBAL_KEY) !== '1'
  }
  catch {
    // ignore
  }
}

function persistPermanent() {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(DISMISSED_KEY, [...permanentDismissed.value].join(','))
  }
  catch {
    // ignore
  }
}

function persistGlobal() {
  if (typeof localStorage === 'undefined') return
  try {
    if (globallyEnabled.value) localStorage.removeItem(GLOBAL_KEY)
    else localStorage.setItem(GLOBAL_KEY, '1')
  }
  catch {
    // ignore
  }
}

/**
 * Returns reactive show state + dismiss helpers for one specific feature key.
 */
export function useFeatureTooltip(key: string) {
  hydrate()

  const shouldShow = computed(() =>
    globallyEnabled.value
    && !permanentDismissed.value.has(key)
    && !sessionDismissed.value.has(key),
  )

  /** Hide for this session — comes back on next app start. */
  function dismissForSession() {
    if (sessionDismissed.value.has(key)) return
    const next = new Set(sessionDismissed.value)
    next.add(key)
    sessionDismissed.value = next
  }

  /** Hide forever (until the user resets in settings). */
  function dismissPermanent() {
    if (permanentDismissed.value.has(key)) return
    const next = new Set(permanentDismissed.value)
    next.add(key)
    permanentDismissed.value = next
    persistPermanent()
  }

  return { shouldShow, dismissForSession, dismissPermanent }
}

/**
 * Settings-level controls: global on/off + reset all permanent dismissals.
 */
export function useFeatureTooltipSettings() {
  hydrate()

  function setGloballyEnabled(value: boolean) {
    globallyEnabled.value = value
    persistGlobal()
  }

  function resetAllDismissed() {
    permanentDismissed.value = new Set()
    sessionDismissed.value = new Set()
    persistPermanent()
  }

  return {
    globallyEnabled,
    setGloballyEnabled,
    resetAllDismissed,
  }
}
