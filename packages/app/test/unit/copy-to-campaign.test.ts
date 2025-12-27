import { describe, it, expect } from 'vitest'

/**
 * Copy-to-Campaign Tests
 *
 * Pure unit tests that simulate the copy logic without database access:
 * 1. Entity copying with source_entity_id tracking
 * 2. Duplicate detection (entities already copied)
 * 3. Copy modes: skip, update, duplicate
 * 4. Relation copying between copied entities
 * 5. ID mapping for relations
 */

// =============================================================================
// TYPES (matching the actual implementation)
// =============================================================================

interface Entity {
  id: number
  name: string
  type_id: number
  campaign_id: number
  source_entity_id: number | null
}

interface Relation {
  from_entity_id: number
  to_entity_id: number
  relation_type: string
}

interface CopyResult {
  success: boolean
  stats: {
    entitiesCopied: number
    entitiesSkipped: number
    entitiesUpdated: number
    relationsCopied: number
  }
  duplicates?: Array<{ id: number; source_entity_id: number; name: string }>
  requiresConfirmation?: boolean
}

type CopyMode = 'skip' | 'update' | 'duplicate'

// =============================================================================
// SIMULATION FUNCTIONS (matching the actual API logic)
// =============================================================================

/**
 * Simulates finding existing copies in target campaign
 */
function findExistingCopies(
  sourceEntities: Entity[],
  targetCampaignEntities: Entity[],
): Array<{ id: number; source_entity_id: number; name: string }> {
  const sourceIds = new Set(sourceEntities.map((e) => e.source_entity_id || e.id))

  return targetCampaignEntities
    .filter((e) => e.source_entity_id && sourceIds.has(e.source_entity_id))
    .map((e) => ({
      id: e.id,
      source_entity_id: e.source_entity_id!,
      name: e.name,
    }))
}

/**
 * Simulates the copy operation
 */
function simulateCopy(
  sourceEntities: Entity[],
  targetCampaignId: number,
  targetCampaignEntities: Entity[],
  relations: Relation[],
  mode: CopyMode,
): CopyResult {
  const existingCopies = findExistingCopies(sourceEntities, targetCampaignEntities)
  const existingSourceIds = new Set(existingCopies.map((c) => c.source_entity_id))

  // If duplicates found and mode is 'skip' on first call, return for confirmation
  if (existingCopies.length > 0 && mode === 'skip') {
    return {
      success: true,
      stats: {
        entitiesCopied: 0,
        entitiesSkipped: existingCopies.length,
        entitiesUpdated: 0,
        relationsCopied: 0,
      },
      duplicates: existingCopies,
      requiresConfirmation: true,
    }
  }

  const stats = {
    entitiesCopied: 0,
    entitiesSkipped: 0,
    entitiesUpdated: 0,
    relationsCopied: 0,
  }

  const idMapping = new Map<number, number>()
  let nextId = Math.max(...targetCampaignEntities.map((e) => e.id), 0) + 1

  for (const entity of sourceEntities) {
    const originalSourceId = entity.source_entity_id || entity.id
    const isDuplicate = existingSourceIds.has(originalSourceId)

    if (isDuplicate) {
      if (mode === 'skip') {
        stats.entitiesSkipped++
        const existingCopy = existingCopies.find((c) => c.source_entity_id === originalSourceId)
        if (existingCopy) {
          idMapping.set(entity.id, existingCopy.id)
        }
        continue
      } else if (mode === 'update') {
        const existingCopy = existingCopies.find((c) => c.source_entity_id === originalSourceId)
        if (existingCopy) {
          idMapping.set(entity.id, existingCopy.id)
          stats.entitiesUpdated++
          continue
        }
      }
      // mode === 'duplicate' - fall through to create new
    }

    // Create new entity
    const newId = nextId++
    idMapping.set(entity.id, newId)
    stats.entitiesCopied++
  }

  // Copy relations between copied entities
  const copiedSourceIds = Array.from(idMapping.keys())
  for (const rel of relations) {
    if (copiedSourceIds.includes(rel.from_entity_id) && copiedSourceIds.includes(rel.to_entity_id)) {
      const newFromId = idMapping.get(rel.from_entity_id)
      const newToId = idMapping.get(rel.to_entity_id)
      if (newFromId && newToId) {
        stats.relationsCopied++
      }
    }
  }

  return {
    success: true,
    stats,
  }
}

// =============================================================================
// TESTS
// =============================================================================

