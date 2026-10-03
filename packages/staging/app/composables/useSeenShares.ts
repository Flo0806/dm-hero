// "New" marker: which version of each share the player has already opened (per game, this browser)
export function useSeenShares(gameId: string) {
  const key = `dm-hero-seen:${gameId}`
  const seen = ref<Record<string, string>>({})

  onMounted(() => {
    try {
      seen.value = JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, string>
    }
    catch {
      // Private mode / blocked storage: everything just counts as new
    }
  })

  const isNew = (share: ShareContent) => seen.value[share.shareId] !== share.updatedAt

  function markSeen(share: ShareContent) {
    seen.value = { ...seen.value, [share.shareId]: share.updatedAt }
    try {
      localStorage.setItem(key, JSON.stringify(seen.value))
    }
    catch {
      // ignore
    }
  }

  return { isNew, markSeen }
}
