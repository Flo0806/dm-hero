import type { NavLayoutEntry } from '~~/types/navigation'
import { normalizeNavLayout } from '~~/types/navigation'

// The DM's sidebar order - loaded once, shared by the whole app
const layout = ref<NavLayoutEntry[]>(normalizeNavLayout([]))
let loaded = false

export function useNavigationLayout() {
  async function load() {
    if (loaded) return
    loaded = true
    try {
      layout.value = await $fetch<NavLayoutEntry[]>('/api/settings/navigation')
    }
    catch {
      loaded = false
    }
  }

  async function save(next: NavLayoutEntry[]) {
    layout.value = await $fetch<NavLayoutEntry[]>('/api/settings/navigation', { method: 'PUT', body: { layout: next } })
  }

  async function reset() {
    layout.value = await $fetch<NavLayoutEntry[]>('/api/settings/navigation', { method: 'DELETE' })
  }

  return { layout: readonly(layout), load, save, reset }
}
