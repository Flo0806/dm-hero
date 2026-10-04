import { normalizeNavLayout } from '~~/types/navigation'
import { getDb } from '../../../utils/db'

// Back to the default sidebar order
export default defineEventHandler(() => {
  getDb().prepare('DELETE FROM settings WHERE key = ?').run('navigation_layout')
  return normalizeNavLayout([])
})
