import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type Database from 'better-sqlite3'
import { loadGameKeys, seal, type EnvelopeHeader, type LoadedGameKeys, type StoredGameKeys } from '@dm-hero/seal'
import { EMPTY_FOG, normalizeFog, type MapFog, type TableFogContent, type TableMapContent } from '~~/types/fog'
import type { SharedFileRef } from '~~/types/share'
import { getUploadPath } from '../paths'
import { deleteRelayFile, deleteRelayState, getRelayAuth, putRelayState, type RelayAuth } from '../relay'
import { encryptAndUploadImage } from './files'
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

const hash = (value: string) => createHash('sha256').update(value).digest('hex')

// Big but readable on a tablet - smaller steps if a map is huge
const IMAGE_STEPS = [
  { width: 3072, quality: 80 },
  { width: 2400, quality: 75 },
  { width: 1600, quality: 70 },
] as const

// A failed upload (relay down, storage full) isn't retried every 5 s - re-encoding
// a big map costs real CPU. Waits 30 s, doubling up to 5 min. A new image or
// "show" from the DM tries right away.
const RETRY_MIN_MS = 30_000
const RETRY_MAX_MS = 5 * 60_000
const uploadBackoff = new Map<number, { source: string, mapId: number, until: number, delay: number }>()

function waitingAfterFailure(tableId: number, mapId: number, source: string) {
  const backoff = uploadBackoff.get(tableId)
  return !!backoff && backoff.mapId === mapId && backoff.source === source && Date.now() < backoff.until
}

function noteFailure(tableId: number, mapId: number, source: string) {
  const previous = uploadBackoff.get(tableId)
  const delay = previous?.mapId === mapId && previous.source === source ? Math.min(previous.delay * 2, RETRY_MAX_MS) : RETRY_MIN_MS
  uploadBackoff.set(tableId, { mapId, source, delay, until: Date.now() + delay })
}

async function uploadMapImage(auth: RelayAuth, mapId: number, source: string): Promise<MapState> {
  const uploaded = await encryptAndUploadImage(auth, await readFile(join(getUploadPath(), source)), IMAGE_STEPS)
  return { mapId, source, file: uploaded.ref, width: uploaded.width, height: uploaded.height }
}

async function withdrawMap(db: Database.Database, auth: RelayAuth, tableId: number, state: MapState | null) {
  await deleteRelayState(auth, 'map')
  await deleteRelayState(auth, 'fog')
  if (state) await deleteRelayFile(auth, state.file.fileId).catch(error => console.error('[Relay] Map file delete failed:', error))
  db.prepare('UPDATE game_tables SET map_state = NULL, map_hash = NULL, fog_hash = NULL WHERE id = ?').run(tableId)
}

async function runMapSync(db: Database.Database, tableId: number, force: boolean) {
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
    uploadBackoff.delete(tableId)
    if (state || table.map_hash || table.fog_hash) await withdrawMap(db, auth, tableId, state)
    return
  }

  // Other map or new image -> upload once (the uploaded file is remembered), then remove the old file
  if (!state || state.mapId !== map.id || state.source !== map.image_url) {
    if (!force && waitingAfterFailure(tableId, map.id, map.image_url)) return
    const previous = state
    try {
      state = await uploadMapImage(auth, map.id, map.image_url)
    }
    catch (error) {
      noteFailure(tableId, map.id, map.image_url)
      throw error
    }
    uploadBackoff.delete(tableId)
    db.prepare('UPDATE game_tables SET map_state = ?, map_hash = NULL WHERE id = ?').run(JSON.stringify(state), tableId)
    table.map_hash = null
    if (previous) await deleteRelayFile(auth, previous.file.fileId).catch(error => console.error('[Relay] Map file delete failed:', error))
  }

  // Keys only when something is actually sent
  let keys: LoadedGameKeys | null = null
  const sealed = async (content: TableMapContent | TableFogContent) => {
    keys ??= await loadGameKeys(JSON.parse(table.e2e_keys!) as StoredGameKeys)
    const header: EnvelopeHeader = { v: 1, gameId: table.relay_game_id, from: 'dm', to: 'all', epoch: keys.epoch, seq: Date.now() }
    return seal(keys.gameKey, header, content, keys.signingKey)
  }

  // Fog first: a new map must never show up before its fog. Hash of the stored text - no parsing when unchanged.
  const fogText = (db.prepare('SELECT fog FROM map_fog WHERE map_id = ?').get(map.id) as { fog: string } | undefined)?.fog ?? null
  const fogHash = hash(`${map.id}:${fogText}`)
  if (fogHash !== table.fog_hash) {
    const fog: TableFogContent = { kind: 'fog', mapId: map.id, fog: fogText ? normalizeFog(JSON.parse(fogText) as MapFog) : EMPTY_FOG }
    await putRelayState(auth, 'fog', await sealed(fog))
    db.prepare('UPDATE game_tables SET fog_hash = ? WHERE id = ?').run(fogHash, tableId)
  }

  const content: TableMapContent = { kind: 'map', mapId: map.id, name: map.name, image: state.file, width: state.width, height: state.height }
  const mapHash = hash(JSON.stringify(content))
  if (mapHash !== table.map_hash) {
    await putRelayState(auth, 'map', await sealed(content))
    db.prepare('UPDATE game_tables SET map_hash = ? WHERE id = ?').run(mapHash, tableId)
  }
}

/** Bring the players' map + fog up to date (no-op when nothing changed). force: ignore the retry pause. */
export function syncTableMap(db: Database.Database, tableId: number, { force = false } = {}) {
  return withTableLock(tableId, () => runMapSync(db, tableId, force))
}

/** Fog of a map changed - send it to every game showing that map */
export async function syncMapFog(db: Database.Database, mapId: number) {
  const tables = db.prepare('SELECT id FROM game_tables WHERE shown_map_id = ?').all(mapId) as Array<{ id: number }>
  for (const { id } of tables) {
    await syncTableMap(db, id).catch(error => console.error('[Relay] Fog sync failed:', error))
  }
}
