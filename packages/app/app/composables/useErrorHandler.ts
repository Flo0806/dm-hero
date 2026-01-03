/**
 * Composable for handling and translating API errors
 *
 * Parses error messages and returns appropriate i18n keys
 * for user-friendly error display.
 */

/**
 * Parse OpenAI error message and return the appropriate i18n key
 */
export function getOpenAIErrorKey(error: string): string {
  const errorLower = error.toLowerCase()

  // Check for specific error patterns
  if (errorLower.includes('quota') || errorLower.includes('exceeded your current quota')) {
    return 'errors.openai.insufficientQuota'
  }
  if (errorLower.includes('invalid_api_key') || errorLower.includes('incorrect api key')) {
    return 'errors.openai.invalidApiKey'
  }
  if (errorLower.includes('rate_limit') || errorLower.includes('rate limit')) {
    return 'errors.openai.rateLimitExceeded'
  }
  if (errorLower.includes('content_policy') || errorLower.includes('safety system')) {
    return 'errors.openai.contentPolicyViolation'
  }
  if (errorLower.includes('billing_hard_limit') || errorLower.includes('billing hard limit')) {
    return 'errors.openai.billingHardLimitReached'
  }
  if (errorLower.includes('server_error') || errorLower.includes('internal server error')) {
    return 'errors.openai.serverError'
  }
  if (errorLower.includes('model_not_found') || errorLower.includes('does not exist')) {
    return 'errors.openai.modelNotFound'
  }

  // Default fallback
  return 'errors.openai.unknown'
}

/**
 * Check if an error is an OpenAI-related error
 */
export function isOpenAIError(error: string): boolean {
  const errorLower = error.toLowerCase()
  return (
    errorLower.includes('openai') ||
    errorLower.includes('quota') ||
    errorLower.includes('api key') ||
    errorLower.includes('api_key') ||
    errorLower.includes('rate limit') ||
    errorLower.includes('dall-e') ||
    errorLower.includes('gpt')
  )
}

/**
 * Extract the actual error message from various error formats
 */
function extractErrorMessage(error: unknown): string {
  // Handle $fetch errors which have nested data
  if (error && typeof error === 'object') {
    const fetchError = error as {
      data?: { message?: string; statusMessage?: string }
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
      snackbarStore.error(t(fallbackKey || 'errors.openai.unknown'), { persistent: true })
      return
    }

    // Check if it's an OpenAI error and translate it
    if (isOpenAIError(message)) {
      const errorKey = getOpenAIErrorKey(message)
      snackbarStore.error(t(errorKey), { persistent: true })
    } else if (fallbackKey) {
      snackbarStore.error(t(fallbackKey), { persistent: true })
    } else {
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
    getOpenAIErrorKey,
    isOpenAIError,
  }
}
