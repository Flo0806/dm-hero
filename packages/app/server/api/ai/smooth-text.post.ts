import { getDb } from '../../utils/db'
import { decrypt } from '../../utils/encryption'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { text, language = 'de' } = body

  if (!text || typeof text !== 'string') {
    throw createError({
      statusCode: 400,
      message: 'Text is required',
    })
  }

  // Get OpenAI API key
  const db = getDb()
  const setting = db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get('openai_api_key') as { value: string } | undefined

  if (!setting?.value) {
    throw createError({
      statusCode: 400,
      message: 'OpenAI API key not configured',
    })
  }

  const apiKey = decrypt(setting.value)

  // Build the system prompt based on language
  const systemPrompt =
    language === 'de'
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
          { role: 'user', content: text },
        ],
        temperature: 0.3, // Low temperature for consistent, factual output
        max_tokens: 4000,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('OpenAI API error:', errorData)
      throw createError({
        statusCode: response.status,
        message: (errorData as { error?: { message?: string } })?.error?.message || 'OpenAI API error',
      })
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>
    }
    const smoothedText = data.choices[0]?.message?.content?.trim() || text

    return {
      text: smoothedText,
    }
  } catch (error) {
    console.error('Text smoothing error:', error)
    if ((error as { statusCode?: number }).statusCode) {
      throw error
    }
    throw createError({
      statusCode: 500,
      message: 'Failed to smooth text',
    })
  }
})
