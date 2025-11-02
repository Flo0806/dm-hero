import { getDb } from '../../../utils/db'

export default defineEventHandler(() => {
  const db = getDb()

  // Check if OpenAI key exists in settings
  const setting = db.prepare(`
    SELECT value FROM settings WHERE key = 'openai_api_key'
  `).get() as { value: string } | undefined

  return {
    hasKey: !!setting?.value && setting.value.length > 0,
  }
})
