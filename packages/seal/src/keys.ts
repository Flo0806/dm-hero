import { fromBase64Url, toBase64Url, utf8 } from './encoding'

// Standard WebCrypto building blocks only: AES-GCM 256, ECDSA + ECDH on P-256, HKDF-SHA-256.
// Works the same in browsers and Node (globalThis.crypto).
const subtle = globalThis.crypto.subtle
const CURVE = { namedCurve: 'P-256' } as const

/** Game key: encrypts everything that goes to all players */
export function generateGameKey(): Promise<CryptoKey> {
  return subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
}

/** DM signing key pair: proves "this really comes from the DM" */
export function generateSigningKeyPair(): Promise<CryptoKeyPair> {
  return subtle.generateKey({ name: 'ECDSA', ...CURVE }, true, ['sign', 'verify'])
}

/** Key exchange pair (DM and every player): basis for keys only two parties share */
export function generateExchangeKeyPair(): Promise<CryptoKeyPair> {
  return subtle.generateKey({ name: 'ECDH', ...CURVE }, true, ['deriveKey'])
}

/** Player device key pair: the private key can't be exported - it never leaves the browser */
export function generateDeviceKeyPair(): Promise<CryptoKeyPair> {
  return subtle.generateKey({ name: 'ECDH', ...CURVE }, false, ['deriveKey'])
}

export async function exportPublicKey(key: CryptoKey): Promise<string> {
  return toBase64Url(new Uint8Array(await subtle.exportKey('spki', key)))
}

export function importVerifyKey(value: string): Promise<CryptoKey> {
  return subtle.importKey('spki', fromBase64Url(value), { name: 'ECDSA', ...CURVE }, true, ['verify'])
}

export function importExchangePublicKey(value: string): Promise<CryptoKey> {
  return subtle.importKey('spki', fromBase64Url(value), { name: 'ECDH', ...CURVE }, true, [])
}

/**
 * Key shared by exactly two parties (DM <-> one player), derived from one side's
 * private and the other side's public exchange key. Both sides get the same key.
 */
export async function derivePairKey(ownPrivate: CryptoKey, otherPublic: CryptoKey, gameId: string): Promise<CryptoKey> {
  const secret = await subtle.deriveKey(
    { name: 'ECDH', public: otherPublic },
    ownPrivate,
    { name: 'HKDF' },
    false,
    ['deriveKey'],
  )
  return subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: utf8(`dm-hero/seal/v1/${gameId}`), info: utf8('pair') },
    secret,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  )
}

/** A fresh game key for the same game (rotation) - signing and exchange keys stay, the epoch goes up */
export async function rotateGameKey(stored: StoredGameKeys): Promise<StoredGameKeys> {
  const gameKey = await generateGameKey()
  return { ...stored, epoch: (stored.epoch ?? 1) + 1, gameKey: toBase64Url(new Uint8Array(await subtle.exportKey('raw', gameKey))) }
}

// Storage on the DM's machine (DM Hero database). Private keys never go to the relay.

export interface StoredGameKeys {
  /** Generation of the game key - increases on every rotation (player removed, PIN rolled) */
  epoch?: number
  gameKey: string
  signing: { privateKey: JsonWebKey, publicKey: string }
  exchange: { privateKey: JsonWebKey, publicKey: string }
}

export interface LoadedGameKeys {
  epoch: number
  gameKey: CryptoKey
  signingKey: CryptoKey
  exchangeKey: CryptoKey
  /** Public keys (spki, base64url) - safe to share with the relay and players */
  publicKeys: { signing: string, exchange: string }
}

/** All keys the DM needs for a new game, in a storable (JSON) form */
export async function createGameKeys(): Promise<StoredGameKeys> {
  const [gameKey, signing, exchange] = await Promise.all([generateGameKey(), generateSigningKeyPair(), generateExchangeKeyPair()])
  return {
    epoch: 1,
    gameKey: toBase64Url(new Uint8Array(await subtle.exportKey('raw', gameKey))),
    signing: { privateKey: await subtle.exportKey('jwk', signing.privateKey), publicKey: await exportPublicKey(signing.publicKey) },
    exchange: { privateKey: await subtle.exportKey('jwk', exchange.privateKey), publicKey: await exportPublicKey(exchange.publicKey) },
  }
}

export async function loadGameKeys(stored: StoredGameKeys): Promise<LoadedGameKeys> {
  return {
    epoch: stored.epoch ?? 1,
    gameKey: await subtle.importKey('raw', fromBase64Url(stored.gameKey), { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']),
    signingKey: await subtle.importKey('jwk', stored.signing.privateKey, { name: 'ECDSA', ...CURVE }, false, ['sign']),
    exchangeKey: await subtle.importKey('jwk', stored.exchange.privateKey, { name: 'ECDH', ...CURVE }, false, ['deriveKey']),
    publicKeys: { signing: stored.signing.publicKey, exchange: stored.exchange.publicKey },
  }
}
