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

interface LoreData {
  name: string
  type?: string // legend, history, religion, etc.
  era?: string // ancient, current, etc.
  description?: string
}

interface GenerateImageRequest {
  prompt: string // User-provided description (can be empty if entityData provided)
  entityName?: string // Entity name for better prompts
  entityType?: 'NPC' | 'Location' | 'Item' | 'Faction' | 'Player' | 'Session' | 'Lore'
  style?: 'realistic' | 'fantasy-art' | 'sketch' | 'oil-painting'
  // Structured entity data for richer prompts
  entityData?: NpcData | LocationData | ItemData | FactionData | PlayerData | SessionData | LoreData
}

interface GenerateImageResponse {
  imageUrl: string // Local path to saved image
  revisedPrompt?: string // DALL-E's revised prompt
}

// Build a detailed description from structured entity data
function buildEntityDescription(
  entityType: string,
  entityData: NpcData | LocationData | ItemData | FactionData | PlayerData | SessionData | LoreData | undefined,
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
  } else if (entityType === 'Lore') {
    const data = entityData as LoreData
    if (data.type) parts.push(`Lore Type: ${data.type}`)
    if (data.era) parts.push(`Era: ${data.era}`)
    parts.push(`Name: ${data.name}`)
    if (data.description) parts.push(`Description: ${data.description}`)
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
  // IMPORTANT: Use "detailed fantasy illustration" instead of "photograph" to avoid 3D/CGI look
  const style = body.style || 'fantasy-art' // Changed default from 'realistic' to 'fantasy-art'
  const styleMap: Record<string, string> = {
    realistic:
      'detailed fantasy illustration with realistic rendering, professional digital painting, lifelike details and textures, cinematic lighting, like concept art for a fantasy film or AAA video game, NOT 3D render, NOT video game screenshot',
    'fantasy-art':
      'detailed fantasy illustration in the style of official D&D 5e artwork, like Baldur\'s Gate 3 character art or Critical Role character commissions, rich colors, dramatic painterly lighting, professional fantasy art',
    sketch:
      'hand-drawn pencil sketch on textured paper, visible crosshatching and shading, traditional artist drawing style, NOT digital',
    'oil-painting':
      'classical oil painting style, Renaissance masters technique, visible brushstrokes, dramatic chiaroscuro lighting, museum quality fine art, like a Pre-Raphaelite fantasy painting',
  }

  // Step 1: Use GPT-4 to optimize the prompt for DALL-E
  // Choose system prompt based on entity type
  let systemPrompt: string

  if (entityType === 'NPC') {
    systemPrompt = `You are a DALL-E 3 prompt expert specializing in D&D and Pathfinder character portraits.

YOUR GOAL: Generate prompts that produce CINEMATIC FANTASY PORTRAITS - like concept art for a big-budget fantasy film, or professional D&D character commissions. Think: the art style of official D&D 5e books, Critical Role character art, or Baldur's Gate 3 promotional images.

=== D&D/PATHFINDER RACE GUIDE (CRITICAL - USE THIS!) ===
When you see these races, describe them EXACTLY as specified:

BIRDFOLK:
- Owlin: Humanoid with owl features - large round owl eyes, feathered face and body, owl-like beak, wings that can serve as arms, taloned feet. NOT just an owl! A humanoid owl-person.
- Aarakocra: Tall bird-humanoid with eagle/parrot features, large feathered wings, bird head with beak, taloned hands and feet
- Kenku: Raven-like humanoid, black feathers covering body, crow/raven head with beak, no wings (flightless)

CATFOLK:
- Tabaxi: Sleek feline humanoid, cat face with whiskers, fur-covered body, cat ears, tail, retractable claws
- Leonin: Lion-like humanoid, proud lion face with mane (males), muscular feline body

REPTILIAN:
- Dragonborn: Tall dragon-humanoid, scaled skin, dragon head with snout, no wings (usually), comes in chromatic/metallic colors
- Kobold: Small reptilian humanoid, scaled skin, dog-like snout, small horns
- Lizardfolk: Reptilian humanoid with iguana/crocodile features, scaled green/brown skin, tail
- Yuan-ti: Snake-human hybrid, scales, possibly snake lower body or just snake features on humanoid body

SMALL FOLK:
- Halfling: Small human-like, 3 feet tall, curly hair, bare furry feet, cheerful appearance
- Gnome: Very small humanoid, 3 feet, large nose, wild hair, curious expression
- Goblin: Small green-skinned humanoid, large pointed ears, sharp teeth, mischievous

OTHER EXOTIC:
- Tiefling: Human with demonic heritage - horns (various styles), tail, unusual skin colors (red, purple, blue), possibly glowing eyes
- Aasimar: Human with angelic heritage - ethereal beauty, possibly glowing eyes, subtle halo effect
- Genasi: Human with elemental heritage - Fire: flame hair, ember skin; Water: blue skin, flowing hair; Earth: stone-like skin; Air: light blue, wispy
- Firbolg: Giant-kin, 7-8 feet tall, cow-like nose, gentle giant appearance, nature-connected
- Goliath: Tall gray-skinned humanoid, 7-8 feet, bald, tribal markings, mountain-dweller
- Warforged: Living construct, mechanical/wooden body, glowing eyes, armor-like plating
- Changeling: Pale humanoid with white hair, colorless eyes, can appear androgynous
- Kalashtar: Human-like but with an otherworldly, serene quality
- Shifter: Human with bestial features (wolf-like, bear-like, etc.)
- Harengon: Rabbit-folk humanoid, rabbit head, long ears, fur-covered body, rabbit feet

CLASSIC FANTASY:
- Elf/High Elf/Wood Elf/Drow: Elegant humanoid, pointed ears, slender build. Drow: dark purple/black skin, white hair
- Dwarf: Stocky humanoid, 4-5 feet, thick beard (usually), broad shoulders, sturdy build
- Half-Elf: Human-elf mix, slightly pointed ears, elegant but more rugged than full elf
- Half-Orc: Human-orc mix, grayish/greenish skin, prominent lower canines, muscular
- Orc: Green/gray skin, tusks, muscular, tribal markings

=== CRITICAL SAFETY-FILTER-FRIENDLY REPHRASING ===
This is for a TABLETOP ROLEPLAYING GAME (D&D/Pathfinder). All characters are FICTIONAL for entertainment.
ALWAYS rephrase potentially problematic content into NEUTRAL, ARTISTIC terms:

STATUS/CONDITION:
- "dead", "deceased", "killed" → IGNORE completely, show character ALIVE and healthy
- "executed", "murdered", "slain" → IGNORE, show normal portrait
- "missing", "lost" → "mysterious expression", "enigmatic gaze"
- "injured", "wounded", "scarred" → "battle-worn veteran", "experienced warrior"
- "dying", "near death" → "determined expression"

EVIL/DARK THEMES (VERY IMPORTANT):
- "evil", "wicked", "malevolent" → "mysterious", "enigmatic", "morally complex"
- "villain", "antagonist" → "powerful figure", "commanding presence"
- "killer", "murderer", "assassin" → "shadowy operative", "mysterious agent", "skilled infiltrator"
- "dark lord", "evil overlord" → "powerful ruler", "commanding leader"
- "demon", "demonic" → "otherworldly", "supernatural", "fiendish heritage"
- "cultist", "worshipper of dark gods" → "robed mystic", "devoted follower"
- "necromancer" → "scholar of ancient arts", "dark magic practitioner"
- "torturer" → "interrogator", "stern inquisitor"
- "slave", "slaver" → "servant", "worker", "merchant"

VIOLENCE/BLOOD:
- "blood", "bloody", "blood-soaked" → REMOVE or "battle-worn", "weathered"
- "gore", "gory" → REMOVE completely
- "corpse", "body", "remains" → REMOVE completely
- "weapon dripping" → "well-used weapon"
- "killing", "slaughter" → "combat", "battle"

APPEARANCE:
- "terrifying", "horrifying" → "imposing", "intimidating", "awe-inspiring"
- "gruesome", "hideous" → "unusual", "distinctive", "striking"
- "rotting", "decaying" → "ancient", "weathered"

ALWAYS focus on: character design, costume, expression, pose - NOT violence or darkness

=== STYLE RULES ===
Art style: ${styleMap[style]}

CRITICAL STYLE GUIDANCE:
- Describe as "fantasy character portrait", "D&D character art", "tabletop RPG illustration"
- Reference: "in the style of official D&D artwork", "like a character from Baldur's Gate 3"
- Lighting: dramatic, cinematic, painterly
- Composition: portrait or 3/4 view, focused on the character
- AVOID: "photograph", "real photo" (these make it look like cosplay)
- INCLUDE: "detailed fantasy illustration", "professional character art", "rich colors and textures"

=== CONTENT RULES ===
1. Race features MUST match the race guide above - be SPECIFIC about non-human features
2. Class-appropriate gear: wizard (robes, staff, spellbook), fighter (armor, weapons), rogue (leather, daggers), etc.
3. Keep under 120 words
4. Focus on: distinctive race features, class identity, personality through expression
5. FORBIDDEN WORDS (never include in output): "blood", "gore", "corpse", "dead body", "murder", "kill", "torture", "execution", "violence", "gruesome", "horrifying", "terrifying", "evil" (use alternatives above)

=== EXAMPLES ===
Input: "Race: Owlin, Class: Wizard"
Output: "Fantasy character portrait of an Owlin wizard, a humanoid owl-person with large round amber owl eyes, feathered face and body in brown and white plumage, small curved beak, wearing elegant purple robes with silver arcane symbols, holding an ancient tome, wise and mysterious expression, detailed fantasy illustration in the style of official D&D 5e artwork, dramatic magical lighting, rich colors, NOT a photograph"

Input: "Race: Tiefling, Class: Warlock, Gender: Female"
Output: "Fantasy character portrait of a female Tiefling warlock, crimson skin, elegant curved horns, glowing amber eyes, long black hair, wearing dark leather armor with eldritch symbols, mysterious smirk, swirling dark magic around her hands, detailed D&D character art style like Baldur's Gate 3, dramatic purple and orange lighting, professional fantasy illustration"

Input: "Race: Tabaxi, Class: Rogue"
Output: "Fantasy character portrait of a Tabaxi rogue, sleek feline humanoid with orange and black striped fur, cat face with bright green eyes and whiskers, pointed cat ears, wearing dark leather armor with many hidden pockets, twin daggers at belt, confident predatory grin, detailed fantasy illustration, warm torchlight, in the style of official D&D artwork"

Output ONLY the optimized prompt.`
  } else if (entityType === 'Location') {
    systemPrompt = `You are a DALL-E 3 prompt expert. Your prompts must produce REALISTIC photographs, NOT 3D renders or CGI.

CONTEXT: This is for a Dungeons & Dragons tabletop roleplaying game. All locations are FICTIONAL FANTASY settings for entertainment - medieval castles, enchanted forests, mysterious dungeons. Like movie set photography.

YOUR GOAL: Generate prompts that look like REAL PHOTOGRAPHS of actual locations - like movie set photography from Lord of the Rings or Game of Thrones, or National Geographic travel photos.

CRITICAL SAFETY-FILTER-FRIENDLY REPHRASING:
The user's input may contain dramatic location descriptions. ALWAYS rephrase into NEUTRAL, ARTISTIC terms:
- "torture chamber", "execution site" → "ancient stone chamber", "historical dungeon"
- "battlefield", "war zone" → "dramatic landscape", "historic plains"
- "blood-stained", "gore" → "weathered", "ancient", "mysterious stains"
- "prison", "cell" → "medieval tower room", "stone chamber"
- "slaughterhouse" → "rustic building", "old barn"
- "graveyard of corpses" → "ancient cemetery", "peaceful memorial grounds"
- Any violent/dark descriptions → focus on ATMOSPHERE and ARCHITECTURE, not horror

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
7. FORBIDDEN WORDS: "blood", "gore", "corpse", "body", "violence", "torture", "execution"

EXAMPLES:
Input: "The Blood Pit - an underground fighting arena where gladiators died"
Output: "Real photograph of an ancient underground arena with worn stone tiers, dramatic torchlight casting long shadows, sand floor with centuries of history, massive iron gates, atmospheric dust particles in light beams, shot on Arri Alexa, cinematic wide shot, NOT 3D rendered, NOT CGI, like a film location from Gladiator"

Input: "Location Type: Tavern, Name: The Prancing Pony"
Output: "Real photograph of a rustic medieval tavern interior, actual stone fireplace with crackling fire, heavy oak beams blackened by centuries of smoke, worn wooden tables and benches, pewter tankards and tallow candles, dust motes in shafts of window light, shot on Arri Alexa, cinematic wide shot, NOT 3D rendered, NOT CGI, like a film location from Lord of the Rings"

Output ONLY the optimized prompt.`
  } else if (entityType === 'Faction') {
    systemPrompt = `You are a DALL-E 3 prompt expert specializing in heraldic symbols, emblems, and faction logos.

CONTEXT: This is for a Dungeons & Dragons tabletop roleplaying game. All factions are FICTIONAL FANTASY organizations for entertainment - noble guilds, mysterious orders, legendary groups.

YOUR GOAL: Generate prompts that produce iconic faction symbols - crests, emblems, banners, or logos with strong visual identity. Like museum-quality heraldic art.

CRITICAL SAFETY-FILTER-FRIENDLY REPHRASING:
The user's input may contain dramatic faction descriptions. ALWAYS rephrase into NEUTRAL, ARTISTIC terms:
- "death cult", "murder guild" → "mysterious order", "secret society"
- "blood clan" → "ancient clan", "noble house"
- "assassin brotherhood" → "shadow guild", "silent order"
- "demon worshippers" → "mystical cult", "ancient order"
- "criminal organization" → "underground guild", "secretive network"
- Any violent/evil descriptions → focus on SYMBOLISM and HERALDIC DESIGN

CRITICAL RULES:
1. Describe the symbol/emblem design (central icon, surrounding elements, colors, symbolism)
2. Art style: ${styleMap[style]}
3. Include heraldic elements (shields, banners, scrolls) but keep focus on the symbol itself
4. Use ONLY positive descriptions - NEVER say "no text", "no frame", "no border" (this triggers DALL-E to add them!)
5. Keep under 100 words
6. Emphasize: clean heraldic design, symbolic representation, faction identity
7. FORBIDDEN WORDS: "inventory", "icon", "UI", "card", "interface", "label", "game asset", "profile picture", "blood", "death", "skull", "gore"
8. Think: medieval heraldry, guild emblem, fantasy faction crest

EXAMPLES:
Bad: "A death cult emblem with skulls and blood"
Good: "Mysterious heraldic emblem featuring a crescent moon over dark waters, deep purple and silver color scheme, ornate gothic border, elegant and enigmatic appearance, fantasy secret society crest, detailed metalwork"

Good: "Heraldic emblem featuring crossed golden swords behind a silver shield, dark blue and gold color scheme, laurel wreath border, majestic and noble appearance, fantasy guild crest, detailed metalwork"

Output ONLY the optimized prompt.`
  } else if (entityType === 'Player') {
    systemPrompt = `You are a DALL-E 3 prompt expert specializing in D&D and Pathfinder PLAYER CHARACTER portraits.

YOUR GOAL: Generate prompts that produce HEROIC FANTASY CHARACTER ART - like professional D&D character commissions, Critical Role fan art, or Baldur's Gate 3 character portraits. These are the HEROES of the story!

=== D&D/PATHFINDER RACE GUIDE (CRITICAL - USE THIS!) ===
When you see these races, describe them EXACTLY as specified:

BIRDFOLK:
- Owlin: Humanoid with owl features - large round owl eyes, feathered face and body, owl-like beak, wings. NOT just an owl! A humanoid owl-person.
- Aarakocra: Tall bird-humanoid with eagle/parrot features, large feathered wings, bird head with beak
- Kenku: Raven-like humanoid, black feathers, crow/raven head with beak, no wings

CATFOLK:
- Tabaxi: Sleek feline humanoid, cat face with whiskers, fur-covered body, cat ears, tail
- Leonin: Lion-like humanoid, proud lion face with mane (males), muscular feline body

REPTILIAN:
- Dragonborn: Tall dragon-humanoid, scaled skin, dragon head with snout, chromatic/metallic colors
- Kobold: Small reptilian humanoid, scaled skin, dog-like snout, small horns
- Lizardfolk: Reptilian humanoid with iguana/crocodile features, scaled skin, tail

OTHER EXOTIC:
- Tiefling: Human with demonic heritage - horns, tail, unusual skin colors (red, purple, blue)
- Aasimar: Human with angelic heritage - ethereal beauty, possibly glowing eyes, subtle halo
- Genasi: Elemental heritage - Fire: flame hair; Water: blue skin; Earth: stone-like; Air: wispy
- Firbolg: Giant-kin, 7-8 feet tall, cow-like nose, gentle giant
- Goliath: Tall gray-skinned, 7-8 feet, bald, tribal markings
- Warforged: Living construct, mechanical/wooden body, glowing eyes
- Harengon: Rabbit-folk humanoid, rabbit head, long ears, fur-covered

CLASSIC:
- Elf/Drow: Elegant, pointed ears, slender. Drow: dark purple/black skin, white hair
- Dwarf: Stocky, 4-5 feet, thick beard, broad shoulders
- Half-Orc: Grayish/greenish skin, prominent lower canines, muscular

=== SAFETY-FILTER RULES ===
- "assassin", "killer" → "shadowy rogue", "swift scout"
- "blood mage", "death knight" → "arcane warrior", "dark paladin"
- "demonic", "evil" → "mysterious", "enigmatic", "dark but noble"
- Dark backstory → focus on HEROIC PRESENT

=== STYLE RULES ===
Art style: ${styleMap[style]}

CRITICAL STYLE GUIDANCE:
- Describe as "heroic fantasy portrait", "D&D player character art", "epic character illustration"
- Reference: "in the style of official D&D artwork", "like a Baldur's Gate 3 character portrait"
- These are HEROES - show them looking powerful, confident, ready for adventure
- Lighting: dramatic, heroic, painterly
- AVOID: "photograph", "real photo", "cosplay"
- INCLUDE: "detailed fantasy illustration", "professional character commission", "vibrant colors"

=== CONTENT RULES ===
1. Race features MUST match the race guide - be SPECIFIC about non-human features
2. Class-appropriate gear showing their level/experience
3. HEROIC composition - dynamic pose, confident expression
4. Keep under 120 words
5. Show their CLASS ABILITIES: wizard with arcane energy, paladin with divine light, etc.

=== EXAMPLES ===
Input: "Race: Owlin, Class: Ranger, Level: 12"
Output: "Heroic fantasy portrait of an Owlin ranger, a humanoid owl-person with large golden owl eyes, brown and white feathered face and body, curved beak, wearing forest-green leather armor with leaf motifs, longbow across back, a hawk companion on shoulder, confident and alert expression, detailed D&D character illustration in the style of official 5e artwork, forest background with dappled sunlight, professional fantasy art"

Input: "Race: Tiefling, Class: Paladin, Level: 8"
Output: "Epic fantasy portrait of a Tiefling paladin, purple skin, elegant swept-back horns, glowing golden eyes, wearing gleaming silver plate armor with celestial engravings, radiant divine energy emanating from raised holy symbol, righteous and determined expression, detailed character art like Baldur's Gate 3, dramatic divine lighting, heroic pose"

Output ONLY the optimized prompt.`
  } else if (entityType === 'Session') {
    systemPrompt = `You are a DALL-E 3 prompt expert specializing in D&D session cover art.

YOUR GOAL: Generate prompts that produce EPIC FANTASY SCENE ILLUSTRATIONS - like concept art for fantasy films, book covers, or official D&D adventure module art. These are COVER IMAGES for D&D session recaps.

=== CREATURE & RACE GUIDE ===
If the session involves specific D&D creatures or races, describe them correctly:
- Owlin, Aarakocra, Kenku: Bird-humanoids (humanoid body with bird features, NOT just birds!)
- Tabaxi, Leonin: Cat-humanoids (humanoid body with feline features)
- Dragonborn: Dragon-humanoids (NOT dragons! Bipedal humanoids with dragon features)
- Tiefling: Humanoid with horns, tail, unusual skin colors
- Mind Flayer/Illithid: Humanoid with octopus-like head, tentacles where mouth would be
- Beholder: Floating spherical creature with one large central eye and many eye stalks
- Owlbear: Large beast - bear body with owl head
- Displacer Beast: Six-legged panther-like creature with tentacles

=== SAFETY-FILTER RULES ===
ALWAYS rephrase dramatic D&D descriptions into ARTISTIC, WONDER-FOCUSED terms:
- "battle", "war", "fight", "attack" → "epic confrontation", "dramatic standoff", "climactic moment"
- "giant creature attacking" → "majestic creature towering over heroes", "awe-inspiring beast"
- "death", "killed", "died" → COMPLETELY IGNORE, show the scene without death
- "demon", "devil", "undead" → "otherworldly being", "spectral figure", "ancient spirit"
- "blood", "gore" → "dramatic moment", "intense scene"
- Violence/death → focus on DRAMA, TENSION, AWE - like a movie poster

=== STYLE RULES ===
Art style: ${styleMap[style]}

CRITICAL STYLE GUIDANCE:
- Describe as "epic fantasy illustration", "D&D adventure cover art", "cinematic fantasy scene"
- Reference: "in the style of official D&D module covers", "like concept art for a fantasy film"
- Composition: WIDE 16:9 format, cinematic framing, rule of thirds
- AVOID: "photograph", "real photo", "3D render", "video game screenshot"
- INCLUDE: "detailed fantasy illustration", "painterly lighting", "rich atmospheric colors"
- Lighting: dramatic, painterly - golden hour, magical glows, torchlight, moonbeams

=== CONTENT RULES ===
1. Extract the KEY DRAMATIC MOMENT - transform into visual wonder
2. Wide establishing shots showing the epic scale
3. Keep under 120 words
4. Focus on: atmosphere, wonder, awe, majesty - the EMOTIONAL impact
5. FORBIDDEN WORDS: "inventory", "icon", "UI", "card", "interface", "attack", "violence", "blood", "gore", "death", "corpse"

=== EXAMPLES ===
Input: "A fox grows to 10 meters in an epic battle at night. Lightning strikes the heroes."
Output: "Epic fantasy illustration of a colossal spirit fox towering against a stormy night sky, mystical blue fur glowing with ethereal light, four silhouetted adventurers standing in awe on a hilltop below, dramatic lightning illuminating swirling clouds, magical energy crackling in the air, wide cinematic composition, detailed D&D adventure art style like official module covers, painterly atmospheric lighting, rich purples and blues"

Input: "War of the Gods. A massive battle."
Output: "Epic fantasy scene illustration of divine beings clashing in the heavens, colossal mythological figures silhouetted against a dramatic sunset sky, golden light streaming through parting clouds, tiny heroes witnessing the celestial event from a mountain peak, awe-inspiring scale and grandeur, detailed fantasy art in the style of classic D&D covers, painterly lighting, warm and cool color contrast"

Output ONLY the optimized prompt - make it SAFE for DALL-E while preserving the epic fantasy atmosphere.`
  } else if (entityType === 'Item') {
    systemPrompt = `You are a DALL-E 3 prompt expert specializing in D&D magical item illustrations.

YOUR GOAL: Generate prompts for BEAUTIFUL FANTASY ITEM ARTWORK - like official D&D item illustrations, video game concept art, or tabletop RPG card art. The item should look MAGICAL and UNIQUE.

=== CRITICAL: INTERPRET THE ITEM NAME VISUALLY ===
The item's NAME often contains visual hints. ALWAYS translate the name into physical features:
- "Heart" in name → heart-shaped, heart motif, or pulsing/glowing like a heartbeat
- "Flame/Fire/Burning" → flickering flames, ember glow, warm orange/red colors, heat shimmer
- "Ice/Frost/Winter" → crystalline ice formations, cold blue glow, frost patterns
- "Shadow/Dark/Night" → dark wisps, shadowy aura, deep purple/black colors
- "Storm/Thunder/Lightning" → crackling electricity, storm clouds within, electric blue
- "Blood/Crimson" → deep red coloring, ruby gems (NOT actual blood!)
- "Soul/Spirit" → ethereal glow, ghostly wisps, translucent elements
- "Dragon" → dragon scale patterns, dragon head motifs, dragon eye gems
- "Star/Celestial" → twinkling lights, cosmic patterns, silver and gold
- "Ancient/Elder" → weathered look, runic inscriptions, aged patina
- "Crown/King/Royal" → regal design, gold filigree, gemstone inlays

=== D&D ITEM CATEGORIES ===
WEAPONS: Show magical auras, glowing runes, unique materials (mithril, adamantine, dragon bone)
ARMOR: Intricate engravings, magical sigils, otherworldly materials
WANDS/STAVES: Magical cores visible, arcane crystals, swirling energy
RINGS: Magical gem with inner glow, intricate band design
AMULETS: Glowing pendant, magical chains, mystical symbols
POTIONS: Swirling liquids, magical bubbles, ethereal glow inside glass
CRYSTALS: Inner light, magical inclusions, geometric or organic shapes
ARTIFACTS: Ancient and powerful appearance, multiple magical elements

=== ANTI-TEXT RULES (CRITICAL!) ===
DALL-E loves adding text/letters. To prevent this:
- NEVER mention the item's name in the prompt
- NEVER use words like "labeled", "inscribed with words", "written", "titled"
- Instead of "runes with text" say "abstract arcane symbols" or "geometric magical patterns"
- Focus ONLY on visual elements: shape, color, material, glow, texture
- End prompt with: "clean artifact illustration, pure visual design"

=== STYLE RULES ===
Art style: ${styleMap[style]}

CRITICAL STYLE GUIDANCE:
- Describe as "fantasy item illustration", "D&D artifact art", "magical object concept art"
- Lighting: dramatic studio lighting, magical glow from within the object
- Background: simple dark gradient or neutral, all focus on the item
- AVOID: "photograph", "museum", "catalog" (too mundane for magic items)
- INCLUDE: "detailed fantasy illustration", "magical aura", "mystical glow"

=== CONTENT RULES ===
1. FIRST analyze the item name and translate into VISUAL features
2. Add appropriate magical effects (glow, aura, energy, particles)
3. Describe materials in fantasy terms (not just "metal" but "enchanted silver", "dragon-forged steel")
4. Keep under 100 words
5. End with "clean artifact illustration, pure visual design" to prevent text

=== SAFETY RULES ===
- "cursed", "evil" → "enchanted", "mysterious", "ancient"
- "blood" → "crimson", "ruby-colored"
- Focus on BEAUTY and CRAFTSMANSHIP

=== EXAMPLES ===
Input: "Das Herz der alten Flamme (Kristall)" / "Heart of the Ancient Flame (Crystal)"
Output: "Fantasy item illustration of a heart-shaped crystal radiating with inner fire, deep crimson core pulsing with warm orange glow, ancient flame flickering within the translucent gem, delicate gold filigree mounting, ember-like particles floating around it, dramatic magical lighting against dark gradient background, detailed D&D artifact art style, mystical and powerful appearance, clean artifact illustration, pure visual design"

Input: "Frostbane Dagger"
Output: "Fantasy item illustration of an elegant dagger with blade of eternal ice, crystalline blue steel radiating cold mist, snowflake patterns etched into the frozen metal, hilt wrapped in white leather with silver wolf-head pommel, faint blue magical aura, frost particles in the air around it, dark gradient background, detailed fantasy weapon art, clean artifact illustration, pure visual design"

Input: "Ring of the Storm King"
Output: "Fantasy item illustration of a royal signet ring with storming thundercloud captured within a large sapphire, tiny lightning bolts crackling inside the gem, band of dark silver with cloud engravings, electric blue glow emanating from within, dramatic lighting against dark background, detailed D&D magical item art style, clean artifact illustration, pure visual design"

Output ONLY the optimized prompt.`
  } else if (entityType === 'Lore') {
    systemPrompt = `You are a DALL-E 3 prompt expert. Your prompts must produce REALISTIC photographs or classical artwork, NOT 3D renders or CGI.

CONTEXT: This is for a Dungeons & Dragons tabletop roleplaying game. All lore entries are FICTIONAL FANTASY for entertainment - ancient legends, mythological tales, historical events. Think illustrated manuscripts, museum paintings, ancient tapestries.

YOUR GOAL: Generate prompts that look like REAL PHOTOGRAPHS of historical artwork, museum pieces, or illustrated manuscripts depicting legendary scenes.

CRITICAL SAFETY-FILTER-FRIENDLY REPHRASING:
The user's input may contain dramatic D&D lore content. ALWAYS rephrase problematic content into ARTISTIC, HISTORICAL terms:
- "war", "battle", "conflict" → "epic historical moment", "legendary confrontation", "dramatic standoff"
- "death", "killed", "slain" → COMPLETELY IGNORE death references, focus on the living legend
- "destruction", "devastation" → "dramatic transformation", "legendary upheaval"
- "dark ritual", "sacrifice" → "mysterious ceremony", "ancient tradition", "mystical gathering"
- "demon", "devil" → "otherworldly being", "mythological entity", "legendary creature"
- "curse", "cursed" → "enchanted", "bound by ancient magic", "touched by legend"
- Any violence or death → focus on the LEGEND, the MAJESTY, the HISTORICAL SIGNIFICANCE

CRITICAL ANTI-3D RULES (ALWAYS INCLUDE):
- ALWAYS add: "classical artwork style, NOT 3D rendered, NOT CGI, NOT digital art"
- For legends: "like an illuminated manuscript", "like a Renaissance painting", "like a museum oil painting"
- For historical events: "like a historical tapestry", "like an epic mural", "classical artistic depiction"

CONTENT RULES:
1. Art style: ${styleMap[style]}
2. Transform lore into VISUAL SCENES - show the legend being depicted in art
3. Reference classical art styles: illuminated manuscripts, Renaissance paintings, Pre-Raphaelite art
4. Focus on WONDER, MAJESTY, HISTORICAL SIGNIFICANCE - not conflict
5. Keep under 100 words
6. FORBIDDEN WORDS: "violence", "blood", "gore", "death", "corpse", "attack", "weapon striking", "killing"

EXAMPLES:
Input: "The Great Dragon War - a devastating conflict that destroyed three kingdoms"
Output: "Classical oil painting depicting a majestic dragon soaring over medieval kingdoms, tiny figures looking up in awe, dramatic sunset sky, painted in Renaissance style like a museum masterpiece, golden frame-worthy composition, NOT 3D, NOT CGI, like a Pre-Raphaelite fantasy painting"

Input: "The Dark Ritual of the Blood Cult - where they sacrificed innocents"
Output: "Mysterious illuminated manuscript illustration showing robed figures gathered in candlelit ancient temple, mystical symbols glowing softly, ethereal atmosphere, painted in medieval manuscript style with gold leaf details, NOT 3D, NOT CGI"

Output ONLY the optimized prompt - make it SAFE for DALL-E while preserving the legendary atmosphere.`
  } else {
    // Fallback for any other entity type
    systemPrompt = `You are a DALL-E 3 prompt expert specializing in fantasy art.

CONTEXT: This is for a Dungeons & Dragons tabletop roleplaying game. All content is FICTIONAL FANTASY for entertainment.

YOUR GOAL: Generate prompts that produce high-quality fantasy illustrations.

CRITICAL SAFETY-FILTER-FRIENDLY REPHRASING:
ALWAYS rephrase problematic content into safe, artistic terms:
- Any violence or death → focus on drama, majesty, legend
- Dark themes → mysterious, enchanted, legendary
- Conflict → dramatic moment, standoff, confrontation

CRITICAL RULES:
1. Art style: ${styleMap[style]}
2. Use ONLY positive descriptions - NEVER say "no text", "no frame", "no border"
3. Keep under 100 words
4. FORBIDDEN WORDS: "inventory", "icon", "UI", "card", "interface", "banner", "label", "frame", "border", "game asset", "violence", "blood", "gore", "death"

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
