import { createHash, randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type Database from 'better-sqlite3'
import {
  derivePairKey, encryptFile, HANDOUT_FILE_MAX, HANDOUT_TEXT_MAX, importExchangePublicKey, loadGameKeys, seal,
  type HandoutContent, type LoadedGameKeys, type StoredGameKeys,
} from '@dm-hero/seal'
import type { SharedFileRef } from '~~/types/share'
import { getUploadPath } from '../paths'
import { deleteRelayFile, deleteRelayHandout, getRelayAuth, putRelayFile, putRelayHandout, type RelayAuth } from '../relay'
import { withTableLock } from './sync'
import { resolveEntityLinks } from './text'

// Handouts: documents for chosen players. Each recipient device gets its own
// envelope (DM<->device pair key) - other players can't read it and don't even
// get it. Like shares: "always live", sent again when text, file, recipients or
// their devices change.

export interface HandoutRow {
  id: number
  handout_key: string
  document_id: number
  recipients: string
  content_hash: string | null
  file_source: string | null
  file_ref: string | null
  created_at: string
}

interface DocumentRow {
  title: string
  content: string
  file_type: string | null
  file_path: string | null
}

/** 'all' or the chosen player ids */
export type HandoutRecipients = 'all' | number[]

export const parseRecipients = (value: string): HandoutRecipients => value === 'all' ? 'all' : JSON.parse(value) as number[]

const tooLarge = (message: string) => createError({ statusCode: 413, message })

/** Withdraw: recipients drop it, its file goes */
export async function withdrawHandout(db: Database.Database, auth: RelayAuth | null, row: HandoutRow) {
  if (auth) {
    await deleteRelayHandout(auth, row.handout_key)
    const file = row.file_ref ? JSON.parse(row.file_ref) as SharedFileRef : null
    if (file) await deleteRelayFile(auth, file.fileId).catch(error => console.error('[Relay] Handout file delete failed:', error))
  }
  db.prepare('DELETE FROM game_table_handouts WHERE id = ?').run(row.id)
}

/** The encrypted PDF on the relay - uploaded once per file */
async function ensureHandoutFile(db: Database.Database, auth: RelayAuth, row: HandoutRow, source: string) {
  if (row.file_source === source && row.file_ref) return JSON.parse(row.file_ref) as SharedFileRef & { size: number }
  const bytes = await readFile(join(getUploadPath(), source))
  if (bytes.length > HANDOUT_FILE_MAX) throw tooLarge('PDF too large for the game table (max 2 MB)')
  const { ciphertext, fileKey } = await encryptFile(new Uint8Array(bytes))
  const ref = { fileId: randomBytes(16).toString('hex'), key: fileKey.key, iv: fileKey.iv, mime: 'application/pdf', size: bytes.length }
  await putRelayFile(auth, ref.fileId, ciphertext)
  const previous = row.file_ref ? JSON.parse(row.file_ref) as SharedFileRef : null
  db.prepare('UPDATE game_table_handouts SET file_source = ?, file_ref = ? WHERE id = ?').run(source, JSON.stringify(ref), row.id)
  if (previous) await deleteRelayFile(auth, previous.fileId).catch(error => console.error('[Relay] Handout file delete failed:', error))
  return ref
}

async function syncHandout(db: Database.Database, auth: RelayAuth, tableId: number, gameId: string, row: HandoutRow, getKeys: () => Promise<LoadedGameKeys>) {
  const doc = db.prepare(`
    SELECT d.title, d.content, d.file_type, d.file_path FROM entity_documents d
    JOIN entities e ON e.id = d.entity_id
    WHERE d.id = ? AND e.deleted_at IS NULL
  `).get(row.document_id) as DocumentRow | undefined
  // Document (or its entity) deleted -> withdraw
  if (!doc) return withdrawHandout(db, auth, row)

  const players = (db.prepare('SELECT id FROM game_table_players WHERE game_table_id = ?').all(tableId) as Array<{ id: number }>).map(p => p.id)
  const wanted = parseRecipients(row.recipients)
  const recipients = wanted === 'all' ? players : wanted.filter(id => players.includes(id))
  const devices = recipients.length
    ? db.prepare(`SELECT player_id, public_key FROM game_table_devices WHERE game_table_id = ? AND player_id IN (${recipients.map(() => '?').join(',')}) ORDER BY id`)
      .all(tableId, ...recipients) as Array<{ player_id: number, public_key: string }>
    : []

  const content: HandoutContent = { kind: 'handout', handoutId: row.handout_key, title: doc.title, format: 'markdown', sharedAt: row.created_at }
  if (doc.file_type === 'pdf' && doc.file_path) {
    content.format = 'pdf'
    content.file = await ensureHandoutFile(db, auth, row, doc.file_path)
  }
  else {
    content.text = resolveEntityLinks(db, tableId, doc.content ?? '')
    if (content.text.length > HANDOUT_TEXT_MAX) throw tooLarge('Text too long for the game table')
  }

  const hash = createHash('sha256').update(JSON.stringify({ content, recipients, devices })).digest('hex')
  if (hash === row.content_hash) return

  const keys = await getKeys()
  const envelopes: Record<string, Record<string, unknown>> = Object.fromEntries(recipients.map(id => [String(id), {}]))
  for (const device of devices) {
    const pairKey = await derivePairKey(keys.exchangeKey, await importExchangePublicKey(device.public_key), gameId)
    envelopes[String(device.player_id)]![device.public_key] = await seal(
      pairKey,
      { v: 1, gameId, from: 'dm', to: String(device.player_id), epoch: keys.epoch, seq: Date.now() },
      content,
      keys.signingKey,
    )
  }
  await putRelayHandout(auth, row.handout_key, envelopes)
  db.prepare('UPDATE game_table_handouts SET content_hash = ? WHERE id = ?').run(hash, row.id)
}

async function runHandoutSync(db: Database.Database, tableId: number) {
  const errors = new Map<number, unknown>()
  const auth = getRelayAuth(db, tableId)
  const table = db.prepare('SELECT relay_game_id, e2e_keys FROM game_tables WHERE id = ?').get(tableId) as { relay_game_id: string, e2e_keys: string | null } | undefined
  if (!auth || !table?.e2e_keys) return errors

  let keys: LoadedGameKeys | null = null
  const getKeys = async () => (keys ??= await loadGameKeys(JSON.parse(table.e2e_keys!) as StoredGameKeys))
  const rows = db.prepare('SELECT * FROM game_table_handouts WHERE game_table_id = ?').all(tableId) as HandoutRow[]
  for (const row of rows) {
    // One broken handout must not block the others
    try {
      await syncHandout(db, auth, tableId, table.relay_game_id, row, getKeys)
    }
    catch (error) {
      console.error(`[Handout] Sync of handout ${row.id} failed:`, error)
      errors.set(row.id, error)
    }
  }
  return errors
}

/** Sync all handouts of a game. Returns the errors per handout id (empty = all fine). */
export function syncTableHandouts(db: Database.Database, tableId: number) {
  return withTableLock(tableId, () => runHandoutSync(db, tableId))
}
