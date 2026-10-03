import { exportPublicKey, generateDeviceKeyPair } from '@dm-hero/seal'

// One key pair per browser (= one device for the DM to approve), plus the DM's
// public keys per game - all in IndexedDB. CryptoKey objects are stored as-is,
// the private key stays non-extractable.

export interface DeviceKey {
  keyPair: CryptoKeyPair
  publicKey: string
}

export interface DmPublicKeys {
  signing: string
  exchange: string
}

const DB_NAME = 'dm-hero-player'
const STORE = 'game-keys'
const DEVICE_ID = 'device'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const request = action(db.transaction(STORE, mode).objectStore(STORE))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/** This browser's device key - created once, reused for every join (so the DM approves it only once) */
export async function getDeviceKey(): Promise<DeviceKey> {
  const existing = await run<DeviceKey | undefined>('readonly', store => store.get(DEVICE_ID))
  if (existing) return existing
  const keyPair = await generateDeviceKeyPair()
  const device = { keyPair, publicKey: await exportPublicKey(keyPair.publicKey) }
  await run('readwrite', store => store.put(device, DEVICE_ID))
  return device
}

export const saveDmPublicKeys = (gameId: string, keys: DmPublicKeys) => run('readwrite', store => store.put(keys, `dm:${gameId}`))

export const loadDmPublicKeys = (gameId: string) => run<DmPublicKeys | undefined>('readonly', store => store.get(`dm:${gameId}`))
