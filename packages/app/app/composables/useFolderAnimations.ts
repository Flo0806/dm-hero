/**
 * Folder easter-egg animations — playful hover effects on folder cards.
 *
 * Behaviour:
 *  - each folder gets one animation deterministically picked from its id
 *  - hover triggers it with ~15% probability + 10s cooldown per folder
 *  - respects `prefers-reduced-motion` (always off then)
 *  - respects a global toggle in Settings (`dm-hero-folder-animations-disabled`)
 *
 * Storing the picked animation on `entity_folders.easter_egg` is optional —
 * if NULL the deterministic fallback is used. Letting users override it via
 * the edit dialog is a phase-2 feature.
 */
import { FOLDER_EASTER_EGGS, type FolderEasterEgg, isValidEasterEgg } from '~~/types/folder'

const SETTINGS_KEY = 'dm-hero-folder-animations-disabled'
const TRIGGER_CHANCE = 0.15
const COOLDOWN_MS = 10_000

// Module-scope reactive state. Hydration happens in `onMounted` (i.e. AFTER
// SSR render is committed on the client) so server and client agree on the
// first render and Vue then patches the switch DOM via reactivity. Top-level
// `if (localStorage)` reads were unreliable because v-switch latched the SSR
// value before our reactive update propagated on first paint after F5.
const globallyEnabled = ref(true)
let hydratedFromStorage = false

function readFromLocalStorage() {
  if (typeof localStorage === 'undefined') return
  try {
    globallyEnabled.value = localStorage.getItem(SETTINGS_KEY) !== '1'
  }
  catch {
    // ignore quota / privacy errors
  }
}

function hydrateFromLocalStorage() {
  if (hydratedFromStorage) return
  if (typeof window === 'undefined') return
  hydratedFromStorage = true
  readFromLocalStorage()
  // Cross-tab sync: another tab toggled the setting → mirror it here. Listener
  // is attached once per browser session at module level since `globallyEnabled`
  // is also module-scoped; no per-component cleanup needed.
  window.addEventListener('storage', (event) => {
    if (event.key === SETTINGS_KEY) readFromLocalStorage()
  })
}

/** Stable hash for picking the deterministic egg per folder id. */
function hashId(n: number): number {
  let x = n | 0
  x = (x ^ 0xdeadbeef) * 0x9e3779b1
  x = (x ^ (x >>> 16)) | 0
  return Math.abs(x)
}

export function easterEggForFolder(
  folderId: number,
  override?: string | null,
): FolderEasterEgg {
  if (isValidEasterEgg(override)) return override
  return FOLDER_EASTER_EGGS[hashId(folderId) % FOLDER_EASTER_EGGS.length]!
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Per-folder hover controller. Returns:
 *  - `egg` — the egg key for this folder (deterministic or override)
 *  - `playing` — true while the animation is on screen
 *  - `onHover()` — call from `@mouseenter` on the card root
 */
export function useFolderAnimation(folderId: number, override?: string | null) {
  onMounted(hydrateFromLocalStorage)
  const egg = easterEggForFolder(folderId, override)
  const playing = ref(false)
  const lastTrigger = ref(0)
  let timeout: ReturnType<typeof setTimeout> | null = null

  function onHover() {
    if (!globallyEnabled.value) return
    if (prefersReducedMotion()) return
    if (playing.value) return
    if (Date.now() - lastTrigger.value < COOLDOWN_MS) return
    if (Math.random() > TRIGGER_CHANCE) return

    lastTrigger.value = Date.now()
    playing.value = true
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => {
      playing.value = false
    }, 2200)
  }

  function stop() {
    if (timeout) {
      clearTimeout(timeout)
      timeout = null
    }
    playing.value = false
  }

  // Ensure the pending hover-out timer is cancelled when the host card
  // unmounts (e.g. folder list re-renders after a move). Without this the
  // setTimeout would fire on a disposed component and flip stale state.
  onBeforeUnmount(stop)

  return { egg, playing, onHover, stop }
}

/** Settings-level controls. */
export function useFolderAnimationSettings() {
  onMounted(hydrateFromLocalStorage)
  function setEnabled(value: boolean) {
    globallyEnabled.value = value
    if (typeof localStorage === 'undefined') return
    try {
      if (value) localStorage.removeItem(SETTINGS_KEY)
      else localStorage.setItem(SETTINGS_KEY, '1')
    }
    catch {
      // ignore
    }
  }
  return { enabled: globallyEnabled, setEnabled }
}
