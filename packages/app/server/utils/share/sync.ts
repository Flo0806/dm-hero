import { createHash } from 'node:crypto'
import type Database from 'better-sqlite3'
import { loadGameKeys, seal, type StoredGameKeys } from '@dm-hero/seal'
import type { ShareContent, ShareType } from '~~/types/share'
import { deleteRelayShare, getRelayAuth, putRelayShare } from '../relay'
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
  content_hash: string | null
  created_at: string
}

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')

export async function syncTableShares(db: Database.Database, tableId: number) {
  const auth = getRelayAuth(db, tableId)
  const table = db.prepare('SELECT relay_game_id, e2e_keys FROM game_tables WHERE id = ?')
    .get(tableId) as { relay_game_id: string, e2e_keys: string | null } | undefined
  if (!auth || !table?.e2e_keys) return

  const shares = db.prepare('SELECT * FROM game_table_shares WHERE game_table_id = ?').all(tableId) as ShareRow[]
  let keys: Awaited<ReturnType<typeof loadGameKeys>> | null = null

  for (const share of shares) {
    const built = getShareKind(share.entity_type).build(db, share.entity_id, JSON.parse(share.fields) as string[])

    // Entity deleted -> withdraw the share
    if (!built) {
      await deleteRelayShare(auth, share.share_key)
      db.prepare('DELETE FROM game_table_shares WHERE id = ?').run(share.id)
      continue
    }

    const contentHash = hash(built)
    if (contentHash === share.content_hash) continue

    keys ??= await loadGameKeys(JSON.parse(table.e2e_keys) as StoredGameKeys)
    const now = new Date().toISOString()
    const content: ShareContent = {
      shareId: share.share_key,
      type: share.entity_type,
      title: built.title,
      fields: built.fields,
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
