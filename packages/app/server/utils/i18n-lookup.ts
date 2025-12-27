/**
 * Reverse i18n lookup for race and class keys.
 * Converts localized names (German/English) back to database keys.
 *
 * Example:
 * - "Mensch" → "human"
 * - "Human" → "human"
 * - "Elf" → "elf"
 * - "Magier" → "wizard"
 * - "Wizard" → "wizard"
 */

// =============================================================================
// SINGLE SOURCE OF TRUTH: Standard Races & Classes
// All lookups and key sets are derived from these definitions.
// Add new races/classes HERE - everything else is auto-generated.
// =============================================================================

interface StandardRace {
  key: string
  de: string | string[] // German name(s) - can have aliases
  en: string | string[] // English name(s)
}

interface StandardClass {
  key: string
  de: string | string[]
  en: string | string[]
}

/**
 * Standard fantasy races from D&D 5e, D&D 2024, Pathfinder, DSA, and other TTRPGs.
 * Sorted alphabetically by key for easy maintenance.
 */
const STANDARD_RACES_DEFINITION: StandardRace[] = [
  // D&D 5e Core
  { key: 'human', de: 'Mensch', en: 'Human' },
  { key: 'elf', de: 'Elf', en: 'Elf' },
  { key: 'dwarf', de: 'Zwerg', en: 'Dwarf' },
  { key: 'halfling', de: 'Halbling', en: 'Halfling' },
  { key: 'gnome', de: 'Gnom', en: 'Gnome' },
  { key: 'halfelf', de: 'Halbelf', en: ['Half-Elf', 'Half Elf', 'Halfelf'] },
  { key: 'halforc', de: 'Halbork', en: ['Half-Orc', 'Half Orc', 'Halforc'] },
  { key: 'tiefling', de: 'Tiefling', en: 'Tiefling' },
  { key: 'dragonborn', de: 'Drachenblütiger', en: 'Dragonborn' },

  // D&D 5e Subraces
  { key: 'drow', de: ['Zwergelf (Drow)', 'Drow', 'Dunkelelf'], en: ['Drow', 'Dark Elf'] },
  { key: 'woodelf', de: 'Waldelf', en: ['Wood Elf', 'Woodelf'] },
  { key: 'highelf', de: 'Hochelf', en: ['High Elf', 'Highelf'] },
  { key: 'mountaindwarf', de: 'Bergzwerg', en: ['Mountain Dwarf', 'Mountaindwarf'] },
  { key: 'hilldwarf', de: 'Hügelzwerg', en: ['Hill Dwarf', 'Hilldwarf'] },
  { key: 'lightfoothalfling', de: 'Leichtfuß-Halbling', en: ['Lightfoot Halfling', 'Lightfoothalfling'] },
  { key: 'stouthalfling', de: 'Robuster Halbling', en: ['Stout Halfling', 'Stouthalfling'] },

  // D&D 5e Supplements & D&D 2024 Core
  { key: 'aasimar', de: 'Aasimar', en: 'Aasimar' },
  { key: 'goliath', de: 'Goliath', en: 'Goliath' },
  { key: 'orc', de: 'Ork', en: 'Orc' },
  { key: 'genasi', de: 'Genasi', en: 'Genasi' },
  { key: 'firegenasi', de: 'Feuergenasi', en: ['Fire Genasi', 'Firegenasi'] },
  { key: 'watergenasi', de: 'Wassergenasi', en: ['Water Genasi', 'Watergenasi'] },
  { key: 'earthgenasi', de: 'Erdgenasi', en: ['Earth Genasi', 'Earthgenasi'] },
  { key: 'airgenasi', de: 'Luftgenasi', en: ['Air Genasi', 'Airgenasi'] },
  { key: 'tabaxi', de: 'Tabaxi', en: 'Tabaxi' },
  { key: 'kenku', de: 'Kenku', en: 'Kenku' },
  { key: 'triton', de: 'Triton', en: 'Triton' },
  { key: 'firbolg', de: 'Firbolg', en: 'Firbolg' },
  { key: 'aarakocra', de: 'Aarakocra', en: 'Aarakocra' },
  { key: 'tortle', de: 'Tortle', en: 'Tortle' },
  { key: 'changeling', de: 'Wechselbalg', en: 'Changeling' },
  { key: 'warforged', de: 'Kriegsgeschmiedeter', en: 'Warforged' },
  { key: 'shifter', de: 'Gestaltwandler', en: 'Shifter' },
  { key: 'kalashtar', de: 'Kalashtar', en: 'Kalashtar' },

  // Monster Races
  { key: 'kobold', de: 'Kobold', en: 'Kobold' },
  { key: 'goblin', de: 'Goblin', en: 'Goblin' },
  { key: 'hobgoblin', de: 'Hobgoblin', en: 'Hobgoblin' },
  { key: 'bugbear', de: 'Bugbär', en: 'Bugbear' },
  { key: 'lizardfolk', de: 'Echsenmensch', en: 'Lizardfolk' },
  { key: 'yuanti', de: 'Yuan-Ti', en: ['Yuan-Ti', 'Yuan-Ti Pureblood'] },

  // Pathfinder
  { key: 'catfolk', de: 'Katzenvolk', en: 'Catfolk' },
  { key: 'ratfolk', de: 'Rattenvolk', en: 'Ratfolk' },
  { key: 'tengu', de: 'Tengu', en: 'Tengu' },
  { key: 'kitsune', de: 'Kitsune', en: 'Kitsune' },

  // Das Schwarze Auge (DSA)
  { key: 'thorwaler', de: 'Thorwaler', en: 'Thorwaler' },
  { key: 'achaz', de: 'Achaz', en: 'Achaz' },
  { key: 'ogre', de: 'Oger', en: 'Ogre' },
  { key: 'troll', de: 'Troll', en: 'Troll' },

  // Generic Fantasy
  { key: 'vampire', de: 'Vampir', en: 'Vampire' },
  { key: 'dhampir', de: 'Dhampir', en: 'Dhampir' },
  { key: 'werewolf', de: 'Werwolf', en: 'Werewolf' },
  { key: 'centaur', de: 'Zentaur', en: 'Centaur' },
  { key: 'minotaur', de: 'Minotaurus', en: 'Minotaur' },
  { key: 'satyr', de: 'Satyr', en: 'Satyr' },
  { key: 'fairy', de: 'Fee', en: 'Fairy' },
  { key: 'harengon', de: 'Harengon', en: 'Harengon' },
]

