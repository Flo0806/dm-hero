export default defineNuxtRouteMiddleware(async () => {
  const { isAuthenticated, loading, fetchUser } = useAuth()

  // Fetch user if not already loaded
  if (loading.value) {
    await fetchUser()
  }

  // Redirect to home if already authenticated
  if (isAuthenticated.value) {
    return navigateTo('/')
  }
})
