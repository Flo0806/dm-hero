import { getDb } from '../../utils/db'
import { decrypt } from '../../utils/encryption'

interface TestRequest {
  apiKey?: string // Optional: test a new key before saving
}

export default defineEventHandler(async (event) => {
  const body = await readBody<TestRequest>(event)

  let apiKey: string | null = null

  // Use provided key or fetch from database
  if (body?.apiKey && body.apiKey.trim().length > 0) {
    apiKey = body.apiKey.trim()
  } else {
    const db = getDb()
    const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get('openai_api_key') as
      | { value: string }
      | undefined

    if (setting) {
      try {
        apiKey = decrypt(setting.value)
      } catch {
        throw createError({
          statusCode: 500,
          message: 'Failed to decrypt API key',
        })
      }
    }
  }

  if (!apiKey) {
    throw createError({
      statusCode: 400,
      message: 'No API key provided',
    })
  }

  // Test the API key with a simple request
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw createError({
        statusCode: response.status,
        message: error.error?.message || 'OpenAI API request failed',
      })
    }

    const data = await response.json()

    // Check if GPT-4o-mini is available
    const hasGpt4oMini = data.data?.some((model: { id: string }) => model.id === 'gpt-4o-mini')

    return {
      success: true,
      message: 'OpenAI API connection successful',
      modelsAvailable: data.data?.length || 0,
      hasGpt4oMini,
    }
  } catch (error) {
    const err = error as { statusCode?: number; message?: string }
    throw createError({
      statusCode: err.statusCode || 500,
      message: err.message || 'Failed to connect to OpenAI API',
    })
  }
})