/**
 * Standard fantasy classes from D&D 5e, D&D 2024, Pathfinder, and other TTRPGs.
 * Sorted alphabetically by key for easy maintenance.
 */
const STANDARD_CLASSES_DEFINITION: StandardClass[] = [
  // D&D 5e Core
  { key: 'barbarian', de: 'Barbar', en: 'Barbarian' },
  { key: 'bard', de: 'Barde', en: 'Bard' },
  { key: 'cleric', de: 'Kleriker', en: 'Cleric' },
  { key: 'druid', de: 'Druide', en: 'Druid' },
  { key: 'fighter', de: 'Kämpfer', en: 'Fighter' },
  { key: 'monk', de: 'Mönch', en: 'Monk' },
  { key: 'paladin', de: 'Paladin', en: 'Paladin' },
  { key: 'ranger', de: 'Waldläufer', en: 'Ranger' },
  { key: 'rogue', de: 'Schurke', en: 'Rogue' },
  { key: 'sorcerer', de: 'Zauberer', en: 'Sorcerer' },
  { key: 'warlock', de: 'Hexenmeister', en: 'Warlock' },
  { key: 'wizard', de: 'Magier', en: 'Wizard' },

  // D&D 5e Supplements
  { key: 'artificer', de: 'Konstrukteur', en: 'Artificer' },
  { key: 'bloodhunter', de: 'Blutjäger', en: ['Blood Hunter', 'Bloodhunter'] },

  // Generic/Pathfinder
  { key: 'alchemist', de: 'Alchemist', en: 'Alchemist' },
  { key: 'necromancer', de: 'Nekromant', en: 'Necromancer' },
  { key: 'witch', de: 'Hexe', en: 'Witch' },
  { key: 'oracle', de: 'Orakel', en: 'Oracle' },
  { key: 'inquisitor', de: 'Inquisitor', en: 'Inquisitor' },
  { key: 'summoner', de: 'Beschwörer', en: 'Summoner' },
  { key: 'gunslinger', de: 'Revolverheld', en: 'Gunslinger' },
  { key: 'swashbuckler', de: 'Swashbuckler', en: 'Swashbuckler' },
  { key: 'magus', de: 'Magus', en: 'Magus' },

  // NPC/Monster Classes
  { key: 'knight', de: 'Ritter', en: 'Knight' },
  { key: 'assassin', de: 'Assassine', en: 'Assassin' },
  { key: 'priest', de: 'Priester', en: 'Priest' },
  { key: 'shaman', de: 'Schamane', en: 'Shaman' },
  { key: 'merchant', de: 'Händler', en: 'Merchant' },
  { key: 'noble', de: 'Adliger', en: 'Noble' },
  { key: 'commoner', de: 'Bürger', en: 'Commoner' },
  { key: 'soldier', de: 'Soldat', en: 'Soldier' },
  { key: 'guard', de: 'Wache', en: 'Guard' },
  { key: 'thief', de: 'Dieb', en: 'Thief' },
  { key: 'pirate', de: 'Pirat', en: 'Pirate' },
  { key: 'hunter', de: 'Jäger', en: 'Hunter' },
  { key: 'beastmaster', de: 'Tiermeister', en: 'Beastmaster' },
]

