/**
 * Normalize text for search by removing accents/diacritics
 * Examples:
 * - "André" → "Andre"
 * - "Müller" → "Muller"
 * - "São Paulo" → "Sao Paulo"
 */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD') // Decompose characters (é → e + accent)
    .replace(/[\u0300-\u036f]/g, '') // Remove accent marks
    .toLowerCase()
}
