import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getDb } from '../../server/utils/db'
import type Database from 'better-sqlite3'
import type { StatTemplate, StatTemplateDbRow, StatTemplateGroupDbRow, StatTemplateFieldDbRow } from '../../types/stat-template'

// Stat Templates + Entity Stats Tests
// Tests template CRUD, entity stats CRUD, orphan cleanup

let db: Database.Database
let testCampaignId: number
let playerTypeId: number

// Local helper equivalent to server/utils/stat-template-helpers.ts getStatTemplateById
// Needed because the server util uses Nitro auto-imports (getDb) unavailable in tests
function loadTemplate(id: number): StatTemplate | null {
  const template = db
    .prepare<unknown[], StatTemplateDbRow>(
      `SELECT id, name, system_key, description, sort_order, is_imported, created_at, updated_at
       FROM stat_templates WHERE id = ? AND deleted_at IS NULL`,
    )
    .get(id)

  if (!template) return null

  const groups = db
    .prepare<unknown[], StatTemplateGroupDbRow>(
      `SELECT id, template_id, name, group_type, sort_order, created_at
       FROM stat_template_groups WHERE template_id = ? ORDER BY sort_order ASC`,
    )
    .all(id)

  const groupIds = groups.map(g => g.id)
  let fields: StatTemplateFieldDbRow[] = []

  if (groupIds.length > 0) {
    const placeholders = groupIds.map(() => '?').join(',')
    fields = db
      .prepare<unknown[], StatTemplateFieldDbRow>(
        `SELECT id, group_id, name, label, field_type, has_modifier, sort_order, created_at
         FROM stat_template_fields WHERE group_id IN (${placeholders}) ORDER BY sort_order ASC`,
      )
      .all(...groupIds)
  }

  const fieldsByGroup = new Map<number, StatTemplateFieldDbRow[]>()
  for (const field of fields) {
    const list = fieldsByGroup.get(field.group_id) || []
    list.push(field)
    fieldsByGroup.set(field.group_id, list)
  }

  return {
    ...template,
    system_key: template.system_key as StatTemplate['system_key'],
    is_imported: Boolean(template.is_imported),
    groups: groups.map(g => ({
      ...g,
      group_type: g.group_type as StatTemplate['groups'][number]['group_type'],
      fields: (fieldsByGroup.get(g.id) || []).map(f => ({
        ...f,
        field_type: f.field_type as StatTemplate['groups'][number]['fields'][number]['field_type'],
        has_modifier: Boolean(f.has_modifier),
      })),
    })),
  }
}

beforeAll(() => {
  db = getDb()

  const playerType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Player') as { id: number }
  playerTypeId = playerType.id

  const campaign = db
    .prepare('INSERT INTO campaigns (name, description) VALUES (?, ?)')
    .run('Test Campaign Stats', 'Stats test campaign')
  testCampaignId = Number(campaign.lastInsertRowid)
})

afterAll(() => {
  if (db) {
    // Clean up entity stats for our test entities
    db.prepare(`
      DELETE FROM entity_stats WHERE entity_id IN
      (SELECT id FROM entities WHERE campaign_id = ?)
    `).run(testCampaignId)

    db.prepare('DELETE FROM entities WHERE campaign_id = ?').run(testCampaignId)
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(testCampaignId)

    // Clean up test templates (hard delete for tests)
    db.prepare("DELETE FROM stat_templates WHERE name LIKE 'Test %'").run()
  }
})

beforeEach(() => {
  // Clean up test templates and entity stats before each test
  db.prepare(`
    DELETE FROM entity_stats WHERE entity_id IN
    (SELECT id FROM entities WHERE campaign_id = ?)
  `).run(testCampaignId)
  db.prepare('DELETE FROM entities WHERE campaign_id = ?').run(testCampaignId)
  db.prepare("DELETE FROM stat_templates WHERE name LIKE 'Test %'").run()
})

