import { fromBase64Url, toBase64Url } from './encoding'

// Files (images, later maps/documents) get their own random key. Key + iv travel
// inside the DM-signed share envelope, the relay only stores the ciphertext.
// AES-GCM detects any change to the bytes - no extra checksum needed.

const subtle = globalThis.crypto.subtle

export interface FileKey {
  key: string
  iv: string
}

export async function encryptFile(data: Uint8Array<ArrayBuffer>): Promise<{ ciphertext: Uint8Array, fileKey: FileKey }> {
  const key = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt'])
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, key, data))
  return {
    ciphertext,
    fileKey: { key: toBase64Url(new Uint8Array(await subtle.exportKey('raw', key))), iv: toBase64Url(iv) },
  }
}

export async function decryptFile(ciphertext: ArrayBuffer | Uint8Array<ArrayBuffer>, fileKey: FileKey): Promise<Uint8Array> {
  const key = await subtle.importKey('raw', fromBase64Url(fileKey.key), { name: 'AES-GCM' }, false, ['decrypt'])
  return new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: fromBase64Url(fileKey.iv) }, key, ciphertext))
}
