/**
 * Composable for displaying reference data (races, classes)
 * with fallback logic: DB translations (custom) → i18n (standard)
 */

interface ReferenceData {
  name: string
  name_de?: string | null
  name_en?: string | null
}

export function useRaceName(race: ReferenceData) {
  const { t, locale } = useI18n()

  // Custom race: Use DB translations if available
  if (race.name_de && race.name_en) {
    return locale.value === 'de' ? race.name_de : race.name_en
  }

  // Standard race: Use i18n
  const i18nKey = `referenceData.raceNames.${race.name}`
  const translated = t(i18nKey)

  // Fallback to raw name if i18n key missing
  return translated === i18nKey ? race.name : translated
}

export function useClassName(classData: ReferenceData) {
  const { t, locale } = useI18n()

  // Custom class: Use DB translations if available
  if (classData.name_de && classData.name_en) {
    return locale.value === 'de' ? classData.name_de : classData.name_en
  }

  // Standard class: Use i18n
  const i18nKey = `referenceData.classNames.${classData.name}`
  const translated = t(i18nKey)

  // Fallback to raw name if i18n key missing
  return translated === i18nKey ? classData.name : translated
}
