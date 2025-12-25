/**
 * API fetch utilities with automatic token refresh
 *
 * Uses the $api instance from api.client.ts plugin which handles:
 * - Automatic token refresh on 401
 * - Request queue during refresh
 * - Automatic retry after successful refresh
 * - Logout on refresh failure
 *
 * Usage in components:
 *   const api = useApiFetch()
 *   const data = await api.get<User[]>('/users')
 *
 * Usage in stores:
 *   const $api = getApi()
 *   const data = await $api<User[]>('/users')
 */

/**
 * Composable for API calls in components
 */
export function useApiFetch() {
  const { $api } = useNuxtApp()
  return {
    fetch: $api,
    get: $api,
    post: <T>(url: string, body?: Record<string, unknown>) =>
      $api<T>(url, { method: 'POST', body }),
    put: <T>(url: string, body?: Record<string, unknown>) =>
      $api<T>(url, { method: 'PUT', body }),
    patch: <T>(url: string, body?: Record<string, unknown>) =>
      $api<T>(url, { method: 'PATCH', body }),
    delete: <T>(url: string) => $api<T>(url, { method: 'DELETE' }),
  }
}

/**
 * Direct access to $api for use in Pinia stores
 */
export function getApi() {
  const { $api } = useNuxtApp()
  return $api
}
