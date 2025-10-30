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
export function getLocaleFromEvent(event: any): 'de' | 'en' {
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
 */
export function getRaceKey(name: string | undefined | null, fuzzy = false, locale: 'de' | 'en' = 'de'): string | null {
  if (!name) return null
  const lookup = createI18nLookup(locale)
  const nameLower = name.toLowerCase()

  // Exact match first
  const exactMatch = lookup.races[nameLower]
  if (exactMatch) return exactMatch

  // Fuzzy match for typos (optional, used in search)
  if (fuzzy) {
    // Simple fuzzy: check if any key is very similar (Levenshtein distance <= 2)
    for (const [localizedName, key] of Object.entries(lookup.races)) {
      if (simpleLevenshtein(nameLower, localizedName) <= 2) {
        return key
      }
    }
  }

  return null
}

export function getClassKey(name: string | undefined | null, fuzzy = false, locale: 'de' | 'en' = 'de'): string | null {
  if (!name) return null
  const lookup = createI18nLookup(locale)
  const nameLower = name.toLowerCase()

  // Exact match first
  const exactMatch = lookup.classes[nameLower]
  if (exactMatch) return exactMatch

  // Fuzzy match for typos (optional, used in search)
  if (fuzzy) {
    for (const [localizedName, key] of Object.entries(lookup.classes)) {
      if (simpleLevenshtein(nameLower, localizedName) <= 2) {
        return key
      }
    }
  }

  return null
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
export function getItemTypeKey(name: string | undefined | null, fuzzy = false, locale: 'de' | 'en' = 'de'): string | null {
  if (!name) return null
  const lookup = createItemLookup(locale)
  const nameLower = name.toLowerCase()

  // Exact match first
  const exactMatch = lookup.types[nameLower]
  if (exactMatch) return exactMatch

  // Fuzzy match for typos (more lenient for user input)
  if (fuzzy) {
    for (const [localizedName, key] of Object.entries(lookup.types)) {
      const maxDist = localizedName.length <= 4 ? 1 : localizedName.length <= 7 ? 2 : 3
      if (simpleLevenshtein(nameLower, localizedName) <= maxDist) {
        return key
      }
    }
  }

  return null
}

/**
 * Convert item rarity name (localized) to database key.
 */
export function getItemRarityKey(name: string | undefined | null, fuzzy = false, locale: 'de' | 'en' = 'de'): string | null {
  if (!name) return null
  const lookup = createItemLookup(locale)
  const nameLower = name.toLowerCase()

  // Exact match first
  const exactMatch = lookup.rarities[nameLower]
  if (exactMatch) return exactMatch

  // Fuzzy match for typos (more lenient for user input)
  if (fuzzy) {
    for (const [localizedName, key] of Object.entries(lookup.rarities)) {
      const maxDist = localizedName.length <= 5 ? 1 : localizedName.length <= 10 ? 2 : 3
      if (simpleLevenshtein(nameLower, localizedName) <= maxDist) {
        return key
      }
    }
  }

  return null
}

/**
 * Convert metadata object with localized names to keys.
 * Used when creating/updating NPCs and Items.
 */
export function convertMetadataToKeys(metadata: any, entityType: 'npc' | 'item' = 'npc'): any {
  if (!metadata) return metadata

  const converted = { ...metadata }

  if (entityType === 'npc') {
    // Handle race - could be string or {title, value} object from v-combobox
    if (converted.race) {
      const raceValue = typeof converted.race === 'object' && converted.race.value
        ? converted.race.value
        : converted.race

      // If it's already a key (no uppercase, no spaces), keep it
      if (typeof raceValue === 'string' && raceValue === raceValue.toLowerCase() && !raceValue.includes(' ')) {
        converted.race = raceValue
      }
      else {
        const raceKey = getRaceKey(raceValue)
        if (raceKey) converted.race = raceKey
      }
    }

    // Handle class - could be string or {title, value} object from v-combobox
    if (converted.class) {
      const classValue = typeof converted.class === 'object' && converted.class.value
        ? converted.class.value
        : converted.class

      // If it's already a key (no uppercase, no spaces), keep it
      if (typeof classValue === 'string' && classValue === classValue.toLowerCase() && !classValue.includes(' ')) {
        converted.class = classValue
      }
      else {
        const classKey = getClassKey(classValue)
        if (classKey) converted.class = classKey
      }
    }
  }
  else if (entityType === 'item') {
    // Handle type - use fuzzy matching for typos when saving
    if (converted.type) {
      const typeValue = typeof converted.type === 'object' && converted.type.value
        ? converted.type.value
        : converted.type

      if (typeof typeValue === 'string' && typeValue === typeValue.toLowerCase() && !typeValue.includes(' ')) {
        converted.type = typeValue
      }
      else {
        // Try exact match first, then fuzzy
        const typeKey = getItemTypeKey(typeValue, false) || getItemTypeKey(typeValue, true)
        if (typeKey) converted.type = typeKey
      }
    }

    // Handle rarity - use fuzzy matching for typos when saving
    if (converted.rarity) {
      const rarityValue = typeof converted.rarity === 'object' && converted.rarity.value
        ? converted.rarity.value
        : converted.rarity

      if (typeof rarityValue === 'string' && rarityValue === rarityValue.toLowerCase() && !rarityValue.includes(' ')) {
        converted.rarity = rarityValue
      }
      else {
        // Try exact match first, then fuzzy
        const rarityKey = getItemRarityKey(rarityValue, false) || getItemRarityKey(rarityValue, true)
        if (rarityKey) converted.rarity = rarityKey
      }
    }
  }

  return converted
}
