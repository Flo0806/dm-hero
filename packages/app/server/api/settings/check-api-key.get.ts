import { getDb } from '../../utils/db'
import { decrypt } from '../../utils/encryption'

interface SettingRow {
  key: string
  value: string
}

export default defineEventHandler(() => {
  const db = getDb()

  try {
    // Check if openai_api_key exists and is not empty
    const setting = db.prepare('SELECT * FROM settings WHERE key = ?').get('openai_api_key') as
      | SettingRow
      | undefined

    if (!setting) {
      return { hasKey: false }
    }

    // Try to decrypt the value
    const decryptedValue = decrypt(setting.value)

    // Check if the decrypted value is not empty and looks valid (starts with 'sk-')
    const hasKey = decryptedValue && decryptedValue.length > 0 && decryptedValue.startsWith('sk-')

    return { hasKey: !!hasKey }
  } catch (error) {
    console.error('[Settings] Failed to check API key:', error)
    return { hasKey: false }
  }
})
