/**
 * Tracks the most recent AI/MCP bulk-import so the app can detect it (via a
 * lightweight poll of GET /api/import/status) and show a "AI imported X"
 * snackbar + refresh the lists — WITHOUT the user reloading.
 *
 * This is set ONLY by the MCP bulk-import endpoint, never by the app's own
 * create endpoints — so manual user creation does not trigger the snackbar.
 *
 * State is in-memory in the (single) Nitro process shared by both endpoints.
 * It resets on server restart, which is fine: the app re-syncs its baseline on
 * the next poll and only reacts to imports that happen while it is running.
 */
export interface ImportSignal {
  seq: number
  at: string | null
  campaignId: number | null
  byType: Record<string, number> | null
  total: number
}

let signal: ImportSignal = { seq: 0, at: null, campaignId: null, byType: null, total: 0 }

export function recordImport(campaignId: number, byType: Record<string, number>) {
  const total = Object.values(byType).reduce((sum, n) => sum + n, 0)
  signal = {
    seq: signal.seq + 1,
    at: new Date().toISOString(),
    campaignId,
    byType,
    total,
  }
}

export function getImportSignal(): ImportSignal {
  return signal
}
