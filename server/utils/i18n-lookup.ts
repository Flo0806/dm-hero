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
export function getLocaleFromEvent(event: { node: { req: { headers: { 'accept-language'?: string, cookie?: string } } } }): 'de' | 'en' {
  // Priority 1: Accept-Language header (set by frontend with current locale)
  const acceptLanguage = event.node.req.headers['accept-language']
  if (acceptLanguage) {
    const locale = acceptLanguage.toLowerCase().split(',')[0].split('-')[0] // Extract language code
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
 */
export function createI18nLookup(locale: 'de' | 'en' = 'de'): RaceClassLookup {
  const racesDE: Record<string, string> = {
    'mensch': 'human',
    'elf': 'elf',
    'zwerg': 'dwarf',
    'halbling': 'halfling',
    'gnom': 'gnome',
    'halbelf': 'halfelf',
    'halbork': 'halforc',
    'tiefling': 'tiefling',
    'drachenblütiger': 'dragonborn',
    'zwergelf (drow)': 'drow',
    'drow': 'drow',
    'waldelf': 'woodelf',
    'hochelf': 'highelf',
    'bergzwerg': 'mountaindwarf',
    'hügelzwerg': 'hilldwarf',
    'leichtfuß-halbling': 'lightfoothalfling',
    'robuster halbling': 'stouthalfling',
  }

  const racesEN: Record<string, string> = {
    // English names (NOT keys - keys are language-neutral and should not be directly searchable)
    // If user searches "human" in EN, we want to find it. But NOT in DE.
    'human': 'human',
    'elf': 'elf',
    'dwarf': 'dwarf',
    'halfling': 'halfling',
    'gnome': 'gnome',
    'half-elf': 'halfelf',
    'half elf': 'halfelf',
    'halfelf': 'halfelf',
    'half-orc': 'halforc',
    'half orc': 'halforc',
    'halforc': 'halforc',
    'tiefling': 'tiefling',
    'dragonborn': 'dragonborn',
    'drow': 'drow',
    'wood elf': 'woodelf',
    'woodelf': 'woodelf',
    'high elf': 'highelf',
    'highelf': 'highelf',
    'mountain dwarf': 'mountaindwarf',
    'mountaindwarf': 'mountaindwarf',
    'hill dwarf': 'hilldwarf',
    'hilldwarf': 'hilldwarf',
    'lightfoot halfling': 'lightfoothalfling',
    'lightfoothalfling': 'lightfoothalfling',
    'stout halfling': 'stouthalfling',
    'stouthalfling': 'stouthalfling',
  }

  const classesDE: Record<string, string> = {
    'barbar': 'barbarian',
    'barde': 'bard',
    'druide': 'druid',
    'hexenmeister': 'warlock',
    'kämpfer': 'fighter',
    'kleriker': 'cleric',
    'magier': 'wizard',
    'mönch': 'monk',
    'paladin': 'paladin',
    'schurke': 'rogue',
    'waldläufer': 'ranger',
    'zauberer': 'sorcerer',
  }

  const classesEN: Record<string, string> = {
    // English names (keys happen to match English names for classes)
    'barbarian': 'barbarian',
    'bard': 'bard',
    'druid': 'druid',
    'warlock': 'warlock',
    'fighter': 'fighter',
    'cleric': 'cleric',
    'wizard': 'wizard',
    'monk': 'monk',
    'paladin': 'paladin',
    'rogue': 'rogue',
    'ranger': 'ranger',
    'sorcerer': 'sorcerer',
  }

  return {
    races: locale === 'en' ? racesEN : racesDE,
    classes: locale === 'en' ? classesEN : classesDE,
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
export async function getRaceKey(name: string | undefined | null, fuzzy = false, locale: 'de' | 'en' = 'de'): Promise<string | null> {
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

    const customRaceExact = db.prepare(`
      SELECT name FROM races
      WHERE (LOWER(name_de) = ? OR LOWER(name_en) = ? OR LOWER(name) = ?)
        AND deleted_at IS NULL
      LIMIT 1
    `).get(nameLower, nameLower, nameLower) as { name: string } | undefined

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

      const allCustomRaces = db.prepare(`
        SELECT name, name_de, name_en FROM races
        WHERE name_de IS NOT NULL AND name_en IS NOT NULL
          AND deleted_at IS NULL
      `).all() as Array<{ name: string, name_de: string, name_en: string }>

      for (const race of allCustomRaces) {
        const compareValue = locale === 'de' ? race.name_de : race.name_en
        if (simpleLevenshtein(nameLower, compareValue.toLowerCase()) <= 2) {
          return race.name
        }
      }
    } catch  {
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
export async function getRaceSearchVariants(name: string | undefined | null, locale: 'de' | 'en' = 'de'): Promise<string[]> {
  if (!name) return []

  const key = await getRaceKey(name, true, locale)

  // If we couldn't find a key by localized name, check if 'name' itself is already a key
  let actualKey: string
  if (!key) {
    try {
      const dbModule = await import('./db')
      const db = dbModule.getDb()

      const raceByKey = db.prepare(`
        SELECT name FROM races
        WHERE LOWER(name) = LOWER(?)
          AND deleted_at IS NULL
        LIMIT 1
      `).get(name) as { name: string } | undefined

      if (raceByKey) {
        actualKey = raceByKey.name
      } else {
        return [name.toLowerCase()]
      }
    } catch  {
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

    const customRace = db.prepare(`
      SELECT name_de, name_en FROM races
      WHERE LOWER(name) = LOWER(?)
        AND deleted_at IS NULL
      LIMIT 1
    `).get(actualKey) as { name_de: string, name_en: string } | undefined

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

export async function getClassKey(name: string | undefined | null, fuzzy = false, locale: 'de' | 'en' = 'de'): Promise<string | null> {
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

    const customClassExact = db.prepare(`
      SELECT name FROM classes
      WHERE (LOWER(name_de) = ? OR LOWER(name_en) = ? OR LOWER(name) = ?)
        AND deleted_at IS NULL
      LIMIT 1
    `).get(nameLower, nameLower, nameLower) as { name: string } | undefined

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

      const allCustomClasses = db.prepare(`
        SELECT name, name_de, name_en FROM classes
        WHERE name_de IS NOT NULL AND name_en IS NOT NULL
          AND deleted_at IS NULL
      `).all() as Array<{ name: string, name_de: string, name_en: string }>

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
export async function getClassSearchVariants(name: string | undefined | null, locale: 'de' | 'en' = 'de'): Promise<string[]> {
  if (!name) return []

  const key = await getClassKey(name, true, locale)

  // If we couldn't find a key by localized name, check if 'name' itself is already a key
  let actualKey: string
  if (!key) {
    try {
      const dbModule = await import('./db')
      const db = dbModule.getDb()

      const classByKey = db.prepare(`
        SELECT name FROM classes
        WHERE LOWER(name) = LOWER(?)
          AND deleted_at IS NULL
        LIMIT 1
      `).get(name) as { name: string } | undefined

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

    const customClass = db.prepare(`
      SELECT name_de, name_en FROM classes
      WHERE LOWER(name) = LOWER(?)
        AND deleted_at IS NULL
      LIMIT 1
    `).get(actualKey) as { name_de: string, name_en: string } | undefined

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
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      }
      else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

/**
 * Create lookup tables for item types and rarities.
 * Locale-specific for multilingual search support.
 */
export function createItemLookup(locale: 'de' | 'en' = 'de'): ItemLookup {
  const typesDE: Record<string, string> = {
    'waffe': 'weapon',
    'rüstung': 'armor',
    'trank': 'potion',
    'schriftrolle': 'scroll',
    'ring': 'ring',
    'amulett': 'amulet',
    'stab': 'staff',
    'zauberstab': 'wand',
    'wundersamer gegenstand': 'wondrous_item',
    'werkzeug': 'tool',
    'ausrüstung': 'equipment',
  }

  const typesEN: Record<string, string> = {
    'weapon': 'weapon',
    'armor': 'armor',
    'potion': 'potion',
    'scroll': 'scroll',
    'ring': 'ring',
    'amulet': 'amulet',
    'staff': 'staff',
    'wand': 'wand',
    'wondrous item': 'wondrous_item',
    'wondrous_item': 'wondrous_item',
    'tool': 'tool',
    'equipment': 'equipment',
  }

  const raritiesDE: Record<string, string> = {
    'gewöhnlich': 'common',
    'ungewöhnlich': 'uncommon',
    'selten': 'rare',
    'sehr selten': 'very_rare',
    'sehr_selten': 'very_rare',
    'legendär': 'legendary',
    'artefakt': 'artifact',
  }

  const raritiesEN: Record<string, string> = {
    'common': 'common',
    'uncommon': 'uncommon',
    'rare': 'rare',
    'very rare': 'very_rare',
    'very_rare': 'very_rare',
    'legendary': 'legendary',
    'artifact': 'artifact',
  }

  return {
    types: locale === 'en' ? typesEN : typesDE,
    rarities: locale === 'en' ? raritiesEN : raritiesDE,
  }
}

/**
 * Convert item type name (localized) to database key.
 */
export function getItemTypeKey(name: string | undefined | null, fuzzy = false, locale: 'de' | 'en' = 'de'): Promise<string | null> {
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
export function getItemRarityKey(name: string | undefined | null, fuzzy = false, locale: 'de' | 'en' = 'de'): Promise<string | null> {
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
export async function convertMetadataToKeys(metadata: Record<string, unknown> | null | undefined, entityType: 'npc' | 'item' = 'npc'): Promise<Record<string, unknown> | null | undefined> {
  if (!metadata) return metadata

  const converted = { ...metadata }

  if (entityType === 'npc') {
    // Handle race - could be string or {title, value} object from v-combobox
    if (converted.race) {
      const raceValue = typeof converted.race === 'object' && converted.race !== null && 'value' in converted.race
        ? converted.race.value
        : converted.race

      // If it's already a key (no uppercase, no spaces), keep it
      if (typeof raceValue === 'string' && raceValue === raceValue.toLowerCase() && !raceValue.includes(' ')) {
        converted.race = raceValue
      }
      else if (typeof raceValue === 'string') {
        const raceKey = await getRaceKey(raceValue)
        if (raceKey) converted.race = raceKey
      }
    }

    // Handle class - could be string or {title, value} object from v-combobox
    if (converted.class) {
      const classValue = typeof converted.class === 'object' && converted.class !== null && 'value' in converted.class
        ? converted.class.value
        : converted.class

      // If it's already a key (no uppercase, no spaces), keep it
      if (typeof classValue === 'string' && classValue === classValue.toLowerCase() && !classValue.includes(' ')) {
        converted.class = classValue
      }
      else if (typeof classValue === 'string') {
        const classKey = await getClassKey(classValue)
        if (classKey) converted.class = classKey
      }
    }
  }
  else if (entityType === 'item') {
    // Handle type - use fuzzy matching for typos when saving
    if (converted.type) {
      const typeValue = typeof converted.type === 'object' && converted.type !== null && 'value' in converted.type
        ? converted.type.value
        : converted.type

      if (typeof typeValue === 'string' && typeValue === typeValue.toLowerCase() && !typeValue.includes(' ')) {
        converted.type = typeValue
      }
      else if (typeof typeValue === 'string') {
        // Try exact match first, then fuzzy
        const typeKey = await getItemTypeKey(typeValue, false) || await getItemTypeKey(typeValue, true)
        if (typeKey) converted.type = typeKey
      }
    }

    // Handle rarity - use fuzzy matching for typos when saving
    if (converted.rarity) {
      const rarityValue = typeof converted.rarity === 'object' && converted.rarity !== null && 'value' in converted.rarity
        ? converted.rarity.value
        : converted.rarity

      if (typeof rarityValue === 'string' && rarityValue === rarityValue.toLowerCase() && !rarityValue.includes(' ')) {
        converted.rarity = rarityValue
      }
      else if (typeof rarityValue === 'string') {
        // Try exact match first, then fuzzy
        const rarityKey = await getItemRarityKey(rarityValue, false) || await getItemRarityKey(rarityValue, true)
        if (rarityKey) converted.rarity = rarityKey
      }
    }
  }

  return converted
}
