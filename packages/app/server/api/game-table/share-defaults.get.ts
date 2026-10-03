import { getDb } from '../../utils/db'
import { getShareDefaults } from '../../utils/share/defaults'

// The DM's remembered ticks per share type
export default defineEventHandler(() => getShareDefaults(getDb()))
