import { getDb } from '../../../utils/db'
import { toHttpError, updateStoryNode, type StoryNodePatch } from '../../../utils/story'

/** Apply supplied fields, normalize metadata, refresh mentions, and return the updated node. */
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!id) {
    throw createError({ statusCode: 400, message: 'Node ID is required' })
  }
  const body = await readBody<StoryNodePatch>(event)
  try {
    return updateStoryNode(getDb(), id, body ?? {})
  }
  catch (error) {
    toHttpError(error)
  }
})