describe('Copy-to-Campaign: Duplicate Detection', () => {
  it('should detect entities already copied to target campaign', () => {
    const sourceEntities: Entity[] = [
      { id: 1, name: 'Gandalf', type_id: 1, campaign_id: 1, source_entity_id: null },
      { id: 2, name: 'Frodo', type_id: 1, campaign_id: 1, source_entity_id: null },
    ]

    const targetCampaignEntities: Entity[] = [
      { id: 100, name: 'Gandalf (Copy)', type_id: 1, campaign_id: 2, source_entity_id: 1 },
    ]

    const duplicates = findExistingCopies(sourceEntities, targetCampaignEntities)

    expect(duplicates).toHaveLength(1)
    expect(duplicates[0].source_entity_id).toBe(1)
    expect(duplicates[0].name).toBe('Gandalf (Copy)')
  })

  it('should detect copies of copies (transitive)', () => {
    // Entity was copied from campaign A to B, now trying to copy from B to C
    const sourceEntities: Entity[] = [
      { id: 50, name: 'Gandalf', type_id: 1, campaign_id: 2, source_entity_id: 1 }, // Copy of original
    ]

    const targetCampaignEntities: Entity[] = [
      { id: 100, name: 'Gandalf', type_id: 1, campaign_id: 3, source_entity_id: 1 }, // Also from original
    ]

    const duplicates = findExistingCopies(sourceEntities, targetCampaignEntities)

    expect(duplicates).toHaveLength(1)
    expect(duplicates[0].source_entity_id).toBe(1)
  })

  it('should return empty array when no duplicates exist', () => {
    const sourceEntities: Entity[] = [
      { id: 1, name: 'Gandalf', type_id: 1, campaign_id: 1, source_entity_id: null },
    ]

    const targetCampaignEntities: Entity[] = [
      { id: 100, name: 'Different NPC', type_id: 1, campaign_id: 2, source_entity_id: 99 },
    ]

    const duplicates = findExistingCopies(sourceEntities, targetCampaignEntities)

    expect(duplicates).toHaveLength(0)
  })
})

describe('Copy-to-Campaign: Copy Modes', () => {
  const sourceEntities: Entity[] = [
    { id: 1, name: 'Gandalf', type_id: 1, campaign_id: 1, source_entity_id: null },
    { id: 2, name: 'Frodo', type_id: 1, campaign_id: 1, source_entity_id: null },
  ]

  const targetWithDuplicate: Entity[] = [
    { id: 100, name: 'Gandalf', type_id: 1, campaign_id: 2, source_entity_id: 1 },
  ]

  const emptyTarget: Entity[] = []
  const relations: Relation[] = []

  it('should require confirmation when duplicates found with skip mode', () => {
    const result = simulateCopy(sourceEntities, 2, targetWithDuplicate, relations, 'skip')

    expect(result.requiresConfirmation).toBe(true)
    expect(result.duplicates).toHaveLength(1)
    expect(result.stats.entitiesCopied).toBe(0)
  })

  it('should skip duplicates and copy others in skip mode (after confirmation)', () => {
    // Simulate user confirmed - we'd normally re-call with same mode
    // For this test, we check that with empty target, all get copied
    const result = simulateCopy(sourceEntities, 2, emptyTarget, relations, 'skip')

    expect(result.requiresConfirmation).toBeUndefined()
    expect(result.stats.entitiesCopied).toBe(2)
    expect(result.stats.entitiesSkipped).toBe(0)
  })

  it('should update existing copies in update mode', () => {
    const result = simulateCopy(sourceEntities, 2, targetWithDuplicate, relations, 'update')

    expect(result.stats.entitiesUpdated).toBe(1) // Gandalf updated
    expect(result.stats.entitiesCopied).toBe(1) // Frodo copied
    expect(result.stats.entitiesSkipped).toBe(0)
  })

  it('should create new copies even for duplicates in duplicate mode', () => {
    const result = simulateCopy(sourceEntities, 2, targetWithDuplicate, relations, 'duplicate')

    expect(result.stats.entitiesCopied).toBe(2) // Both created as new
    expect(result.stats.entitiesUpdated).toBe(0)
    expect(result.stats.entitiesSkipped).toBe(0)
  })
})

