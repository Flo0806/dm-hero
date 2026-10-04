// "New" badges for features of the current release. A badge disappears once the
// feature was looked at - remembered in this browser only.
const STORAGE_KEY = 'dm-hero-new-badges-seen'

/** Features that get a badge in this release */
export const NEW_BADGES = ['gameTable', 'playerApp'] as const
export type NewBadge = typeof NEW_BADGES[number]

const seen = ref<Set<string> | null>(null)

// Only called in the browser (onMounted / on click) - SSR keeps "unknown" = no badge
function load() {
  if (seen.value) return
  try {
    seen.value = new Set((localStorage.getItem(STORAGE_KEY) ?? '').split(',').filter(Boolean))
  }
  catch {
    seen.value = new Set()
  }
}

export function useNewBadges() {
  // Browser only (SSR would latch "new") - see onMounted
  onMounted(load)

  return {
    isNew: (badge: NewBadge) => !!seen.value && !seen.value.has(badge),
    markSeen(badge: NewBadge) {
      load()
      if (!seen.value || seen.value.has(badge)) return
      seen.value = new Set([...seen.value, badge])
      try {
        localStorage.setItem(STORAGE_KEY, [...seen.value].join(','))
      }
      catch {
        // Storage blocked - the badge just shows again next time
      }
    },
  }
}
