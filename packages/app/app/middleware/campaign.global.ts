export default defineNuxtRouteMiddleware((to) => {
  const campaignStore = useCampaignStore()

  // Initialize campaign from cookie
  campaignStore.initFromCookie()

  // Pages that don't require a campaign
  const publicPages = ['/', '/campaigns']
  if (publicPages.includes(to.path)) {
    return
  }

  // If no campaign selected, redirect to dashboard
  if (!campaignStore.activeCampaignId) {
    return navigateTo('/')
  }
})
