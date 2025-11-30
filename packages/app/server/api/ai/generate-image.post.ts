import { getDb } from '../../utils/db'
import { decrypt } from '../../utils/encryption'
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { getUploadPath } from '../../utils/paths'
import { randomUUID } from 'node:crypto'

interface GenerateImageRequest {
  prompt: string // User-provided description
  entityName?: string // Entity name for better prompts
  entityType?: 'NPC' | 'Location' | 'Item' | 'Faction'
  style?: 'realistic' | 'fantasy-art' | 'sketch' | 'oil-painting'
}

interface GenerateImageResponse {
  imageUrl: string // Local path to saved image
  revisedPrompt?: string // DALL-E's revised prompt
}

export default defineEventHandler(async (event): Promise<GenerateImageResponse> => {
  const body = await readBody<GenerateImageRequest>(event)

  // Validate input
  if (!body || !body.prompt || body.prompt.trim().length === 0) {
    throw createError({
      statusCode: 400,
      message: 'Prompt is required',
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

  // DALL-E 3 Strategy with GPT-4 Prompt Optimization
  // ChatGPT uses GPT-4 to rewrite prompts before sending to DALL-E
  // We'll do the same thing!

  const objectDescription = body.prompt.trim()

  // Style definitions for GPT-4 to use
  const style = body.style || 'fantasy-art'
  const styleMap: Record<string, string> = {
    realistic: 'photorealistic with studio lighting',
    'fantasy-art': 'fantasy digital illustration',
    sketch: 'pencil sketch',
    'oil-painting': 'oil painting',
  }

  // Step 1: Use GPT-4 to optimize the prompt for DALL-E
  // Choose system prompt based on entity type
  const entityType = body.entityType || 'Item'
  let systemPrompt: string

  if (entityType === 'NPC') {
    systemPrompt = `You are a DALL-E 3 prompt expert specializing in fantasy character portraits.

YOUR GOAL: Generate prompts that produce detailed character portraits - full body or waist-up shots with personality and atmosphere.

CRITICAL RULES:
1. Describe the character's appearance (race, age, clothing, equipment, facial features, posture)
2. Art style: ${styleMap[style]}
3. Include environment hints (tavern, forest clearing, castle hall) but keep background slightly blurred
4. Use ONLY positive descriptions - NEVER say "no text", "no frame", "no border" (this triggers DALL-E to add them!)
5. Keep under 100 words
6. Emphasize: character portrait, personality visible, atmospheric lighting
7. FORBIDDEN WORDS: "inventory", "icon", "UI", "card", "interface", "banner", "label", "frame", "border", "game asset", "profile picture"
8. Think: fantasy art character commission, D&D character portrait

EXAMPLE:
Bad: "An elf warrior character icon with no frame"
Good: "A wise elven ranger with long silver hair and weathered leather armor, holding a wooden longbow, standing in a misty forest clearing, determined expression, warm afternoon light filtering through trees, waist-up portrait"

Output ONLY the optimized prompt.`
  } else if (entityType === 'Location') {
    systemPrompt = `You are a DALL-E 3 prompt expert specializing in fantasy location and environment art.

YOUR GOAL: Generate prompts that produce immersive fantasy locations - landscapes, buildings, interiors with rich atmosphere.

CRITICAL RULES:
1. Describe the location's key features (architecture, terrain, natural elements, mood)
2. Art style: ${styleMap[style]}
3. Include atmospheric details (weather, lighting, time of day, ambient effects)
4. Use ONLY positive descriptions - NEVER say "no text", "no frame", "no border" (this triggers DALL-E to add them!)
5. Keep under 100 words
6. Emphasize: establishing shot, cinematic composition, depth and scale
7. FORBIDDEN WORDS: "inventory", "icon", "UI", "card", "interface", "banner", "label", "frame", "border", "game asset", "map marker"
8. Think: fantasy concept art, environment matte painting, D&D setting illustration

EXAMPLE:
Bad: "A tavern location icon with no frame"
Good: "Cozy medieval tavern interior, warm firelight casting dancing shadows on wooden beams, stone fireplace with crackling fire, round tables with adventurers, barrels and bottles on shelves, comfortable atmosphere, golden hour light streaming through small windows"

Output ONLY the optimized prompt.`
  } else if (entityType === 'Faction') {
    systemPrompt = `You are a DALL-E 3 prompt expert specializing in heraldic symbols, emblems, and faction logos.

YOUR GOAL: Generate prompts that produce iconic faction symbols - crests, emblems, banners, or logos with strong visual identity.

CRITICAL RULES:
1. Describe the symbol/emblem design (central icon, surrounding elements, colors, symbolism)
2. Art style: ${styleMap[style]}
3. Include heraldic elements (shields, banners, scrolls) but keep focus on the symbol itself
4. Use ONLY positive descriptions - NEVER say "no text", "no frame", "no border" (this triggers DALL-E to add them!)
5. Keep under 100 words
6. Emphasize: clean heraldic design, symbolic representation, faction identity
7. FORBIDDEN WORDS: "inventory", "icon", "UI", "card", "interface", "label", "game asset", "profile picture"
8. Think: medieval heraldry, guild emblem, fantasy faction crest

EXAMPLE:
Bad: "A guild icon with no frame or text"
Good: "Heraldic emblem featuring crossed golden swords behind a silver shield, dark blue and gold color scheme, laurel wreath border, majestic and noble appearance, fantasy guild crest, detailed metalwork"

Output ONLY the optimized prompt.`
  } else {
    // For Items, etc. - keep the object-focused prompt
    systemPrompt = `You are a DALL-E 3 prompt expert specializing in clean, isolated object renders.

YOUR GOAL: Generate prompts that produce ONLY the object itself - no frames, no text, no UI elements, no decorations.

CRITICAL RULES:
1. Describe ONLY the physical object in detail (materials, shape, colors, craftsmanship)
2. Art style: ${styleMap[style]}
3. ALWAYS specify: "centered on plain neutral background"
4. Use ONLY positive descriptions - NEVER say "no text", "no frame", "no border" (this triggers DALL-E to add them!)
5. Keep under 80 words
6. Emphasize: product photography, museum display, or studio render aesthetic
7. FORBIDDEN WORDS: "inventory", "icon", "UI", "card", "interface", "banner", "label", "frame", "border", "game asset"
8. Think: clean catalog photo of a single object

EXAMPLE:
Bad: "A sword with no text or frame, game inventory icon style"
Good: "An ornate longsword with silver crossguard and leather-wrapped grip, centered on neutral grey background, studio lighting, detailed metalwork visible"

Output ONLY the optimized prompt.`
  }

  const gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini', // Cheaper and faster than gpt-4
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: objectDescription,
        },
      ],
      temperature: 0.7,
      max_tokens: 150,
    }),
  })

  let enhancedPrompt: string
  if (!gptResponse.ok) {
    console.error('[AI] GPT-4 optimization failed, using fallback prompt')
    // Fallback to simple prompt if GPT-4 fails
    enhancedPrompt = `${objectDescription}, ${styleMap[style]}, centered composition, simple background`
  } else {
    const gptData = await gptResponse.json()
    enhancedPrompt =
      gptData.choices?.[0]?.message?.content?.trim() ||
      `${objectDescription}, ${styleMap[style]}, centered composition, simple background`
  }

  // Call OpenAI DALL-E 3 API
  try {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: enhancedPrompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
        style: 'natural', // Use 'natural' to minimize creative rewriting
        response_format: 'url',
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw createError({
        statusCode: response.status,
        message: error.error?.message || 'OpenAI DALL-E API request failed',
      })
    }

    const data = await response.json()
    const imageUrl = data.data?.[0]?.url
    const revisedPrompt = data.data?.[0]?.revised_prompt

    // Log what DALL-E actually generated vs what we asked for
    if (!imageUrl) {
      throw createError({
        statusCode: 500,
        message: 'No image generated',
      })
    }

    // Download the image from OpenAI and save locally
    const imageResponse = await fetch(imageUrl)
    if (!imageResponse.ok) {
      throw createError({
        statusCode: 500,
        message: 'Failed to download generated image',
      })
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())

    // Save to uploads directory with UUID filename
    const filename = `${randomUUID()}.png`
    const uploadsDir = getUploadPath()
    const filePath = join(uploadsDir, filename)

    // Ensure uploads directory exists
    await mkdir(uploadsDir, { recursive: true })

    await writeFile(filePath, imageBuffer)

    // Return local URL
    return {
      imageUrl: `/uploads/${filename}`,
      revisedPrompt,
    }
  } catch (error: unknown) {
    console.error('[AI Generate Image] Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate image'
    throw createError({
      statusCode: 500,
      message: errorMessage,
    })
  }
})
