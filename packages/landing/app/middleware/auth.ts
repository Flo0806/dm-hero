export default defineNuxtRouteMiddleware(async () => {
  const { isAuthenticated, initialized, fetchUser } = useAuth()

  // Fetch user if not already initialized
  if (!initialized.value) {
    await fetchUser()
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated.value) {
    return navigateTo('/login')
  }
})
