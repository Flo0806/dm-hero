import { getDb } from '../../../utils/db'
import { setStoryNodeLinks, toHttpError } from '../../../utils/story'
import type { StoryNodeLinks } from '~~/types/story'

/** Replace linked sessions / encounters / maps (each list only if given) */
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!id) {
    throw createError({ statusCode: 400, message: 'Node ID is required' })
  }
  const body = await readBody<StoryNodeLinks>(event)
  try {
    return setStoryNodeLinks(getDb(), id, body ?? {})
  }
  catch (error) {
    toHttpError(error)
  }
})
