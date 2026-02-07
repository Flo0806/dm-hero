import { chatCompletion } from '../../utils/ai'

interface GenerateNameRequest {
  entityType: 'NPC' | 'Location' | 'Item' | 'Faction'
  context?: string
  language?: 'de' | 'en'
}

interface GenerateNameResponse {
  name: string
}

export default defineEventHandler(async (event): Promise<GenerateNameResponse> => {
  const body = await readBody<GenerateNameRequest>(event)

  if (!body || !body.entityType) {
    throw createError({ statusCode: 400, message: 'Entity type is required' })
  }

  const language = body.language || 'de'
  const systemPrompt
    = language === 'de'
      ? 'Du bist ein kreativer D&D Namens-Generator. Generiere passende, atmosphärische Namen für Fantasy-Charaktere und -Orte.'
      : 'You are a creative D&D name generator. Generate fitting, atmospheric names for fantasy characters and locations.'

  const entityLabels: Record<string, { de: string, en: string }> = {
    NPC: { de: 'Fantasy-NPC-Namen', en: 'fantasy NPC name' },
    Location: { de: 'Fantasy-Ortsnamen', en: 'fantasy location name' },
    Item: { de: 'Fantasy-Item-Namen', en: 'fantasy item name' },
    Faction: { de: 'Fantasy-Fraktionsnamen', en: 'fantasy faction name' },
  }

  const label = entityLabels[body.entityType] ?? entityLabels.NPC
  const userPrompt = language === 'de'
    ? `Generiere einen passenden ${label?.de}${body.context ? ` für: ${body.context}` : ''}. Antworte NUR mit dem Namen, ohne Erklärung.`
    : `Generate a fitting ${label?.en}${body.context ? ` for: ${body.context}` : ''}. Reply ONLY with the name, no explanation.`

  try {
    const name = await chatCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.9, max_tokens: 50 },
    )

    return { name }
  }
  catch (error) {
    const err = error as { statusCode?: number, message?: string }
    console.error('[AI Generate Name] Error:', error)
    throw createError({
      statusCode: err.statusCode || 500,
      message: err.message || 'Failed to generate name',
    })
  }
})
