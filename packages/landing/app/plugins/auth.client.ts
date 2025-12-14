export default defineNuxtPlugin(async () => {
  const { fetchUser } = useAuth()

  // Try to fetch user on app init (client-side only)
  await fetchUser()
})
