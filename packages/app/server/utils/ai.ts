import { getDb } from './db'
import { decrypt } from './encryption'

// Supported AI providers
export type AiProviderType = 'openai' | 'gemini'

// Provider configuration map — add new providers here
const PROVIDERS: Record<AiProviderType, {
  chatUrl: string
  defaultModel: string
  modelSettingsKey: string
  settingsKey: string
  testUrl: string
}> = {
  openai: {
    chatUrl: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o-mini',
    modelSettingsKey: 'openai_model',
    settingsKey: 'openai_api_key',
    testUrl: 'https://api.openai.com/v1/models',
  },
  gemini: {
    chatUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    defaultModel: 'gemini-2.5-flash',
    modelSettingsKey: 'gemini_model',
    settingsKey: 'gemini_api_key',
    testUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/models',
  },
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatCompletionOptions {
  temperature?: number
  max_tokens?: number
}

interface ImageGenerationOptions {
  aspectRatio?: '1:1' | '16:9'
}

// Read active provider + API key + model from DB
function getActiveProvider(): { provider: AiProviderType, apiKey: string, model: string, config: typeof PROVIDERS[AiProviderType] } {
  const db = getDb()

  // Read provider setting (default: openai for backward compat)
  const providerRow = db.prepare("SELECT value FROM settings WHERE key = 'ai_provider'").get() as { value: string } | undefined
  let provider: AiProviderType = 'openai'
  if (providerRow?.value) {
    try {
      const decrypted = decrypt(providerRow.value)
      if (decrypted in PROVIDERS) provider = decrypted as AiProviderType
    }
    catch { /* Decryption failed — use default provider */ }
  }

  const config = PROVIDERS[provider]

  // Read API key
  const keyRow = db.prepare('SELECT value FROM settings WHERE key = ?').get(config.settingsKey) as { value: string } | undefined
  if (!keyRow?.value) {
    throw createError({
      statusCode: 400,
      message: `API key not configured for ${provider}. Please add it in Settings.`,
    })
  }

  let apiKey: string
  try {
    apiKey = decrypt(keyRow.value)
  }
  catch {
    throw createError({ statusCode: 500, message: 'Failed to decrypt API key' })
  }

  // Read model (fallback to provider default)
  let model = config.defaultModel
  const modelRow = db.prepare('SELECT value FROM settings WHERE key = ?').get(config.modelSettingsKey) as { value: string } | undefined
  if (modelRow?.value) {
    try {
      const decrypted = decrypt(modelRow.value)
      if (decrypted.trim()) model = decrypted.trim()
    }
    catch { /* Decryption failed — use default model */ }
  }

  return { provider, apiKey, model, config }
}

// Text generation — OpenAI-compatible format for all providers
export async function chatCompletion(messages: ChatMessage[], options?: ChatCompletionOptions): Promise<string> {
  const { apiKey, model, config } = getActiveProvider()
  console.log(`[AI] chatCompletion → ${config.chatUrl} model=${model}`)

  const response = await fetch(config.chatUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      ...(options?.temperature != null && { temperature: options.temperature }),
      ...(options?.max_tokens != null && { max_tokens: options.max_tokens }),
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw createError({
      statusCode: response.status,
      message: (error as { error?: { message?: string } })?.error?.message || 'AI API request failed',
    })
  }

  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>
  }

  const content = data.choices?.[0]?.message?.content?.trim()
  if (!content) {
    console.error('[AI] Unexpected response structure:', JSON.stringify(data).slice(0, 500))
    throw createError({ statusCode: 500, message: 'No response from AI' })
  }

  return content
}

// Image generation — provider-specific implementations
export async function generateImage(prompt: string, options?: ImageGenerationOptions): Promise<Buffer> {
  const { provider, apiKey } = getActiveProvider()

  if (provider === 'gemini') {
    return generateImageImagen(apiKey, prompt, options)
  }
  return generateImageDallE(apiKey, prompt, options)
}

