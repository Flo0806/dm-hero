import { getDb } from '../../utils/db'
import { moveStoryNode, toHttpError } from '../../utils/story'

/** Reorder / reparent a node; returns the updated tree */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ id: number, parentId: number | null, index: number }>(event)
  const id = Number(body?.id)
  if (!id) {
    throw createError({ statusCode: 400, message: 'Node ID is required' })
  }
  try {
    return moveStoryNode(getDb(), id, body.parentId ?? null, Number(body.index) || 0)
  }
  catch (error) {
    toHttpError(error)
  }
})
