import { normalizeNavLayout } from '~~/types/navigation'
import { getDb } from '../../../utils/db'
import { encrypt } from '../../../utils/encryption'

// Save the sidebar order - stored like every other setting
export default defineEventHandler(async (event) => {
  const body = await readBody<{ layout?: unknown }>(event)
  if (!Array.isArray(body?.layout)) throw createError({ statusCode: 400, message: 'layout (array) required' })
  const layout = normalizeNavLayout(body.layout)
  getDb().prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `).run('navigation_layout', encrypt(JSON.stringify(layout)))
  return layout
})
