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
