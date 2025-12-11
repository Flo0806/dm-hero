import { getDb } from '../../utils/db'
import { decrypt } from '../../utils/encryption'
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { getUploadPath } from '../../utils/paths'
import { randomUUID } from 'node:crypto'

// Entity-specific data interfaces for richer prompts
interface NpcData {
  name: string
  race?: string
  class?: string
  age?: number
  gender?: string
  type?: string // friendly, neutral, enemy
  status?: string // alive, dead, missing
  alignment?: string
  description?: string
}

interface LocationData {
  name: string
  type?: string // tavern, forest, dungeon, etc.
  description?: string
}

interface ItemData {
  name: string
  type?: string // weapon, armor, potion, etc.
  rarity?: string // common, uncommon, rare, etc.
  material?: string
  description?: string
}

interface FactionData {
  name: string
  type?: string // guild, religious order, criminal organization, etc.
  goals?: string
  description?: string
}

interface PlayerData {
  name: string
  characterName?: string
  race?: string
  class?: string
  level?: number
  description?: string
}

interface SessionData {
  title: string
  sessionNumber?: number
  summary?: string
  notes?: string // First part of session notes for context
}

interface GenerateImageRequest {
  prompt: string // User-provided description (can be empty if entityData provided)
  entityName?: string // Entity name for better prompts
  entityType?: 'NPC' | 'Location' | 'Item' | 'Faction' | 'Player' | 'Session'
  style?: 'realistic' | 'fantasy-art' | 'sketch' | 'oil-painting'
  // Structured entity data for richer prompts
  entityData?: NpcData | LocationData | ItemData | FactionData | PlayerData | SessionData
}

interface GenerateImageResponse {
  imageUrl: string // Local path to saved image
  revisedPrompt?: string // DALL-E's revised prompt
}

// Build a detailed description from structured entity data
function buildEntityDescription(
  entityType: string,
  entityData: NpcData | LocationData | ItemData | FactionData | PlayerData | SessionData | undefined,
  fallbackPrompt: string,
): string {
  if (!entityData) return fallbackPrompt

  const parts: string[] = []

  if (entityType === 'NPC') {
    const data = entityData as NpcData
    if (data.race) parts.push(`Race: ${data.race}`)
    if (data.class) parts.push(`Class: ${data.class}`)
    if (data.gender) parts.push(`Gender: ${data.gender}`)
    if (data.age) parts.push(`Age: ${data.age}`)
    if (data.alignment) parts.push(`Alignment: ${data.alignment}`)
    if (data.type) parts.push(`NPC Type: ${data.type}`)
    if (data.status) parts.push(`Status: ${data.status}`)
    parts.push(`Name: ${data.name}`)
    if (data.description) parts.push(`Description: ${data.description}`)
  } else if (entityType === 'Location') {
    const data = entityData as LocationData
    if (data.type) parts.push(`Location Type: ${data.type}`)
    parts.push(`Name: ${data.name}`)
    if (data.description) parts.push(`Description: ${data.description}`)
  } else if (entityType === 'Item') {
    const data = entityData as ItemData
    if (data.type) parts.push(`Item Type: ${data.type}`)
    if (data.rarity) parts.push(`Rarity: ${data.rarity}`)
    if (data.material) parts.push(`Material: ${data.material}`)
    parts.push(`Name: ${data.name}`)
    if (data.description) parts.push(`Description: ${data.description}`)
  } else if (entityType === 'Faction') {
    const data = entityData as FactionData
    if (data.type) parts.push(`Faction Type: ${data.type}`)
    parts.push(`Name: ${data.name}`)
    if (data.goals) parts.push(`Goals: ${data.goals}`)
    if (data.description) parts.push(`Description: ${data.description}`)
  } else if (entityType === 'Player') {
    const data = entityData as PlayerData
    if (data.characterName) parts.push(`Character Name: ${data.characterName}`)
    if (data.race) parts.push(`Race: ${data.race}`)
    if (data.class) parts.push(`Class: ${data.class}`)
    if (data.level) parts.push(`Level: ${data.level}`)
    parts.push(`Player Name: ${data.name}`)
    if (data.description) parts.push(`Description: ${data.description}`)
  } else if (entityType === 'Session') {
    const data = entityData as SessionData
    if (data.sessionNumber) parts.push(`Session Number: ${data.sessionNumber}`)
    parts.push(`Session Title: ${data.title}`)
    if (data.summary) parts.push(`Summary: ${data.summary}`)
    if (data.notes) parts.push(`Scene Notes: ${data.notes}`)
  }

  // Combine structured data with any additional user prompt
  const structuredPart = parts.join('\n')
  if (fallbackPrompt && fallbackPrompt.trim()) {
    return `${structuredPart}\n\nAdditional details: ${fallbackPrompt}`
  }
  return structuredPart
}

