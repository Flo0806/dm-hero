import { getDb } from '../../utils/db'
import { getGameTableByCampaign, requireNumericParam } from '../../utils/game-table'

// Current game of a campaign (or null if none is running)
export default defineEventHandler((event) => {
  const campaignId = requireNumericParam(getQuery(event).campaignId as string | undefined, 'campaignId')
  return getGameTableByCampaign(getDb(), campaignId)
})
