import { utf8 } from './encoding'

// 64 easy-to-tell-apart symbols. 3 of them = 18 bit - enough to spot a stranger's
// device when DM and player compare them at the table, not meant as a password.
const SYMBOLS = [
  '🐉', '🗡️', '🛡️', '🏹', '🔮', '👑', '🍄', '🦉', '🐺', '🦄', '🐸', '🦂', '🕷️', '🐙', '🦇', '🐍',
  '🌙', '☀️', '⭐', '⚡', '🔥', '❄️', '🌊', '🌪️', '🌋', '🏔️', '🌲', '🌵', '🌹', '🍀', '🍎', '🍇',
  '💎', '🗝️', '⚔️', '🪓', '🔨', '⚗️', '📜', '🕯️', '🏰', '⛵', '🎲', '🎭', '🪕', '🥁', '🎺', '🔔',
  '🦅', '🐻', '🦊', '🐗', '🐢', '🦀', '🐝', '🦋', '🐲', '👻', '💀', '🧙', '🧝', '🧌', '🗿', '🪄',
] as const

/** Three symbols derived from a public key (base64url) - same result on DM and player side */
export async function fingerprint(publicKey: string): Promise<string[]> {
  const hash = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', utf8(publicKey)))
  // 18 bits from the first 3 bytes -> three 6-bit indexes
  const bits = (hash[0]! << 16) | (hash[1]! << 8) | hash[2]!
  return [(bits >> 12) & 63, (bits >> 6) & 63, bits & 63].map(i => SYMBOLS[i]!)
}
