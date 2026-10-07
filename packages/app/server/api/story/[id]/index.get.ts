import { getDb } from '../../../utils/db'
import { getStoryNode, toHttpError } from '../../../utils/story'

/** One story node with its texts, links and mentions. */
export default defineEventHandler((event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!id) {
    throw createError({ statusCode: 400, message: 'Node ID is required' })
  }
  try {
    return getStoryNode(getDb(), id)
  }
  catch (error) {
    toHttpError(error)
  }
})
