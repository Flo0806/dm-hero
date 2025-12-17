import { useAuthStore } from '~/stores/authStore'

export default defineNuxtPlugin(async () => {
  const store = useAuthStore()

  // Only fetch if not already initialized (prevents double fetch on client hydration)
  if (!store.initialized) {
    // On server, forward cookies from the incoming request
    let headers: Record<string, string> | undefined
    if (import.meta.server) {
      const requestHeaders = useRequestHeaders(['cookie'])
      if (requestHeaders.cookie) {
        headers = { cookie: requestHeaders.cookie }
      }
    }

    await store.fetchUser(headers)
  }
})