export default defineEventHandler(async (event): Promise<GenerateImageResponse> => {
  const body = await readBody<GenerateImageRequest>(event)

  // Validate input - allow empty prompt if entityData is provided
  const hasEntityData = body?.entityData && Object.keys(body.entityData).length > 0
  if (!body || (!body.prompt?.trim() && !hasEntityData)) {
    throw createError({
      statusCode: 400,
      message: 'Prompt or entity data is required',
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

  const entityType = body.entityType || 'Item'

  // Build rich description from structured entity data + user prompt
  const objectDescription = buildEntityDescription(
    entityType,
    body.entityData,
    body.prompt?.trim() || '',
  )

  // Style definitions for GPT-4 to use
  // IMPORTANT: Explicitly avoid 3D/CGI look which DALL-E 3 tends to produce
  const style = body.style || 'realistic'
  const styleMap: Record<string, string> = {
    realistic:
      'real photograph, NOT 3D rendered, NOT CGI, NOT computer generated, NOT video game graphics. Shot on professional camera, natural film grain, real human features, cinematic movie still quality, like a photo from a high-budget fantasy film set',
    'fantasy-art':
      'traditional oil painting on canvas, visible brushstrokes, NOT digital art, NOT 3D, classic fantasy art style like Alan Lee or John Howe, painterly texture',
    sketch: 'hand-drawn pencil sketch on paper, visible paper texture, crosshatching, NOT digital, traditional artist drawing',
    'oil-painting':
      'classical oil painting, Renaissance masters technique, visible brushstrokes on canvas, NOT digital, dramatic chiaroscuro lighting, museum quality fine art',
  }

  // Step 1: Use GPT-4 to optimize the prompt for DALL-E
  // Choose system prompt based on entity type
  let systemPrompt: string

  if (entityType === 'NPC') {
    systemPrompt = `You are a DALL-E 3 prompt expert. Your prompts must produce REALISTIC photographs, NOT 3D renders or CGI.

YOUR GOAL: Generate prompts that look like REAL PHOTOGRAPHS of actors in costume on a fantasy film set - like stills from Lord of the Rings or Game of Thrones movies.

CRITICAL SAFETY-FILTER-FRIENDLY REPHRASING:
The user's input may contain NPC status information. ALWAYS rephrase problematic status values into NEUTRAL, ARTISTIC terms:
- "dead", "deceased", "tot", "verstorben" → COMPLETELY IGNORE this status, generate a portrait as if the character is alive
- "executed", "hingerichtet", "murdered", "ermordet" → COMPLETELY IGNORE this status, generate a normal portrait
- "missing", "vermisst" → can mention "mysterious", "enigmatic expression"
- "injured", "wounded", "verletzt" → can show "battle-worn", "scarred veteran"
- ANY death-related status → Generate the portrait WITHOUT mentioning death at all. Show the character as they were in life.

CRITICAL ANTI-3D RULES (ALWAYS INCLUDE):
- ALWAYS add: "real photograph, NOT 3D rendered, NOT CGI, NOT video game"
- ALWAYS add: "shot on Arri Alexa camera, natural film grain, real human skin texture"
- Describe REAL physical features, not idealized CGI faces

SETTING: Medieval fantasy by default. Adapt to sci-fi/other if description indicates.

CONTENT RULES:
1. Art style: ${styleMap[style]}
2. Race-appropriate features (elves: pointed ears, elegant; dwarves: stocky, bearded)
3. Class-appropriate medieval gear (wizard: robes, staff; fighter: real metal armor)
4. Real costume materials: actual leather, real chainmail, wool cloaks
5. Cinematic lighting: practical lights, golden hour, candlelight
6. Keep under 100 words
7. Focus on: real human expression, authentic costume, film set atmosphere
8. NEVER mention death, corpses, or deceased state in the output prompt

EXAMPLE:
Input: "Race: Elf, Class: Wizard, Name: Elara"
Output: "Real photograph of an elegant elven woman with long silver hair and pointed ears, wearing hand-sewn midnight-blue velvet robes with silver embroidery, holding a gnarled wooden staff, standing in a candlelit medieval library, wise expression, shot on Arri Alexa, natural film grain, cinematic lighting like Lord of the Rings, NOT 3D rendered, NOT CGI"

Input: "Race: Human, Class: Fighter, Status: dead, Name: Sir Aldric"
Output: "Real photograph of a noble human knight with weathered face and grey-streaked beard, wearing polished plate armor with heraldic crest, standing proudly in a castle courtyard, dignified expression, shot on Arri Alexa, natural film grain, cinematic lighting, NOT 3D rendered, NOT CGI"

Output ONLY the optimized prompt.`
  } else if (entityType === 'Location') {
    systemPrompt = `You are a DALL-E 3 prompt expert. Your prompts must produce REALISTIC photographs, NOT 3D renders or CGI.

YOUR GOAL: Generate prompts that look like REAL PHOTOGRAPHS of actual locations - like movie set photography from Lord of the Rings or Game of Thrones, or National Geographic travel photos.

CRITICAL ANTI-3D RULES (ALWAYS INCLUDE):
- ALWAYS add: "real photograph, NOT 3D rendered, NOT CGI, NOT digital art"
- ALWAYS add: "shot on professional camera, natural lighting, real materials and textures"
- Describe REAL physical materials: actual stone, real wood, authentic weathering

DEFAULT SETTING: Medieval fantasy. Adapt to sci-fi/other if description indicates.

CONTENT RULES:
1. Art style: ${styleMap[style]}
2. Real architecture and materials (actual stone walls, real wooden beams, authentic wear)
3. Cinematic composition: establishing shots, dramatic angles, depth of field
4. Natural lighting: golden hour sun, real fire light, moonlight through windows
5. Keep under 100 words
6. Focus on: authentic textures, real weathering, lived-in atmosphere

EXAMPLE:
Input: "Location Type: Tavern, Name: The Prancing Pony"
Output: "Real photograph of a rustic medieval tavern interior, actual stone fireplace with crackling fire, heavy oak beams blackened by centuries of smoke, worn wooden tables and benches, pewter tankards and tallow candles, dust motes in shafts of window light, shot on Arri Alexa, cinematic wide shot, NOT 3D rendered, NOT CGI, like a film location from Lord of the Rings"

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
  } else if (entityType === 'Player') {
    systemPrompt = `You are a DALL-E 3 prompt expert specializing in fantasy player character portraits.

YOUR GOAL: Generate prompts that produce heroic player character portraits - detailed, dynamic poses showing the character's class and abilities.

CRITICAL RULES:
1. Describe the character based on their race, class, and level - show their experience and power
2. Art style: ${styleMap[style]}
3. Include equipment and abilities typical for their class (weapons, armor, magical effects)
4. Use ONLY positive descriptions - NEVER say "no text", "no frame", "no border" (this triggers DALL-E to add them!)
5. Keep under 100 words
6. Emphasize: heroic pose, class identity visible, character personality, atmospheric lighting
7. FORBIDDEN WORDS: "inventory", "icon", "UI", "card", "interface", "banner", "label", "frame", "border", "game asset", "profile picture"
8. Think: D&D player character commission, fantasy hero portrait

EXAMPLE:
Bad: "A player character icon with no frame"
Good: "A confident half-orc barbarian with tribal tattoos and a massive greataxe, muscular build, weathered leather armor, fierce but noble expression, standing in dramatic battle pose, warm campfire lighting, waist-up portrait"

Output ONLY the optimized prompt.`
  } else if (entityType === 'Session') {
    systemPrompt = `You are a DALL-E 3 prompt expert. Your prompts must produce REALISTIC photographs, NOT 3D renders or CGI.

CONTEXT: This is for a Dungeons & Dragons tabletop roleplaying game session recap. All content is FICTIONAL FANTASY for entertainment - epic battles, mythical creatures, magic spells are collaborative storytelling like in movies/books. Think Lord of the Rings, Game of Thrones - epic fantasy cinema.

YOUR GOAL: Generate prompts that look like REAL PHOTOGRAPHS from a fantasy film set - movie stills from Lord of the Rings, Game of Thrones, or The Witcher series. These are COVER IMAGES for D&D session recaps.

CRITICAL SAFETY-FILTER-FRIENDLY REPHRASING:
The user's input may contain dramatic D&D descriptions. ALWAYS rephrase them into CINEMATIC, ARTISTIC terms that focus on VISUAL SPECTACLE rather than conflict:
- "battle", "war", "fight", "attack" → "epic confrontation", "dramatic standoff", "climactic moment"
- "giant creature attacking" → "majestic creature towering over heroes", "awe-inspiring beast"
- "lightning strikes heroes" → "dramatic storm with lightning in sky, heroes silhouetted"
- "10 meter fox", "giant animal" → "majestic mythical beast", "legendary creature from folklore"
- "gods at war" → "divine beings in dramatic celestial scene", "mythological tableau"
- Any violence → focus on DRAMA, TENSION, AWE - like a movie poster, not action scene

CRITICAL ANTI-3D RULES (ALWAYS INCLUDE):
- ALWAYS add: "real photograph, NOT 3D rendered, NOT CGI, NOT video game graphics"
- ALWAYS add: "shot on Arri Alexa, 35mm anamorphic lens, natural film grain, cinematic color grading"
- Describe REAL actors in costumes, real locations, practical lighting

IMAGE FORMAT: This will be a WIDE 16:9 cover image - compose for horizontal/landscape format with cinematic framing.

CONTENT RULES:
1. Art style: ${styleMap[style]}
2. Extract the KEY DRAMATIC MOMENT - transform into CINEMATIC WONDER, not conflict
3. Show the scene as if photographed on a real movie set with actors and practical effects
4. Cinematic composition: wide establishing shots, dramatic angles, rule of thirds
5. Real lighting: golden hour, torchlight, moonlight - all practical and natural
6. Keep under 100 words
7. Focus on: atmosphere, wonder, awe, majesty - the EMOTIONAL and VISUAL impact
8. FORBIDDEN WORDS: "inventory", "icon", "UI", "card", "interface", "banner", "label", "frame", "border", "game asset", "illustration", "painting", "digital art", "attack", "violence", "blood", "gore", "weapon striking"

EXAMPLES:
Input: "A fox grows to 10 meters in an epic battle at night. Lightning strikes the heroes."
Output: "Real photograph of a majestic giant fox spirit towering against a stormy night sky, silhouettes of four adventurers standing in awe below, dramatic lightning illuminating storm clouds in the distance, mystical fog swirling, cinematic wide shot, shot on Arri Alexa with anamorphic lens, natural film grain, like a movie still from a fantasy epic, NOT 3D rendered, NOT CGI"

Input: "War of the Gods. A massive battle."
Output: "Real photograph of an epic mythological tableau, divine figures silhouetted against a dramatic sunset sky, heroes witnessing the celestial event from a hilltop, golden light streaming through clouds, awe-inspiring scale, cinematic wide shot, shot on Arri Alexa, natural film grain, like a scene from Lord of the Rings, NOT 3D rendered, NOT CGI"

Output ONLY the optimized prompt - make it SAFE for DALL-E while preserving the epic fantasy atmosphere.`
  } else if (entityType === 'Item') {
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
  } else {
    // Fallback for any other entity type
    systemPrompt = `You are a DALL-E 3 prompt expert specializing in fantasy art.

YOUR GOAL: Generate prompts that produce high-quality fantasy illustrations.

CRITICAL RULES:
1. Art style: ${styleMap[style]}
2. Use ONLY positive descriptions - NEVER say "no text", "no frame", "no border"
3. Keep under 100 words
4. FORBIDDEN WORDS: "inventory", "icon", "UI", "card", "interface", "banner", "label", "frame", "border", "game asset"

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
  // Use 16:9 format (1792x1024) for Session cover images, square for everything else
  const imageSize = entityType === 'Session' ? '1792x1024' : '1024x1024'

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
        size: imageSize,
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