// =============================================================================
// DERIVED: Sets of standard keys (for checking if a key is custom)
// =============================================================================

/** Set of all standard race keys - any key NOT in this set is a custom race */
export const STANDARD_RACE_KEYS = new Set(STANDARD_RACES_DEFINITION.map((r) => r.key))

/** Set of all standard class keys - any key NOT in this set is a custom class */
export const STANDARD_CLASS_KEYS = new Set(STANDARD_CLASSES_DEFINITION.map((c) => c.key))

// =============================================================================
// DERIVED: Lookup tables (name → key, built once at module load)
// =============================================================================

function buildLookup(
  definitions: Array<{ key: string; de: string | string[]; en: string | string[] }>,
  locale: 'de' | 'en',
): Record<string, string> {
  const lookup: Record<string, string> = {}
  for (const def of definitions) {
    const names = locale === 'de' ? def.de : def.en
    const nameArray = Array.isArray(names) ? names : [names]
    for (const name of nameArray) {
      lookup[name.toLowerCase()] = def.key
    }
  }
  return lookup
}

const RACES_DE = buildLookup(STANDARD_RACES_DEFINITION, 'de')
const RACES_EN = buildLookup(STANDARD_RACES_DEFINITION, 'en')
const CLASSES_DE = buildLookup(STANDARD_CLASSES_DEFINITION, 'de')
const CLASSES_EN = buildLookup(STANDARD_CLASSES_DEFINITION, 'en')

// =============================================================================
// TYPES
// =============================================================================

export interface RaceClassLookup {
  races: Record<string, string>
  classes: Record<string, string>
}

export interface ItemLookup {
  types: Record<string, string>
  rarities: Record<string, string>
}

/**
 * Extract locale from H3 event (from cookie or Accept-Language header).
 * Defaults to 'de'.
 */
export function getLocaleFromEvent(event: {
  node: { req: { headers: { 'accept-language'?: string; cookie?: string } } }
}): 'de' | 'en' {
  // Priority 1: Accept-Language header (set by frontend with current locale)
  const acceptLanguage = event.node.req.headers['accept-language']
  if (acceptLanguage) {
    const locale = acceptLanguage.toLowerCase().split(',')[0]?.split('-')[0] // Extract language code
    if (locale === 'en') return 'en'
    if (locale === 'de') return 'de'
  }

  // Priority 2: Try to get from cookie (nuxt-i18n can use different cookie names)
  const cookieHeader = event.node.req.headers.cookie
  if (cookieHeader) {
    // Check for i18n_redirected cookie
    const redirectMatch = cookieHeader.match(/i18n_redirected=([^;]+)/)
    if (redirectMatch) {
      const locale = redirectMatch[1]
      if (locale === 'en') return 'en'
      if (locale === 'de') return 'de'
    }

    // Check for direct locale cookie
    const localeMatch = cookieHeader.match(/locale=([^;]+)/)
    if (localeMatch) {
      const locale = localeMatch[1]
      if (locale === 'en') return 'en'
      if (locale === 'de') return 'de'
    }
  }

  // Default to German
  return 'de'
}