// Helper: create a stat template with groups and fields
function createTemplate(name: string, options?: {
  systemKey?: string
  description?: string
  groups?: Array<{
    name: string
    group_type: string
    fields: Array<{
      name: string
      label: string
      field_type: string
      has_modifier?: boolean
    }>
  }>
}): number {
  const maxOrder = db
    .prepare('SELECT MAX(sort_order) as max_order FROM stat_templates WHERE deleted_at IS NULL')
    .get() as { max_order: number | null }
  const sortOrder = (maxOrder.max_order ?? -1) + 1

  const result = db
    .prepare('INSERT INTO stat_templates (name, system_key, description, sort_order) VALUES (?, ?, ?, ?)')
    .run(name, options?.systemKey || null, options?.description || null, sortOrder)
  const templateId = Number(result.lastInsertRowid)

  if (options?.groups) {
    for (let gi = 0; gi < options.groups.length; gi++) {
      const group = options.groups[gi]!
      const groupResult = db
        .prepare('INSERT INTO stat_template_groups (template_id, name, group_type, sort_order) VALUES (?, ?, ?, ?)')
        .run(templateId, group.name, group.group_type, gi)
      const groupId = Number(groupResult.lastInsertRowid)

      for (let fi = 0; fi < group.fields.length; fi++) {
        const field = group.fields[fi]!
        db.prepare(
          'INSERT INTO stat_template_fields (group_id, name, label, field_type, has_modifier, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
        ).run(groupId, field.name, field.label, field.field_type, field.has_modifier ? 1 : 0, fi)
      }
    }
  }

  return templateId
}

// Helper: create a player entity
function createPlayer(name: string): number {
  const result = db
    .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
    .run(playerTypeId, testCampaignId, name)
  return Number(result.lastInsertRowid)
}

// Helper: assign stats to entity
function assignStats(entityId: number, templateId: number, values: Record<string, unknown> = {}): number {
  db.prepare(`
    INSERT INTO entity_stats (entity_id, template_id, values_json)
    VALUES (?, ?, ?)
    ON CONFLICT(entity_id) DO UPDATE SET
      template_id = excluded.template_id,
      values_json = excluded.values_json,
      updated_at = datetime('now')
  `).run(entityId, templateId, JSON.stringify(values))

  const row = db.prepare('SELECT id FROM entity_stats WHERE entity_id = ?').get(entityId) as { id: number }
  return row.id
}

describe('Stat Templates - CRUD', () => {
  it('should create a template without groups', () => {
    const templateId = createTemplate('Test Empty Template', {
      description: 'An empty template',
    })

    const template = loadTemplate(templateId)
    expect(template).not.toBeNull()
    expect(template!.name).toBe('Test Empty Template')
    expect(template!.description).toBe('An empty template')
    expect(template!.groups).toHaveLength(0)
  })

  it('should create a template with groups and fields', () => {
    const templateId = createTemplate('Test DnD Template', {
      systemKey: 'dnd5e',
      groups: [
        {
          name: 'Attributes',
          group_type: 'attributes',
          fields: [
            { name: 'strength', label: 'Strength', field_type: 'number', has_modifier: true },
            { name: 'dexterity', label: 'Dexterity', field_type: 'number', has_modifier: true },
          ],
        },
        {
          name: 'Resources',
          group_type: 'resources',
          fields: [
            { name: 'hit_points', label: 'HP', field_type: 'resource' },
          ],
        },
      ],
    })

    const template = loadTemplate(templateId)
    expect(template).not.toBeNull()
    expect(template!.name).toBe('Test DnD Template')
    expect(template!.system_key).toBe('dnd5e')
    expect(template!.groups).toHaveLength(2)

    // Check first group
    const attrs = template!.groups[0]!
    expect(attrs.name).toBe('Attributes')
    expect(attrs.group_type).toBe('attributes')
    expect(attrs.fields).toHaveLength(2)
    expect(attrs.fields[0]!.name).toBe('strength')
    expect(attrs.fields[0]!.has_modifier).toBe(true)
    expect(attrs.fields[1]!.name).toBe('dexterity')

    // Check second group
    const resources = template!.groups[1]!
    expect(resources.name).toBe('Resources')
    expect(resources.group_type).toBe('resources')
    expect(resources.fields).toHaveLength(1)
    expect(resources.fields[0]!.field_type).toBe('resource')
  })

  it('should preserve field sort order', () => {
    const templateId = createTemplate('Test Sort Order', {
      groups: [
        {
          name: 'Stats',
          group_type: 'custom',
          fields: [
            { name: 'first', label: 'First', field_type: 'string' },
            { name: 'second', label: 'Second', field_type: 'number' },
            { name: 'third', label: 'Third', field_type: 'boolean' },
          ],
        },
      ],
    })

    const template = loadTemplate(templateId)
    const fields = template!.groups[0]!.fields
    expect(fields[0]!.name).toBe('first')
    expect(fields[0]!.sort_order).toBe(0)
    expect(fields[1]!.name).toBe('second')
    expect(fields[1]!.sort_order).toBe(1)
    expect(fields[2]!.name).toBe('third')
    expect(fields[2]!.sort_order).toBe(2)
  })

  it('should soft-delete a template', () => {
    const templateId = createTemplate('Test To Delete')

    db.prepare("UPDATE stat_templates SET deleted_at = datetime('now') WHERE id = ?").run(templateId)

    const template = loadTemplate(templateId)
    expect(template).toBeNull()
  })

  it('should not return soft-deleted templates', () => {
    const id1 = createTemplate('Test Active Template')
    const id2 = createTemplate('Test Deleted Template')
    db.prepare("UPDATE stat_templates SET deleted_at = datetime('now') WHERE id = ?").run(id2)

    const t1 = loadTemplate(id1)
    const t2 = loadTemplate(id2)

    expect(t1).not.toBeNull()
    expect(t2).toBeNull()
  })
})