// OpenAI DALL-E 3: POST /v1/images/generations → download URL → Buffer
async function generateImageDallE(apiKey: string, prompt: string, options?: ImageGenerationOptions): Promise<Buffer> {
  const size = options?.aspectRatio === '16:9' ? '1792x1024' : '1024x1024'

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size,
      quality: 'standard',
      style: 'natural',
      response_format: 'url',
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw createError({
      statusCode: response.status,
      message: (error as { error?: { message?: string } })?.error?.message || 'Image generation failed',
    })
  }

  const data = await response.json() as {
    data?: Array<{ url?: string, revised_prompt?: string }>
  }
  const imageUrl = data.data?.[0]?.url

  if (!imageUrl) {
    throw createError({ statusCode: 500, message: 'No image generated' })
  }

  // Download image from URL
  const imageResponse = await fetch(imageUrl)
  if (!imageResponse.ok) {
    throw createError({ statusCode: 500, message: 'Failed to download generated image' })
  }

  return Buffer.from(await imageResponse.arrayBuffer())
}

// Google Imagen 4: POST predict → base64 → Buffer
async function generateImageImagen(apiKey: string, prompt: string, options?: ImageGenerationOptions): Promise<Buffer> {
  const aspectRatio = options?.aspectRatio === '16:9' ? '16:9' : '1:1'

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict', {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio,
      },
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    const errorMessage = (error as { error?: { message?: string } })?.error?.message || 'Imagen API request failed'
    throw createError({ statusCode: response.status, message: errorMessage })
  }

  const data = await response.json() as {
    predictions?: Array<{ bytesBase64Encoded?: string }>
  }

  const base64 = data.predictions?.[0]?.bytesBase64Encoded
  if (!base64) {
    throw createError({ statusCode: 500, message: 'No image generated' })
  }

  return Buffer.from(base64, 'base64')
}

// Test connection for a specific provider (optionally with a test key)
export async function testAiConnection(providerType?: AiProviderType, testApiKey?: string): Promise<{
  success: boolean
  message: string
  modelsAvailable?: number
}> {
  let provider: AiProviderType
  let apiKey: string

  if (testApiKey && providerType) {
    provider = providerType
    apiKey = testApiKey
  }
  else {
    const active = getActiveProvider()
    provider = active.provider
    apiKey = active.apiKey
  }

  const config = PROVIDERS[provider]

  const response = await fetch(config.testUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw createError({
      statusCode: response.status,
      message: (error as { error?: { message?: string } })?.error?.message || 'API connection failed',
    })
  }

  const data = await response.json() as { data?: Array<{ id: string }> }

  return {
    success: true,
    message: 'API connection successful',
    modelsAvailable: data.data?.length || 0,
  }
}

// Check if active provider has a configured key
export function hasAiKey(): boolean {
  const db = getDb()

  const providerRow = db.prepare("SELECT value FROM settings WHERE key = 'ai_provider'").get() as { value: string } | undefined
  let provider: AiProviderType = 'openai'
  if (providerRow?.value) {
    try {
      const decrypted = decrypt(providerRow.value)
      if (decrypted in PROVIDERS) provider = decrypted as AiProviderType
    }
    catch { /* Decryption failed — use default provider */ }
  }

  const config = PROVIDERS[provider]
  const keyRow = db.prepare('SELECT value FROM settings WHERE key = ?').get(config.settingsKey) as { value: string } | undefined

  return !!keyRow?.value && keyRow.value.length > 0
}

// Get the active provider type (for frontend display)
export function getActiveProviderType(): AiProviderType {
  const db = getDb()
  const providerRow = db.prepare("SELECT value FROM settings WHERE key = 'ai_provider'").get() as { value: string } | undefined

  if (providerRow?.value) {
    try {
      const decrypted = decrypt(providerRow.value)
      if (decrypted in PROVIDERS) return decrypted as AiProviderType
    }
    catch { /* Decryption failed — use default provider */ }
  }

  return 'openai'
}
