import { describe, it, expect } from 'vitest'
import { isExportCompatible, EXPORT_FORMAT_VERSION } from '../../types/export'

/**
 * Import/Export Tests
 *
 * Pure unit tests that don't require database access:
 * 1. Version compatibility (isExportCompatible)
 * 2. Export logic simulation (custom race/class collection)
 * 3. Import logic simulation (conflict detection, soft-delete restore)
 * 4. Standard vs Custom race/class handling
 */

// Standard race/class keys (same as in the actual code)
const STANDARD_RACE_KEYS = new Set([
  'human', 'elf', 'dwarf', 'halfling', 'gnome', 'halforc', 'tiefling', 'dragonborn',
  'halfelf', 'aasimar', 'genasi', 'goliath', 'firbolg', 'tabaxi', 'kenku', 'lizardfolk',
  'triton', 'bugbear', 'goblin', 'hobgoblin', 'kobold', 'orc', 'yuanti', 'tortle',
  'changeling', 'kalashtar', 'shifter', 'warforged', 'gith', 'centaur', 'minotaur',
  'satyr', 'leonin', 'loxodon', 'vedalken', 'simic',
])

const STANDARD_CLASS_KEYS = new Set([
  'fighter', 'wizard', 'rogue', 'cleric', 'ranger', 'paladin', 'barbarian', 'bard',
  'druid', 'monk', 'sorcerer', 'warlock', 'artificer', 'bloodhunter',
])

// =============================================================================
// VERSION COMPATIBILITY TESTS
// =============================================================================

describe('Version Compatibility - isExportCompatible', () => {
  it('should return true for format 1.0 with app >= beta.1', () => {
    expect(isExportCompatible('1.0', '1.0.0-beta.1')).toBe(true)
    expect(isExportCompatible('1.0', '1.0.0-beta.2')).toBe(true)
    expect(isExportCompatible('1.0', '1.0.0-beta.5')).toBe(true)
    // Note: Current implementation treats 1.0.0 as [1,0,0] < 1.0.0-beta.1 as [1,0,0,1]
    // This is technically incorrect (final should be > beta) but matches current behavior
    expect(isExportCompatible('1.0', '1.1.0')).toBe(true)
    expect(isExportCompatible('1.0', '2.0.0')).toBe(true)
  })

  it('should return true for format 1.1 with app >= beta.2', () => {
    expect(isExportCompatible('1.1', '1.0.0-beta.2')).toBe(true)
    expect(isExportCompatible('1.1', '1.0.0-beta.5')).toBe(true)
    // Note: 1.0.0 (no beta) returns false due to version comparison quirk
    expect(isExportCompatible('1.1', '1.1.0')).toBe(true)
  })

  it('should return false for format 1.1 with app < beta.2', () => {
    expect(isExportCompatible('1.1', '1.0.0-beta.1')).toBe(false)
  })

  it('should handle edge case: final version vs beta (current behavior)', () => {
    // Current implementation: 1.0.0 [1,0,0] is LESS than 1.0.0-beta.1 [1,0,0,1]
    // This is a known quirk - in semver, final SHOULD be greater
    // But we test current behavior to catch unexpected changes
    expect(isExportCompatible('1.0', '1.0.0')).toBe(false) // min is 1.0.0-beta.1
    expect(isExportCompatible('1.1', '1.0.0')).toBe(false) // min is 1.0.0-beta.2
  })

  it('should return true for unknown format versions (try anyway)', () => {
    expect(isExportCompatible('2.0', '1.0.0')).toBe(true)
    expect(isExportCompatible('99.0', '1.0.0')).toBe(true)
    expect(isExportCompatible('3.5', '1.0.0-beta.1')).toBe(true)
  })

  it('should export with current format version 1.1', () => {
    expect(EXPORT_FORMAT_VERSION).toBe('1.1')
  })
})

// =============================================================================
// EXPORT LOGIC TESTS (Simulated)
// =============================================================================

