import { describe, it, expect } from 'vitest'
import {
  uniqueFolderName,
  isValidFolderName,
  isValidEasterEgg,
  FOLDER_EASTER_EGGS,
} from '../../types/folder'

describe('uniqueFolderName', () => {
  it('returns the desired name when no collision', () => {
    expect(uniqueFolderName([], 'Loot')).toBe('Loot')
    expect(uniqueFolderName(['Other'], 'Loot')).toBe('Loot')
  })

  it('appends "(1)" on first collision', () => {
    expect(uniqueFolderName(['Loot'], 'Loot')).toBe('Loot (1)')
  })

  it('finds next free index on multi-collision', () => {
    expect(uniqueFolderName(['Loot', 'Loot (1)'], 'Loot')).toBe('Loot (2)')
    expect(uniqueFolderName(['Loot', 'Loot (1)', 'Loot (2)'], 'Loot')).toBe('Loot (3)')
  })

  it('compares case-insensitively', () => {
    expect(uniqueFolderName(['loot'], 'Loot')).toBe('Loot (1)')
    expect(uniqueFolderName(['LOOT', 'loot (1)'], 'Loot')).toBe('Loot (2)')
  })

  it('trims surrounding whitespace before comparing', () => {
    expect(uniqueFolderName(['Loot'], '  Loot  ')).toBe('Loot (1)')
  })
})

describe('isValidFolderName', () => {
  it('rejects empty / whitespace-only names', () => {
    expect(isValidFolderName('')).toBe(false)
    expect(isValidFolderName('   ')).toBe(false)
  })

  it('accepts reasonable names', () => {
    expect(isValidFolderName('Loot')).toBe(true)
    expect(isValidFolderName('Quest Items')).toBe(true)
    expect(isValidFolderName('Müller & Söhne')).toBe(true)
  })

  it('rejects names longer than 64 chars', () => {
    expect(isValidFolderName('x'.repeat(64))).toBe(true)
    expect(isValidFolderName('x'.repeat(65))).toBe(false)
  })
})

describe('isValidEasterEgg', () => {
  it('accepts every known key', () => {
    for (const egg of FOLDER_EASTER_EGGS) {
      expect(isValidEasterEgg(egg)).toBe(true)
    }
  })

  it('rejects null/undefined/empty', () => {
    expect(isValidEasterEgg(null)).toBe(false)
    expect(isValidEasterEgg(undefined)).toBe(false)
    expect(isValidEasterEgg('')).toBe(false)
  })

  it('rejects unknown values', () => {
    expect(isValidEasterEgg('werewolf')).toBe(false)
    expect(isValidEasterEgg('Dragon')).toBe(false) // case-sensitive
  })
})
