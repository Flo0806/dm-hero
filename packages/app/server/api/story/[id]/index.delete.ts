import { getDb } from '../../../utils/db'
import { deleteStoryNode, toHttpError } from '../../../utils/story'

/** Soft-delete a node and its live story descendants in the same campaign; return success and deletedIds. */
export default defineEventHandler((event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!id) {
    throw createError({ statusCode: 400, message: 'Node ID is required' })
  }
  try {
    return { success: true, deletedIds: deleteStoryNode(getDb(), id) }
  }
  catch (error) {
    toHttpError(error)
  }
})
