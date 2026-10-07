import { getDb } from '../../utils/db'
import { createStoryOutline, toHttpError, type StoryOutlineInput } from '../../utils/story'

/** Create a nested outline in one go (all or nothing); ?dryRun=true only validates */
export default defineEventHandler(async (event) => {
  const q = getQuery(event).dryRun
  const dryRun = q === 'true' || q === '1'
  const body = await readBody<{ campaignId: number, parentId?: number | null, nodes: StoryOutlineInput[] }>(event)
  try {
    return createStoryOutline(getDb(), { ...(body ?? { campaignId: 0, nodes: [] }), dryRun })
  }
  catch (error) {
    toHttpError(error)
  }
})
