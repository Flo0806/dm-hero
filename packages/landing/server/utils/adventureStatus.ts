/**
 * Adventure Status Constants
 *
 * Defines all possible states for adventure validation workflow
 */

export const ADVENTURE_STATUS = {
  // Initial state after upload - waiting for CRON to pick up
  PENDING_REVIEW: 'pending_review',

  // CRON is currently validating this adventure
  VALIDATING: 'validating',

  // Validation passed - visible in store
  PUBLISHED: 'published',

  // Validation failed - author needs to fix issues and re-upload
  REJECTED: 'rejected',

  // Reserved for future: needs human review after automated checks
  // PENDING_MANUAL_REVIEW: 'pending_manual_review',

  // Author took it down or admin removed it
  ARCHIVED: 'archived',

  // Draft - not submitted (reserved for future save-as-draft feature)
  DRAFT: 'draft',
} as const

export type AdventureStatus = typeof ADVENTURE_STATUS[keyof typeof ADVENTURE_STATUS]

/**
 * Status labels for UI display
 */
export const STATUS_LABELS: Record<AdventureStatus, { en: string; de: string }> = {
  [ADVENTURE_STATUS.PENDING_REVIEW]: {
    en: 'Pending Review',
    de: 'Überprüfung ausstehend',
  },
  [ADVENTURE_STATUS.VALIDATING]: {
    en: 'Validating...',
    de: 'Wird überprüft...',
  },
  [ADVENTURE_STATUS.PUBLISHED]: {
    en: 'Published',
    de: 'Veröffentlicht',
  },
  [ADVENTURE_STATUS.REJECTED]: {
    en: 'Rejected - Action Required',
    de: 'Abgelehnt - Nacharbeit erforderlich',
  },
  [ADVENTURE_STATUS.ARCHIVED]: {
    en: 'Archived',
    de: 'Archiviert',
  },
  [ADVENTURE_STATUS.DRAFT]: {
    en: 'Draft',
    de: 'Entwurf',
  },
}

/**
 * Status colors for UI badges
 */
export const STATUS_COLORS: Record<AdventureStatus, string> = {
  [ADVENTURE_STATUS.PENDING_REVIEW]: 'warning',
  [ADVENTURE_STATUS.VALIDATING]: 'info',
  [ADVENTURE_STATUS.PUBLISHED]: 'success',
  [ADVENTURE_STATUS.REJECTED]: 'error',
  [ADVENTURE_STATUS.ARCHIVED]: 'grey',
  [ADVENTURE_STATUS.DRAFT]: 'grey',
}

/**
 * Status icons for UI
 */
export const STATUS_ICONS: Record<AdventureStatus, string> = {
  [ADVENTURE_STATUS.PENDING_REVIEW]: 'mdi-clock-outline',
  [ADVENTURE_STATUS.VALIDATING]: 'mdi-loading mdi-spin',
  [ADVENTURE_STATUS.PUBLISHED]: 'mdi-check-circle',
  [ADVENTURE_STATUS.REJECTED]: 'mdi-alert-circle',
  [ADVENTURE_STATUS.ARCHIVED]: 'mdi-archive',
  [ADVENTURE_STATUS.DRAFT]: 'mdi-pencil',
}

/**
 * Get status label for display
 */
export function getStatusLabel(status: AdventureStatus, locale: string = 'en'): string {
  const labels = STATUS_LABELS[status]
  return locale === 'de' ? labels.de : labels.en
}

/**
 * Check if status allows editing
 */
export function canEdit(status: AdventureStatus): boolean {
  const editableStatuses: AdventureStatus[] = [
    ADVENTURE_STATUS.PUBLISHED,
    ADVENTURE_STATUS.REJECTED,
    ADVENTURE_STATUS.DRAFT,
  ]
  return editableStatuses.includes(status)
}

/**
 * Check if adventure is visible in store
 */
export function isVisible(status: AdventureStatus): boolean {
  return status === ADVENTURE_STATUS.PUBLISHED
}

/**
 * Check if adventure is in a processing state
 */
export function isProcessing(status: AdventureStatus): boolean {
  const processingStatuses: AdventureStatus[] = [
    ADVENTURE_STATUS.PENDING_REVIEW,
    ADVENTURE_STATUS.VALIDATING,
  ]
  return processingStatuses.includes(status)
}
