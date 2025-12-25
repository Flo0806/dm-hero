/**
 * Terms of Service Configuration
 *
 * When updating the ToS content, increment the version.
 * Users must re-accept when version changes.
 */

// Current ToS version - increment when ToS content changes
export const CURRENT_TOS_VERSION = '1.0.0'

// Check if user has accepted the current ToS version
export function hasAcceptedCurrentTos(userTosVersion: string | null): boolean {
  if (!userTosVersion) return false
  return userTosVersion === CURRENT_TOS_VERSION
}