/**
 * Create lookup tables for race and class names to keys.
 * Locale-specific to support language-aware fuzzy matching.
 * Uses pre-built lookups from STANDARD_RACES_DEFINITION and STANDARD_CLASSES_DEFINITION.
 */
export function createI18nLookup(locale: 'de' | 'en' = 'de'): RaceClassLookup {
  return {
    races: locale === 'en' ? RACES_EN : RACES_DE,
    classes: locale === 'en' ? CLASSES_EN : CLASSES_DE,
  }
}

/**
 * Convert race/class name (localized) to database key.
 * Case-insensitive lookup with fuzzy matching for typos.
 *
 * Checks:
 * 1. Standard races (i18n lookup) - e.g., "Mensch" → "human"
 * 2. Custom races (DB lookup) - e.g., "Drachling" → "drachling"
 *
 * @returns Array of possible keys/names to search for [key, localized_name]
 */
export async function getRaceKey(
  name: string | undefined | null,
  fuzzy = false,
  locale: 'de' | 'en' = 'de',
): Promise<string | null> {
  if (!name) return null
  const lookup = createI18nLookup(locale)
  const nameLower = name.toLowerCase()

  // Step 1: Check standard races in i18n (exact match)
  const exactMatch = lookup.races[nameLower]
  if (exactMatch) return exactMatch

  // Step 2: Check custom races in DB (name_de / name_en / name itself)
  try {
    // Dynamic import for ESM compatibility (Nuxt 4)
    const dbModule = await import('./db')
    const db = dbModule.getDb()

    const customRaceExact = db
      .prepare(
        `
      SELECT name FROM races
      WHERE (LOWER(name_de) = ? OR LOWER(name_en) = ? OR LOWER(name) = ?)
        AND deleted_at IS NULL
      LIMIT 1
    `,
      )
      .get(nameLower, nameLower, nameLower) as { name: string } | undefined

    console.log('[getRaceKey] Custom race lookup for:', nameLower, '→', customRaceExact)

    if (customRaceExact) return customRaceExact.name
  } catch (e) {
    console.error('[getRaceKey] DB error:', e)
    // DB not available or error - continue with i18n only
  }

  // Step 3: Fuzzy match for typos (optional, used in search)
  if (fuzzy) {
    // Fuzzy match in i18n
    for (const [localizedName, key] of Object.entries(lookup.races)) {
      if (simpleLevenshtein(nameLower, localizedName) <= 2) {
        return key
      }
    }

    // Fuzzy match in DB custom races
    try {
      const dbModule = await import('./db')
      const db = dbModule.getDb()

      const allCustomRaces = db
        .prepare(
          `
        SELECT name, name_de, name_en FROM races
        WHERE name_de IS NOT NULL AND name_en IS NOT NULL
          AND deleted_at IS NULL
      `,
        )
        .all() as Array<{ name: string; name_de: string; name_en: string }>

      for (const race of allCustomRaces) {
        const compareValue = locale === 'de' ? race.name_de : race.name_en
        if (simpleLevenshtein(nameLower, compareValue.toLowerCase()) <= 2) {
          return race.name
        }
      }
    } catch {
      // DB not available or error - continue
    }
  }

  return null
}

/**
 * Get ALL possible search variants for a race name (key + localized names).
 * Used for expanding FTS5 search queries.
 *
 * Example: "Drachling" → ["drachling", "drachling", "dragonkin"]
 * (key in metadata + localized names for matching)
 */
