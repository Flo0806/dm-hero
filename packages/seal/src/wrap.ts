import { fromBase64Url, toBase64Url } from './encoding'
import { open, seal, type Envelope, type EnvelopeHeader } from './envelope'

const subtle = globalThis.crypto.subtle

/**
 * Hands the game key to ONE player: encrypted with the DM<->player pair key and
 * signed by the DM. The relay transports it but can't read it.
 */
export async function wrapGameKey(gameKey: CryptoKey, pairKey: CryptoKey, header: EnvelopeHeader, signingKey: CryptoKey): Promise<Envelope> {
  const raw = toBase64Url(new Uint8Array(await subtle.exportKey('raw', gameKey)))
  return seal(pairKey, header, { gameKey: raw }, signingKey)
}

/** Player side: unwraps the game key (checks the DM signature) */
export async function unwrapGameKey(envelope: Envelope, pairKey: CryptoKey, verifyKey: CryptoKey): Promise<CryptoKey> {
  const { gameKey } = await open<{ gameKey: string }>(pairKey, envelope, verifyKey)
  return subtle.importKey('raw', fromBase64Url(gameKey), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}
