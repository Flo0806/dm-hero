import { requireAuth } from '../../utils/requireAuth'
import { CURRENT_TOS_VERSION, hasAcceptedCurrentTos } from '../../utils/tos'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  return {
    currentVersion: CURRENT_TOS_VERSION,
    acceptedVersion: user.tos_accepted_version || null,
    acceptedAt: user.tos_accepted_at || null,
    needsAcceptance: !hasAcceptedCurrentTos(user.tos_accepted_version),
  }
})
