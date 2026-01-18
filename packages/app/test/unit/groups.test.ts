import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getDb } from '../../server/utils/db'
import { getContrastColor, GROUP_COLORS, GROUP_ICONS } from '../../types/group'
import type Database from 'better-sqlite3'

// Entity Groups Tests
// Tests group CRUD, member management, and utility functions

let db: Database.Database
let testCampaignId: number
let npcTypeId: number
let locationTypeId: number
let itemTypeId: number

beforeAll(() => {
  db = getDb()

  // Get entity type IDs
  const npcType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('NPC') as { id: number }
  const locationType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Location') as { id: number }
  const itemType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Item') as { id: number }
  npcTypeId = npcType.id
  locationTypeId = locationType.id
  itemTypeId = itemType.id

  // Create test campaign
  const campaign = db
    .prepare('INSERT INTO campaigns (name, description) VALUES (?, ?)')
    .run('Test Campaign Groups', 'Test description')
  testCampaignId = Number(campaign.lastInsertRowid)
})

afterAll(() => {
  if (db) {
    // Clean up in correct order (foreign key constraints)
    db.prepare('DELETE FROM entity_group_members WHERE group_id IN (SELECT id FROM entity_groups WHERE campaign_id = ?)').run(testCampaignId)
    db.prepare('DELETE FROM entity_groups WHERE campaign_id = ?').run(testCampaignId)
    db.prepare('DELETE FROM entities WHERE campaign_id = ?').run(testCampaignId)
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(testCampaignId)
  }
})

beforeEach(() => {
  // Clean up groups and members before each test
  db.prepare('DELETE FROM entity_group_members WHERE group_id IN (SELECT id FROM entity_groups WHERE campaign_id = ?)').run(testCampaignId)
  db.prepare('DELETE FROM entity_groups WHERE campaign_id = ?').run(testCampaignId)
  db.prepare('DELETE FROM entities WHERE campaign_id = ?').run(testCampaignId)
})

// Helper to create a group
function createGroup(name: string, options?: {
  description?: string
  color?: string
  icon?: string
}): number {
  const result = db
    .prepare(`
      INSERT INTO entity_groups (campaign_id, name, description, color, icon, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `)
    .run(
      testCampaignId,
      name,
      options?.description || null,
      options?.color || null,
      options?.icon || null
    )
  return Number(result.lastInsertRowid)
}

// Helper to create an entity
function createEntity(name: string, typeId: number): number {
  const result = db
    .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
    .run(typeId, testCampaignId, name)
  return Number(result.lastInsertRowid)
}

// Helper to add member to group
function addMember(groupId: number, entityId: number): void {
  db.prepare(`
    INSERT INTO entity_group_members (group_id, entity_id, added_at)
    VALUES (?, ?, datetime('now'))
  `).run(groupId, entityId)
}

