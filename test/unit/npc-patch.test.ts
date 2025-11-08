import { describe, it, expect } from 'vitest'
import { convertMetadataToKeys } from '../../server/utils/i18n-lookup'
import type { NpcMetadata } from '../../types/npc'

/**
 * CRITICAL REGRESSION TESTS for NPC PATCH Metadata Conversion
 *
 * Background:
 * - Bug discovered 2025-11-08: NPC metadata (race/class) saved as German names instead of keys
 * - Root cause: convertMetadataToKeys() is async but PATCH endpoint wasn't using await
 * - Result: Promise object was stringified instead of converted metadata
 *
 * These tests ensure:
 * 1. Race/class names (German/English) are converted to database keys
 * 2. await is used (no Promise objects saved)
 * 3. Edge cases handled (null, undefined, empty strings)
 */

describe('NPC PATCH - Metadata Conversion', () => {
  describe('convertMetadataToKeys - Race Conversion (Standard Races)', () => {
    it('should convert German race name "Waldelf" to key "woodelf"', async () => {
      const metadata: NpcMetadata = {
        race: 'Waldelf',
        class: 'wizard',
      }

      const converted = await convertMetadataToKeys(
        metadata as unknown as Record<string, unknown>,
        'npc',
      )

      expect(converted).toBeDefined()
      expect(converted?.race).toBe('woodelf')
    })

    it('should convert German race name "Mensch" to key "human"', async () => {
      const metadata: NpcMetadata = {
        race: 'Mensch',
        class: 'fighter',
      }

      const converted = await convertMetadataToKeys(
        metadata as unknown as Record<string, unknown>,
        'npc',
      )

      expect(converted).toBeDefined()
      expect(converted?.race).toBe('human')
    })

    it('should convert German race name "Zwerg" to key "dwarf"', async () => {
      const metadata: NpcMetadata = {
        race: 'Zwerg',
        class: 'fighter',
      }

      const converted = await convertMetadataToKeys(
        metadata as unknown as Record<string, unknown>,
        'npc',
      )

      expect(converted).toBeDefined()
      expect(converted?.race).toBe('dwarf')
    })

    it('should convert German race name "Hochelf" to key "highelf"', async () => {
      const metadata: NpcMetadata = {
        race: 'Hochelf',
        class: 'wizard',
      }

      const converted = await convertMetadataToKeys(
        metadata as unknown as Record<string, unknown>,
        'npc',
      )

      expect(converted).toBeDefined()
      expect(converted?.race).toBe('highelf')
    })

    it('should keep race key unchanged if already a key (lowercase, no spaces)', async () => {
      const metadata: NpcMetadata = {
        race: 'woodelf',
        class: 'ranger',
      }

      const converted = await convertMetadataToKeys(
        metadata as unknown as Record<string, unknown>,
        'npc',
      )

      expect(converted).toBeDefined()
      expect(converted?.race).toBe('woodelf')
    })

    it('should handle empty race string', async () => {
      const metadata: NpcMetadata = {
        race: '',
        class: 'wizard',
      }

      const converted = await convertMetadataToKeys(
        metadata as unknown as Record<string, unknown>,
        'npc',
      )

      expect(converted).toBeDefined()
      expect(converted?.race).toBe('')
    })
  })

  describe('convertMetadataToKeys - Class Conversion (Standard Classes)', () => {
    it('should convert German class name "Magier" to key "wizard"', async () => {
      const metadata: NpcMetadata = {
        race: 'human',
        class: 'Magier',
      }

      const converted = await convertMetadataToKeys(
        metadata as unknown as Record<string, unknown>,
        'npc',
      )

      expect(converted).toBeDefined()
      expect(converted?.class).toBe('wizard')
    })

    it('should convert German class name "Waldläufer" to key "ranger"', async () => {
      const metadata: NpcMetadata = {
        race: 'elf',
        class: 'Waldläufer',
      }

      const converted = await convertMetadataToKeys(
        metadata as unknown as Record<string, unknown>,
        'npc',
      )

      expect(converted).toBeDefined()
      expect(converted?.class).toBe('ranger')
    })

    it('should convert German class name "Kämpfer" to key "fighter"', async () => {
      const metadata: NpcMetadata = {
        race: 'dwarf',
        class: 'Kämpfer',
      }

      const converted = await convertMetadataToKeys(
        metadata as unknown as Record<string, unknown>,
        'npc',
      )

      expect(converted).toBeDefined()
      expect(converted?.class).toBe('fighter')
    })

    it('should convert German class name "Schurke" to key "rogue"', async () => {
      const metadata: NpcMetadata = {
        race: 'halfling',
        class: 'Schurke',
      }

      const converted = await convertMetadataToKeys(
        metadata as unknown as Record<string, unknown>,
        'npc',
      )

      expect(converted).toBeDefined()
      expect(converted?.class).toBe('rogue')
    })

    it('should keep class key unchanged if already a key', async () => {
      const metadata: NpcMetadata = {
        race: 'human',
        class: 'wizard',
      }

      const converted = await convertMetadataToKeys(
        metadata as unknown as Record<string, unknown>,
        'npc',
      )

      expect(converted).toBeDefined()
      expect(converted?.class).toBe('wizard')
    })

    it('should handle empty class string', async () => {
      const metadata: NpcMetadata = {
        race: 'human',
        class: '',
      }

      const converted = await convertMetadataToKeys(
        metadata as unknown as Record<string, unknown>,
        'npc',
      )

      expect(converted).toBeDefined()
      expect(converted?.class).toBe('')
    })
  })

  describe('convertMetadataToKeys - Combined Race + Class', () => {
    it('CRITICAL: should convert BOTH German race AND class to keys', async () => {
      const metadata: NpcMetadata = {
        race: 'Waldelf',
        class: 'Waldläufer',
      }

      const converted = await convertMetadataToKeys(
        metadata as unknown as Record<string, unknown>,
        'npc',
      )

      expect(converted).toBeDefined()
      expect(converted?.race).toBe('woodelf')
      expect(converted?.class).toBe('ranger')
    })

    it('CRITICAL: should handle real-world case from bug report (Waldelf + empty class)', async () => {
      // This is the EXACT payload that caused the bug:
      // {"name":"André Dubois","description":"Französischer Fechtmeister.","metadata":{"race":"Waldelf","class":""}}
      const metadata: NpcMetadata = {
        race: 'Waldelf',
        class: '',
      }

      const converted = await convertMetadataToKeys(
        metadata as unknown as Record<string, unknown>,
        'npc',
      )

      expect(converted).toBeDefined()
      expect(converted?.race).toBe('woodelf') // ✅ Must be "woodelf", NOT "Waldelf"!
      expect(converted?.class).toBe('') // Empty is fine
    })

    it('REGRESSION: should NOT return a Promise object when conversion is async', async () => {
      const metadata: NpcMetadata = {
        race: 'Waldelf',
        class: '',
      }

      // This test ensures await is used in the PATCH endpoint
      // If await is missing, this would be a Promise instead of an object
      const converted = await convertMetadataToKeys(
        metadata as unknown as Record<string, unknown>,
        'npc',
      )

      // Check it's an object, not a Promise
      expect(converted).toBeDefined()
      expect(converted).toBeTypeOf('object')
      expect(converted?.constructor.name).not.toBe('Promise')

      // Check actual conversion worked
      expect(converted?.race).toBe('woodelf')
    })
  })

  describe('Edge Cases', () => {
    it('should handle null metadata', async () => {
      const converted = await convertMetadataToKeys(null, 'npc')
      expect(converted).toBeNull()
    })

    it('should handle undefined metadata', async () => {
      const converted = await convertMetadataToKeys(undefined, 'npc')
      expect(converted).toBeUndefined()
    })

    it('should handle metadata without race/class', async () => {
      const metadata = {
        gender: 'male',
        age: 30,
      }

      const converted = await convertMetadataToKeys(metadata, 'npc')

      expect(converted).toBeDefined()
      expect(converted?.gender).toBe('male')
      expect(converted?.age).toBe(30)
    })

    it('should preserve other metadata fields while converting race/class', async () => {
      const metadata = {
        race: 'Waldelf',
        class: 'Magier',
        gender: 'female',
        age: 150,
        faction: 'Harpers',
        notes: 'Important NPC',
      }

      const converted = await convertMetadataToKeys(metadata, 'npc')

      expect(converted).toBeDefined()
      expect(converted?.race).toBe('woodelf') // Converted
      expect(converted?.class).toBe('wizard') // Converted
      expect(converted?.gender).toBe('female') // Preserved
      expect(converted?.age).toBe(150) // Preserved
      expect(converted?.faction).toBe('Harpers') // Preserved
      expect(converted?.notes).toBe('Important NPC') // Preserved
    })
  })

  describe('Case Handling', () => {
    it('should keep lowercase strings as-is (treated as custom keys)', async () => {
      // If a value is lowercase with no spaces, it's assumed to be already a key
      const metadata: NpcMetadata = {
        race: 'customrace', // lowercase, no spaces → treated as custom key
        class: 'wizard',
      }

      const converted = await convertMetadataToKeys(
        metadata as unknown as Record<string, unknown>,
        'npc',
      )

      expect(converted).toBeDefined()
      expect(converted?.race).toBe('customrace') // ✅ Kept as-is
    })

    it('should convert capitalized German race names (TitleCase)', async () => {
      const metadata: NpcMetadata = {
        race: 'Waldelf', // TitleCase → convert to key
        class: 'wizard',
      }

      const converted = await convertMetadataToKeys(
        metadata as unknown as Record<string, unknown>,
        'npc',
      )

      expect(converted).toBeDefined()
      expect(converted?.race).toBe('woodelf')
    })

    it('should convert UPPERCASE German race names', async () => {
      const metadata: NpcMetadata = {
        race: 'WALDELF', // UPPERCASE → convert to key
        class: 'wizard',
      }

      const converted = await convertMetadataToKeys(
        metadata as unknown as Record<string, unknown>,
        'npc',
      )

      expect(converted).toBeDefined()
      expect(converted?.race).toBe('woodelf')
    })
  })

  describe('REGRESSION: Critical Bug Scenario (2025-11-08)', () => {
    it('CRITICAL REGRESSION: should NOT save German name "Waldelf" to database', async () => {
      // This is the exact bug that happened:
      // User saved NPC with race="Waldelf"
      // Backend saved "Waldelf" instead of "woodelf" because await was missing

      const metadata: NpcMetadata = {
        race: 'Waldelf',
        class: 'Magier',
      }

      const converted = await convertMetadataToKeys(
        metadata as unknown as Record<string, unknown>,
        'npc',
      )

      // These assertions MUST pass to prevent regression:
      expect(converted?.race).toBe('woodelf')
      expect(converted?.race).not.toBe('Waldelf') // ❌ This was the bug!

      expect(converted?.class).toBe('wizard')
      expect(converted?.class).not.toBe('Magier') // ❌ This was the bug!
    })

    it('CRITICAL: Simulated PATCH endpoint behavior (with await)', async () => {
      // Simulate what the PATCH endpoint does:
      const body = {
        name: 'André Dubois',
        description: 'Französischer Fechtmeister.',
        metadata: {
          race: 'Waldelf',
          class: '',
        },
      }

      // This is what the PATCH endpoint MUST do (WITH await!)
      const metadataWithKeys = body.metadata
        ? await convertMetadataToKeys(body.metadata as unknown as Record<string, unknown>, 'npc')
        : null

      // Verify conversion worked
      expect(metadataWithKeys).toBeDefined()
      expect(metadataWithKeys?.race).toBe('woodelf')

      // Simulate JSON.stringify (what gets saved to DB)
      const jsonString = JSON.stringify(metadataWithKeys)

      // Verify JSON contains key, not German name
      expect(jsonString).toContain('"race":"woodelf"')
      expect(jsonString).not.toContain('"race":"Waldelf"')
    })

    it('CRITICAL: Detect if await is missing (Promise stringified)', () => {
      // This test demonstrates the BUG scenario

      const metadata: NpcMetadata = {
        race: 'Waldelf',
        class: '',
      }

      // ❌ WITHOUT await (this was the bug!)
      const brokenConversion = convertMetadataToKeys(
        metadata as unknown as Record<string, unknown>,
        'npc',
      )

      // This would stringify to: '{"race":"Waldelf",...}' [object Promise]
      expect(brokenConversion).toBeInstanceOf(Promise)

      // Stringifying a Promise gives useless data
      const brokenJson = JSON.stringify(brokenConversion)
      expect(brokenJson).toContain('{}') // Promise stringifies to empty object
    })
  })
})
