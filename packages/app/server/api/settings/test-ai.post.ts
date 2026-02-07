import type { AiProviderType } from '../../utils/ai'
import { testAiConnection } from '../../utils/ai'

interface TestAiRequest {
  provider?: AiProviderType
  apiKey?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<TestAiRequest>(event)

  try {
    return await testAiConnection(body?.provider, body?.apiKey?.trim())
  }
  catch (error) {
    const err = error as { statusCode?: number, message?: string }
    throw createError({
      statusCode: err.statusCode || 500,
      message: err.message || 'Failed to test AI connection',
    })
  }
})
