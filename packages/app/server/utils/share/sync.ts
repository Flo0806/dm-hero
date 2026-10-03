import { createHash } from 'node:crypto'
import type Database from 'better-sqlite3'
import { loadGameKeys, seal, type LoadedGameKeys, type StoredGameKeys } from '@dm-hero/seal'
import type { BuiltField, SharedField, ShareContent, ShareType } from '~~/types/share'
import { deleteRelayShare, getRelayAuth, putRelayShare, type RelayAuth } from '../relay'
import { ensureShareImage, removeShareFiles } from './files'
import { translateAll } from './i18n'
import { getShareKind } from './registry'

// Keeps the players' copy of every share up to date ("always live").
// One central place: no matter where or how the DM edits something
// (dialog, import, MCP), the next sync notices the change and re-sends it.

interface ShareRow {
  id: number
  share_key: string
  entity_type: ShareType
  entity_id: number
  fields: string
  display_name: string | null
  content_hash: string | null
  created_at: string
}

interface TableRow {
  relay_game_id: string
  e2e_keys: string | null
}

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')

// ---------------------------------------------------------------------------
// One task per game at a time: the 5 s timer, "share now" and key rotation must
// never overlap (two runs would upload the same image twice and delete each
// other's files).
// ---------------------------------------------------------------------------

const chains = new Map<number, Promise<unknown>>()
const pending = new Map<number, number>()

export function withTableLock<T>(tableId: number, task: () => Promise<T>): Promise<T> {
  pending.set(tableId, (pending.get(tableId) ?? 0) + 1)
  const run = (chains.get(tableId) ?? Promise.resolve())
    .catch(() => {})
    .then(task)
    .finally(() => pending.set(tableId, (pending.get(tableId) ?? 1) - 1))
  chains.set(tableId, run.catch(() => {}))
  return run
}

/** The timer skips a round while a sync is still running or queued */
export const isTableBusy = (tableId: number) => (pending.get(tableId) ?? 0) > 0

// ---------------------------------------------------------------------------

/** Images become uploaded, encrypted file refs. complete = false: an image failed, try again next round. */
async function resolveFields(db: Database.Database, auth: RelayAuth, shareId: number, fields: BuiltField[]) {
  const resolved: SharedField[] = []
  let imageSource: string | null = null
  let complete = true
  for (const field of fields) {
    if (field.format !== 'image') {
      resolved.push(field)
      continue
    }
    try {
      resolved.push({ key: field.key, format: 'image', label: field.label, image: await ensureShareImage(db, auth, shareId, field.source) })
      imageSource = field.source
    }
    catch (error) {
      if ((error as { statusCode?: number }).statusCode === 413) throw error
      console.error('[Share] Image failed, retrying next round:', error)
      complete = false
    }
  }
  // Image unticked or removed -> its files go (not when it just failed - it's retried)
  if (!imageSource && complete) await removeShareFiles(db, auth, shareId)
  return { fields: resolved, complete }
}

async function syncShare(db: Database.Database, auth: RelayAuth, table: TableRow, tableId: number, share: ShareRow, getKeys: () => Promise<LoadedGameKeys>) {
  const kind = getShareKind(share.entity_type)
  const built = kind.build(db, share.entity_id, JSON.parse(share.fields) as string[], { tableId })

  // Entity deleted -> withdraw the share first (players drop it), then its files
  if (!built) {
    await deleteRelayShare(auth, share.share_key)
    await removeShareFiles(db, auth, share.id)
    db.prepare('DELETE FROM game_table_shares WHERE id = ?').run(share.id)
    return
  }

  const visible = { ...built, title: share.display_name ?? built.title }
  const contentHash = hash(visible)
  if (contentHash === share.content_hash) return

  const keys = await getKeys()
  const { fields, complete } = await resolveFields(db, auth, share.id, visible.fields)
  const content: ShareContent = {
    shareId: share.share_key,
    type: share.entity_type,
    typeLabel: translateAll(kind.typeLabel) ?? share.entity_type,
    title: visible.title,
    fields,
    sharedAt: share.created_at,
    updatedAt: new Date().toISOString(),
  }
  const envelope = await seal(
    keys.gameKey,
    { v: 1, gameId: table.relay_game_id, from: 'dm', to: 'all', epoch: keys.epoch, seq: Date.now() },
    content,
    keys.signingKey,
  )
  await putRelayShare(auth, share.share_key, envelope)
  // Only remember "players have this" when everything (incl. images) arrived
  db.prepare('UPDATE game_table_shares SET content_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(complete ? contentHash : null, share.id)
}

async function runSync(db: Database.Database, tableId: number) {
  const errors = new Map<number, unknown>()
  const auth = getRelayAuth(db, tableId)
  const table = db.prepare('SELECT relay_game_id, e2e_keys FROM game_tables WHERE id = ?').get(tableId) as TableRow | undefined
  if (!auth || !table?.e2e_keys) return errors

  let keys: LoadedGameKeys | null = null
  const getKeys = async () => (keys ??= await loadGameKeys(JSON.parse(table.e2e_keys!) as StoredGameKeys))

  const shares = db.prepare('SELECT * FROM game_table_shares WHERE game_table_id = ?').all(tableId) as ShareRow[]
  for (const share of shares) {
    // One broken share must not block the others
    try {
      await syncShare(db, auth, table, tableId, share, getKeys)
    }
    catch (error) {
      console.error(`[Share] Sync of share ${share.id} failed:`, error)
      errors.set(share.id, error)
    }
  }
  return errors
}

/** Sync all shares of a game. Returns the errors per share id (empty = all fine). */
export function syncTableShares(db: Database.Database, tableId: number) {
  return withTableLock(tableId, () => runSync(db, tableId))
}
