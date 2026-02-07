import { getDb } from '../../utils/db'
import { encrypt } from '../../utils/encryption'

interface SettingsUpdateRequest {
  openai_api_key?: string
  openai_model?: string
}

export default defineEventHandler(async (event) => {
  const db = getDb()
  const body = await readBody<SettingsUpdateRequest>(event)

  // Validate input
  if (!body || typeof body !== 'object') {
    throw createError({
      statusCode: 400,
      message: 'Invalid request body',
    })
  }

  // Prepare upsert statement
  const upsertStmt = db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = CURRENT_TIMESTAMP
  `)

  // Update each setting (encrypt sensitive data)
  const updates: Array<{ key: string; value: string }> = []

  if (body.openai_api_key !== undefined) {
    // Only update if not empty (allow deletion by setting to empty string)
    if (body.openai_api_key.trim().length > 0) {
      updates.push({
        key: 'openai_api_key',
        value: encrypt(body.openai_api_key.trim()),
      })
    } else {
      // Delete the key if empty
      db.prepare('DELETE FROM settings WHERE key = ?').run('openai_api_key')
    }
  }

  if (body.openai_model !== undefined) {
    updates.push({
      key: 'openai_model',
      value: encrypt(body.openai_model.trim() || 'gpt-4o-mini'),
    })
  }

  // Execute updates
  for (const update of updates) {
    upsertStmt.run(update.key, update.value)
  }

  return {
    success: true,
    message: 'Settings updated successfully',
  }
})
