/**
 * API Plugin with automatic token refresh
 *
 * Architecture:
 * 1. Server-side: /api/auth/me does silent refresh (access token expired but refresh valid)
 * 2. Client-side: This plugin provides $api with auto-retry on 401
 *
 * The $api wrapper catches 401, refreshes token, and retries the request.
 * It also handles concurrent requests during refresh by queueing them.
 *
 * Usage: const { $api } = useNuxtApp()
 *        await $api('/protected/endpoint')
 *
 * @see https://github.com/nuxt/nuxt/discussions/22441
 */

import { useAuthStore } from '~/stores/authStore'

// Shared refresh state across all requests
let isRefreshing = false
let refreshPromise: Promise<boolean> | null = null
const pendingRequests: Array<{
  resolve: (value: unknown) => void
  reject: (error: unknown) => void
  url: string
  options: Parameters<typeof $fetch>[1]
}> = []

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()

  // Create a wrapper function that handles 401 + refresh + retry
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const api = async <T = any>(url: string, options?: Parameters<typeof $fetch>[1]): Promise<T> => {
    const fullOptions: Parameters<typeof $fetch>[1] = {
      ...options,
      baseURL: config.public.apiBase || '',
    }

    try {
      return await $fetch<T>(url, fullOptions) as T
    } catch (error) {
      const fetchError = error as { statusCode?: number; status?: number }
      const status = fetchError.statusCode || fetchError.status

      // Only handle 401
      if (status !== 401) {
        throw error
      }

      // Skip auth endpoints to avoid infinite loops
      if (
        url.includes('/api/auth/login') ||
        url.includes('/api/auth/register') ||
        url.includes('/api/auth/refresh') ||
        url.includes('/api/auth/logout') ||
        url.includes('/api/auth/me')
      ) {
        throw error
      }

      // If already refreshing, queue this request
      if (isRefreshing && refreshPromise) {
        return new Promise<T>((resolve, reject) => {
          pendingRequests.push({ resolve: resolve as (value: unknown) => void, reject, url, options: fullOptions })
        })
      }

      // Start refresh
      isRefreshing = true
      refreshPromise = performRefresh()

      try {
        const success = await refreshPromise

        if (!success) {
          // Refresh failed - reject all pending requests
          pendingRequests.forEach(({ reject }) => reject(new Error('Session expired')))
          pendingRequests.length = 0

          // Logout and redirect
          const authStore = useAuthStore()
          await authStore.logout()
          navigateTo('/login')
          throw new Error('Session expired')
        }

        // Refresh successful - retry pending requests
        for (const pending of pendingRequests) {
          try {
            const result = await $fetch(pending.url, pending.options)
            pending.resolve(result)
          } catch (err) {
            pending.reject(err)
          }
        }
        pendingRequests.length = 0

        // Retry the current request
        return await $fetch<T>(url, fullOptions) as T
      } finally {
        isRefreshing = false
        refreshPromise = null
      }
    }
  }

  return {
    provide: {
      api,
    },
  }
})

/**
 * Perform the actual token refresh
 */
async function performRefresh(): Promise<boolean> {
  try {
    const response = await $fetch<{
      user: {
        id: number
        email: string
        displayName: string
        avatarUrl: string | null
        role: 'user' | 'creator' | 'admin'
        emailVerified: boolean
      }
    }>('/api/auth/refresh', {
      method: 'POST',
    })

    if (response.user) {
      const authStore = useAuthStore()
      authStore.setUser({
        ...response.user,
        emailVerified: !!response.user.emailVerified,
      })
      return true
    }

    return false
  } catch {
    return false
  }
}
