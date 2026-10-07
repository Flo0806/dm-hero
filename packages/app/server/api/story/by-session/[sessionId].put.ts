import { getDb } from '../../../utils/db'
import { setSessionStoryNodes, toHttpError } from '../../../utils/story'

/** Replace a session's linked story nodes without changing their statuses; return the linked nodes. */
export default defineEventHandler(async (event) => {
  const sessionId = Number(getRouterParam(event, 'sessionId'))
  if (!sessionId) {
    throw createError({ statusCode: 400, message: 'Session ID is required' })
  }
  const body = await readBody<{ nodeIds: number[] }>(event)
  if (!Array.isArray(body?.nodeIds)) {
    throw createError({ statusCode: 400, message: 'nodeIds must be an array' })
  }
  try {
    return setSessionStoryNodes(getDb(), sessionId, body.nodeIds)
  }
  catch (error) {
    toHttpError(error)
  }
})
