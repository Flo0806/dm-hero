import { getDb } from '../../utils/db'
import { listStoryNodes, toHttpError } from '../../utils/story'

/** The campaign's story tree as a flat, ordered list */
export default defineEventHandler((event) => {
  const campaignId = Number(getQuery(event).campaignId)
  if (!campaignId) {
    throw createError({ statusCode: 400, message: 'Campaign ID is required' })
  }
  try {
    return listStoryNodes(getDb(), campaignId)
  }
  catch (error) {
    toHttpError(error)
  }
})
