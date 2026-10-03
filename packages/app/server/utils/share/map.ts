import { createHash, randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type Database from 'better-sqlite3'
import sharp from 'sharp'
import { encryptFile, loadGameKeys, seal, type EnvelopeHeader, type StoredGameKeys } from '@dm-hero/seal'
import { EMPTY_FOG, type MapFog, type TableFogContent, type TableMapContent } from '~~/types/fog'
import type { SharedFileRef } from '~~/types/share'
import { getUploadPath } from '../paths'
import { deleteRelayFile, deleteRelayState, getRelayAuth, putRelayFile, putRelayState, type RelayAuth } from '../relay'
import { withTableLock } from './sync'

// The one map the players see + its fog of war. Same idea as shares: one place
// compares what players have (hashes) with the current state and sends changes.

interface MapState {
  mapId: number
  source: string
  file: SharedFileRef
  width: number
  height: number
}

interface TableRow {
  relay_game_id: string
  e2e_keys: string | null
  shown_map_id: number | null
  map_state: string | null
  map_hash: string | null
  fog_hash: string | null
}

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')

// Big but readable on a tablet - and below the relay's 2 MB per file
const IMAGE_STEPS = [
  { width: 3072, quality: 80 },
  { width: 2400, quality: 75 },
  { width: 1600, quality: 70 },
]
const MAX_FILE_BYTES = 2 * 1024 * 1024 - 1024

async function uploadMapImage(auth: RelayAuth, mapId: number, source: string): Promise<MapState> {
  const original = await readFile(join(getUploadPath(), source))
  for (const step of IMAGE_STEPS) {
    const { data, info } = await sharp(original).rotate().resize({ width: step.width, withoutEnlargement: true })
      .webp({ quality: step.quality }).toBuffer({ resolveWithObject: true })
    if (data.length > MAX_FILE_BYTES) continue
    const { ciphertext, fileKey } = await encryptFile(new Uint8Array(data))
    const fileId = randomBytes(16).toString('hex')
    await putRelayFile(auth, fileId, ciphertext)
    return { mapId, source, file: { fileId, key: fileKey.key, iv: fileKey.iv, mime: 'image/webp' }, width: info.width, height: info.height }
  }
  throw createError({ statusCode: 413, message: 'Map image too large' })
}

async function withdrawMap(db: Database.Database, auth: RelayAuth, tableId: number, state: MapState | null) {
  await deleteRelayState(auth, 'map')
  await deleteRelayState(auth, 'fog')
  if (state) await deleteRelayFile(auth, state.file.fileId).catch(error => console.error('[Relay] Map file delete failed:', error))
  db.prepare('UPDATE game_tables SET map_state = NULL, map_hash = NULL, fog_hash = NULL WHERE id = ?').run(tableId)
}

async function runMapSync(db: Database.Database, tableId: number) {
  const auth = getRelayAuth(db, tableId)
  const table = db.prepare('SELECT relay_game_id, e2e_keys, shown_map_id, map_state, map_hash, fog_hash FROM game_tables WHERE id = ?')
    .get(tableId) as TableRow | undefined
  if (!auth || !table?.e2e_keys) return
  let state = table.map_state ? JSON.parse(table.map_state) as MapState : null

  const map = table.shown_map_id
    ? db.prepare('SELECT id, name, image_url FROM campaign_maps WHERE id = ? AND deleted_at IS NULL')
      .get(table.shown_map_id) as { id: number, name: string, image_url: string } | undefined
    : undefined

  // Nothing shown (anymore) -> players drop map + fog
  if (!map) {
    if (state || table.map_hash) await withdrawMap(db, auth, tableId, state)
    return
  }

  // Other map or new image -> upload, then remove the old file
  if (!state || state.mapId !== map.id || state.source !== map.image_url) {
    const previous = state
    state = await uploadMapImage(auth, map.id, map.image_url)
    db.prepare('UPDATE game_tables SET map_state = ?, map_hash = NULL WHERE id = ?').run(JSON.stringify(state), tableId)
    if (previous) await deleteRelayFile(auth, previous.file.fileId).catch(error => console.error('[Relay] Map file delete failed:', error))
  }

  const keys = await loadGameKeys(JSON.parse(table.e2e_keys) as StoredGameKeys)
  const header = (): EnvelopeHeader => ({ v: 1, gameId: table.relay_game_id, from: 'dm', to: 'all', epoch: keys.epoch, seq: Date.now() })

  // Fog first: a new map must never show up before its fog
  const fogRow = db.prepare('SELECT fog FROM map_fog WHERE map_id = ?').get(map.id) as { fog: string } | undefined
  const fog: TableFogContent = { mapId: map.id, fog: fogRow ? JSON.parse(fogRow.fog) as MapFog : EMPTY_FOG }
  const fogHash = hash(fog)
  if (fogHash !== table.fog_hash) {
    await putRelayState(auth, 'fog', await seal(keys.gameKey, header(), fog, keys.signingKey))
    db.prepare('UPDATE game_tables SET fog_hash = ? WHERE id = ?').run(fogHash, tableId)
  }

  const content: TableMapContent = { mapId: map.id, name: map.name, image: state.file, width: state.width, height: state.height }
  const mapHash = hash(content)
  if (mapHash !== table.map_hash || !table.map_state) {
    await putRelayState(auth, 'map', await seal(keys.gameKey, header(), content, keys.signingKey))
    db.prepare('UPDATE game_tables SET map_hash = ? WHERE id = ?').run(mapHash, tableId)
  }
}

/** Bring the players' map + fog up to date (no-op when nothing changed) */
export function syncTableMap(db: Database.Database, tableId: number) {
  return withTableLock(tableId, () => runMapSync(db, tableId))
}

/** Fog of a map changed - send it to every game showing that map */
export async function syncMapFog(db: Database.Database, mapId: number) {
  const tables = db.prepare('SELECT id FROM game_tables WHERE shown_map_id = ?').all(mapId) as Array<{ id: number }>
  for (const { id } of tables) {
    await syncTableMap(db, id).catch(error => console.error('[Relay] Fog sync failed:', error))
  }
}
