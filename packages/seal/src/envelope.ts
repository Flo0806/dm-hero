import { fromBase64Url, toBase64Url, utf8 } from './encoding'

const subtle = globalThis.crypto.subtle

/** Readable by the relay (routing). Bound to the content, so it can't be changed or replayed elsewhere. */
export interface EnvelopeHeader {
  v: 1
  gameId: string
  from: string
  /** 'all' (game key) or a player id (pair key) */
  to: string
  /** Game key generation - increases when a player is kicked */
  epoch: number
  /** Sender's running number, lets receivers drop replays */
  seq: number
}

export interface Envelope {
  header: EnvelopeHeader
  iv: string
  ciphertext: string
  /** DM signature (ECDSA) - set for everything the DM sends */
  signature?: string
}

// Fixed field order, so both sides authenticate the exact same bytes
const headerJson = (h: EnvelopeHeader) => JSON.stringify([h.v, h.gameId, h.from, h.to, h.epoch, h.seq])
const headerBytes = (h: EnvelopeHeader) => utf8(headerJson(h))
const signedBytes = (e: Omit<Envelope, 'signature'>) => utf8(`${headerJson(e.header)}.${e.iv}.${e.ciphertext}`)

/** Encrypts any JSON content. Header is authenticated (AES-GCM additional data). */
export async function seal(key: CryptoKey, header: EnvelopeHeader, content: unknown, signingKey?: CryptoKey): Promise<Envelope> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: headerBytes(header) },
    key,
    utf8(JSON.stringify(content)),
  )
  const envelope: Envelope = { header, iv: toBase64Url(iv), ciphertext: toBase64Url(new Uint8Array(ciphertext)) }
  if (signingKey) {
    const signature = await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signingKey, signedBytes(envelope))
    envelope.signature = toBase64Url(new Uint8Array(signature))
  }
  return envelope
}

/** Decrypts. Throws if the key is wrong, anything was changed, or a required DM signature is missing/invalid. */
export async function open<T>(key: CryptoKey, envelope: Envelope, verifyKey?: CryptoKey): Promise<T> {
  if (verifyKey) {
    const valid = envelope.signature !== undefined && await subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      verifyKey,
      fromBase64Url(envelope.signature),
      signedBytes(envelope),
    )
    if (!valid) throw new Error('Invalid DM signature')
  }
  const plaintext = await subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64Url(envelope.iv), additionalData: headerBytes(envelope.header) },
    key,
    fromBase64Url(envelope.ciphertext),
  )
  return JSON.parse(new TextDecoder().decode(plaintext)) as T
}
