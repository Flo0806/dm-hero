import { getDb } from '../../utils/db'
import { encrypt } from '../../utils/encryption'

interface SettingsUpdateRequest {
  ai_provider?: string
  openai_api_key?: string
  openai_model?: string
  gemini_api_key?: string
  gemini_model?: string
}

export default defineEventHandler(async (event) => {
  const db = getDb()
  const body = await readBody<SettingsUpdateRequest>(event)

  if (!body || typeof body !== 'object') {
    throw createError({
      statusCode: 400,
      message: 'Invalid request body',
    })
  }

  const upsertStmt = db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = CURRENT_TIMESTAMP
  `)

  const updates: Array<{ key: string, value: string }> = []

  // AI provider selection
  if (body.ai_provider !== undefined) {
    const validProviders = ['openai', 'gemini']
    const provider = validProviders.includes(body.ai_provider) ? body.ai_provider : 'openai'
    updates.push({
      key: 'ai_provider',
      value: encrypt(provider),
    })
  }

  // API keys + models — encrypt if non-empty, delete if empty
  for (const keyName of ['openai_api_key', 'openai_model', 'gemini_api_key', 'gemini_model'] as const) {
    const val = body[keyName]
    if (val !== undefined) {
      if (val.trim().length > 0) {
        updates.push({ key: keyName, value: encrypt(val.trim()) })
      }
      else {
        db.prepare('DELETE FROM settings WHERE key = ?').run(keyName)
      }
    }
  }

  for (const update of updates) {
    upsertStmt.run(update.key, update.value)
  }

  return {
    success: true,
    message: 'Settings updated successfully',
  }
})