export async function getRaceSearchVariants(
  name: string | undefined | null,
  locale: 'de' | 'en' = 'de',
): Promise<string[]> {
  if (!name) return []

  const key = await getRaceKey(name, true, locale)

  // If we couldn't find a key by localized name, check if 'name' itself is already a key
  let actualKey: string
  if (!key) {
    try {
      const dbModule = await import('./db')
      const db = dbModule.getDb()

      const raceByKey = db
        .prepare(
          `
        SELECT name FROM races
        WHERE LOWER(name) = LOWER(?)
          AND deleted_at IS NULL
        LIMIT 1
      `,
        )
        .get(name) as { name: string } | undefined

      if (raceByKey) {
        actualKey = raceByKey.name
      } else {
        return [name.toLowerCase()]
      }
    } catch {
      return [name.toLowerCase()]
    }
  } else {
    actualKey = key
  }

  const variants: string[] = [actualKey] // Always include the key (for metadata JSON match)

  // Add localized names from DB
  try {
    const dbModule = await import('./db')
    const db = dbModule.getDb()

    const customRace = db
      .prepare(
        `
      SELECT name_de, name_en FROM races
      WHERE LOWER(name) = LOWER(?)
        AND deleted_at IS NULL
      LIMIT 1
    `,
      )
      .get(actualKey) as { name_de: string; name_en: string } | undefined

    if (customRace) {
      if (customRace.name_de) variants.push(customRace.name_de.toLowerCase())
      if (customRace.name_en) variants.push(customRace.name_en.toLowerCase())
    }
  } catch {
    // DB not available
  }

  // Deduplicate
  return [...new Set(variants)]
}

export async function getClassKey(
  name: string | undefined | null,
  fuzzy = false,
  locale: 'de' | 'en' = 'de',
): Promise<string | null> {
  if (!name) return null
  const lookup = createI18nLookup(locale)
  const nameLower = name.toLowerCase()

  // Step 1: Check standard classes in i18n (exact match)
  const exactMatch = lookup.classes[nameLower]
  if (exactMatch) return exactMatch

  // Step 2: Check custom classes in DB (name_de / name_en / name itself)
  try {
    const dbModule = await import('./db')
    const db = dbModule.getDb()

    const customClassExact = db
      .prepare(
        `
      SELECT name FROM classes
      WHERE (LOWER(name_de) = ? OR LOWER(name_en) = ? OR LOWER(name) = ?)
        AND deleted_at IS NULL
      LIMIT 1
    `,
      )
      .get(nameLower, nameLower, nameLower) as { name: string } | undefined

    if (customClassExact) return customClassExact.name
  } catch {
    // DB not available or error - continue with i18n only
  }

  // Step 3: Fuzzy match for typos (optional, used in search)
  if (fuzzy) {
    // Fuzzy match in i18n
    for (const [localizedName, key] of Object.entries(lookup.classes)) {
      if (simpleLevenshtein(nameLower, localizedName) <= 2) {
        return key
      }
    }

    // Fuzzy match in DB custom classes
    try {
      const dbModule = await import('./db')
      const db = dbModule.getDb()

      const allCustomClasses = db
        .prepare(
          `
        SELECT name, name_de, name_en FROM classes
        WHERE name_de IS NOT NULL AND name_en IS NOT NULL
          AND deleted_at IS NULL
      `,
        )
        .all() as Array<{ name: string; name_de: string; name_en: string }>

      for (const classData of allCustomClasses) {
        const compareValue = locale === 'de' ? classData.name_de : classData.name_en
        if (simpleLevenshtein(nameLower, compareValue.toLowerCase()) <= 2) {
          return classData.name
        }
      }
    } catch {
      // DB not available or error - continue
    }
  }

  return null
}

/**
 * Get ALL possible search variants for a class name (key + localized names).
 * Used for expanding FTS5 search queries.
 */
