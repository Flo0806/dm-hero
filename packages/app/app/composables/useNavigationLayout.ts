import type { NavLayoutEntry } from '~~/types/navigation'
import { normalizeNavLayout } from '~~/types/navigation'

// The DM's sidebar order. Loaded once during the page load (also server-side),
// so the sidebar is drawn in the saved order right away - no jump after start.
export function useNavigationLayout() {
  const layout = useState<NavLayoutEntry[]>('navigation-layout', () => normalizeNavLayout([]))
  /** The saved order is known - only then may the editor start from it */
  const ready = useState('navigation-layout-ready', () => false)

  async function load() {
    await callOnce('navigation-layout', async () => {
      try {
        layout.value = await $fetch<NavLayoutEntry[]>('/api/settings/navigation')
        ready.value = true
      }
      catch (error) {
        console.error('[Navigation] Layout could not be loaded:', error)
      }
    })
  }

  /** Load again (after a failed first try) */
  async function retry() {
    try {
      layout.value = await $fetch<NavLayoutEntry[]>('/api/settings/navigation')
      ready.value = true
    }
    catch (error) {
      console.error('[Navigation] Layout could not be loaded:', error)
    }
  }

  async function save(next: NavLayoutEntry[]) {
    layout.value = await $fetch<NavLayoutEntry[]>('/api/settings/navigation', { method: 'PUT', body: { layout: next } })
    ready.value = true
  }

  return { layout: readonly(layout), ready: readonly(ready), load, retry, save }
}
