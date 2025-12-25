import { useAuthStore } from '~/stores/authStore'

// Note: AuthUser type is exported from ~/stores/authStore

// Composable wrapper for the auth store
// Provides reactive refs that work with Nuxt's SSR
export function useAuth() {
  const store = useAuthStore()

  // Create computed refs from store state for template reactivity
  const user = computed(() => store.user)
  const loading = computed(() => store.loading)
  const error = computed(() => store.error)
  const initialized = computed(() => store.initialized)
  const isAuthenticated = computed(() => store.isAuthenticated)
  const isEmailVerified = computed(() => store.isEmailVerified)
  const isCreator = computed(() => store.isCreator)
  const isAdmin = computed(() => store.isAdmin)

  // Wrapper for fetchUser that auto-adds headers on server
  async function fetchUser() {
    let headers: Record<string, string> | undefined
    if (import.meta.server) {
      const requestHeaders = useRequestHeaders(['cookie'])
      if (requestHeaders.cookie) {
        headers = { cookie: requestHeaders.cookie }
      }
    }
    return store.fetchUser(headers)
  }

  return {
    // State (as computed refs)
    user,
    loading,
    error,
    initialized,
    isAuthenticated,
    isEmailVerified,
    isCreator,
    isAdmin,

    // Actions
    fetchUser,
    login: store.login.bind(store),
    register: store.register.bind(store),
    logout: store.logout.bind(store),
    refreshToken: store.refreshToken.bind(store),
    clearError: store.clearError.bind(store),
  }
}