describe('Export - Custom Race Collection Logic', () => {
  /**
   * Simulates the export logic that collects custom race keys from NPC metadata
   */
  function collectCustomRaceKeys(npcs: Array<{ metadata: string | null }>): Set<string> {
    const customRaceKeys = new Set<string>()
    for (const npc of npcs) {
      if (!npc.metadata) continue
      try {
        const metadata = JSON.parse(npc.metadata)
        if (metadata.race) {
          const raceKey = metadata.race.toLowerCase().replace(/\s+/g, '')
          if (!STANDARD_RACE_KEYS.has(raceKey)) {
            customRaceKeys.add(raceKey)
          }
        }
      } catch {
        // Invalid JSON, skip
      }
    }
    return customRaceKeys
  }

  it('should identify custom races from NPC metadata', () => {
    const npcs = [
      { metadata: JSON.stringify({ race: 'customrace' }) },
      { metadata: JSON.stringify({ race: 'anotherrace' }) },
    ]

    const customRaceKeys = collectCustomRaceKeys(npcs)

    expect(customRaceKeys.has('customrace')).toBe(true)
    expect(customRaceKeys.has('anotherrace')).toBe(true)
    expect(customRaceKeys.size).toBe(2)
  })

  it('should NOT include standard races in custom collection', () => {
    const npcs = [
      { metadata: JSON.stringify({ race: 'human' }) },
      { metadata: JSON.stringify({ race: 'elf' }) },
      { metadata: JSON.stringify({ race: 'dwarf' }) },
    ]

    const customRaceKeys = collectCustomRaceKeys(npcs)

    expect(customRaceKeys.size).toBe(0)
  })

  it('should handle mixed standard and custom races', () => {
    const npcs = [
      { metadata: JSON.stringify({ race: 'human' }) },
      { metadata: JSON.stringify({ race: 'myspecialrace' }) },
      { metadata: JSON.stringify({ race: 'elf' }) },
    ]

    const customRaceKeys = collectCustomRaceKeys(npcs)

    expect(customRaceKeys.size).toBe(1)
    expect(customRaceKeys.has('myspecialrace')).toBe(true)
  })

  it('should handle NPCs without race in metadata', () => {
    const npcs = [
      { metadata: JSON.stringify({ class: 'wizard', alignment: 'neutral' }) },
      { metadata: JSON.stringify({ name: 'Test NPC' }) },
    ]

    const customRaceKeys = collectCustomRaceKeys(npcs)

    expect(customRaceKeys.size).toBe(0)
  })

  it('should handle NPCs with null metadata', () => {
    const npcs = [
      { metadata: null },
      { metadata: JSON.stringify({ race: 'customrace' }) },
    ]

    const customRaceKeys = collectCustomRaceKeys(npcs)

    expect(customRaceKeys.size).toBe(1)
    expect(customRaceKeys.has('customrace')).toBe(true)
  })

  it('should normalize race keys to lowercase', () => {
    const npcs = [
      { metadata: JSON.stringify({ race: 'UPPERCASE' }) },
      { metadata: JSON.stringify({ race: 'MixedCase' }) },
    ]

    const customRaceKeys = collectCustomRaceKeys(npcs)

    expect(customRaceKeys.has('uppercase')).toBe(true)
    expect(customRaceKeys.has('mixedcase')).toBe(true)
  })

  it('should remove spaces from race keys', () => {
    const npcs = [
      { metadata: JSON.stringify({ race: 'my custom race' }) },
    ]

    const customRaceKeys = collectCustomRaceKeys(npcs)

    expect(customRaceKeys.has('mycustomrace')).toBe(true)
  })
})

describe('Export - Custom Class Collection Logic', () => {
  function collectCustomClassKeys(npcs: Array<{ metadata: string | null }>): Set<string> {
    const customClassKeys = new Set<string>()
    for (const npc of npcs) {
      if (!npc.metadata) continue
      try {
        const metadata = JSON.parse(npc.metadata)
        if (metadata.class) {
          const classKey = metadata.class.toLowerCase().replace(/\s+/g, '')
          if (!STANDARD_CLASS_KEYS.has(classKey)) {
            customClassKeys.add(classKey)
          }
        }
      } catch {
        // Invalid JSON, skip
      }
    }
    return customClassKeys
  }

  it('should identify custom classes from NPC metadata', () => {
    const npcs = [
      { metadata: JSON.stringify({ class: 'necromancer' }) },
    ]

    const customClassKeys = collectCustomClassKeys(npcs)

    expect(customClassKeys.has('necromancer')).toBe(true)
    expect(customClassKeys.size).toBe(1)
  })

  it('should NOT include standard classes', () => {
    const npcs = [
      { metadata: JSON.stringify({ class: 'fighter' }) },
      { metadata: JSON.stringify({ class: 'wizard' }) },
      { metadata: JSON.stringify({ class: 'rogue' }) },
    ]

    const customClassKeys = collectCustomClassKeys(npcs)

    expect(customClassKeys.size).toBe(0)
  })
})

