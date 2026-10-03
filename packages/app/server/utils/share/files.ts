import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type Database from 'better-sqlite3'
import sharp from 'sharp'
import { encryptFile } from '@dm-hero/seal'
import type { SharedFileRef } from '~~/types/share'
import { getUploadPath } from '../paths'
import { deleteRelayFile, putRelayFile, type RelayAuth } from '../relay'

// Images for shares: resized (small preview + view size), encrypted with a key of
// their own and uploaded to the relay. Uploaded once per image - unchanged
// images are reused, a new image replaces the old files.

const VARIANTS = {
  thumb: { width: 160, quality: 75 },
  full: { width: 1200, quality: 82 },
} as const

type Variant = keyof typeof VARIANTS

interface FileRow {
  variant: Variant
  file_id: string
  file_key: string
  iv: string
  mime: string
}

const toRef = (row: FileRow): SharedFileRef => ({ fileId: row.file_id, key: row.file_key, iv: row.iv, mime: row.mime })

/** Thumb + full refs for an image (uploads it if this share hasn't got it yet) */
export async function ensureShareImage(db: Database.Database, auth: RelayAuth, shareId: number, source: string) {
  const existing = db.prepare('SELECT variant, file_id, file_key, iv, mime FROM game_table_share_files WHERE share_id = ? AND source = ?')
    .all(shareId, source) as FileRow[]
  const byVariant = new Map(existing.map(row => [row.variant, row]))

  const original = await readFile(join(getUploadPath(), source))
  for (const variant of Object.keys(VARIANTS) as Variant[]) {
    if (byVariant.has(variant)) continue
    const { width, quality } = VARIANTS[variant]
    const webp = await sharp(original).rotate().resize({ width, withoutEnlargement: true }).webp({ quality }).toBuffer()
    const { ciphertext, fileKey } = await encryptFile(new Uint8Array(webp))
    const row: FileRow = { variant, file_id: randomBytes(16).toString('hex'), file_key: fileKey.key, iv: fileKey.iv, mime: 'image/webp' }

    await putRelayFile(auth, row.file_id, ciphertext)
    db.prepare('INSERT INTO game_table_share_files (share_id, source, variant, file_id, file_key, iv, mime, size) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(shareId, source, variant, row.file_id, row.file_key, row.iv, row.mime, ciphertext.length)
    byVariant.set(variant, row)
  }

  // Older images of this share are no longer needed
  await removeShareFiles(db, auth, shareId, source)
  return { thumb: toRef(byVariant.get('thumb')!), full: toRef(byVariant.get('full')!) }
}

/** Remove a share's files on the relay and locally - all, or all except one source */
export async function removeShareFiles(db: Database.Database, auth: RelayAuth, shareId: number, keepSource: string | null = null) {
  const rows = db.prepare('SELECT id, file_id FROM game_table_share_files WHERE share_id = ? AND source IS NOT ?')
    .all(shareId, keepSource) as Array<{ id: number, file_id: string }>
  for (const row of rows) {
    await deleteRelayFile(auth, row.file_id).catch(error => console.error('[Relay] File delete failed:', error))
    db.prepare('DELETE FROM game_table_share_files WHERE id = ?').run(row.id)
  }
}