describe('Stat Templates - Save (groups + fields replacement)', () => {
  it('should replace all groups and fields', () => {
    const templateId = createTemplate('Test Save Template', {
      groups: [
        {
          name: 'Old Group',
          group_type: 'custom',
          fields: [
            { name: 'old_field', label: 'Old', field_type: 'string' },
          ],
        },
      ],
    })

    // Simulate save: delete old groups, insert new ones
    db.transaction(() => {
      db.prepare('UPDATE stat_templates SET name = ?, updated_at = datetime(\'now\') WHERE id = ?')
        .run('Test Updated Template', templateId)
      db.prepare('DELETE FROM stat_template_groups WHERE template_id = ?').run(templateId)

      const groupResult = db
        .prepare('INSERT INTO stat_template_groups (template_id, name, group_type, sort_order) VALUES (?, ?, ?, ?)')
        .run(templateId, 'New Group', 'attributes', 0)
      const groupId = Number(groupResult.lastInsertRowid)

      db.prepare(
        'INSERT INTO stat_template_fields (group_id, name, label, field_type, has_modifier, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(groupId, 'new_field', 'New Field', 'number', 1, 0)
    })()

    const template = loadTemplate(templateId)
    expect(template!.name).toBe('Test Updated Template')
    expect(template!.groups).toHaveLength(1)
    expect(template!.groups[0]!.name).toBe('New Group')
    expect(template!.groups[0]!.fields).toHaveLength(1)
    expect(template!.groups[0]!.fields[0]!.name).toBe('new_field')
    expect(template!.groups[0]!.fields[0]!.has_modifier).toBe(true)
  })

  it('should update name and description', () => {
    const templateId = createTemplate('Test Old Name', {
      description: 'Old description',
    })

    db.prepare('UPDATE stat_templates SET name = ?, description = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run('Test New Name', 'New description', templateId)

    const template = loadTemplate(templateId)
    expect(template!.name).toBe('Test New Name')
    expect(template!.description).toBe('New description')
  })

  it('should cascade delete fields when groups are deleted', () => {
    const templateId = createTemplate('Test Cascade', {
      groups: [
        {
          name: 'Group A',
          group_type: 'custom',
          fields: [
            { name: 'field_a1', label: 'A1', field_type: 'string' },
            { name: 'field_a2', label: 'A2', field_type: 'number' },
          ],
        },
      ],
    })

    // Get initial field count
    const groupsBefore = db
      .prepare('SELECT id FROM stat_template_groups WHERE template_id = ?')
      .all(templateId)

    const groupIds = (groupsBefore as Array<{ id: number }>).map(g => g.id)
    const placeholders = groupIds.map(() => '?').join(',')
    const fieldsBefore = db
      .prepare(`SELECT id FROM stat_template_fields WHERE group_id IN (${placeholders})`)
      .all(...groupIds)

    expect(fieldsBefore).toHaveLength(2)

    // Delete groups (CASCADE should delete fields)
    db.prepare('DELETE FROM stat_template_groups WHERE template_id = ?').run(templateId)

    // Fields should be gone
    const fieldsAfter = db
      .prepare(`SELECT id FROM stat_template_fields WHERE group_id IN (${placeholders})`)
      .all(...groupIds)
    expect(fieldsAfter).toHaveLength(0)
  })
})

describe('Stat Templates - Orphan Cleanup', () => {
  it('should remove orphaned values when template fields change', () => {
    const templateId = createTemplate('Test Orphan Template', {
      groups: [
        {
          name: 'Stats',
          group_type: 'custom',
          fields: [
            { name: 'strength', label: 'Strength', field_type: 'number' },
            { name: 'dexterity', label: 'Dexterity', field_type: 'number' },
            { name: 'hp', label: 'HP', field_type: 'resource' },
          ],
        },
      ],
    })

    // Create entity with stats
    const playerId = createPlayer('Test Orphan Player')
    assignStats(playerId, templateId, {
      strength: 15,
      dexterity: 12,
      hp: { current: 20, max: 30 },
    })

    // Now simulate template save that removes 'dexterity'
    const validFieldNames = new Set(['strength', 'hp'])

    const linkedStats = db
      .prepare<unknown[], { id: number, values_json: string }>(
        'SELECT id, values_json FROM entity_stats WHERE template_id = ?',
      )
      .all(templateId)

    for (const stat of linkedStats) {
      const values = JSON.parse(stat.values_json) as Record<string, unknown>
      const cleaned: Record<string, unknown> = {}
      for (const [key, val] of Object.entries(values)) {
        if (validFieldNames.has(key)) {
          cleaned[key] = val
        }
      }
      db.prepare("UPDATE entity_stats SET values_json = ?, updated_at = datetime('now') WHERE id = ?")
        .run(JSON.stringify(cleaned), stat.id)
    }

    // Verify dexterity was removed
    const row = db
      .prepare('SELECT values_json FROM entity_stats WHERE entity_id = ?')
      .get(playerId) as { values_json: string }
    const values = JSON.parse(row.values_json)

    expect(values.strength).toBe(15)
    expect(values.hp).toEqual({ current: 20, max: 30 })
    expect(values.dexterity).toBeUndefined()
  })

  it('should keep values for existing fields when new fields are added', () => {
    const templateId = createTemplate('Test AddField Template', {
      groups: [
        {
          name: 'Stats',
          group_type: 'custom',
          fields: [
            { name: 'strength', label: 'Strength', field_type: 'number' },
          ],
        },
      ],
    })

    const playerId = createPlayer('Test AddField Player')
    assignStats(playerId, templateId, { strength: 18 })

    // Simulate template save with additional field
    const validFieldNames = new Set(['strength', 'wisdom'])

    const linkedStats = db
      .prepare<unknown[], { id: number, values_json: string }>(
        'SELECT id, values_json FROM entity_stats WHERE template_id = ?',
      )
      .all(templateId)

    for (const stat of linkedStats) {
      const values = JSON.parse(stat.values_json) as Record<string, unknown>
      const cleaned: Record<string, unknown> = {}
      for (const [key, val] of Object.entries(values)) {
        if (validFieldNames.has(key)) {
          cleaned[key] = val
        }
      }
      db.prepare("UPDATE entity_stats SET values_json = ?, updated_at = datetime('now') WHERE id = ?")
        .run(JSON.stringify(cleaned), stat.id)
    }

    const row = db
      .prepare('SELECT values_json FROM entity_stats WHERE entity_id = ?')
      .get(playerId) as { values_json: string }
    const values = JSON.parse(row.values_json)

    // strength is kept, wisdom doesn't exist yet (no value was set)
    expect(values.strength).toBe(18)
    expect(values.wisdom).toBeUndefined()
  })

  it('should handle multiple entities using the same template', () => {
    const templateId = createTemplate('Test Multi Entity Template', {
      groups: [
        {
          name: 'Stats',
          group_type: 'custom',
          fields: [
            { name: 'strength', label: 'STR', field_type: 'number' },
            { name: 'hp', label: 'HP', field_type: 'resource' },
            { name: 'name', label: 'Name', field_type: 'string' },
          ],
        },
      ],
    })

    const player1 = createPlayer('Test Multi Player 1')
    const player2 = createPlayer('Test Multi Player 2')

    assignStats(player1, templateId, {
      strength: 10,
      hp: { current: 20, max: 20 },
      name: 'Warrior',
    })
    assignStats(player2, templateId, {
      strength: 14,
      hp: { current: 30, max: 30 },
      name: 'Mage',
    })

    // Remove 'name' field via orphan cleanup
    const validFieldNames = new Set(['strength', 'hp'])

    const linkedStats = db
      .prepare<unknown[], { id: number, values_json: string }>(
        'SELECT id, values_json FROM entity_stats WHERE template_id = ?',
      )
      .all(templateId)

    expect(linkedStats).toHaveLength(2)

    for (const stat of linkedStats) {
      const values = JSON.parse(stat.values_json) as Record<string, unknown>
      const cleaned: Record<string, unknown> = {}
      for (const [key, val] of Object.entries(values)) {
        if (validFieldNames.has(key)) {
          cleaned[key] = val
        }
      }
      db.prepare("UPDATE entity_stats SET values_json = ?, updated_at = datetime('now') WHERE id = ?")
        .run(JSON.stringify(cleaned), stat.id)
    }

    const row1 = db.prepare('SELECT values_json FROM entity_stats WHERE entity_id = ?').get(player1) as { values_json: string }
    const row2 = db.prepare('SELECT values_json FROM entity_stats WHERE entity_id = ?').get(player2) as { values_json: string }

    const v1 = JSON.parse(row1.values_json)
    const v2 = JSON.parse(row2.values_json)

    expect(v1.strength).toBe(10)
    expect(v1.name).toBeUndefined()
    expect(v2.strength).toBe(14)
    expect(v2.name).toBeUndefined()
  })
})

describe('Entity Stats - CRUD', () => {
  it('should assign stats to entity', () => {
    const templateId = createTemplate('Test Assign Template', {
      groups: [{
        name: 'Stats',
        group_type: 'custom',
        fields: [{ name: 'hp', label: 'HP', field_type: 'resource' }],
      }],
    })
    const playerId = createPlayer('Test Assign Player')

    assignStats(playerId, templateId, { hp: { current: 10, max: 20 } })

    const row = db
      .prepare('SELECT * FROM entity_stats WHERE entity_id = ?')
      .get(playerId) as { entity_id: number, template_id: number, values_json: string }

    expect(row).toBeDefined()
    expect(row.entity_id).toBe(playerId)
    expect(row.template_id).toBe(templateId)

    const values = JSON.parse(row.values_json)
    expect(values.hp).toEqual({ current: 10, max: 20 })
  })

  it('should enforce unique entity_id (one template per entity)', () => {
    const template1 = createTemplate('Test Template A')
    const template2 = createTemplate('Test Template B')
    const playerId = createPlayer('Test Unique Player')

    assignStats(playerId, template1, { foo: 'bar' })
    assignStats(playerId, template2, { baz: 'qux' })

    // Should only have one row (ON CONFLICT updates)
    const rows = db
      .prepare('SELECT * FROM entity_stats WHERE entity_id = ?')
      .all(playerId)
    expect(rows).toHaveLength(1)

    const row = rows[0] as { template_id: number, values_json: string }
    expect(row.template_id).toBe(template2)
    expect(JSON.parse(row.values_json)).toEqual({ baz: 'qux' })
  })

  it('should update values for existing stats', () => {
    const templateId = createTemplate('Test Update Stats', {
      groups: [{
        name: 'Attrs',
        group_type: 'attributes',
        fields: [
          { name: 'str', label: 'STR', field_type: 'number', has_modifier: true },
        ],
      }],
    })
    const playerId = createPlayer('Test Update Player')

    assignStats(playerId, templateId, { str: 10 })
    assignStats(playerId, templateId, { str: { value: 15, modifier: 2 } })

    const row = db
      .prepare('SELECT values_json FROM entity_stats WHERE entity_id = ?')
      .get(playerId) as { values_json: string }
    const values = JSON.parse(row.values_json)

    expect(values.str).toEqual({ value: 15, modifier: 2 })
  })

  it('should delete entity stats', () => {
    const templateId = createTemplate('Test Delete Stats')
    const playerId = createPlayer('Test Delete Stats Player')

    assignStats(playerId, templateId, { foo: 'bar' })

    // Verify exists
    const before = db.prepare('SELECT id FROM entity_stats WHERE entity_id = ?').get(playerId)
    expect(before).toBeDefined()

    // Delete
    db.prepare('DELETE FROM entity_stats WHERE entity_id = ?').run(playerId)

    const after = db.prepare('SELECT id FROM entity_stats WHERE entity_id = ?').get(playerId)
    expect(after).toBeUndefined()
  })

  it('should return null when entity has no stats', () => {
    const playerId = createPlayer('Test No Stats Player')

    const row = db
      .prepare('SELECT * FROM entity_stats WHERE entity_id = ?')
      .get(playerId)

    expect(row).toBeUndefined()
  })

  it('should cascade delete stats when entity is hard-deleted', () => {
    const templateId = createTemplate('Test Cascade Entity')
    const playerId = createPlayer('Test Cascade Entity Player')
    assignStats(playerId, templateId, { str: 10 })

    // Hard-delete entity
    db.prepare('DELETE FROM entities WHERE id = ?').run(playerId)

    // Stats should be gone (ON DELETE CASCADE)
    const row = db.prepare('SELECT id FROM entity_stats WHERE entity_id = ?').get(playerId)
    expect(row).toBeUndefined()
  })
})

describe('Entity Stats - Value Types', () => {
  it('should store and retrieve string values', () => {
    const templateId = createTemplate('Test String Values')
    const playerId = createPlayer('Test String Player')
    assignStats(playerId, templateId, { name: 'Gandalf', title: 'The Grey' })

    const row = db
      .prepare('SELECT values_json FROM entity_stats WHERE entity_id = ?')
      .get(playerId) as { values_json: string }
    const values = JSON.parse(row.values_json)

    expect(values.name).toBe('Gandalf')
    expect(values.title).toBe('The Grey')
  })

  it('should store and retrieve number values', () => {
    const templateId = createTemplate('Test Number Values')
    const playerId = createPlayer('Test Number Player')
    assignStats(playerId, templateId, { strength: 18, dexterity: 14, constitution: 0 })

    const row = db
      .prepare('SELECT values_json FROM entity_stats WHERE entity_id = ?')
      .get(playerId) as { values_json: string }
    const values = JSON.parse(row.values_json)

    expect(values.strength).toBe(18)
    expect(values.dexterity).toBe(14)
    expect(values.constitution).toBe(0)
  })

  it('should store and retrieve number with modifier', () => {
    const templateId = createTemplate('Test Modifier Values')
    const playerId = createPlayer('Test Modifier Player')
    assignStats(playerId, templateId, {
      strength: { value: 15, modifier: 2 },
      dexterity: { value: 8, modifier: -1 },
      constitution: { value: 10, modifier: 0 },
    })

    const row = db
      .prepare('SELECT values_json FROM entity_stats WHERE entity_id = ?')
      .get(playerId) as { values_json: string }
    const values = JSON.parse(row.values_json)

    expect(values.strength).toEqual({ value: 15, modifier: 2 })
    expect(values.dexterity).toEqual({ value: 8, modifier: -1 })
    expect(values.constitution).toEqual({ value: 10, modifier: 0 })
  })

  it('should store and retrieve resource values', () => {
    const templateId = createTemplate('Test Resource Values')
    const playerId = createPlayer('Test Resource Player')
    assignStats(playerId, templateId, {
      hp: { current: 25, max: 30 },
      mana: { current: 0, max: 50 },
    })

    const row = db
      .prepare('SELECT values_json FROM entity_stats WHERE entity_id = ?')
      .get(playerId) as { values_json: string }
    const values = JSON.parse(row.values_json)

    expect(values.hp).toEqual({ current: 25, max: 30 })
    expect(values.mana).toEqual({ current: 0, max: 50 })
  })

  it('should store and retrieve boolean values', () => {
    const templateId = createTemplate('Test Boolean Values')
    const playerId = createPlayer('Test Boolean Player')
    assignStats(playerId, templateId, {
      inspiration: true,
      exhaustion: false,
    })

    const row = db
      .prepare('SELECT values_json FROM entity_stats WHERE entity_id = ?')
      .get(playerId) as { values_json: string }
    const values = JSON.parse(row.values_json)

    expect(values.inspiration).toBe(true)
    expect(values.exhaustion).toBe(false)
  })

  it('should store and retrieve null values', () => {
    const templateId = createTemplate('Test Null Values')
    const playerId = createPlayer('Test Null Player')
    assignStats(playerId, templateId, {
      name: null,
      strength: null,
    })

    const row = db
      .prepare('SELECT values_json FROM entity_stats WHERE entity_id = ?')
      .get(playerId) as { values_json: string }
    const values = JSON.parse(row.values_json)

    expect(values.name).toBeNull()
    expect(values.strength).toBeNull()
  })

  it('should store mixed value types together', () => {
    const templateId = createTemplate('Test Mixed Values')
    const playerId = createPlayer('Test Mixed Player')
    assignStats(playerId, templateId, {
      name: 'Aragorn',
      strength: { value: 18, modifier: 4 },
      hp: { current: 100, max: 120 },
      inspiration: true,
      level: 15,
    })

    const row = db
      .prepare('SELECT values_json FROM entity_stats WHERE entity_id = ?')
      .get(playerId) as { values_json: string }
    const values = JSON.parse(row.values_json)

    expect(values.name).toBe('Aragorn')
    expect(values.strength).toEqual({ value: 18, modifier: 4 })
    expect(values.hp).toEqual({ current: 100, max: 120 })
    expect(values.inspiration).toBe(true)
    expect(values.level).toBe(15)
  })
})

describe('Stat Templates - Template Delete with linked stats', () => {
  it('should count linked entities when checking delete', () => {
    const templateId = createTemplate('Test Delete Check Template')
    const p1 = createPlayer('Test DC Player 1')
    const p2 = createPlayer('Test DC Player 2')

    assignStats(p1, templateId, { hp: 10 })
    assignStats(p2, templateId, { hp: 20 })

    const usage = db
      .prepare<unknown[], { count: number }>(
        'SELECT COUNT(*) as count FROM entity_stats WHERE template_id = ?',
      )
      .get(templateId)

    expect(usage!.count).toBe(2)
  })

  it('should delete linked entity_stats when template is deleted with confirm', () => {
    const templateId = createTemplate('Test Confirm Delete Template')
    const playerId = createPlayer('Test CD Player')
    assignStats(playerId, templateId, { str: 10 })

    // Simulate confirmed delete
    db.transaction(() => {
      db.prepare('DELETE FROM entity_stats WHERE template_id = ?').run(templateId)
      db.prepare("UPDATE stat_templates SET deleted_at = datetime('now') WHERE id = ?").run(templateId)
    })()

    const stats = db.prepare('SELECT id FROM entity_stats WHERE entity_id = ?').get(playerId)
    expect(stats).toBeUndefined()

    const template = loadTemplate(templateId)
    expect(template).toBeNull()
  })

  it('should not delete stats for unrelated templates', () => {
    const template1 = createTemplate('Test Unrelated Template 1')
    const template2 = createTemplate('Test Unrelated Template 2')
    const player1 = createPlayer('Test UR Player 1')
    const player2 = createPlayer('Test UR Player 2')

    assignStats(player1, template1, { str: 10 })
    assignStats(player2, template2, { str: 20 })

    // Delete only template1
    db.transaction(() => {
      db.prepare('DELETE FROM entity_stats WHERE template_id = ?').run(template1)
      db.prepare("UPDATE stat_templates SET deleted_at = datetime('now') WHERE id = ?").run(template1)
    })()

    // Player1's stats should be gone
    const stats1 = db.prepare('SELECT id FROM entity_stats WHERE entity_id = ?').get(player1)
    expect(stats1).toBeUndefined()

    // Player2's stats should still exist
    const stats2 = db.prepare('SELECT values_json FROM entity_stats WHERE entity_id = ?').get(player2) as { values_json: string }
    expect(stats2).toBeDefined()
    expect(JSON.parse(stats2.values_json)).toEqual({ str: 20 })
  })
})

describe('getStatTemplateById - Helper', () => {
  it('should return null for non-existent template', () => {
    const template = loadTemplate(999999)
    expect(template).toBeNull()
  })

  it('should return groups sorted by sort_order', () => {
    const templateId = createTemplate('Test Group Sort')

    // Insert groups in reverse order
    db.prepare('INSERT INTO stat_template_groups (template_id, name, group_type, sort_order) VALUES (?, ?, ?, ?)')
      .run(templateId, 'Third', 'custom', 2)
    db.prepare('INSERT INTO stat_template_groups (template_id, name, group_type, sort_order) VALUES (?, ?, ?, ?)')
      .run(templateId, 'First', 'custom', 0)
    db.prepare('INSERT INTO stat_template_groups (template_id, name, group_type, sort_order) VALUES (?, ?, ?, ?)')
      .run(templateId, 'Second', 'custom', 1)

    const template = loadTemplate(templateId)
    expect(template!.groups).toHaveLength(3)
    expect(template!.groups[0]!.name).toBe('First')
    expect(template!.groups[1]!.name).toBe('Second')
    expect(template!.groups[2]!.name).toBe('Third')
  })

  it('should return fields sorted by sort_order within group', () => {
    const templateId = createTemplate('Test Field Sort')
    const groupResult = db
      .prepare('INSERT INTO stat_template_groups (template_id, name, group_type, sort_order) VALUES (?, ?, ?, ?)')
      .run(templateId, 'Stats', 'custom', 0)
    const groupId = Number(groupResult.lastInsertRowid)

    // Insert fields in reverse
    db.prepare('INSERT INTO stat_template_fields (group_id, name, label, field_type, has_modifier, sort_order) VALUES (?, ?, ?, ?, ?, ?)')
      .run(groupId, 'c', 'C', 'string', 0, 2)
    db.prepare('INSERT INTO stat_template_fields (group_id, name, label, field_type, has_modifier, sort_order) VALUES (?, ?, ?, ?, ?, ?)')
      .run(groupId, 'a', 'A', 'string', 0, 0)
    db.prepare('INSERT INTO stat_template_fields (group_id, name, label, field_type, has_modifier, sort_order) VALUES (?, ?, ?, ?, ?, ?)')
      .run(groupId, 'b', 'B', 'string', 0, 1)

    const template = loadTemplate(templateId)
    const fields = template!.groups[0]!.fields
    expect(fields[0]!.name).toBe('a')
    expect(fields[1]!.name).toBe('b')
    expect(fields[2]!.name).toBe('c')
  })

  it('should convert has_modifier from integer to boolean', () => {
    const templateId = createTemplate('Test Modifier Bool')
    const groupResult = db
      .prepare('INSERT INTO stat_template_groups (template_id, name, group_type, sort_order) VALUES (?, ?, ?, ?)')
      .run(templateId, 'Stats', 'custom', 0)
    const groupId = Number(groupResult.lastInsertRowid)

    db.prepare('INSERT INTO stat_template_fields (group_id, name, label, field_type, has_modifier, sort_order) VALUES (?, ?, ?, ?, ?, ?)')
      .run(groupId, 'with_mod', 'With Mod', 'number', 1, 0)
    db.prepare('INSERT INTO stat_template_fields (group_id, name, label, field_type, has_modifier, sort_order) VALUES (?, ?, ?, ?, ?, ?)')
      .run(groupId, 'without_mod', 'Without Mod', 'number', 0, 1)

    const template = loadTemplate(templateId)
    expect(template!.groups[0]!.fields[0]!.has_modifier).toBe(true)
    expect(template!.groups[0]!.fields[1]!.has_modifier).toBe(false)
  })
})
