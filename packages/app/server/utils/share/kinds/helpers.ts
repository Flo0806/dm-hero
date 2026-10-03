import type { LocalizedText } from '~~/types/share'
import { joinLocalized, translateAll } from '../i18n'

// Shared building blocks for share kinds

/** Keys of a metadata type without its [key: string] index signature - for the field policy check */
export type KnownKeys<T> = keyof { [K in keyof T as string extends K ? never : number extends K ? never : K]: T[K] }

/** Fields a policy marks as 'share' */
export type SharedKeys<P> = { [K in keyof P]: P[K] extends 'share' ? K : never }[keyof P]

export const sharedFieldsOf = <P extends Record<string, 'share' | 'private'>>(policy: P) =>
  (Object.keys(policy) as Array<keyof P>).filter((f): f is SharedKeys<P> => policy[f] === 'share')

/** "a" or ["a", "b"] -> ["a", "b"] */
export const list = (value: unknown) => (Array.isArray(value) ? value : value ? [value] : []).map(String).filter(Boolean)

/** Standard values (keys) in all languages, a DM's own values as written */
export const localize = (path: string, values: string[]): LocalizedText | null =>
  values.length ? joinLocalized(values.map(v => translateAll(`${path}.${v}`) ?? v)) : null
