import { getDb } from '../../utils/db'
import { decrypt } from '../../utils/encryption'

interface GenerateNameRequest {
  entityType: 'NPC' | 'Location' | 'Item' | 'Faction'
  context?: string // Optional context (race, class, location, etc.)
  language?: 'de' | 'en'
}

interface GenerateNameResponse {
  name: string
  alternatives?: string[]
}

export default defineEventHandler(async (event): Promise<GenerateNameResponse> => {
  const body = await readBody<GenerateNameRequest>(event)

  // Validate input
  if (!body || !body.entityType) {
    throw createError({
      statusCode: 400,
      message: 'Entity type is required',
    })
  }

  // Get API key from database
  const db = getDb()
  const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get('openai_api_key') as
    | { value: string }
    | undefined

  if (!setting) {
    throw createError({
      statusCode: 400,
      message: 'OpenAI API key not configured. Please add it in Settings.',
    })
  }

  let apiKey: string
  try {
    apiKey = decrypt(setting.value)
  } catch {
    throw createError({
      statusCode: 500,
      message: 'Failed to decrypt API key',
    })
  }

  // Build prompt based on entity type and context
  const language = body.language || 'de'
  const systemPrompt =
    language === 'de'
      ? 'Du bist ein kreativer D&D Namens-Generator. Generiere passende, atmosphärische Namen für Fantasy-Charaktere und -Orte.'
      : 'You are a creative D&D name generator. Generate fitting, atmospheric names for fantasy characters and locations.'

  let userPrompt = ''
  switch (body.entityType) {
  case 'NPC':
    userPrompt =
        language === 'de'
          ? `Generiere einen passenden Fantasy-NPC-Namen${body.context ? ` für: ${body.context}` : ''}. Antworte NUR mit dem Namen, ohne Erklärung.`
          : `Generate a fitting fantasy NPC name${body.context ? ` for: ${body.context}` : ''}. Reply ONLY with the name, no explanation.`
    break
  case 'Location':
    userPrompt =
        language === 'de'
          ? `Generiere einen passenden Fantasy-Ortsnamen${body.context ? ` für: ${body.context}` : ''}. Antworte NUR mit dem Namen, ohne Erklärung.`
          : `Generate a fitting fantasy location name${body.context ? ` for: ${body.context}` : ''}. Reply ONLY with the name, no explanation.`
    break
  case 'Item':
    userPrompt =
        language === 'de'
          ? `Generiere einen passenden Fantasy-Item-Namen${body.context ? ` für: ${body.context}` : ''}. Antworte NUR mit dem Namen, ohne Erklärung.`
          : `Generate a fitting fantasy item name${body.context ? ` for: ${body.context}` : ''}. Reply ONLY with the name, no explanation.`
    break
  case 'Faction':
    userPrompt =
        language === 'de'
          ? `Generiere einen passenden Fantasy-Fraktionsnamen${body.context ? ` für: ${body.context}` : ''}. Antworte NUR mit dem Namen, ohne Erklärung.`
          : `Generate a fitting fantasy faction name${body.context ? ` for: ${body.context}` : ''}. Reply ONLY with the name, no explanation.`
    break
  }

  // Call OpenAI API
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.9, // High creativity for varied names
        max_tokens: 50,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw createError({
        statusCode: response.status,
        message: error.error?.message || 'OpenAI API request failed',
      })
    }

    const data = await response.json()
    const generatedName = data.choices?.[0]?.message?.content?.trim()

    if (!generatedName) {
      throw createError({
        statusCode: 500,
        message: 'No name generated',
      })
    }

    return {
      name: generatedName,
    }
  } catch (error) {
    const err = error as { statusCode?: number; message?: string }
    console.error('[AI Generate Name] Error:', error)
    throw createError({
      statusCode: err.statusCode || 500,
      message: err.message || 'Failed to generate name',
    })
  }
})