export async function getClassSearchVariants(
  name: string | undefined | null,
  locale: 'de' | 'en' = 'de',
): Promise<string[]> {
  if (!name) return []

  const key = await getClassKey(name, true, locale)

  // If we couldn't find a key by localized name, check if 'name' itself is already a key
  let actualKey: string
  if (!key) {
    try {
      const dbModule = await import('./db')
      const db = dbModule.getDb()

      const classByKey = db
        .prepare(
          `
        SELECT name FROM classes
        WHERE LOWER(name) = LOWER(?)
          AND deleted_at IS NULL
        LIMIT 1
      `,
        )
        .get(name) as { name: string } | undefined

      if (classByKey) {
        actualKey = classByKey.name
      } else {
        return [name.toLowerCase()]
      }
    } catch {
      return [name.toLowerCase()]
    }
  } else {
    actualKey = key
  }

  const variants: string[] = [actualKey] // Always include the key (for metadata JSON match)

  // Add localized names from DB
  try {
    const dbModule = await import('./db')
    const db = dbModule.getDb()

    const customClass = db
      .prepare(
        `
      SELECT name_de, name_en FROM classes
      WHERE LOWER(name) = LOWER(?)
        AND deleted_at IS NULL
      LIMIT 1
    `,
      )
      .get(actualKey) as { name_de: string; name_en: string } | undefined

    if (customClass) {
      if (customClass.name_de) variants.push(customClass.name_de.toLowerCase())
      if (customClass.name_en) variants.push(customClass.name_en.toLowerCase())
    }
  } catch {
    // DB not available
  }

  // Deduplicate
  return [...new Set(variants)]
}

/**
 * Simple Levenshtein distance implementation (for fuzzy i18n lookup).
 * Copied from levenshtein.ts to avoid circular dependency.
 */
function simpleLevenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const matrix: number[][] = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0]![j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i]![j] = matrix[i - 1]![j - 1]!
      } else {
        matrix[i]![j] = Math.min(
          matrix[i - 1]![j - 1]! + 1,
          matrix[i]![j - 1]! + 1,
          matrix[i - 1]![j]! + 1,
        )
      }
    }
  }

  return matrix[b.length]![a.length]!
}

/**
 * Create lookup tables for item types and rarities.
 * Locale-specific for multilingual search support.
 */
export function createItemLookup(locale: 'de' | 'en' = 'de'): ItemLookup {
  const typesDE: Record<string, string> = {
    waffe: 'weapon',
    rüstung: 'armor',
    trank: 'potion',
    schriftrolle: 'scroll',
    ring: 'ring',
    amulett: 'amulet',
    stab: 'staff',
    zauberstab: 'wand',
    'wundersamer gegenstand': 'wondrous_item',
    werkzeug: 'tool',
    ausrüstung: 'equipment',
  }

  const typesEN: Record<string, string> = {
    weapon: 'weapon',
    armor: 'armor',
    potion: 'potion',
    scroll: 'scroll',
    ring: 'ring',
    amulet: 'amulet',
    staff: 'staff',
    wand: 'wand',
    'wondrous item': 'wondrous_item',
    wondrous_item: 'wondrous_item',
    tool: 'tool',
    equipment: 'equipment',
  }

  const raritiesDE: Record<string, string> = {
    gewöhnlich: 'common',
    ungewöhnlich: 'uncommon',
    selten: 'rare',
    'sehr selten': 'very_rare',
    sehr_selten: 'very_rare',
    legendär: 'legendary',
    artefakt: 'artifact',
  }

  const raritiesEN: Record<string, string> = {
    common: 'common',
    uncommon: 'uncommon',
    rare: 'rare',
    'very rare': 'very_rare',
    very_rare: 'very_rare',
    legendary: 'legendary',
    artifact: 'artifact',
  }

  return {
    types: locale === 'en' ? typesEN : typesDE,
    rarities: locale === 'en' ? raritiesEN : raritiesDE,
  }
}

/**
 * Convert item type name (localized) to database key.
 */
export function getItemTypeKey(
  name: string | undefined | null,
  fuzzy = false,
  locale: 'de' | 'en' = 'de',
): Promise<string | null> {
  if (!name) return Promise.resolve(null)
  const lookup = createItemLookup(locale)
  const nameLower = name.toLowerCase()

  // Exact match first
  const exactMatch = lookup.types[nameLower]
  if (exactMatch) return Promise.resolve(exactMatch)

  // Fuzzy match for typos (more lenient for user input)
  if (fuzzy) {
    for (const [localizedName, key] of Object.entries(lookup.types)) {
      const maxDist = localizedName.length <= 4 ? 1 : localizedName.length <= 7 ? 2 : 3
      if (simpleLevenshtein(nameLower, localizedName) <= maxDist) {
        return Promise.resolve(key)
      }
    }
  }

  return Promise.resolve(null)
}

/**
 * Convert item rarity name (localized) to database key.
 */
