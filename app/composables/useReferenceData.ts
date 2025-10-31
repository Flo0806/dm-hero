/**
 * Composable for displaying reference data (races, classes)
 * with fallback logic: DB translations (custom) → i18n (standard)
 */

interface ReferenceData {
  name: string
  name_de?: string | null
  name_en?: string | null
}

export function useRaceName(race: ReferenceData | string) {
  const { t, locale } = useI18n()

  // Handle string input (just the name key)
  if (typeof race === 'string') {
    // Load races to check if this is a custom entry
    const { data: races } = useFetch<ReferenceData[]>('/api/races', {
      key: 'races',
      getCachedData: key => useNuxtApp().static.data[key],
    })

    // Find matching race in DB
    const raceData = races.value?.find(r => r.name === race)
    if (raceData?.name_de && raceData?.name_en) {
      // Custom race with DB translations
      return locale.value === 'de' ? raceData.name_de : raceData.name_en
    }

    // Standard race: Try i18n
    const i18nKey = `referenceData.raceNames.${race}`
    const translated = t(i18nKey)
    return translated === i18nKey ? race : translated
  }

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

export function useClassName(classData: ReferenceData | string) {
  const { t, locale } = useI18n()

  // Handle string input (just the name key)
  if (typeof classData === 'string') {
    // Load classes to check if this is a custom entry
    const { data: classes } = useFetch<ReferenceData[]>('/api/classes', {
      key: 'classes',
      getCachedData: key => useNuxtApp().static.data[key],
    })

    // Find matching class in DB
    const classObj = classes.value?.find(c => c.name === classData)
    if (classObj?.name_de && classObj?.name_en) {
      // Custom class with DB translations
      return locale.value === 'de' ? classObj.name_de : classObj.name_en
    }

    // Standard class: Try i18n
    const i18nKey = `referenceData.classNames.${classData}`
    const translated = t(i18nKey)
    return translated === i18nKey ? classData : translated
  }

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
