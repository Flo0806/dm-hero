import { defineStore } from 'pinia'

export interface AuthUser {
  id: number
  email: string
  displayName: string
  avatarUrl: string | null
  role: 'user' | 'creator' | 'admin'
  emailVerified: boolean
  createdAt: string
}

interface AuthState {
  user: AuthUser | null
  loading: boolean
  error: string | null
  initialized: boolean
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    loading: false,
    error: null,
    initialized: false,
  }),

  getters: {
    isAuthenticated: (state) => !!state.user,
    isEmailVerified: (state) => state.user?.emailVerified ?? false,
    isCreator: (state) => state.user?.role === 'creator' || state.user?.role === 'admin',
    isAdmin: (state) => state.user?.role === 'admin',
  },

  actions: {
    async fetchUser(headers?: Record<string, string>) {
      this.loading = true
      this.error = null

      try {
        const response = await $fetch<{ user: AuthUser }>('/api/auth/me', {
          headers,
        })
        // Ensure emailVerified is a boolean (DB might return 0/1)
        this.user = response.user ? {
          ...response.user,
          emailVerified: !!response.user.emailVerified,
        } : null
      } catch (err: unknown) {
        const fetchError = err as { statusCode?: number }

        // If 401, try to refresh token (client-side only)
        if (fetchError.statusCode === 401 && import.meta.client) {
          const refreshed = await this.refreshToken()
          if (refreshed) {
            this.loading = false
            this.initialized = true
            return
          }
        }

        this.user = null
      } finally {
        this.loading = false
        this.initialized = true
      }
    },

    async login(email: string, password: string) {
      this.loading = true
      this.error = null

      try {
        const response = await $fetch<{ user: AuthUser }>('/api/auth/login', {
          method: 'POST',
          body: { email, password },
        })
        // Ensure emailVerified is a boolean
        this.user = response.user ? {
          ...response.user,
          emailVerified: !!response.user.emailVerified,
        } : null
        return true
      } catch (err: unknown) {
        const fetchError = err as { data?: { message?: string } }
        this.error = fetchError.data?.message || 'Login failed'
        return false
      } finally {
        this.loading = false
      }
    },

    async register(email: string, password: string, displayName: string, locale?: string) {
      this.loading = true
      this.error = null

      try {
        await $fetch('/api/auth/register', {
          method: 'POST',
          body: { email, password, displayName, locale },
        })
        return true
      } catch (err: unknown) {
        const fetchError = err as { data?: { message?: string } }
        this.error = fetchError.data?.message || 'Registration failed'
        return false
      } finally {
        this.loading = false
      }
    },

    async logout() {
      try {
        await $fetch('/api/auth/logout', { method: 'POST' })
      } catch {
        // Ignore errors
      } finally {
        this.user = null
      }
    },

    async refreshToken() {
      try {
        const response = await $fetch<{ user: AuthUser }>('/api/auth/refresh', {
          method: 'POST',
        })
        // Ensure emailVerified is a boolean
        this.user = response.user ? {
          ...response.user,
          emailVerified: !!response.user.emailVerified,
        } : null
        return true
      } catch {
        this.user = null
        return false
      }
    },

    setUser(user: AuthUser | null) {
      this.user = user
    },

    clearError() {
      this.error = null
    },
  },
})
