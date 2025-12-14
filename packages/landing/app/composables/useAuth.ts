export interface AuthUser {
  id: number
  email: string
  displayName: string
  avatarUrl: string | null
  role: 'user' | 'creator' | 'admin'
  emailVerified: boolean
}

export function useAuth() {
  const user = useState<AuthUser | null>('auth-user', () => null)
  const loading = useState<boolean>('auth-loading', () => true)
  const error = useState<string | null>('auth-error', () => null)

  const isAuthenticated = computed(() => !!user.value)
  const isEmailVerified = computed(() => user.value?.emailVerified ?? false)
  const isCreator = computed(() => user.value?.role === 'creator' || user.value?.role === 'admin')
  const isAdmin = computed(() => user.value?.role === 'admin')

  async function fetchUser() {
    loading.value = true
    error.value = null

    try {
      const response = await $fetch<{ user: AuthUser }>('/api/auth/me')
      user.value = response.user
    } catch (err) {
      user.value = null
      // Silently fail - user is just not logged in
    } finally {
      loading.value = false
    }
  }

  async function login(email: string, password: string) {
    loading.value = true
    error.value = null

    try {
      const response = await $fetch<{ user: AuthUser }>('/api/auth/login', {
        method: 'POST',
        body: { email, password },
      })
      user.value = response.user
      return true
    } catch (err: unknown) {
      const fetchError = err as { data?: { message?: string } }
      error.value = fetchError.data?.message || 'Login failed'
      return false
    } finally {
      loading.value = false
    }
  }

  async function register(email: string, password: string, displayName: string, locale?: string) {
    loading.value = true
    error.value = null

    try {
      await $fetch('/api/auth/register', {
        method: 'POST',
        body: { email, password, displayName, locale },
      })
      // Don't set user - they need to verify email first
      return true
    } catch (err: unknown) {
      const fetchError = err as { data?: { message?: string } }
      error.value = fetchError.data?.message || 'Registration failed'
      return false
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    try {
      await $fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // Ignore errors
    } finally {
      user.value = null
    }
  }

  async function refreshToken() {
    try {
      const response = await $fetch<{ user: AuthUser }>('/api/auth/refresh', {
        method: 'POST',
      })
      user.value = response.user
      return true
    } catch {
      user.value = null
      return false
    }
  }

  return {
    user,
    loading,
    error,
    isAuthenticated,
    isEmailVerified,
    isCreator,
    isAdmin,
    fetchUser,
    login,
    register,
    logout,
    refreshToken,
  }
}
