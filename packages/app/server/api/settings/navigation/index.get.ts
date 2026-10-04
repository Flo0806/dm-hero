import { normalizeNavLayout } from '~~/types/navigation'
import { getDb } from '../../../utils/db'
import { readJsonSetting } from '../../../utils/settings'

// The DM's sidebar order (default order if none was saved)
export default defineEventHandler(() => normalizeNavLayout(readJsonSetting<unknown>(getDb(), 'navigation_layout', [])))
