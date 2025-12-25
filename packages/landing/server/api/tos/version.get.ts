import { CURRENT_TOS_VERSION } from '../../utils/tos'

// Public endpoint - returns current ToS version (no auth required)
export default defineEventHandler(() => {
  return {
    version: CURRENT_TOS_VERSION,
  }
})
