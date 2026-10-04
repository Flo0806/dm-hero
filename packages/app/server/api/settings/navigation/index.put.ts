import { normalizeNavLayout } from '~~/types/navigation'
import { getDb } from '../../../utils/db'
import { writeSetting } from '../../../utils/settings'

// Save the sidebar order - stored like every other setting
export default defineEventHandler(async (event) => {
  const body = await readBody<{ layout?: unknown }>(event)
  if (!Array.isArray(body?.layout)) throw createError({ statusCode: 400, message: 'layout (array) required' })
  const layout = normalizeNavLayout(body.layout)
  writeSetting(getDb(), 'navigation_layout', JSON.stringify(layout))
  return layout
})
