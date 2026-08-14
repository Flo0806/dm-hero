import { chatCompletion } from '../../utils/ai'

interface GenerateNameRequest {
  entityType: 'NPC' | 'Location' | 'Item' | 'Faction'
  context?: string
  language?: 'de' | 'en' | 'zh-CN'
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
      : language === 'zh-CN'
        ? '你是一个富有创意的 D&D 命名生成器。请为奇幻角色和地点生成合适、有氛围感的名字。'
      : language === 'zh-CN'
        ? '你是一个富有创意的 D&D 命名生成器。请为奇幻角色和地点生成合适、有氛围感的名字。'
      : 'You are a creative D&D name generator. Generate fitting, atmospheric names for fantasy characters and locations.'

  const entityLabels: Record<string, { de: string, en: string, 'zh-CN': string }> = {
    NPC: { de: 'Fantasy-NPC-Namen', en: 'fantasy NPC name', 'zh-CN': '奇幻 NPC 名字' },
    Location: { de: 'Fantasy-Ortsnamen', en: 'fantasy location name', 'zh-CN': '奇幻地点名字' },
    Item: { de: 'Fantasy-Item-Namen', en: 'fantasy item name', 'zh-CN': '奇幻物品名字' },
    Faction: { de: 'Fantasy-Fraktionsnamen', en: 'fantasy faction name', 'zh-CN': '奇幻阵营名字' },
  }

  const label = entityLabels[body.entityType] ?? entityLabels.NPC
  const userPrompt = language === 'de'
    ? `Generiere einen passenden ${label?.de}${body.context ? ` für: ${body.context}` : ''}. Antworte NUR mit dem Namen, ohne Erklärung.`
    : language === 'zh-CN'
      ? `生成一个合适的${label?.['zh-CN']}${body.context ? `，背景：${body.context}` : ''}。只回答名字，不要解释。`
    : language === 'zh-CN'
      ? `生成一个合适的${label?.['zh-CN']}${body.context ? `，背景：${body.context}` : ''}。只回答名字，不要解释。`
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