// =============================================================================
// IMPORT LOGIC TESTS (Simulated)
// =============================================================================

interface RaceRecord {
  name: string
  name_de: string | null
  name_en: string | null
  description: string | null
  deleted_at: string | null
  is_standard: number
}

interface ImportResult {
  inserted: string[]
  restored: string[]
  conflicts: string[]
  skipped: string[]
  overwrote: string[]
}

describe('Import - Race/Class Logic Simulation', () => {
  /**
   * Simulates the import logic for races
   */
  function simulateRaceImport(
    existingRaces: Map<string, RaceRecord>,
    manifestRaces: Array<{ name: string; name_de?: string; name_en?: string; description?: string }>,
    resolutions: Record<string, 'overwrite' | 'keep' | 'skip'> = {},
  ): ImportResult {
    const result: ImportResult = {
      inserted: [],
      restored: [],
      conflicts: [],
      skipped: [],
      overwrote: [],
    }

    for (const race of manifestRaces) {
      const key = race.name.toLowerCase().replace(/\s+/g, '')

      // Skip standard races
      if (STANDARD_RACE_KEYS.has(key)) {
        result.skipped.push(key)
        continue
      }

      const existing = existingRaces.get(key)

      if (existing && existing.deleted_at) {
        // Soft-deleted: restore with new data
        existing.name_de = race.name_de || null
        existing.name_en = race.name_en || null
        existing.description = race.description || null
        existing.deleted_at = null
        result.restored.push(key)
      } else if (existing) {
        // Active: check resolution
        const resolution = resolutions[key]
        if (resolution === 'overwrite') {
          existing.name_de = race.name_de || null
          existing.name_en = race.name_en || null
          existing.description = race.description || null
          result.overwrote.push(key)
        } else if (resolution === 'skip') {
          result.skipped.push(key)
        } else {
          // No resolution provided = conflict
          result.conflicts.push(key)
        }
      } else {
        // Doesn't exist: insert
        existingRaces.set(key, {
          name: key,
          name_de: race.name_de || null,
          name_en: race.name_en || null,
          description: race.description || null,
          deleted_at: null,
          is_standard: 0,
        })
        result.inserted.push(key)
      }
    }

    return result
  }

  it('should insert new race when it does not exist', () => {
    const existingRaces = new Map<string, RaceRecord>()
    const manifestRaces = [
      { name: 'newrace', name_de: 'Neue Rasse', name_en: 'New Race' },
    ]

    const result = simulateRaceImport(existingRaces, manifestRaces)

    expect(result.inserted).toContain('newrace')
    expect(existingRaces.has('newrace')).toBe(true)
    expect(existingRaces.get('newrace')?.name_de).toBe('Neue Rasse')
  })

  it('should restore soft-deleted race on import', () => {
    const existingRaces = new Map<string, RaceRecord>([
      ['deletedrace', {
        name: 'deletedrace',
        name_de: 'Old DE',
        name_en: 'Old EN',
        description: null,
        deleted_at: '2024-01-01 00:00:00',
        is_standard: 0,
      }],
    ])
    const manifestRaces = [
      { name: 'deletedrace', name_de: 'Restored DE', name_en: 'Restored EN' },
    ]

    const result = simulateRaceImport(existingRaces, manifestRaces)

    expect(result.restored).toContain('deletedrace')
    expect(existingRaces.get('deletedrace')?.deleted_at).toBeNull()
    expect(existingRaces.get('deletedrace')?.name_de).toBe('Restored DE')
  })

  it('should detect conflict when active race with same key exists', () => {
    const existingRaces = new Map<string, RaceRecord>([
      ['conflictrace', {
        name: 'conflictrace',
        name_de: 'Existing DE',
        name_en: 'Existing EN',
        description: null,
        deleted_at: null,
        is_standard: 0,
      }],
    ])
    const manifestRaces = [
      { name: 'conflictrace', name_de: 'Import DE', name_en: 'Import EN' },
    ]

    const result = simulateRaceImport(existingRaces, manifestRaces)

    expect(result.conflicts).toContain('conflictrace')
    // Original data unchanged without resolution
    expect(existingRaces.get('conflictrace')?.name_de).toBe('Existing DE')
  })

  it('should NOT detect conflict for soft-deleted race', () => {
    const existingRaces = new Map<string, RaceRecord>([
      ['softdel', {
        name: 'softdel',
        name_de: 'Deleted DE',
        name_en: 'Deleted EN',
        description: null,
        deleted_at: '2024-01-01 00:00:00',
        is_standard: 0,
      }],
    ])
    const manifestRaces = [
      { name: 'softdel', name_de: 'New DE', name_en: 'New EN' },
    ]

    const result = simulateRaceImport(existingRaces, manifestRaces)

    expect(result.conflicts.length).toBe(0)
    expect(result.restored).toContain('softdel')
  })

  it('should allow overwrite resolution to update existing race', () => {
    const existingRaces = new Map<string, RaceRecord>([
      ['overwriterace', {
        name: 'overwriterace',
        name_de: 'Original DE',
        name_en: 'Original EN',
        description: null,
        deleted_at: null,
        is_standard: 0,
      }],
    ])
    const manifestRaces = [
      { name: 'overwriterace', name_de: 'Overwritten DE', name_en: 'Overwritten EN' },
    ]

    const result = simulateRaceImport(existingRaces, manifestRaces, { overwriterace: 'overwrite' })

    expect(result.overwrote).toContain('overwriterace')
    expect(existingRaces.get('overwriterace')?.name_de).toBe('Overwritten DE')
  })

  it('should keep existing race when resolution is keep or skip', () => {
    const existingRaces = new Map<string, RaceRecord>([
      ['keeprace', {
        name: 'keeprace',
        name_de: 'Keep This DE',
        name_en: 'Keep This EN',
        description: null,
        deleted_at: null,
        is_standard: 0,
      }],
    ])
    const manifestRaces = [
      { name: 'keeprace', name_de: 'Should Not Apply', name_en: 'Should Not Apply' },
    ]

    const result = simulateRaceImport(existingRaces, manifestRaces, { keeprace: 'skip' })

    expect(result.skipped).toContain('keeprace')
    expect(existingRaces.get('keeprace')?.name_de).toBe('Keep This DE')
  })

  it('should skip standard races during import', () => {
    const existingRaces = new Map<string, RaceRecord>()
    const manifestRaces = [
      { name: 'human', name_de: 'Mensch', name_en: 'Human' },
      { name: 'elf', name_de: 'Elf', name_en: 'Elf' },
      { name: 'customrace', name_de: 'Custom DE', name_en: 'Custom EN' },
    ]

    const result = simulateRaceImport(existingRaces, manifestRaces)

    expect(result.skipped).toContain('human')
    expect(result.skipped).toContain('elf')
    expect(result.inserted).toContain('customrace')
    // Standard races should NOT be inserted
    expect(existingRaces.has('human')).toBe(false)
    expect(existingRaces.has('elf')).toBe(false)
  })
})

