import { createHash } from 'node:crypto'
import type Database from 'better-sqlite3'
import { loadGameKeys, seal, type StoredGameKeys } from '@dm-hero/seal'
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

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')

/** Images become uploaded, encrypted file refs; a missing image file just drops the field */
async function resolveFields(db: Database.Database, auth: RelayAuth, shareId: number, fields: BuiltField[]): Promise<SharedField[]> {
  const resolved: SharedField[] = []
  let imageSource: string | null = null
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
      console.error('[Share] Image skipped:', error)
    }
  }
  // Image unticked or removed -> its files go
  if (!imageSource) await removeShareFiles(db, auth, shareId)
  return resolved
}

export async function syncTableShares(db: Database.Database, tableId: number) {
  const auth = getRelayAuth(db, tableId)
  const table = db.prepare('SELECT relay_game_id, e2e_keys FROM game_tables WHERE id = ?')
    .get(tableId) as { relay_game_id: string, e2e_keys: string | null } | undefined
  if (!auth || !table?.e2e_keys) return

  const shares = db.prepare('SELECT * FROM game_table_shares WHERE game_table_id = ?').all(tableId) as ShareRow[]
  let keys: Awaited<ReturnType<typeof loadGameKeys>> | null = null

  for (const share of shares) {
    const kind = getShareKind(share.entity_type)
    const built = kind.build(db, share.entity_id, JSON.parse(share.fields) as string[])

    // Entity deleted -> withdraw the share
    if (!built) {
      await removeShareFiles(db, auth, share.id)
      await deleteRelayShare(auth, share.share_key)
      db.prepare('DELETE FROM game_table_shares WHERE id = ?').run(share.id)
      continue
    }

    const visible = { ...built, title: share.display_name ?? built.title }
    const contentHash = hash(visible)
    if (contentHash === share.content_hash) continue

    keys ??= await loadGameKeys(JSON.parse(table.e2e_keys) as StoredGameKeys)
    const now = new Date().toISOString()
    const content: ShareContent = {
      shareId: share.share_key,
      type: share.entity_type,
      typeLabel: translateAll(kind.typeLabel) ?? share.entity_type,
      title: visible.title,
      fields: await resolveFields(db, auth, share.id, visible.fields),
      sharedAt: share.created_at,
      updatedAt: now,
    }
    const envelope = await seal(
      keys.gameKey,
      { v: 1, gameId: table.relay_game_id, from: 'dm', to: 'all', epoch: 1, seq: Date.now() },
      content,
      keys.signingKey,
    )
    await putRelayShare(auth, share.share_key, envelope)
    db.prepare('UPDATE game_table_shares SET content_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(contentHash, share.id)
  }
}
