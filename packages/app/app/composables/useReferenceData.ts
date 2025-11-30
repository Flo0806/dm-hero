/**
 * Composable for displaying reference data (races, classes)
 * with fallback logic: DB translations (custom) → i18n (standard)
 */

interface ReferenceData {
  name: string
  key?: string // i18n key (e.g., "human", "elf")
  name_de?: string | null | undefined
  name_en?: string | null | undefined
}

export function useRaceName(race: ReferenceData) {
  const { t, locale } = useI18n()

  // Custom race: Use DB translations if available
  if (race.name_de && race.name_en) {
    return locale.value === 'de' ? race.name_de : race.name_en
  }

  // Standard race: Use i18n with KEY field (e.g., "human" not "Mensch")
  if (race.key) {
    const i18nKey = `referenceData.raceNames.${race.key}`
    const translated = t(i18nKey)

    // Return translated if found, otherwise fallback to name
    if (translated !== i18nKey) {
      return translated
    }
  }

  // Fallback to raw name
  return race.name
}

export function useClassName(classData: ReferenceData) {
  const { t, locale } = useI18n()

  // Custom class: Use DB translations if available
  if (classData.name_de && classData.name_en) {
    return locale.value === 'de' ? classData.name_de : classData.name_en
  }

  // Standard class: Use i18n with KEY field (e.g., "barbarian" not "Barbar")
  if (classData.key) {
    const i18nKey = `referenceData.classNames.${classData.key}`
    const translated = t(i18nKey)

    // Return translated if found, otherwise fallback to name
    if (translated !== i18nKey) {
      return translated
    }
  }

  // Fallback to raw name
  return classData.name
}