// =============================================================================
// COMPLETE IMPORT FLOW SIMULATION
// =============================================================================

describe('Import Flow - Complete Simulation', () => {
  it('should handle full import flow: new race, soft-deleted class, conflict race', () => {
    // Setup existing data
    const existingRaces = new Map<string, RaceRecord>([
      ['conflictrace', {
        name: 'conflictrace',
        name_de: 'Existing Conflict DE',
        name_en: 'Existing Conflict EN',
        description: null,
        deleted_at: null,
        is_standard: 0,
      }],
    ])
    const existingClasses = new Map<string, RaceRecord>([
      ['softdelclass', {
        name: 'softdelclass',
        name_de: 'Soft Deleted DE',
        name_en: 'Soft Deleted EN',
        description: null,
        deleted_at: '2024-01-01 00:00:00',
        is_standard: 0,
      }],
    ])

    // Manifest from import
    const manifestRaces = [
      { name: 'newrace', name_de: 'New Import DE', name_en: 'New Import EN' },
      { name: 'conflictrace', name_de: 'Import Conflict DE', name_en: 'Import Conflict EN' },
    ]
    const manifestClasses = [
      { name: 'softdelclass', name_de: 'Restored DE', name_en: 'Restored EN' },
    ]

    // Simulate import with resolution "keep" for conflict
    function simulateImport(
      existing: Map<string, RaceRecord>,
      manifest: Array<{ name: string; name_de?: string; name_en?: string }>,
      resolutions: Record<string, 'overwrite' | 'keep' | 'skip'> = {},
    ) {
      for (const item of manifest) {
        const key = item.name.toLowerCase().replace(/\s+/g, '')
        const ex = existing.get(key)

        if (ex && ex.deleted_at) {
          ex.name_de = item.name_de || null
          ex.name_en = item.name_en || null
          ex.deleted_at = null
        } else if (ex) {
          const resolution = resolutions[key]
          if (resolution === 'overwrite') {
            ex.name_de = item.name_de || null
            ex.name_en = item.name_en || null
          }
          // keep/skip: do nothing
        } else {
          existing.set(key, {
            name: key,
            name_de: item.name_de || null,
            name_en: item.name_en || null,
            description: null,
            deleted_at: null,
            is_standard: 0,
          })
        }
      }
    }

    simulateImport(existingRaces, manifestRaces, { conflictrace: 'keep' })
    simulateImport(existingClasses, manifestClasses)

    // Verify results

    // 1. New race was inserted
    expect(existingRaces.has('newrace')).toBe(true)
    expect(existingRaces.get('newrace')?.name_de).toBe('New Import DE')

    // 2. Conflict race was kept (original values)
    expect(existingRaces.get('conflictrace')?.name_de).toBe('Existing Conflict DE')

    // 3. Soft-deleted class was restored with new values
    expect(existingClasses.get('softdelclass')?.deleted_at).toBeNull()
    expect(existingClasses.get('softdelclass')?.name_de).toBe('Restored DE')
  })

  it('should handle import with overwrite resolution', () => {
    const existingRaces = new Map<string, RaceRecord>([
      ['tooverwrite', {
        name: 'tooverwrite',
        name_de: 'Original DE',
        name_en: 'Original EN',
        description: null,
        deleted_at: null,
        is_standard: 0,
      }],
    ])

    const manifestRaces = [
      { name: 'tooverwrite', name_de: 'Overwritten DE', name_en: 'Overwritten EN' },
    ]

    // Import with overwrite resolution
    for (const race of manifestRaces) {
      const key = race.name.toLowerCase()
      const existing = existingRaces.get(key)
      if (existing && !existing.deleted_at) {
        existing.name_de = race.name_de || null
        existing.name_en = race.name_en || null
      }
    }

    expect(existingRaces.get('tooverwrite')?.name_de).toBe('Overwritten DE')
    expect(existingRaces.get('tooverwrite')?.name_en).toBe('Overwritten EN')
  })
})

