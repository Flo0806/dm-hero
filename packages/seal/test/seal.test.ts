import { describe, it, expect } from 'vitest'
import {
  createGameKeys, loadGameKeys, rotateGameKey, generateDeviceKeyPair, fingerprint, encryptFile, decryptFile,
  derivePairKey, exportPublicKey, generateExchangeKeyPair, generateGameKey, generateSigningKeyPair,
  importExchangePublicKey, importVerifyKey, open, seal, unwrapGameKey, wrapGameKey,
  type EnvelopeHeader,
} from '../src'

const header = (overrides: Partial<EnvelopeHeader> = {}): EnvelopeHeader =>
  ({ v: 1, gameId: 'game-1', from: 'dm', to: 'all', epoch: 1, seq: 1, ...overrides })

describe('seal envelopes', () => {
  it('round-trips content with the game key and checks the DM signature', async () => {
    const gameKey = await generateGameKey()
    const dm = await generateSigningKeyPair()
    const envelope = await seal(gameKey, header(), { text: 'Ein Drache! 🐉' }, dm.privateKey)
    expect(await open(gameKey, envelope, dm.publicKey)).toEqual({ text: 'Ein Drache! 🐉' })
  })

  it('fails with a wrong key', async () => {
    const envelope = await seal(await generateGameKey(), header(), { secret: true })
    await expect(open(await generateGameKey(), envelope)).rejects.toThrow()
  })

  it('detects a changed header (e.g. relay re-addressing a message)', async () => {
    const gameKey = await generateGameKey()
    const envelope = await seal(gameKey, header({ to: 'all' }), { text: 'hi' })
    await expect(open(gameKey, { ...envelope, header: { ...envelope.header, to: 'player-2' } })).rejects.toThrow()
  })

  it('detects forged DM messages (player has the game key but not the DM signing key)', async () => {
    const gameKey = await generateGameKey()
    const dm = await generateSigningKeyPair()
    const forger = await generateSigningKeyPair()
    const unsigned = await seal(gameKey, header(), { text: 'fake' })
    const wronglySigned = await seal(gameKey, header(), { text: 'fake' }, forger.privateKey)
    await expect(open(gameKey, unsigned, dm.publicKey)).rejects.toThrow('Invalid DM signature')
    await expect(open(gameKey, wronglySigned, dm.publicKey)).rejects.toThrow('Invalid DM signature')
  })
})

describe('handing the game key to one player', () => {
  it('only that player can unwrap it, verified as coming from the DM', async () => {
    const dmSign = await generateSigningKeyPair()
    const dmExchange = await generateExchangeKeyPair()
    const anna = await generateExchangeKeyPair()
    const bernd = await generateExchangeKeyPair()

    // Public keys travel as strings via the relay
    const annaPublic = await importExchangePublicKey(await exportPublicKey(anna.publicKey))
    const dmPublic = await importExchangePublicKey(await exportPublicKey(dmExchange.publicKey))
    const dmVerify = await importVerifyKey(await exportPublicKey(dmSign.publicKey))

    const gameKey = await generateGameKey()
    const dmSidePair = await derivePairKey(dmExchange.privateKey, annaPublic, 'game-1')
    const wrapped = await wrapGameKey(gameKey, dmSidePair, header({ to: 'anna' }), dmSign.privateKey)

    // Anna derives the same pair key from her side and can read game messages
    const annaPair = await derivePairKey(anna.privateKey, dmPublic, 'game-1')
    const annaGameKey = await unwrapGameKey(wrapped, annaPair, dmVerify)
    const message = await seal(gameKey, header(), { text: 'Willkommen' }, dmSign.privateKey)
    expect(await open(annaGameKey, message, dmVerify)).toEqual({ text: 'Willkommen' })

    // Bernd can't unwrap Anna's key package
    const berndPair = await derivePairKey(bernd.privateKey, dmPublic, 'game-1')
    await expect(unwrapGameKey(wrapped, berndPair, dmVerify)).rejects.toThrow()
  })

  it('pair keys are bound to the game', async () => {
    const dm = await generateExchangeKeyPair()
    const anna = await generateExchangeKeyPair()
    const inGame1 = await derivePairKey(dm.privateKey, anna.publicKey, 'game-1')
    const inGame2 = await derivePairKey(anna.privateKey, dm.publicKey, 'game-2')
    const envelope = await seal(inGame1, header({ to: 'anna' }), { text: 'privat' })
    await expect(open(inGame2, envelope)).rejects.toThrow()
  })
})

describe('stored game keys (DM Hero database)', () => {
  it('survive JSON storage and still work end to end', async () => {
    const stored = JSON.parse(JSON.stringify(await createGameKeys())) as Awaited<ReturnType<typeof createGameKeys>>
    const keys = await loadGameKeys(stored)
    const verify = await importVerifyKey(keys.publicKeys.signing)
    const envelope = await seal(keys.gameKey, header(), { text: 'nach Neustart' }, keys.signingKey)
    expect(await open(keys.gameKey, envelope, verify)).toEqual({ text: 'nach Neustart' })
  })

  it('public keys contain no private material', async () => {
    const stored = await createGameKeys()
    const keys = await loadGameKeys(stored)
    const publicJson = JSON.stringify(keys.publicKeys)
    expect(publicJson).not.toContain(stored.signing.privateKey.d!)
    expect(publicJson).not.toContain(stored.exchange.privateKey.d!)
    expect(publicJson).not.toContain(stored.gameKey)
  })
})

describe('player device keys', () => {
  it('private key cannot be exported, public key can', async () => {
    const device = await generateDeviceKeyPair()
    await expect(globalThis.crypto.subtle.exportKey('jwk', device.privateKey)).rejects.toThrow()
    expect(await exportPublicKey(device.publicKey)).toMatch(/^[\w-]{100,}$/)
  })
})

describe('device fingerprint', () => {
  it('is three symbols, stable for a key and different for another', async () => {
    const a = await exportPublicKey((await generateDeviceKeyPair()).publicKey)
    const b = await exportPublicKey((await generateDeviceKeyPair()).publicKey)
    const fa = await fingerprint(a)
    expect(fa).toHaveLength(3)
    expect(await fingerprint(a)).toEqual(fa)
    expect(await fingerprint(b)).not.toEqual(fa)
  })
})

describe('file encryption', () => {
  it('round-trips bytes and rejects tampering or a wrong key', async () => {
    const data = globalThis.crypto.getRandomValues(new Uint8Array(4096))
    const { ciphertext, fileKey } = await encryptFile(data)
    expect(await decryptFile(new Uint8Array(ciphertext), fileKey)).toEqual(data)

    const tampered = new Uint8Array(ciphertext)
    tampered[100] = tampered[100]! ^ 1
    await expect(decryptFile(tampered, fileKey)).rejects.toThrow()

    const other = (await encryptFile(data)).fileKey
    await expect(decryptFile(new Uint8Array(ciphertext), other)).rejects.toThrow()
  })
})

describe('game key rotation', () => {
  it('new key + higher epoch, signing and exchange keys stay', async () => {
    const stored = await createGameKeys()
    const rotated = await rotateGameKey(stored)
    expect(rotated.epoch).toBe(2)
    expect(rotated.gameKey).not.toBe(stored.gameKey)
    expect(rotated.signing).toEqual(stored.signing)
    expect(rotated.exchange).toEqual(stored.exchange)
    expect((await loadGameKeys(rotated)).epoch).toBe(2)
  })
})
