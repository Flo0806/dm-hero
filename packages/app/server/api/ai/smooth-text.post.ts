import { chatCompletion } from '../../utils/ai'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { text, language = 'de' } = body

  if (!text || typeof text !== 'string') {
    throw createError({ statusCode: 400, message: 'Text is required' })
  }

  const systemPrompt
    = language === 'de'
      ? `Du bist ein Assistent der Stichpunkte und schlampige Notizen in flüssigen Text umwandelt.

REGELN:
1. Wandle Stichpunkte in vollständige Sätze um
2. Behalte ALLE Fakten und Details bei - füge NICHTS hinzu, interpretiere NICHTS
3. Entity-Links wie {{npc:123}} oder {{location:45}} UNVERÄNDERT lassen
4. Schreibe im Präteritum (Vergangenheit) für Session-Zusammenfassungen
5. Halte den Text kompakt - keine unnötigen Ausschmückungen
6. Behalte die Sprache der Eingabe bei (Deutsch)

BEISPIEL:
Eingabe: "- party kommt in taverne an\n- wirt heißt {{npc:45}}\n- gibt quest: finde sohn\n- 50 gold"
Ausgabe: "Die Gruppe kam in der Taverne an und traf auf den Wirt {{npc:45}}. Er bat sie, seinen Sohn zu finden, und bot 50 Gold als Belohnung an."`
      : language === 'zh-CN'
        ? `你是将要点和零散笔记改写成流畅文字的助手。

规则：
1. 将要点改写成完整句子
2. 保留所有事实和细节，不添加任何内容，不做推测
3. 保持 {{npc:123}} 或 {{location:45}} 等实体链接完全不变
4. 跑团记录摘要使用过去时
5. 保持文字简洁，不做不必要修饰
6. 保持输入内容的语言（中文）

示例：
输入："- 队伍抵达酒馆\n- 店主是 {{npc:45}}\n- 给出任务：寻找儿子\n- 50 金币"
输出："队伍抵达酒馆，见到了店主 {{npc:45}}。他请求他们寻找自己的儿子，并提出以 50 金币作为报酬。"`
      : `You are an assistant that transforms bullet points and rough notes into flowing text.

RULES:
1. Transform bullet points into complete sentences
2. Keep ALL facts and details - add NOTHING, interpret NOTHING
3. Keep entity links like {{npc:123}} or {{location:45}} UNCHANGED
4. Write in past tense for session summaries
5. Keep the text compact - no unnecessary embellishments
6. Keep the language of the input (English)

EXAMPLE:
Input: "- party arrives at tavern\n- innkeeper is {{npc:45}}\n- gives quest: find son\n- 50 gold"
Output: "The party arrived at the tavern and met the innkeeper {{npc:45}}. He asked them to find his son and offered 50 gold as a reward."`

  try {
    const smoothedText = await chatCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      { temperature: 0.3, max_tokens: 4000 },
    )

    return { text: smoothedText }
  }
  catch (error) {
    console.error('[AI Smooth Text] Error:', error)
    if ((error as { statusCode?: number }).statusCode) throw error
    throw createError({ statusCode: 500, message: 'Failed to smooth text' })
  }
})
