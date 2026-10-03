import { exportPublicKey, generateDeviceKeyPair } from '@dm-hero/seal'

// This device's key pair + the DM's public keys, per game, in IndexedDB.
// CryptoKey objects are stored as-is - the private key stays non-extractable.

export interface DeviceGameKeys {
  keyPair: CryptoKeyPair
  publicKey: string
  dmPublicKeys: { signing: string, exchange: string }
}

const DB_NAME = 'dm-hero-player'
const STORE = 'game-keys'

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

/** New key pair for joining - stored once the join succeeded */
export async function createDeviceKeyPair() {
  const keyPair = await generateDeviceKeyPair()
  return { keyPair, publicKey: await exportPublicKey(keyPair.publicKey) }
}

export const saveDeviceGameKeys = (gameId: string, keys: DeviceGameKeys) => run('readwrite', store => store.put(keys, gameId))

export const loadDeviceGameKeys = (gameId: string) => run<DeviceGameKeys | undefined>('readonly', store => store.get(gameId))
