// Centralized error codes for API responses
// Frontend translates via $t(`errors.${code}`)

export const ErrorCodes = {
  // General
  CAMPAIGN_ID_REQUIRED: 'CAMPAIGN_ID_REQUIRED',
  INVALID_ID: 'INVALID_ID',
  NOT_FOUND: 'NOT_FOUND',
  NO_FIELDS_TO_UPDATE: 'NO_FIELDS_TO_UPDATE',

  // Groups
  GROUP_NOT_FOUND: 'GROUP_NOT_FOUND',
  GROUP_NAME_REQUIRED: 'GROUP_NAME_REQUIRED',
  GROUP_NAME_EMPTY: 'GROUP_NAME_EMPTY',
  GROUP_ENTITY_IDS_REQUIRED: 'GROUP_ENTITY_IDS_REQUIRED',
  GROUP_ENTITY_ID_REQUIRED: 'GROUP_ENTITY_ID_REQUIRED',
} as const

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes]

interface ApiErrorOptions {
  statusCode: number
  code: ErrorCode
  message?: string // Fallback message for debugging
}

export function createApiError(options: ApiErrorOptions) {
  return createError({
    statusCode: options.statusCode,
    data: { code: options.code },
    message: options.message || options.code,
  })
}
