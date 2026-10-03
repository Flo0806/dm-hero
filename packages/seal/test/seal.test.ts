import { describe, it, expect } from 'vitest'
import {
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