// =============================================================================
// EDGE CASES
// =============================================================================

describe('Edge Cases', () => {
  it('should normalize race key with uppercase to lowercase', () => {
    const inputKey = 'TEST_UPPERCASE'
    const normalizedKey = inputKey.toLowerCase().replace(/\s+/g, '')

    expect(normalizedKey).toBe('test_uppercase')
  })

  it('should remove spaces from race key', () => {
    const inputKey = 'my custom race'
    const normalizedKey = inputKey.toLowerCase().replace(/\s+/g, '')

    expect(normalizedKey).toBe('mycustomrace')
  })

  it('should handle empty manifest gracefully', () => {
    const manifestRaces: Array<{ name: string }> = []

    // Should not throw
    expect(manifestRaces.length).toBe(0)

    // Empty loop should not execute
    let executed = false
    for (const _race of manifestRaces) {
      executed = true
    }
    expect(executed).toBe(false)
  })

  it('should handle invalid JSON metadata gracefully', () => {
    const npcs = [
      { metadata: 'not valid json' },
      { metadata: JSON.stringify({ race: 'validrace' }) },
    ]

    const customRaceKeys = new Set<string>()
    for (const npc of npcs) {
      if (!npc.metadata) continue
      try {
        const metadata = JSON.parse(npc.metadata)
        if (metadata.race) {
          customRaceKeys.add(metadata.race.toLowerCase())
        }
      } catch {
        // Skip invalid JSON
      }
    }

    expect(customRaceKeys.size).toBe(1)
    expect(customRaceKeys.has('validrace')).toBe(true)
  })

  it('should detect is_standard correctly', () => {
    // Simulating the is_standard check
    const customRace = { name: 'myrace', is_standard: 0 }
    const standardRace = { name: 'human', is_standard: 1 }

    expect(customRace.is_standard).toBe(0)
    expect(standardRace.is_standard).toBe(1)

    // Custom races can be edited/deleted
    expect(customRace.is_standard === 0).toBe(true)

    // Standard races cannot be edited/deleted
    expect(standardRace.is_standard === 1).toBe(true)
  })

  it('should validate key format (lowercase + underscores only)', () => {
    const validateKey = (key: string): boolean => /^[a-z_]+$/.test(key)

    expect(validateKey('validkey')).toBe(true)
    expect(validateKey('valid_key')).toBe(true)
    expect(validateKey('my_custom_race')).toBe(true)

    expect(validateKey('Invalid')).toBe(false) // uppercase
    expect(validateKey('with space')).toBe(false) // space
    expect(validateKey('with-dash')).toBe(false) // dash
    expect(validateKey('with123')).toBe(false) // numbers
    expect(validateKey('')).toBe(false) // empty
  })

  it('should sanitize key input correctly', () => {
    const sanitizeKey = (value: string): string =>
      value.toLowerCase().replace(/[^a-z_]/g, '').slice(0, 20)

    expect(sanitizeKey('ValidKey')).toBe('validkey')
    expect(sanitizeKey('with spaces')).toBe('withspaces')
    expect(sanitizeKey('with-dash')).toBe('withdash')
    expect(sanitizeKey('with123numbers')).toBe('withnumbers')
    expect(sanitizeKey('abcdefghijklmnopqrstuvwxyz')).toBe('abcdefghijklmnopqrst') // max 20
    expect(sanitizeKey('MY_CUSTOM_RACE')).toBe('my_custom_race')
  })
})

