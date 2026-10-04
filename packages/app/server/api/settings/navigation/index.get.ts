import { normalizeNavLayout } from '~~/types/navigation'
import { getDb } from '../../../utils/db'
import { decrypt } from '../../../utils/encryption'

// The DM's sidebar order (default order if none was saved)
export default defineEventHandler(() => {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get('navigation_layout') as { value: string } | undefined
  if (!row) return normalizeNavLayout([])
  try {
    return normalizeNavLayout(JSON.parse(decrypt(row.value)))
  }
  catch {
    return normalizeNavLayout([])
  }
})