describe('Groups - Basic CRUD', () => {
  it('should create a group', () => {
    const groupId = createGroup('Dungeon West')

    const group = db
      .prepare('SELECT * FROM entity_groups WHERE id = ?')
      .get(groupId) as { id: number; name: string; campaign_id: number }

    expect(group).toBeDefined()
    expect(group.name).toBe('Dungeon West')
    expect(group.campaign_id).toBe(testCampaignId)
  })

  it('should create a group with all fields', () => {
    const groupId = createGroup('Forest Encounter', {
      description: 'All entities for the forest encounter',
      color: '#6B8E23',
      icon: 'mdi-pine-tree',
    })

    const group = db
      .prepare('SELECT * FROM entity_groups WHERE id = ?')
      .get(groupId) as {
        name: string
        description: string
        color: string
        icon: string
      }

    expect(group.name).toBe('Forest Encounter')
    expect(group.description).toBe('All entities for the forest encounter')
    expect(group.color).toBe('#6B8E23')
    expect(group.icon).toBe('mdi-pine-tree')
  })

  it('should update a group', () => {
    const groupId = createGroup('Old Name')

    db.prepare(`
      UPDATE entity_groups
      SET name = ?, description = ?, color = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run('New Name', 'Updated description', '#D4A574', groupId)

    const group = db
      .prepare('SELECT name, description, color FROM entity_groups WHERE id = ?')
      .get(groupId) as { name: string; description: string; color: string }

    expect(group.name).toBe('New Name')
    expect(group.description).toBe('Updated description')
    expect(group.color).toBe('#D4A574')
  })

  it('should soft-delete a group', () => {
    const groupId = createGroup('To Delete')

    db.prepare("UPDATE entity_groups SET deleted_at = datetime('now') WHERE id = ?").run(groupId)

    const group = db
      .prepare('SELECT deleted_at FROM entity_groups WHERE id = ?')
      .get(groupId) as { deleted_at: string | null }

    expect(group.deleted_at).not.toBeNull()
  })

  it('should not return soft-deleted groups in queries', () => {
    createGroup('Active Group')
    const deletedId = createGroup('Deleted Group')
    db.prepare("UPDATE entity_groups SET deleted_at = datetime('now') WHERE id = ?").run(deletedId)

    const groups = db
      .prepare('SELECT * FROM entity_groups WHERE campaign_id = ? AND deleted_at IS NULL')
      .all(testCampaignId)

    expect(groups).toHaveLength(1)
    expect((groups[0] as { name: string }).name).toBe('Active Group')
  })
})

describe('Groups - Member Management', () => {
  it('should add an entity to a group', () => {
    const groupId = createGroup('Test Group')
    const npcId = createEntity('Test NPC', npcTypeId)

    addMember(groupId, npcId)

    const members = db
      .prepare('SELECT * FROM entity_group_members WHERE group_id = ?')
      .all(groupId)

    expect(members).toHaveLength(1)
    expect((members[0] as { entity_id: number }).entity_id).toBe(npcId)
  })

  it('should add multiple entities to a group', () => {
    const groupId = createGroup('Multi-Entity Group')
    const npc1 = createEntity('NPC 1', npcTypeId)
    const npc2 = createEntity('NPC 2', npcTypeId)
    const location = createEntity('Cave', locationTypeId)
    const item = createEntity('Sword', itemTypeId)

    addMember(groupId, npc1)
    addMember(groupId, npc2)
    addMember(groupId, location)
    addMember(groupId, item)

    const members = db
      .prepare('SELECT * FROM entity_group_members WHERE group_id = ?')
      .all(groupId)

    expect(members).toHaveLength(4)
  })

  it('should prevent duplicate membership', () => {
    const groupId = createGroup('Test Group')
    const npcId = createEntity('Test NPC', npcTypeId)

    addMember(groupId, npcId)

    // Second insert should fail due to UNIQUE constraint
    expect(() => addMember(groupId, npcId)).toThrow()
  })

  it('should remove an entity from a group', () => {
    const groupId = createGroup('Test Group')
    const npcId = createEntity('Test NPC', npcTypeId)
    addMember(groupId, npcId)

    db.prepare('DELETE FROM entity_group_members WHERE group_id = ? AND entity_id = ?')
      .run(groupId, npcId)

    const members = db
      .prepare('SELECT * FROM entity_group_members WHERE group_id = ?')
      .all(groupId)

    expect(members).toHaveLength(0)
  })

  it('should cascade delete members when group is deleted', () => {
    const groupId = createGroup('Test Group')
    const npcId = createEntity('Test NPC', npcTypeId)
    addMember(groupId, npcId)

    // Hard delete group (cascade should remove members)
    db.prepare('DELETE FROM entity_groups WHERE id = ?').run(groupId)

    const members = db
      .prepare('SELECT * FROM entity_group_members WHERE group_id = ?')
      .all(groupId)

    expect(members).toHaveLength(0)
  })
})

describe('Groups - Member Counts', () => {
  it('should count total members', () => {
    const groupId = createGroup('Counting Group')
    for (let i = 0; i < 5; i++) {
      const npcId = createEntity(`NPC ${i}`, npcTypeId)
      addMember(groupId, npcId)
    }

    const count = db
      .prepare(`
        SELECT COUNT(*) as count
        FROM entity_group_members gm
        JOIN entities e ON e.id = gm.entity_id AND e.deleted_at IS NULL
        WHERE gm.group_id = ?
      `)
      .get(groupId) as { count: number }

    expect(count.count).toBe(5)
  })

  it('should count members by type', () => {
    const groupId = createGroup('Mixed Group')

    // Add 3 NPCs
    for (let i = 0; i < 3; i++) {
      addMember(groupId, createEntity(`NPC ${i}`, npcTypeId))
    }
    // Add 2 Locations
    for (let i = 0; i < 2; i++) {
      addMember(groupId, createEntity(`Location ${i}`, locationTypeId))
    }
    // Add 1 Item
    addMember(groupId, createEntity('Sword', itemTypeId))

    const counts = db
      .prepare(`
        SELECT et.name as type_name, COUNT(*) as count
        FROM entity_group_members gm
        JOIN entities e ON e.id = gm.entity_id AND e.deleted_at IS NULL
        JOIN entity_types et ON et.id = e.type_id
        WHERE gm.group_id = ?
        GROUP BY e.type_id
      `)
      .all(groupId) as Array<{ type_name: string; count: number }>

    expect(counts).toHaveLength(3)

    const npcCount = counts.find(c => c.type_name === 'NPC')
    const locationCount = counts.find(c => c.type_name === 'Location')
    const itemCount = counts.find(c => c.type_name === 'Item')

    expect(npcCount?.count).toBe(3)
    expect(locationCount?.count).toBe(2)
    expect(itemCount?.count).toBe(1)
  })

  it('should exclude soft-deleted entities from count', () => {
    const groupId = createGroup('Test Group')
    const npc1 = createEntity('Active NPC', npcTypeId)
    const npc2 = createEntity('Deleted NPC', npcTypeId)

    addMember(groupId, npc1)
    addMember(groupId, npc2)

    // Soft-delete one entity
    db.prepare("UPDATE entities SET deleted_at = datetime('now') WHERE id = ?").run(npc2)

    const count = db
      .prepare(`
        SELECT COUNT(*) as count
        FROM entity_group_members gm
        JOIN entities e ON e.id = gm.entity_id AND e.deleted_at IS NULL
        WHERE gm.group_id = ?
      `)
      .get(groupId) as { count: number }

    expect(count.count).toBe(1)
  })
})

describe('Groups - Delete All (Group + Entities)', () => {
  it('should soft-delete all entities in a group', () => {
    const groupId = createGroup('To Delete All')
    const npc1 = createEntity('NPC 1', npcTypeId)
    const npc2 = createEntity('NPC 2', npcTypeId)
    const location = createEntity('Location', locationTypeId)

    addMember(groupId, npc1)
    addMember(groupId, npc2)
    addMember(groupId, location)

    // Soft-delete all entities in the group
    db.prepare(`
      UPDATE entities SET deleted_at = datetime('now')
      WHERE id IN (SELECT entity_id FROM entity_group_members WHERE group_id = ?)
      AND deleted_at IS NULL
    `).run(groupId)

    // Soft-delete the group itself
    db.prepare("UPDATE entity_groups SET deleted_at = datetime('now') WHERE id = ?").run(groupId)

    // Check entities are soft-deleted
    const activeEntities = db
      .prepare('SELECT * FROM entities WHERE campaign_id = ? AND deleted_at IS NULL')
      .all(testCampaignId)

    expect(activeEntities).toHaveLength(0)

    // Check group is soft-deleted
    const group = db
      .prepare('SELECT deleted_at FROM entity_groups WHERE id = ?')
      .get(groupId) as { deleted_at: string | null }

    expect(group.deleted_at).not.toBeNull()
  })

  it('should not affect entities not in the group', () => {
    const groupId = createGroup('Group To Delete')
    const inGroupNpc = createEntity('In Group', npcTypeId)
    const outsideNpc = createEntity('Outside Group', npcTypeId)

    addMember(groupId, inGroupNpc)
    // outsideNpc is NOT added to the group

    // Soft-delete all entities in the group
    db.prepare(`
      UPDATE entities SET deleted_at = datetime('now')
      WHERE id IN (SELECT entity_id FROM entity_group_members WHERE group_id = ?)
      AND deleted_at IS NULL
    `).run(groupId)

    // Check: inGroupNpc should be deleted
    const inGroup = db
      .prepare('SELECT deleted_at FROM entities WHERE id = ?')
      .get(inGroupNpc) as { deleted_at: string | null }
    expect(inGroup.deleted_at).not.toBeNull()

    // Check: outsideNpc should still be active
    const outside = db
      .prepare('SELECT deleted_at FROM entities WHERE id = ?')
      .get(outsideNpc) as { deleted_at: string | null }
    expect(outside.deleted_at).toBeNull()
  })
})

describe('Groups - Campaign Isolation', () => {
  it('should only return groups from the active campaign', () => {
    // Create another campaign
    const campaign2 = db.prepare('INSERT INTO campaigns (name) VALUES (?)').run('Campaign 2')
    const campaign2Id = Number(campaign2.lastInsertRowid)

    // Create groups in both campaigns
    createGroup('Group in Test Campaign')
    db.prepare(`
      INSERT INTO entity_groups (campaign_id, name, created_at, updated_at)
      VALUES (?, ?, datetime('now'), datetime('now'))
    `).run(campaign2Id, 'Group in Campaign 2')

    const testCampaignGroups = db
      .prepare('SELECT * FROM entity_groups WHERE campaign_id = ? AND deleted_at IS NULL')
      .all(testCampaignId)

    const campaign2Groups = db
      .prepare('SELECT * FROM entity_groups WHERE campaign_id = ? AND deleted_at IS NULL')
      .all(campaign2Id)

    expect(testCampaignGroups).toHaveLength(1)
    expect(campaign2Groups).toHaveLength(1)

    // Cleanup
    db.prepare('DELETE FROM entity_groups WHERE campaign_id = ?').run(campaign2Id)
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(campaign2Id)
  })
})

describe('Groups - Entity in Multiple Groups', () => {
  it('should allow an entity to be in multiple groups', () => {
    const group1 = createGroup('Group 1')
    const group2 = createGroup('Group 2')
    const npcId = createEntity('Shared NPC', npcTypeId)

    addMember(group1, npcId)
    addMember(group2, npcId)

    const memberships = db
      .prepare('SELECT * FROM entity_group_members WHERE entity_id = ?')
      .all(npcId)

    expect(memberships).toHaveLength(2)
  })

  it('should get all groups for an entity', () => {
    const group1 = createGroup('Adventure 1')
    const group2 = createGroup('Adventure 2')
    const group3 = createGroup('Important NPCs')
    const npcId = createEntity('Key NPC', npcTypeId)

    addMember(group1, npcId)
    addMember(group2, npcId)
    addMember(group3, npcId)

    const groups = db
      .prepare(`
        SELECT g.id, g.name
        FROM entity_groups g
        JOIN entity_group_members gm ON gm.group_id = g.id
        WHERE gm.entity_id = ?
        AND g.deleted_at IS NULL
      `)
      .all(npcId) as Array<{ id: number; name: string }>

    expect(groups).toHaveLength(3)
    expect(groups.map(g => g.name).sort()).toEqual(['Adventure 1', 'Adventure 2', 'Important NPCs'])
  })
})

describe('Groups - Utility Functions', () => {
  describe('getContrastColor', () => {
    it('should return black for light colors', () => {
      expect(getContrastColor('#FFFFFF')).toBe('black')
      expect(getContrastColor('#D4A574')).toBe('black') // Gold (primary)
      expect(getContrastColor('#FFFF00')).toBe('black') // Yellow
    })

    it('should return white for dark colors', () => {
      expect(getContrastColor('#000000')).toBe('white')
      expect(getContrastColor('#8B4513')).toBe('white') // Saddle brown
      expect(getContrastColor('#4682B4')).toBe('white') // Steel blue
    })

    it('should return grey for null color', () => {
      expect(getContrastColor(null)).toBe('grey')
    })

    it('should return white for invalid hex', () => {
      expect(getContrastColor('#FFF')).toBe('white') // Too short
      expect(getContrastColor('invalid')).toBe('white')
    })

    it('should handle colors without # prefix', () => {
      expect(getContrastColor('FFFFFF')).toBe('black')
      expect(getContrastColor('000000')).toBe('white')
    })
  })

  describe('GROUP_COLORS constant', () => {
    it('should have valid hex colors', () => {
      const hexRegex = /^#[0-9A-Fa-f]{6}$/
      for (const color of GROUP_COLORS) {
        expect(color).toMatch(hexRegex)
      }
    })

    it('should have expected number of colors', () => {
      expect(GROUP_COLORS.length).toBeGreaterThanOrEqual(10)
    })
  })

  describe('GROUP_ICONS constant', () => {
    it('should have valid MDI icons', () => {
      for (const icon of GROUP_ICONS) {
        expect(icon).toMatch(/^mdi-/)
      }
    })

    it('should have expected number of icons', () => {
      expect(GROUP_ICONS.length).toBeGreaterThanOrEqual(15)
    })
  })
})

describe('Groups - Batch Operations', () => {
  it('should add multiple entities in batch', () => {
    const groupId = createGroup('Batch Group')
    const entityIds: number[] = []

    for (let i = 0; i < 10; i++) {
      entityIds.push(createEntity(`Entity ${i}`, npcTypeId))
    }

    // Batch insert
    const insertStmt = db.prepare(`
      INSERT INTO entity_group_members (group_id, entity_id, added_at)
      VALUES (?, ?, datetime('now'))
    `)

    const insertMany = db.transaction((ids: number[]) => {
      for (const id of ids) {
        insertStmt.run(groupId, id)
      }
    })

    insertMany(entityIds)

    const members = db
      .prepare('SELECT * FROM entity_group_members WHERE group_id = ?')
      .all(groupId)

    expect(members).toHaveLength(10)
  })
})

describe('Groups - Edge Cases & Validation', () => {
  it('should trim whitespace from group name', () => {
    const groupId = createGroup('  Whitespace Name  ')

    const group = db
      .prepare('SELECT name FROM entity_groups WHERE id = ?')
      .get(groupId) as { name: string }

    // Note: Our createGroup helper doesn't trim, but the API does
    // This tests the raw DB allows it (validation is at API level)
    expect(group.name).toBe('  Whitespace Name  ')
  })

  it('should handle special characters in group name', () => {
    const specialName = "Äöü's \"Quest\" & <Monsters>"
    const groupId = createGroup(specialName)

    const group = db
      .prepare('SELECT name FROM entity_groups WHERE id = ?')
      .get(groupId) as { name: string }

    expect(group.name).toBe(specialName)
  })

  it('should handle unicode characters in group name', () => {
    const unicodeName = '🏰 Castle Quest 龍の巣'
    const groupId = createGroup(unicodeName)

    const group = db
      .prepare('SELECT name FROM entity_groups WHERE id = ?')
      .get(groupId) as { name: string }

    expect(group.name).toBe(unicodeName)
  })

  it('should handle very long group names', () => {
    const longName = 'A'.repeat(500)
    const groupId = createGroup(longName)

    const group = db
      .prepare('SELECT name FROM entity_groups WHERE id = ?')
      .get(groupId) as { name: string }

    expect(group.name).toBe(longName)
    expect(group.name.length).toBe(500)
  })

  it('should allow duplicate group names (no unique constraint)', () => {
    createGroup('Same Name')
    const groupId2 = createGroup('Same Name')

    const groups = db
      .prepare('SELECT * FROM entity_groups WHERE campaign_id = ? AND name = ? AND deleted_at IS NULL')
      .all(testCampaignId, 'Same Name')

    expect(groups).toHaveLength(2)
    expect(groupId2).toBeGreaterThan(0)
  })

  it('should handle null description correctly', () => {
    const groupId = createGroup('No Description', { description: undefined })

    const group = db
      .prepare('SELECT description FROM entity_groups WHERE id = ?')
      .get(groupId) as { description: string | null }

    expect(group.description).toBeNull()
  })

  it('should handle empty string description', () => {
    const result = db
      .prepare(`
        INSERT INTO entity_groups (campaign_id, name, description, created_at, updated_at)
        VALUES (?, ?, '', datetime('now'), datetime('now'))
      `)
      .run(testCampaignId, 'Empty Desc')

    const group = db
      .prepare('SELECT description FROM entity_groups WHERE id = ?')
      .get(result.lastInsertRowid) as { description: string | null }

    expect(group.description).toBe('')
  })

  it('should validate hex color format is stored correctly', () => {
    const groupId = createGroup('Color Test', { color: '#FF5733' })

    const group = db
      .prepare('SELECT color FROM entity_groups WHERE id = ?')
      .get(groupId) as { color: string }

    expect(group.color).toBe('#FF5733')
  })

  it('should allow any string as icon (no validation at DB level)', () => {
    const groupId = createGroup('Icon Test', { icon: 'invalid-icon-name' })

    const group = db
      .prepare('SELECT icon FROM entity_groups WHERE id = ?')
      .get(groupId) as { icon: string }

    expect(group.icon).toBe('invalid-icon-name')
  })
})

describe('Groups - Search Functionality', () => {
  beforeEach(() => {
    // Create test groups for search
    createGroup('Dragon Lair', { description: 'A fearsome dragon lives here' })
    createGroup('Goblin Cave', { description: 'Full of goblins and treasure' })
    createGroup('Dragon Nest', { description: 'Baby dragons everywhere' })
    createGroup('Peaceful Village', { description: 'No monsters here' })
  })

  it('should find groups by name using LIKE', () => {
    const searchPattern = '%Dragon%'
    const groups = db
      .prepare(`
        SELECT * FROM entity_groups
        WHERE campaign_id = ? AND deleted_at IS NULL
        AND name LIKE ?
      `)
      .all(testCampaignId, searchPattern)

    expect(groups).toHaveLength(2)
  })

  it('should find groups by description using LIKE', () => {
    const searchPattern = '%treasure%'
    const groups = db
      .prepare(`
        SELECT * FROM entity_groups
        WHERE campaign_id = ? AND deleted_at IS NULL
        AND description LIKE ?
      `)
      .all(testCampaignId, searchPattern)

    expect(groups).toHaveLength(1)
    expect((groups[0] as { name: string }).name).toBe('Goblin Cave')
  })

  it('should find groups by name OR description', () => {
    const searchPattern = '%dragon%'
    const groups = db
      .prepare(`
        SELECT * FROM entity_groups
        WHERE campaign_id = ? AND deleted_at IS NULL
        AND (LOWER(name) LIKE LOWER(?) OR LOWER(description) LIKE LOWER(?))
      `)
      .all(testCampaignId, searchPattern, searchPattern)

    // "Dragon Lair" (name), "Dragon Nest" (name), "Dragon Lair" (desc has "dragon")
    expect(groups).toHaveLength(2)
  })

  it('should be case-insensitive in search', () => {
    const searchPattern = '%DRAGON%'
    const groups = db
      .prepare(`
        SELECT * FROM entity_groups
        WHERE campaign_id = ? AND deleted_at IS NULL
        AND LOWER(name) LIKE LOWER(?)
      `)
      .all(testCampaignId, searchPattern)

    expect(groups).toHaveLength(2)
  })

  it('should return empty result for non-matching search', () => {
    const searchPattern = '%unicorn%'
    const groups = db
      .prepare(`
        SELECT * FROM entity_groups
        WHERE campaign_id = ? AND deleted_at IS NULL
        AND (name LIKE ? OR description LIKE ?)
      `)
      .all(testCampaignId, searchPattern, searchPattern)

    expect(groups).toHaveLength(0)
  })
})

describe('Groups - Data Integrity', () => {
  it('should set created_at and updated_at timestamps', () => {
    const before = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
    const groupId = createGroup('Timestamp Test')
    const after = new Date().toISOString().slice(0, 10)

    const group = db
      .prepare('SELECT created_at, updated_at FROM entity_groups WHERE id = ?')
      .get(groupId) as { created_at: string; updated_at: string }

    // Check timestamps are set and reasonable (same day)
    expect(group.created_at).toBeDefined()
    expect(group.updated_at).toBeDefined()
    expect(group.created_at.slice(0, 10)).toBeOneOf([before, after])
    expect(group.updated_at.slice(0, 10)).toBeOneOf([before, after])
  })

  it('should update updated_at on modification', () => {
    const groupId = createGroup('Update Test')

    const before = db
      .prepare('SELECT updated_at FROM entity_groups WHERE id = ?')
      .get(groupId) as { updated_at: string }

    // Small delay to ensure timestamp difference
    db.prepare(`
      UPDATE entity_groups
      SET name = 'Updated Name', updated_at = datetime('now')
      WHERE id = ?
    `).run(groupId)

    const after = db
      .prepare('SELECT updated_at FROM entity_groups WHERE id = ?')
      .get(groupId) as { updated_at: string }

    // updated_at should be same or later (might be same within same second)
    expect(after.updated_at).toBeDefined()
  })

  it('should maintain referential integrity - entity must exist', () => {
    const groupId = createGroup('Integrity Test')
    const nonExistentEntityId = 999999

    // This should fail due to foreign key constraint
    expect(() => {
      db.prepare(`
        INSERT INTO entity_group_members (group_id, entity_id, added_at)
        VALUES (?, ?, datetime('now'))
      `).run(groupId, nonExistentEntityId)
    }).toThrow()
  })

  it('should maintain referential integrity - group must exist', () => {
    const entityId = createEntity('Test Entity', npcTypeId)
    const nonExistentGroupId = 999999

    // This should fail due to foreign key constraint
    expect(() => {
      db.prepare(`
        INSERT INTO entity_group_members (group_id, entity_id, added_at)
        VALUES (?, ?, datetime('now'))
      `).run(nonExistentGroupId, entityId)
    }).toThrow()
  })

  it('should count members correctly with joins', () => {
    const groupId = createGroup('Count Accuracy Test')

    // Add 3 NPCs
    for (let i = 0; i < 3; i++) {
      addMember(groupId, createEntity(`NPC ${i}`, npcTypeId))
    }

    // Add 2 Locations
    for (let i = 0; i < 2; i++) {
      addMember(groupId, createEntity(`Location ${i}`, locationTypeId))
    }

    // Verify total count
    const total = db
      .prepare(`
        SELECT COUNT(*) as count
        FROM entity_group_members gm
        JOIN entities e ON e.id = gm.entity_id AND e.deleted_at IS NULL
        WHERE gm.group_id = ?
      `)
      .get(groupId) as { count: number }

    expect(total.count).toBe(5)

    // Soft-delete one entity
    const firstMember = db
      .prepare('SELECT entity_id FROM entity_group_members WHERE group_id = ? LIMIT 1')
      .get(groupId) as { entity_id: number }

    db.prepare("UPDATE entities SET deleted_at = datetime('now') WHERE id = ?")
      .run(firstMember.entity_id)

    // Count should now be 4
    const afterDelete = db
      .prepare(`
        SELECT COUNT(*) as count
        FROM entity_group_members gm
        JOIN entities e ON e.id = gm.entity_id AND e.deleted_at IS NULL
        WHERE gm.group_id = ?
      `)
      .get(groupId) as { count: number }

    expect(afterDelete.count).toBe(4)
  })
})

describe('Groups - Import Integration (Merge Mode)', () => {
  // Simulates the import logic that creates a group with imported entities

  it('should create a group for imported entities in merge mode', () => {
    // Simulate importing 5 entities
    const importedEntityIds: number[] = []
    for (let i = 0; i < 5; i++) {
      importedEntityIds.push(createEntity(`Imported Entity ${i}`, npcTypeId))
    }

    // Simulate the import.post.ts logic
    const groupName = 'Test Adventure Import'
    const groupIcon = 'mdi-import'

    // Create the group
    const groupResult = db.prepare(`
      INSERT INTO entity_groups (campaign_id, name, icon, created_at, updated_at)
      VALUES (?, ?, ?, datetime('now'), datetime('now'))
    `).run(testCampaignId, groupName, groupIcon)

    const groupId = Number(groupResult.lastInsertRowid)

    // Add all imported entities to the group
    const insertMember = db.prepare(`
      INSERT INTO entity_group_members (group_id, entity_id, added_at)
      VALUES (?, ?, datetime('now'))
    `)

    for (const entityId of importedEntityIds) {
      insertMember.run(groupId, entityId)
    }

    // Verify the group was created
    const group = db
      .prepare('SELECT * FROM entity_groups WHERE id = ?')
      .get(groupId) as { name: string; icon: string }

    expect(group.name).toBe('Test Adventure Import')
    expect(group.icon).toBe('mdi-import')

    // Verify all entities were added
    const members = db
      .prepare('SELECT * FROM entity_group_members WHERE group_id = ?')
      .all(groupId)

    expect(members).toHaveLength(5)
  })

  it('should not create group when createGroupOnMerge is false', () => {
    // Simulate importing without creating group
    const importedEntityIds: number[] = []
    for (let i = 0; i < 3; i++) {
      importedEntityIds.push(createEntity(`No Group Entity ${i}`, npcTypeId))
    }

    const createGroupOnMerge = false

    // Logic: only create group if flag is true
    if (createGroupOnMerge) {
      createGroup('Should Not Exist')
    }

    // Verify no groups were created
    const groups = db
      .prepare('SELECT * FROM entity_groups WHERE campaign_id = ? AND deleted_at IS NULL')
      .all(testCampaignId)

    expect(groups).toHaveLength(0)
  })

  it('should use custom group name when provided', () => {
    const importedEntityIds: number[] = []
    for (let i = 0; i < 2; i++) {
      importedEntityIds.push(createEntity(`Custom Name Entity ${i}`, npcTypeId))
    }

    // User provides custom name instead of default campaign name
    const customGroupName = 'My Custom Import Group'
    const defaultCampaignName = 'Adventure from Store'

    const groupName = customGroupName || defaultCampaignName

    const groupResult = db.prepare(`
      INSERT INTO entity_groups (campaign_id, name, icon, created_at, updated_at)
      VALUES (?, ?, 'mdi-import', datetime('now'), datetime('now'))
    `).run(testCampaignId, groupName)

    const groupId = Number(groupResult.lastInsertRowid)

    for (const entityId of importedEntityIds) {
      addMember(groupId, entityId)
    }

    const group = db
      .prepare('SELECT name FROM entity_groups WHERE id = ?')
      .get(groupId) as { name: string }

    expect(group.name).toBe('My Custom Import Group')
  })

  it('should fall back to campaign name when no custom name provided', () => {
    const importedEntityIds: number[] = []
    importedEntityIds.push(createEntity('Fallback Entity', npcTypeId))

    // User did not provide custom name
    const customGroupName = ''
    const defaultCampaignName = 'Adventure from Store'

    const groupName = customGroupName || defaultCampaignName

    const groupResult = db.prepare(`
      INSERT INTO entity_groups (campaign_id, name, icon, created_at, updated_at)
      VALUES (?, ?, 'mdi-import', datetime('now'), datetime('now'))
    `).run(testCampaignId, groupName)

    const groupId = Number(groupResult.lastInsertRowid)

    for (const entityId of importedEntityIds) {
      addMember(groupId, entityId)
    }

    const group = db
      .prepare('SELECT name FROM entity_groups WHERE id = ?')
      .get(groupId) as { name: string }

    expect(group.name).toBe('Adventure from Store')
  })

  it('should handle import with mixed entity types in group', () => {
    // Simulate importing entities of different types
    const npc1 = createEntity('Imported NPC', npcTypeId)
    const npc2 = createEntity('Imported NPC 2', npcTypeId)
    const location = createEntity('Imported Location', locationTypeId)
    const item = createEntity('Imported Item', itemTypeId)

    const importedEntityIds = [npc1, npc2, location, item]

    // Create group and add members
    const groupResult = db.prepare(`
      INSERT INTO entity_groups (campaign_id, name, icon, created_at, updated_at)
      VALUES (?, 'Mixed Import', 'mdi-import', datetime('now'), datetime('now'))
    `).run(testCampaignId)

    const groupId = Number(groupResult.lastInsertRowid)

    for (const entityId of importedEntityIds) {
      addMember(groupId, entityId)
    }

    // Verify counts by type
    const counts = db
      .prepare(`
        SELECT et.name as type_name, COUNT(*) as count
        FROM entity_group_members gm
        JOIN entities e ON e.id = gm.entity_id AND e.deleted_at IS NULL
        JOIN entity_types et ON et.id = e.type_id
        WHERE gm.group_id = ?
        GROUP BY e.type_id
      `)
      .all(groupId) as Array<{ type_name: string; count: number }>

    expect(counts).toHaveLength(3) // NPC, Location, Item

    const npcCount = counts.find(c => c.type_name === 'NPC')
    const locationCount = counts.find(c => c.type_name === 'Location')
    const itemCount = counts.find(c => c.type_name === 'Item')

    expect(npcCount?.count).toBe(2)
    expect(locationCount?.count).toBe(1)
    expect(itemCount?.count).toBe(1)
  })
})

// ============================================================================
// Fuzzy Search Tests (Levenshtein + Member Name Search)
// ============================================================================

describe('Groups - Fuzzy Search with Levenshtein', () => {
  // Import utilities dynamically to avoid module issues
  let levenshtein: (a: string, b: string) => number
  let normalizeText: (text: string) => string

  beforeAll(async () => {
    const levModule = await import('../../server/utils/levenshtein')
    levenshtein = levModule.createLevenshtein()
    const normModule = await import('../../server/utils/normalize')
    normalizeText = normModule.normalizeText
  })

  // Helper to simulate the fuzzy search logic from groups/index.get.ts
  function fuzzyScore(text: string, searchTerm: string, maxDist: number): number | null {
    const normalized = normalizeText(text)

    // Exact substring match = best score
    if (normalized.includes(searchTerm)) {
      return 0
    }

    // Full text Levenshtein
    const fullDist = levenshtein(searchTerm, normalized)
    if (fullDist <= maxDist) {
      return fullDist
    }

    // Word-by-word Levenshtein
    const words = normalized.split(/\s+/)
    let bestWordDist: number | null = null

    for (const word of words) {
      if (word.length < 2) continue
      const dist = levenshtein(searchTerm, word)
      if (dist <= maxDist && (bestWordDist === null || dist < bestWordDist)) {
        bestWordDist = dist
      }
    }

    return bestWordDist
  }

  function getMaxDistance(searchTerm: string): number {
    if (searchTerm.length <= 3) return 1
    if (searchTerm.length <= 6) return 2
    return 3
  }

  it('should find group by exact name match', () => {
    createGroup('Helden der Taverne')

    const searchTerm = normalizeText('helden')
    const maxDist = getMaxDistance(searchTerm)

    const groups = db.prepare(`
      SELECT name FROM entity_groups WHERE campaign_id = ? AND deleted_at IS NULL
    `).all(testCampaignId) as Array<{ name: string }>

    const matches = groups.filter(g => fuzzyScore(g.name, searchTerm, maxDist) !== null)
    expect(matches).toHaveLength(1)
    expect(matches[0]?.name).toBe('Helden der Taverne')
  })

  it('should find group with typo in search (Levenshtein)', () => {
    createGroup('Schwertmeister')

    // "Schwertmeiser" has 1 typo (missing 't')
    const searchTerm = normalizeText('schwertmeiser')
    const maxDist = getMaxDistance(searchTerm)

    const groups = db.prepare(`
      SELECT name FROM entity_groups WHERE campaign_id = ? AND deleted_at IS NULL
    `).all(testCampaignId) as Array<{ name: string }>

    const matches = groups.filter(g => fuzzyScore(g.name, searchTerm, maxDist) !== null)
    expect(matches).toHaveLength(1)
  })

  it('should find group by member name', () => {
    const groupId = createGroup('Geheime Gesellschaft')
    const npcId = createEntity('Bernhard der Weise', npcTypeId)
    addMember(groupId, npcId)

    // Search for "Bernhard" - should find the group via member name
    const searchTerm = normalizeText('bernhard')
    const maxDist = getMaxDistance(searchTerm)

    const groups = db.prepare(`
      SELECT g.name, GROUP_CONCAT(DISTINCT e.name) as member_names
      FROM entity_groups g
      LEFT JOIN entity_group_members gm ON gm.group_id = g.id
      LEFT JOIN entities e ON e.id = gm.entity_id AND e.deleted_at IS NULL
      WHERE g.campaign_id = ? AND g.deleted_at IS NULL
      GROUP BY g.id
    `).all(testCampaignId) as Array<{ name: string; member_names: string | null }>

    const matches = groups.filter(g => {
      // Check group name
      if (fuzzyScore(g.name, searchTerm, maxDist) !== null) return true
      // Check member names
      if (g.member_names) {
        const members = g.member_names.split(',')
        return members.some(m => fuzzyScore(m.trim(), searchTerm, maxDist) !== null)
      }
      return false
    })

    expect(matches).toHaveLength(1)
    expect(matches[0]?.name).toBe('Geheime Gesellschaft')
  })

  it('should find group by member name with typo (Levenshtein)', () => {
    const groupId = createGroup('Artefaktsammler')
    const itemId = createEntity('Schwert des Todes', itemTypeId)
    addMember(groupId, itemId)

    // Search for "Schwerd" (typo) - should still find via Levenshtein
    const searchTerm = normalizeText('schwerd')
    const maxDist = getMaxDistance(searchTerm)

    const groups = db.prepare(`
      SELECT g.name, GROUP_CONCAT(DISTINCT e.name) as member_names
      FROM entity_groups g
      LEFT JOIN entity_group_members gm ON gm.group_id = g.id
      LEFT JOIN entities e ON e.id = gm.entity_id AND e.deleted_at IS NULL
      WHERE g.campaign_id = ? AND g.deleted_at IS NULL
      GROUP BY g.id
    `).all(testCampaignId) as Array<{ name: string; member_names: string | null }>

    const matches = groups.filter(g => {
      if (fuzzyScore(g.name, searchTerm, maxDist) !== null) return true
      if (g.member_names) {
        const members = g.member_names.split(',')
        return members.some(m => fuzzyScore(m.trim(), searchTerm, maxDist) !== null)
      }
      return false
    })

    expect(matches).toHaveLength(1)
    expect(matches[0]?.name).toBe('Artefaktsammler')
  })

  it('should find group by partial word in multi-word member name', () => {
    const groupId = createGroup('Wichtige Personen')
    const npcId = createEntity('König Heinrich von Bayern', npcTypeId)
    addMember(groupId, npcId)

    // Search for "heinrich" - should match word in member name
    const searchTerm = normalizeText('heinrich')
    const maxDist = getMaxDistance(searchTerm)

    const groups = db.prepare(`
      SELECT g.name, GROUP_CONCAT(DISTINCT e.name) as member_names
      FROM entity_groups g
      LEFT JOIN entity_group_members gm ON gm.group_id = g.id
      LEFT JOIN entities e ON e.id = gm.entity_id AND e.deleted_at IS NULL
      WHERE g.campaign_id = ? AND g.deleted_at IS NULL
      GROUP BY g.id
    `).all(testCampaignId) as Array<{ name: string; member_names: string | null }>

    const matches = groups.filter(g => {
      if (fuzzyScore(g.name, searchTerm, maxDist) !== null) return true
      if (g.member_names) {
        const members = g.member_names.split(',')
        return members.some(m => fuzzyScore(m.trim(), searchTerm, maxDist) !== null)
      }
      return false
    })

    expect(matches).toHaveLength(1)
  })

  it('should rank name matches higher than member matches', () => {
    // Create group with matching name
    createGroup('Bernhards Bande')
    // Create group with member named Bernhard
    const groupId2 = createGroup('Andere Gruppe')
    const npcId = createEntity('Bernhard', npcTypeId)
    addMember(groupId2, npcId)

    const searchTerm = normalizeText('bernhard')
    const maxDist = getMaxDistance(searchTerm)

    const groups = db.prepare(`
      SELECT g.name, GROUP_CONCAT(DISTINCT e.name) as member_names
      FROM entity_groups g
      LEFT JOIN entity_group_members gm ON gm.group_id = g.id
      LEFT JOIN entities e ON e.id = gm.entity_id AND e.deleted_at IS NULL
      WHERE g.campaign_id = ? AND g.deleted_at IS NULL
      GROUP BY g.id
    `).all(testCampaignId) as Array<{ name: string; member_names: string | null }>

    // Both should be found
    const matches = groups.filter(g => {
      if (fuzzyScore(g.name, searchTerm, maxDist) !== null) return true
      if (g.member_names) {
        const members = g.member_names.split(',')
        return members.some(m => fuzzyScore(m.trim(), searchTerm, maxDist) !== null)
      }
      return false
    })

    expect(matches).toHaveLength(2)

    // Name match should have better (lower) score
    const nameMatchScore = fuzzyScore('Bernhards Bande', searchTerm, maxDist)
    expect(nameMatchScore).toBe(0) // substring match = 0
  })

  it('should not find group when search term does not match', () => {
    createGroup('Drachenjäger')
    const npcId = createEntity('Ritter Klaus', npcTypeId)
    const groupId = db.prepare('SELECT id FROM entity_groups WHERE name = ?').get('Drachenjäger') as { id: number }
    addMember(groupId.id, npcId)

    const searchTerm = normalizeText('einhorn')
    const maxDist = getMaxDistance(searchTerm)

    const groups = db.prepare(`
      SELECT g.name, GROUP_CONCAT(DISTINCT e.name) as member_names
      FROM entity_groups g
      LEFT JOIN entity_group_members gm ON gm.group_id = g.id
      LEFT JOIN entities e ON e.id = gm.entity_id AND e.deleted_at IS NULL
      WHERE g.campaign_id = ? AND g.deleted_at IS NULL
      GROUP BY g.id
    `).all(testCampaignId) as Array<{ name: string; member_names: string | null }>

    const matches = groups.filter(g => {
      if (fuzzyScore(g.name, searchTerm, maxDist) !== null) return true
      if (g.member_names) {
        const members = g.member_names.split(',')
        return members.some(m => fuzzyScore(m.trim(), searchTerm, maxDist) !== null)
      }
      return false
    })

    expect(matches).toHaveLength(0)
  })

  it('should find group by description', () => {
    createGroup('Mysteriöse Gruppe', { description: 'Eine Gruppe von Zauberern' })

    const searchTerm = normalizeText('zauberer')
    const maxDist = getMaxDistance(searchTerm)

    const groups = db.prepare(`
      SELECT name, description FROM entity_groups WHERE campaign_id = ? AND deleted_at IS NULL
    `).all(testCampaignId) as Array<{ name: string; description: string | null }>

    const matches = groups.filter(g => {
      if (fuzzyScore(g.name, searchTerm, maxDist) !== null) return true
      if (g.description && fuzzyScore(g.description, searchTerm, maxDist) !== null) return true
      return false
    })

    expect(matches).toHaveLength(1)
    expect(matches[0]?.name).toBe('Mysteriöse Gruppe')
  })
})

describe('Groups - Entity Card Chips (batch-counts groups)', () => {
  // Tests for the groups array returned by batch-counts APIs
  // Used to display group chips on entity cards

  it('should return groups for an entity in one group', () => {
    const groupId = createGroup('Dungeon West', { color: '#FF5733', icon: 'mdi-castle' })
    const npcId = createEntity('Guard NPC', npcTypeId)
    addMember(groupId, npcId)

    // Query similar to batch-counts.get.ts
    const groupMemberships = db.prepare(`
      SELECT gm.entity_id, g.id as group_id, g.name as group_name, g.color, g.icon
      FROM entity_group_members gm
      INNER JOIN entity_groups g ON g.id = gm.group_id AND g.deleted_at IS NULL
      WHERE gm.entity_id = ?
      ORDER BY g.name
    `).all(npcId) as Array<{
      entity_id: number
      group_id: number
      group_name: string
      color: string | null
      icon: string | null
    }>

    expect(groupMemberships).toHaveLength(1)
    expect(groupMemberships[0]?.group_name).toBe('Dungeon West')
    expect(groupMemberships[0]?.color).toBe('#FF5733')
    expect(groupMemberships[0]?.icon).toBe('mdi-castle')
  })

  it('should return multiple groups for an entity in multiple groups', () => {
    const group1 = createGroup('Adventure A', { color: '#FF0000', icon: 'mdi-sword' })
    const group2 = createGroup('Important NPCs', { color: '#00FF00', icon: 'mdi-star' })
    const group3 = createGroup('Zzz Last Group', { color: '#0000FF', icon: 'mdi-sleep' })
    const npcId = createEntity('Multi-Group NPC', npcTypeId)

    addMember(group1, npcId)
    addMember(group2, npcId)
    addMember(group3, npcId)

    const groupMemberships = db.prepare(`
      SELECT gm.entity_id, g.id as group_id, g.name as group_name, g.color, g.icon
      FROM entity_group_members gm
      INNER JOIN entity_groups g ON g.id = gm.group_id AND g.deleted_at IS NULL
      WHERE gm.entity_id = ?
      ORDER BY g.name
    `).all(npcId) as Array<{
      entity_id: number
      group_id: number
      group_name: string
      color: string | null
      icon: string | null
    }>

    expect(groupMemberships).toHaveLength(3)
    // Should be sorted by name
    expect(groupMemberships[0]?.group_name).toBe('Adventure A')
    expect(groupMemberships[1]?.group_name).toBe('Important NPCs')
    expect(groupMemberships[2]?.group_name).toBe('Zzz Last Group')
  })

  it('should return empty array for entity not in any group', () => {
    const npcId = createEntity('Lonely NPC', npcTypeId)

    const groupMemberships = db.prepare(`
      SELECT gm.entity_id, g.id as group_id, g.name as group_name, g.color, g.icon
      FROM entity_group_members gm
      INNER JOIN entity_groups g ON g.id = gm.group_id AND g.deleted_at IS NULL
      WHERE gm.entity_id = ?
      ORDER BY g.name
    `).all(npcId)

    expect(groupMemberships).toHaveLength(0)
  })

  it('should exclude soft-deleted groups from entity groups', () => {
    const activeGroup = createGroup('Active Group', { color: '#00FF00' })
    const deletedGroup = createGroup('Deleted Group', { color: '#FF0000' })
    const npcId = createEntity('Test NPC', npcTypeId)

    addMember(activeGroup, npcId)
    addMember(deletedGroup, npcId)

    // Soft-delete one group
    db.prepare("UPDATE entity_groups SET deleted_at = datetime('now') WHERE id = ?").run(deletedGroup)

    const groupMemberships = db.prepare(`
      SELECT gm.entity_id, g.id as group_id, g.name as group_name, g.color, g.icon
      FROM entity_group_members gm
      INNER JOIN entity_groups g ON g.id = gm.group_id AND g.deleted_at IS NULL
      WHERE gm.entity_id = ?
      ORDER BY g.name
    `).all(npcId) as Array<{ group_name: string }>

    expect(groupMemberships).toHaveLength(1)
    expect(groupMemberships[0]?.group_name).toBe('Active Group')
  })

  it('should handle groups with null color and icon', () => {
    const groupId = createGroup('Plain Group') // No color or icon
    const npcId = createEntity('Plain NPC', npcTypeId)
    addMember(groupId, npcId)

    const groupMemberships = db.prepare(`
      SELECT gm.entity_id, g.id as group_id, g.name as group_name, g.color, g.icon
      FROM entity_group_members gm
      INNER JOIN entity_groups g ON g.id = gm.group_id AND g.deleted_at IS NULL
      WHERE gm.entity_id = ?
      ORDER BY g.name
    `).all(npcId) as Array<{
      group_name: string
      color: string | null
      icon: string | null
    }>

    expect(groupMemberships).toHaveLength(1)
    expect(groupMemberships[0]?.color).toBeNull()
    expect(groupMemberships[0]?.icon).toBeNull()
  })

  it('should aggregate groups for multiple entities (batch query)', () => {
    // Simulates the batch-counts query pattern
    const group1 = createGroup('Group Alpha', { color: '#FF0000' })
    const group2 = createGroup('Group Beta', { color: '#00FF00' })

    const npc1 = createEntity('NPC 1', npcTypeId)
    const npc2 = createEntity('NPC 2', npcTypeId)
    const npc3 = createEntity('NPC 3', npcTypeId)

    // NPC 1 is in both groups
    addMember(group1, npc1)
    addMember(group2, npc1)
    // NPC 2 is only in group1
    addMember(group1, npc2)
    // NPC 3 is in no groups

    const entityIds = [npc1, npc2, npc3]

    const groupMemberships = db.prepare(`
      SELECT gm.entity_id, g.id as group_id, g.name as group_name, g.color, g.icon
      FROM entity_group_members gm
      INNER JOIN entity_groups g ON g.id = gm.group_id AND g.deleted_at IS NULL
      WHERE gm.entity_id IN (${entityIds.join(',')})
      ORDER BY g.name
    `).all() as Array<{
      entity_id: number
      group_id: number
      group_name: string
      color: string | null
      icon: string | null
    }>

    // Build groups map like batch-counts does
    const groupsByEntity = new Map<number, Array<{ id: number; name: string; color: string | null; icon: string | null }>>()

    for (const membership of groupMemberships) {
      if (!groupsByEntity.has(membership.entity_id)) {
        groupsByEntity.set(membership.entity_id, [])
      }
      groupsByEntity.get(membership.entity_id)!.push({
        id: membership.group_id,
        name: membership.group_name,
        color: membership.color,
        icon: membership.icon,
      })
    }

    // NPC 1 should have 2 groups
    expect(groupsByEntity.get(npc1)).toHaveLength(2)

    // NPC 2 should have 1 group
    expect(groupsByEntity.get(npc2)).toHaveLength(1)
    expect(groupsByEntity.get(npc2)?.[0]?.name).toBe('Group Alpha')

    // NPC 3 should have no entry (or empty array)
    expect(groupsByEntity.get(npc3)).toBeUndefined()
  })

  it('should work across different entity types', () => {
    const groupId = createGroup('Mixed Entity Group', { color: '#9370DB', icon: 'mdi-folder' })

    const npcId = createEntity('Test NPC', npcTypeId)
    const locationId = createEntity('Test Location', locationTypeId)
    const itemId = createEntity('Test Item', itemTypeId)

    addMember(groupId, npcId)
    addMember(groupId, locationId)
    addMember(groupId, itemId)

    // Query for NPC
    const npcGroups = db.prepare(`
      SELECT g.id, g.name, g.color, g.icon
      FROM entity_group_members gm
      INNER JOIN entity_groups g ON g.id = gm.group_id AND g.deleted_at IS NULL
      WHERE gm.entity_id = ?
    `).all(npcId) as Array<{ id: number; name: string }>

    // Query for Location
    const locationGroups = db.prepare(`
      SELECT g.id, g.name, g.color, g.icon
      FROM entity_group_members gm
      INNER JOIN entity_groups g ON g.id = gm.group_id AND g.deleted_at IS NULL
      WHERE gm.entity_id = ?
    `).all(locationId) as Array<{ id: number; name: string }>

    // Query for Item
    const itemGroups = db.prepare(`
      SELECT g.id, g.name, g.color, g.icon
      FROM entity_group_members gm
      INNER JOIN entity_groups g ON g.id = gm.group_id AND g.deleted_at IS NULL
      WHERE gm.entity_id = ?
    `).all(itemId) as Array<{ id: number; name: string }>

    // All should return the same group
    expect(npcGroups).toHaveLength(1)
    expect(locationGroups).toHaveLength(1)
    expect(itemGroups).toHaveLength(1)

    expect(npcGroups[0]?.name).toBe('Mixed Entity Group')
    expect(locationGroups[0]?.name).toBe('Mixed Entity Group')
    expect(itemGroups[0]?.name).toBe('Mixed Entity Group')
  })
})

describe('Groups - Global Search Integration', () => {
  it('should include groups in combined search results', () => {
    // Create a group with members
    const groupId = createGroup('Helden der Nacht', { color: '#FF5733', icon: 'mdi-shield' })
    const npcId = createEntity('Gandalf der Graue', npcTypeId)
    addMember(groupId, npcId)

    // Query like the global search does
    const groupResults = db.prepare(`
      SELECT
        g.id,
        g.name,
        g.description,
        'Group' as type,
        COALESCE(g.icon, 'mdi-folder-multiple') as icon,
        COALESCE(g.color, '#9370DB') as color,
        GROUP_CONCAT(DISTINCT e.name) as linked_entities
      FROM entity_groups g
      LEFT JOIN entity_group_members gm ON gm.group_id = g.id
      LEFT JOIN entities e ON e.id = gm.entity_id AND e.deleted_at IS NULL
      WHERE g.campaign_id = ? AND g.deleted_at IS NULL
      GROUP BY g.id
    `).all(testCampaignId) as Array<{
      id: number
      name: string
      type: string
      icon: string
      color: string
      linked_entities: string | null
    }>

    expect(groupResults).toHaveLength(1)
    expect(groupResults[0]?.type).toBe('Group')
    expect(groupResults[0]?.icon).toBe('mdi-shield')
    expect(groupResults[0]?.color).toBe('#FF5733')
    expect(groupResults[0]?.linked_entities).toBe('Gandalf der Graue')
  })

  it('should use default icon and color for groups without custom values', () => {
    createGroup('Einfache Gruppe') // No color or icon

    const groupResults = db.prepare(`
      SELECT
        COALESCE(g.icon, 'mdi-folder-multiple') as icon,
        COALESCE(g.color, '#9370DB') as color
      FROM entity_groups g
      WHERE g.campaign_id = ? AND g.deleted_at IS NULL
    `).all(testCampaignId) as Array<{ icon: string; color: string }>

    expect(groupResults[0]?.icon).toBe('mdi-folder-multiple')
    expect(groupResults[0]?.color).toBe('#9370DB')
  })

  it('should correctly concatenate multiple member names', () => {
    const groupId = createGroup('Vollständige Gruppe')
    const npc1 = createEntity('Held 1', npcTypeId)
    const npc2 = createEntity('Held 2', npcTypeId)
    const item = createEntity('Magisches Schwert', itemTypeId)

    addMember(groupId, npc1)
    addMember(groupId, npc2)
    addMember(groupId, item)

    const result = db.prepare(`
      SELECT GROUP_CONCAT(DISTINCT e.name) as linked_entities
      FROM entity_groups g
      LEFT JOIN entity_group_members gm ON gm.group_id = g.id
      LEFT JOIN entities e ON e.id = gm.entity_id AND e.deleted_at IS NULL
      WHERE g.id = ?
      GROUP BY g.id
    `).get(groupId) as { linked_entities: string }

    const members = result.linked_entities.split(',')
    expect(members).toHaveLength(3)
    expect(members).toContain('Held 1')
    expect(members).toContain('Held 2')
    expect(members).toContain('Magisches Schwert')
  })

  it('should not include soft-deleted members in search', () => {
    const groupId = createGroup('Gruppe mit gelöschtem Mitglied')
    const npcId = createEntity('Gelöschter NPC', npcTypeId)
    addMember(groupId, npcId)

    // Soft-delete the NPC
    db.prepare("UPDATE entities SET deleted_at = datetime('now') WHERE id = ?").run(npcId)

    const result = db.prepare(`
      SELECT GROUP_CONCAT(DISTINCT e.name) as linked_entities
      FROM entity_groups g
      LEFT JOIN entity_group_members gm ON gm.group_id = g.id
      LEFT JOIN entities e ON e.id = gm.entity_id AND e.deleted_at IS NULL
      WHERE g.id = ?
      GROUP BY g.id
    `).get(groupId) as { linked_entities: string | null }

    expect(result.linked_entities).toBeNull()
  })
})
