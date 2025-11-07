import { getDb } from '../../utils/db'
import { decrypt, maskApiKey } from '../../utils/encryption'

interface SettingRow {
  key: string
  value: string
  created_at: string
  updated_at: string
}

export default defineEventHandler(() => {
  const db = getDb()

  // Get all settings
  const settings = db.prepare('SELECT * FROM settings').all() as SettingRow[]

  // Decrypt and format settings for frontend
  const formattedSettings: Record<string, string | null> = {}

  for (const setting of settings) {
    try {
      const decryptedValue = decrypt(setting.value)

      // Mask API keys for security (don't send full keys to frontend)
      if (setting.key.includes('api_key')) {
        formattedSettings[setting.key] = maskApiKey(decryptedValue)
        formattedSettings[`${setting.key}_full`] = decryptedValue // Full key for editing
      } else {
        formattedSettings[setting.key] = decryptedValue
      }
    } catch (error) {
      console.error(`[Settings] Failed to decrypt setting: ${setting.key}`, error)
      formattedSettings[setting.key] = null
    }
  }

  return formattedSettings
})
