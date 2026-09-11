/**
 * Single source of truth for the app's UI languages.
 * Adding a language: add it here, drop `i18n/locales/<code>.json`,
 * register it in `nuxt.config.ts` and map its Vuetify locale in `app/plugins/vuetify.ts`.
 */
export const SUPPORTED_LOCALES = [
  { code: 'de', name: 'Deutsch', englishName: 'German', flagIcon: 'flag:de-4x3', vuetify: 'de' },
  { code: 'en', name: 'English', englishName: 'English', flagIcon: 'flag:gb-4x3', vuetify: 'en' },
  { code: 'es', name: 'Español', englishName: 'Spanish', flagIcon: 'flag:es-4x3', vuetify: 'es' },
  { code: 'fr', name: 'Français', englishName: 'French', flagIcon: 'flag:fr-4x3', vuetify: 'fr' },
  { code: 'it', name: 'Italiano', englishName: 'Italian', flagIcon: 'flag:it-4x3', vuetify: 'it' },
  { code: 'zh-CN', name: '简体中文', englishName: 'Simplified Chinese', flagIcon: 'flag:cn-4x3', vuetify: 'zhHans' },
] as const

export type AppLocale = (typeof SUPPORTED_LOCALES)[number]['code']

export const LOCALE_CODES = SUPPORTED_LOCALES.map(l => l.code) as readonly AppLocale[]

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && (LOCALE_CODES as readonly string[]).includes(value)
}

/** Vuetify locale key for an app locale (e.g. 'zh-CN' → 'zhHans') */
export function toVuetifyLocale(code: AppLocale): string {
  return SUPPORTED_LOCALES.find(l => l.code === code)?.vuetify ?? code
}

/** English language name, used to instruct AI prompts ("Reply in Italian") */
export function localeEnglishName(code: string): string {
  return SUPPORTED_LOCALES.find(l => l.code === code)?.englishName ?? 'English'
}
