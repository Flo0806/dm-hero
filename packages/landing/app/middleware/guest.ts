export default defineNuxtRouteMiddleware(async () => {
  const { isAuthenticated, initialized, fetchUser } = useAuth()

  // Fetch user if not already initialized
  if (!initialized.value) {
    await fetchUser()
  }

  // Redirect to store if already authenticated
  if (isAuthenticated.value) {
    return navigateTo('/store')
  }
})
