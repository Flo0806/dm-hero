/**
 * Pure helpers shared by the AI import/update endpoints (no Nitro/DB deps, so
 * they're unit-testable directly).
 */

// A relation end may be a payload ref ("npc:1") or an entity that already
// exists, referenced as "existing:<id>". Returns the numeric id or null.
const EXISTING_REF = /^existing:(\d+)$/
export function parseExistingId(value?: string): number | null {
  const m = value ? EXISTING_REF.exec(value) : null
  return m ? Number(m[1]) : null
}

/**
 * Merge a metadata patch over existing metadata for an edit. A key set to
 * `null` in the patch removes it; every other patch key overwrites. Existing
 * keys not mentioned in the patch are kept.
 */
export function mergeMetadata(
  existing: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const removeKeys = new Set(
    Object.entries(patch).filter(([, v]) => v === null).map(([k]) => k),
  )
  const merged: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(existing)) {
    if (!removeKeys.has(k)) merged[k] = v
  }
  for (const [k, v] of Object.entries(patch)) {
    if (v !== null) merged[k] = v
  }
  return merged
}
