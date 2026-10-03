import de from '~~/i18n/locales/de.json'
import en from '~~/i18n/locales/en.json'
import es from '~~/i18n/locales/es.json'
import fr from '~~/i18n/locales/fr.json'
import it from '~~/i18n/locales/it.json'
import zhCN from '~~/i18n/locales/zh-CN.json'
import type { AppLocale } from '~~/types/locale'
import type { LocalizedText } from '~~/types/share'

// Shares carry labels and standard values in ALL app languages, so players can
// read them in theirs - the player app needs no translations of its own.
const MESSAGES: Record<AppLocale, unknown> = { de, en, es, fr, it, 'zh-CN': zhCN }

function lookup(messages: unknown, path: string): string | undefined {
  const value = path.split('.').reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], messages)
  // "Fraktion | Fraktionen" (plural forms) -> singular
  return typeof value === 'string' ? value.split('|')[0]!.trim() : undefined
}

/** A translation key in every language, or undefined if it doesn't exist (e.g. a DM's custom race) */
export function translateAll(path: string): Exclude<LocalizedText, string> | undefined {
  if (!lookup(MESSAGES.en, path)) return undefined
  return Object.fromEntries(
    (Object.keys(MESSAGES) as AppLocale[]).map(locale => [locale, lookup(MESSAGES[locale], path) ?? lookup(MESSAGES.en, path)!]),
  )
}

/** Join several localized values per language ("Wizard, Fighter") */
export function joinLocalized(values: LocalizedText[]): LocalizedText {
  if (values.every(v => typeof v === 'string')) return values.join(', ')
  return Object.fromEntries(
    (Object.keys(MESSAGES) as AppLocale[]).map(locale => [locale, values.map(v => typeof v === 'string' ? v : v[locale] ?? v.en ?? '').join(', ')]),
  )
}
