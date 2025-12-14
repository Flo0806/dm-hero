export default defineNuxtRouteMiddleware(async () => {
  const { isAuthenticated, loading, fetchUser } = useAuth()

  // Fetch user if not already loaded
  if (loading.value) {
    await fetchUser()
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated.value) {
    return navigateTo('/login')
  }
})