export function getItemRarityKey(
  name: string | undefined | null,
  fuzzy = false,
  locale: 'de' | 'en' = 'de',
): Promise<string | null> {
  if (!name) return Promise.resolve(null)
  const lookup = createItemLookup(locale)
  const nameLower = name.toLowerCase()

  // Exact match first
  const exactMatch = lookup.rarities[nameLower]
  if (exactMatch) return Promise.resolve(exactMatch)

  // Fuzzy match for typos (more lenient for user input)
  if (fuzzy) {
    for (const [localizedName, key] of Object.entries(lookup.rarities)) {
      const maxDist = localizedName.length <= 5 ? 1 : localizedName.length <= 10 ? 2 : 3
      if (simpleLevenshtein(nameLower, localizedName) <= maxDist) {
        return Promise.resolve(key)
      }
    }
  }

  return Promise.resolve(null)
}

/**
 * Convert metadata object with localized names to keys.
 * Used when creating/updating NPCs and Items.
 */
export async function convertMetadataToKeys(
  metadata: Record<string, unknown> | null | undefined,
  entityType: 'npc' | 'item' = 'npc',
): Promise<Record<string, unknown> | null | undefined> {
  if (!metadata) return metadata

  const converted = { ...metadata }

  if (entityType === 'npc') {
    // Handle race - could be string or {title, value} object from v-combobox
    if (converted.race) {
      const raceValue =
        typeof converted.race === 'object' && converted.race !== null && 'value' in converted.race
          ? converted.race.value
          : converted.race

      // If it's already a key (lowercase, no spaces), keep it
      // This prevents double-conversion: "halfelf" should stay "halfelf", not be converted again
      if (
        typeof raceValue === 'string' &&
        raceValue === raceValue.toLowerCase() &&
        !raceValue.includes(' ')
      ) {
        converted.race = raceValue
      } else if (typeof raceValue === 'string') {
        // It's a display name (e.g., "Halbelf") - convert to key
        const raceKey = await getRaceKey(raceValue)
        if (raceKey) converted.race = raceKey
      }
    }

    // Handle class - could be string or {title, value} object from v-combobox
    if (converted.class) {
      const classValue =
        typeof converted.class === 'object' &&
        converted.class !== null &&
        'value' in converted.class
          ? converted.class.value
          : converted.class

      // If it's already a key (lowercase, no spaces), keep it
      if (
        typeof classValue === 'string' &&
        classValue === classValue.toLowerCase() &&
        !classValue.includes(' ')
      ) {
        converted.class = classValue
      } else if (typeof classValue === 'string') {
        // It's a display name (e.g., "Magier") - convert to key
        const classKey = await getClassKey(classValue)
        if (classKey) converted.class = classKey
      }
    }
  } else if (entityType === 'item') {
    // Handle type - use fuzzy matching for typos when saving
    if (converted.type) {
      const typeValue =
        typeof converted.type === 'object' && converted.type !== null && 'value' in converted.type
          ? converted.type.value
          : converted.type

      if (
        typeof typeValue === 'string' &&
        typeValue === typeValue.toLowerCase() &&
        !typeValue.includes(' ')
      ) {
        converted.type = typeValue
      } else if (typeof typeValue === 'string') {
        // Try exact match first, then fuzzy
        const typeKey =
          (await getItemTypeKey(typeValue, false)) || (await getItemTypeKey(typeValue, true))
        if (typeKey) converted.type = typeKey
      }
    }

    // Handle rarity - use fuzzy matching for typos when saving
    if (converted.rarity) {
      const rarityValue =
        typeof converted.rarity === 'object' &&
        converted.rarity !== null &&
        'value' in converted.rarity
          ? converted.rarity.value
          : converted.rarity

      if (
        typeof rarityValue === 'string' &&
        rarityValue === rarityValue.toLowerCase() &&
        !rarityValue.includes(' ')
      ) {
        converted.rarity = rarityValue
      } else if (typeof rarityValue === 'string') {
        // Try exact match first, then fuzzy
        const rarityKey =
          (await getItemRarityKey(rarityValue, false)) ||
          (await getItemRarityKey(rarityValue, true))
        if (rarityKey) converted.rarity = rarityKey
      }
    }
  }

  return converted
}
