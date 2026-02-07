/**
 * Composable for handling and translating API errors
 *
 * Parses error messages and returns appropriate i18n keys
 * for user-friendly error display.
 */

/**
 * Parse AI error message and return the appropriate i18n key
 */
export function getAiErrorKey(error: string): string {
  const errorLower = error.toLowerCase()

  // Quota / billing
  if (errorLower.includes('quota') || errorLower.includes('exceeded your current quota') || errorLower.includes('resource_exhausted')) {
    return 'errors.ai.insufficientQuota'
  }
  // Invalid API key
  if (errorLower.includes('invalid_api_key') || errorLower.includes('incorrect api key') || errorLower.includes('permission_denied') || errorLower.includes('api key not valid')) {
    return 'errors.ai.invalidApiKey'
  }
  // Rate limit
  if (errorLower.includes('rate_limit') || errorLower.includes('rate limit') || errorLower.includes('too many requests')) {
    return 'errors.ai.rateLimitExceeded'
  }
  // Content policy / safety
  if (errorLower.includes('content_policy') || errorLower.includes('safety system') || errorLower.includes('safety') || errorLower.includes('blocked')) {
    return 'errors.ai.contentPolicyViolation'
  }
  // Billing limit
  if (errorLower.includes('billing_hard_limit') || errorLower.includes('billing hard limit')) {
    return 'errors.ai.billingHardLimitReached'
  }
  // Server error
  if (errorLower.includes('server_error') || errorLower.includes('internal server error')) {
    return 'errors.ai.serverError'
  }
  // Model not found
  if (errorLower.includes('model_not_found') || errorLower.includes('does not exist')) {
    return 'errors.ai.modelNotFound'
  }
  // No API key configured
  if (errorLower.includes('api key not configured')) {
    return 'errors.ai.noApiKey'
  }

  return 'errors.ai.unknown'
}

// Backward compat alias
export const getOpenAIErrorKey = getAiErrorKey

/**
 * Check if an error is an AI-related error
 */
export function isAiError(error: string): boolean {
  const errorLower = error.toLowerCase()
  return (
    errorLower.includes('openai')
    || errorLower.includes('gemini')
    || errorLower.includes('imagen')
    || errorLower.includes('quota')
    || errorLower.includes('api key')
    || errorLower.includes('api_key')
    || errorLower.includes('rate limit')
    || errorLower.includes('dall-e')
    || errorLower.includes('gpt')
    || errorLower.includes('permission_denied')
    || errorLower.includes('resource_exhausted')
    || errorLower.includes('api key not configured')
  )
}

// Backward compat alias
export const isOpenAIError = isAiError

/**
 * Extract the actual error message from various error formats
 */
function extractErrorMessage(error: unknown): string {
  // Handle $fetch errors which have nested data
  if (error && typeof error === 'object') {
    const fetchError = error as {
      data?: { message?: string, statusMessage?: string }
      statusMessage?: string
      message?: string
      statusCode?: number
    }

    // Check for nested error data (from $fetch)
    if (fetchError.data?.message) {
      return fetchError.data.message
    }
    if (fetchError.data?.statusMessage) {
      return fetchError.data.statusMessage
    }
    if (fetchError.statusMessage) {
      return fetchError.statusMessage
    }

    // Check for 401 status code (invalid API key)
    if (fetchError.statusCode === 401) {
      return 'invalid_api_key'
    }

    if (fetchError.message) {
      // Check for 401 in the message
      if (fetchError.message.includes('401')) {
        return 'invalid_api_key'
      }
      return fetchError.message
    }
  }

  if (error instanceof Error) {
    // Check for 401 in the message
    if (error.message.includes('401')) {
      return 'invalid_api_key'
    }
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  return ''
}

/**
 * Composable for error handling with snackbar integration
 */
export function useErrorHandler() {
  const { t } = useI18n()
  const snackbarStore = useSnackbarStore()

  /**
   * Show an error in the snackbar with automatic translation for known errors
   */
  function showError(error: unknown, fallbackKey?: string) {
    const message = extractErrorMessage(error)

    if (!message) {
      snackbarStore.error(t(fallbackKey || 'errors.ai.unknown'), { persistent: true })
      return
    }

    // Check if it's an AI error and translate it
    if (isAiError(message)) {
      const errorKey = getAiErrorKey(message)
      snackbarStore.error(t(errorKey), { persistent: true })
    }
    else if (fallbackKey) {
      snackbarStore.error(t(fallbackKey), { persistent: true })
    }
    else {
      // Show original message if no translation available
      snackbarStore.error(message, { persistent: true })
    }
  }

  /**
   * Show an upload error
   */
  function showUploadError(type: 'image' | 'pdf' | 'audio') {
    const keyMap = {
      image: 'errors.upload.imageFailed',
      pdf: 'errors.upload.pdfFailed',
      audio: 'errors.upload.audioFailed',
    }
    snackbarStore.error(t(keyMap[type]), { persistent: true })
  }

  /**
   * Show a download error
   */
  function showDownloadError() {
    snackbarStore.error(t('errors.upload.downloadFailed'), { persistent: true })
  }

  /**
   * Show an image operation error
   */
  function showImageError(type: 'generate' | 'delete') {
    const keyMap = {
      generate: 'errors.image.generateFailed',
      delete: 'errors.image.deleteFailed',
    }
    snackbarStore.error(t(keyMap[type]), { persistent: true })
  }

  return {
    showError,
    showUploadError,
    showDownloadError,
    showImageError,
    getAiErrorKey,
    isAiError,
    getOpenAIErrorKey,
    isOpenAIError,
  }
}
