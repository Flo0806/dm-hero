/**
 * Normalize a value to string array. Handles string, string[], null, undefined.
 * Used for multi-value metadata fields (class, type).
 */
export function toArray(val: unknown): string[] {
  if (!val) return []
  if (Array.isArray(val)) return val
  return [val as string]
}