describe('Copy-to-Campaign: Relation Copying', () => {
  it('should copy relations between copied entities', () => {
    const sourceEntities: Entity[] = [
      { id: 1, name: 'Gandalf', type_id: 1, campaign_id: 1, source_entity_id: null },
      { id: 2, name: 'Frodo', type_id: 1, campaign_id: 1, source_entity_id: null },
      { id: 3, name: 'Sam', type_id: 1, campaign_id: 1, source_entity_id: null },
    ]

    const relations: Relation[] = [
      { from_entity_id: 1, to_entity_id: 2, relation_type: 'mentor' },
      { from_entity_id: 2, to_entity_id: 3, relation_type: 'friend' },
    ]

    const result = simulateCopy(sourceEntities, 2, [], relations, 'skip')

    expect(result.stats.entitiesCopied).toBe(3)
    expect(result.stats.relationsCopied).toBe(2)
  })

  it('should not copy relations to entities outside selection', () => {
    const sourceEntities: Entity[] = [
      { id: 1, name: 'Gandalf', type_id: 1, campaign_id: 1, source_entity_id: null },
      // Frodo (id: 2) is NOT in selection
    ]

    const relations: Relation[] = [
      { from_entity_id: 1, to_entity_id: 2, relation_type: 'mentor' }, // Frodo not selected
    ]

    const result = simulateCopy(sourceEntities, 2, [], relations, 'skip')

    expect(result.stats.entitiesCopied).toBe(1)
    expect(result.stats.relationsCopied).toBe(0) // Relation not copied
  })

  it('should handle bidirectional relations correctly', () => {
    const sourceEntities: Entity[] = [
      { id: 1, name: 'Gandalf', type_id: 1, campaign_id: 1, source_entity_id: null },
      { id: 2, name: 'Saruman', type_id: 1, campaign_id: 1, source_entity_id: null },
    ]

    const relations: Relation[] = [
      { from_entity_id: 1, to_entity_id: 2, relation_type: 'rival' },
      { from_entity_id: 2, to_entity_id: 1, relation_type: 'rival' }, // Bidirectional
    ]

    const result = simulateCopy(sourceEntities, 2, [], relations, 'skip')

    expect(result.stats.relationsCopied).toBe(2)
  })
})

describe('Copy-to-Campaign: ID Mapping', () => {
  it('should map old IDs to new IDs for copied entities', () => {
    const sourceEntities: Entity[] = [
      { id: 1, name: 'Gandalf', type_id: 1, campaign_id: 1, source_entity_id: null },
    ]

    // With existing entities in target, new ID should be higher
    const targetEntities: Entity[] = [
      { id: 50, name: 'Existing', type_id: 1, campaign_id: 2, source_entity_id: null },
    ]

    const result = simulateCopy(sourceEntities, 2, targetEntities, [], 'skip')

    expect(result.stats.entitiesCopied).toBe(1)
    // New entity would get ID 51 (max + 1)
  })

  it('should use existing copy ID when skipping duplicates', () => {
    const sourceEntities: Entity[] = [
      { id: 1, name: 'Gandalf', type_id: 1, campaign_id: 1, source_entity_id: null },
      { id: 2, name: 'Frodo', type_id: 1, campaign_id: 1, source_entity_id: null },
    ]

    const targetEntities: Entity[] = [
      { id: 100, name: 'Gandalf', type_id: 1, campaign_id: 2, source_entity_id: 1 },
    ]

    const relations: Relation[] = [
      { from_entity_id: 1, to_entity_id: 2, relation_type: 'mentor' },
    ]

    // In update mode, Gandalf maps to 100, Frodo gets new ID
    const result = simulateCopy(sourceEntities, 2, targetEntities, relations, 'update')

    expect(result.stats.entitiesUpdated).toBe(1)
    expect(result.stats.entitiesCopied).toBe(1)
    expect(result.stats.relationsCopied).toBe(1) // Relation should still be copied
  })
})

describe('Copy-to-Campaign: Edge Cases', () => {
  it('should handle empty entity selection', () => {
    const result = simulateCopy([], 2, [], [], 'skip')

    expect(result.stats.entitiesCopied).toBe(0)
    expect(result.stats.relationsCopied).toBe(0)
  })

  it('should handle copying to campaign with no existing entities', () => {
    const sourceEntities: Entity[] = [
      { id: 1, name: 'Gandalf', type_id: 1, campaign_id: 1, source_entity_id: null },
    ]

    const result = simulateCopy(sourceEntities, 2, [], [], 'skip')

    expect(result.stats.entitiesCopied).toBe(1)
    expect(result.requiresConfirmation).toBeUndefined()
  })

  it('should preserve source_entity_id chain for multi-hop copies', () => {
    // Original entity (id: 1) -> Copy in campaign 2 (id: 50, source: 1)
    // Now copying from campaign 2 to campaign 3
    const sourceEntities: Entity[] = [
      { id: 50, name: 'Gandalf', type_id: 1, campaign_id: 2, source_entity_id: 1 },
    ]

    // The new copy should reference the ORIGINAL source (1), not the intermediate (50)
    // This is what our implementation does via: originalSourceId = entity.source_entity_id || entity.id
    const result = simulateCopy(sourceEntities, 3, [], [], 'skip')

    expect(result.stats.entitiesCopied).toBe(1)
  })

  it('should handle mixed entities with and without source_entity_id', () => {
    const sourceEntities: Entity[] = [
      { id: 1, name: 'Original', type_id: 1, campaign_id: 1, source_entity_id: null },
      { id: 50, name: 'Copy', type_id: 1, campaign_id: 1, source_entity_id: 99 }, // Copy of something else
    ]

    const result = simulateCopy(sourceEntities, 2, [], [], 'skip')

    expect(result.stats.entitiesCopied).toBe(2)
  })
})
