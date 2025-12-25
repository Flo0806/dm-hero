import { requireAuth } from '../../utils/requireAuth'
import { query } from '../../utils/db'
import { CURRENT_TOS_VERSION } from '../../utils/tos'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  // Get IP and user agent for audit trail
  const ip = getHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim()
    || getHeader(event, 'x-real-ip')
    || 'unknown'
  const userAgent = getHeader(event, 'user-agent') || 'unknown'

  // Record acceptance in audit table
  await query(
    `INSERT INTO tos_acceptances (user_id, tos_version, ip_address, user_agent)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE accepted_at = NOW(), ip_address = ?, user_agent = ?`,
    [user.id, CURRENT_TOS_VERSION, ip, userAgent, ip, userAgent],
  )

  // Update user record for quick lookup
  await query(
    'UPDATE users SET tos_accepted_version = ?, tos_accepted_at = NOW() WHERE id = ?',
    [CURRENT_TOS_VERSION, user.id],
  )

  return {
    success: true,
    acceptedVersion: CURRENT_TOS_VERSION,
    acceptedAt: new Date().toISOString(),
  }
})