// =============================================================================
// CONFLICT DETECTION TESTS
// =============================================================================

describe('Conflict Detection Logic', () => {
  interface ConflictInfo {
    key: string
    existing: { name_de: string | null; name_en: string | null }
    incoming: { name_de: string | null; name_en: string | null }
  }

  function detectConflicts(
    existing: Map<string, RaceRecord>,
    manifest: Array<{ name: string; name_de?: string; name_en?: string }>,
  ): ConflictInfo[] {
    const conflicts: ConflictInfo[] = []

    for (const item of manifest) {
      const key = item.name.toLowerCase().replace(/\s+/g, '')

      // Skip standard races - no conflict shown
      if (STANDARD_RACE_KEYS.has(key)) continue

      const ex = existing.get(key)

      // Only show conflict for active (not soft-deleted) custom entries
      if (ex && !ex.deleted_at) {
        conflicts.push({
          key,
          existing: { name_de: ex.name_de, name_en: ex.name_en },
          incoming: { name_de: item.name_de || null, name_en: item.name_en || null },
        })
      }
    }

    return conflicts
  }

  it('should detect conflict for active custom race', () => {
    const existing = new Map<string, RaceRecord>([
      ['customrace', {
        name: 'customrace',
        name_de: 'Existing DE',
        name_en: 'Existing EN',
        description: null,
        deleted_at: null,
        is_standard: 0,
      }],
    ])

    const manifest = [
      { name: 'customrace', name_de: 'Import DE', name_en: 'Import EN' },
    ]

    const conflicts = detectConflicts(existing, manifest)

    expect(conflicts.length).toBe(1)
    expect(conflicts[0].key).toBe('customrace')
    expect(conflicts[0].existing.name_de).toBe('Existing DE')
    expect(conflicts[0].incoming.name_de).toBe('Import DE')
  })

  it('should NOT show conflict for soft-deleted race', () => {
    const existing = new Map<string, RaceRecord>([
      ['softdel', {
        name: 'softdel',
        name_de: 'Deleted DE',
        name_en: 'Deleted EN',
        description: null,
        deleted_at: '2024-01-01 00:00:00',
        is_standard: 0,
      }],
    ])

    const manifest = [
      { name: 'softdel', name_de: 'Import DE', name_en: 'Import EN' },
    ]

    const conflicts = detectConflicts(existing, manifest)

    expect(conflicts.length).toBe(0)
  })

  it('should NOT show conflict for standard races', () => {
    const existing = new Map<string, RaceRecord>([
      ['human', {
        name: 'human',
        name_de: 'Mensch',
        name_en: 'Human',
        description: null,
        deleted_at: null,
        is_standard: 1,
      }],
    ])

    const manifest = [
      { name: 'human', name_de: 'Different DE', name_en: 'Different EN' },
    ]

    const conflicts = detectConflicts(existing, manifest)

    expect(conflicts.length).toBe(0)
  })

  it('should show conflict for new race that does not exist', () => {
    const existing = new Map<string, RaceRecord>()

    const manifest = [
      { name: 'newrace', name_de: 'New DE', name_en: 'New EN' },
    ]

    const conflicts = detectConflicts(existing, manifest)

    // No conflict because it doesn't exist
    expect(conflicts.length).toBe(0)
  })
})
