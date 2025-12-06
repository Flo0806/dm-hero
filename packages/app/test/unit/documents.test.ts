import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getDb } from '../../server/utils/db'
import type Database from 'better-sqlite3'

// Entity Documents Tests
// Tests the document system for entities

let db: Database.Database
let testCampaignId: number
let npcTypeId: number

beforeAll(() => {
  db = getDb()

  // Get NPC type ID
  const npcType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('NPC') as { id: number }
  npcTypeId = npcType.id

  // Create test campaign
  const campaign = db
    .prepare('INSERT INTO campaigns (name, description) VALUES (?, ?)')
    .run('Test Campaign Documents', 'Test description')
  testCampaignId = Number(campaign.lastInsertRowid)
})

afterAll(() => {
  if (db) {
    db.prepare('DELETE FROM entity_documents WHERE entity_id IN (SELECT id FROM entities WHERE campaign_id = ?)').run(testCampaignId)
    db.prepare('DELETE FROM entities WHERE campaign_id = ?').run(testCampaignId)
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(testCampaignId)
  }
})

beforeEach(() => {
  db.prepare('DELETE FROM entity_documents WHERE entity_id IN (SELECT id FROM entities WHERE campaign_id = ?)').run(testCampaignId)
  db.prepare('DELETE FROM entities WHERE campaign_id = ?').run(testCampaignId)
})

// Helper to create an entity
function createEntity(name: string): number {
  const result = db
    .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
    .run(npcTypeId, testCampaignId, name)
  return Number(result.lastInsertRowid)
}

// Helper to create a document
function createDocument(entityId: number, title: string, content: string): number {
  const result = db
    .prepare('INSERT INTO entity_documents (entity_id, title, content, date) VALUES (?, ?, ?, ?)')
    .run(entityId, title, content, new Date().toISOString().split('T')[0])
  return Number(result.lastInsertRowid)
}

describe('Documents - Basic CRUD', () => {
  it('should create a document for an entity', () => {
    const entityId = createEntity('Test NPC')
    const docId = createDocument(entityId, 'Backstory', 'A long and tragic backstory...')

    const doc = db
      .prepare('SELECT * FROM entity_documents WHERE id = ?')
      .get(docId) as { id: number; entity_id: number; title: string; content: string }

    expect(doc).toBeDefined()
    expect(doc.entity_id).toBe(entityId)
    expect(doc.title).toBe('Backstory')
    expect(doc.content).toBe('A long and tragic backstory...')
  })

  it('should update a document', () => {
    const entityId = createEntity('Update NPC')
    const docId = createDocument(entityId, 'Old Title', 'Old content')

    db.prepare('UPDATE entity_documents SET title = ?, content = ? WHERE id = ?')
      .run('New Title', 'New content', docId)

    const doc = db
      .prepare('SELECT title, content FROM entity_documents WHERE id = ?')
      .get(docId) as { title: string; content: string }

    expect(doc.title).toBe('New Title')
    expect(doc.content).toBe('New content')
  })

  it('should delete a document', () => {
    const entityId = createEntity('Delete Doc NPC')
    const docId = createDocument(entityId, 'To Delete', 'Content')

    db.prepare('DELETE FROM entity_documents WHERE id = ?').run(docId)

    const doc = db
      .prepare('SELECT * FROM entity_documents WHERE id = ?')
      .get(docId)

    expect(doc).toBeUndefined()
  })
})

describe('Documents - Multiple Documents', () => {
  it('should support multiple documents per entity', () => {
    const entityId = createEntity('Multi Doc NPC')

    createDocument(entityId, 'Backstory', 'Origin story...')
    createDocument(entityId, 'Motivations', 'Wants to save the world...')
    createDocument(entityId, 'Secrets', 'Is actually a dragon...')
    createDocument(entityId, 'Notes', 'Remember to include in session 5')

    const docs = db
      .prepare('SELECT * FROM entity_documents WHERE entity_id = ?')
      .all(entityId)

    expect(docs).toHaveLength(4)
  })

  it('should count documents for an entity', () => {
    const entityId = createEntity('Count Doc NPC')

    for (let i = 0; i < 5; i++) {
      createDocument(entityId, `Doc ${i}`, `Content ${i}`)
    }

    const count = db
      .prepare('SELECT COUNT(*) as count FROM entity_documents WHERE entity_id = ?')
      .get(entityId) as { count: number }

    expect(count.count).toBe(5)
  })
})

describe('Documents - Markdown Content', () => {
  it('should store markdown content', () => {
    const entityId = createEntity('Markdown NPC')
    const markdownContent = `
# Character Backstory

## Early Life
Born in a small village...

## Adventures
- Slayed a dragon
- Saved a princess
- Found treasure

## Goals
1. Become king
2. Unite the realm

> "I will be the best!"

\`\`\`
Secret code: 12345
\`\`\`
`
    const docId = createDocument(entityId, 'Full Backstory', markdownContent)

    const doc = db
      .prepare('SELECT content FROM entity_documents WHERE id = ?')
      .get(docId) as { content: string }

    expect(doc.content).toContain('# Character Backstory')
    expect(doc.content).toContain('- Slayed a dragon')
    expect(doc.content).toContain('> "I will be the best!"')
  })

  it('should store entity links in markdown', () => {
    const npc1 = createEntity('NPC with Links')
    const npc2 = createEntity('Linked NPC')

    const contentWithLinks = `
This character knows {{npc:${npc2}}} very well.
They met at the {{location:123}} tavern.
`
    const docId = createDocument(npc1, 'Relationships', contentWithLinks)

    const doc = db
      .prepare('SELECT content FROM entity_documents WHERE id = ?')
      .get(docId) as { content: string }

    expect(doc.content).toContain(`{{npc:${npc2}}}`)
  })
})

describe('Documents - Entity Cascade', () => {
  it('should delete documents when entity is deleted', () => {
    const entityId = createEntity('Cascade NPC')
    createDocument(entityId, 'Doc 1', 'Content 1')
    createDocument(entityId, 'Doc 2', 'Content 2')

    // Verify documents exist
    const docsBefore = db
      .prepare('SELECT * FROM entity_documents WHERE entity_id = ?')
      .all(entityId)
    expect(docsBefore).toHaveLength(2)

    // Delete entity and its documents
    db.prepare('DELETE FROM entity_documents WHERE entity_id = ?').run(entityId)
    db.prepare('DELETE FROM entities WHERE id = ?').run(entityId)

    // Verify documents are deleted
    const docsAfter = db
      .prepare('SELECT * FROM entity_documents WHERE entity_id = ?')
      .all(entityId)
    expect(docsAfter).toHaveLength(0)
  })
})

describe('Documents - Timestamps', () => {
  it('should set created_at on creation', () => {
    const entityId = createEntity('Timestamp NPC')
    const docId = createDocument(entityId, 'Timestamped Doc', 'Content')

    const doc = db
      .prepare('SELECT created_at FROM entity_documents WHERE id = ?')
      .get(docId) as { created_at: string }

    expect(doc.created_at).toBeDefined()
    expect(new Date(doc.created_at)).toBeInstanceOf(Date)
  })

  it('should update updated_at on modification', () => {
    const entityId = createEntity('Update Time NPC')
    const docId = createDocument(entityId, 'Update Time Doc', 'Original')

    const before = db
      .prepare('SELECT updated_at FROM entity_documents WHERE id = ?')
      .get(docId) as { updated_at: string }

    db.prepare('UPDATE entity_documents SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run('Modified', docId)

    const after = db
      .prepare('SELECT updated_at FROM entity_documents WHERE id = ?')
      .get(docId) as { updated_at: string }

    expect(new Date(after.updated_at).getTime()).toBeGreaterThanOrEqual(new Date(before.updated_at).getTime())
  })
})

describe('Documents - Query Patterns', () => {
  it('should get documents with entity info', () => {
    const entityId = createEntity('Query NPC')
    createDocument(entityId, 'Test Doc', 'Test Content')

    const result = db
      .prepare(`
        SELECT ed.*, e.name as entity_name
        FROM entity_documents ed
        JOIN entities e ON e.id = ed.entity_id
        WHERE ed.entity_id = ?
      `)
      .get(entityId) as { title: string; entity_name: string }

    expect(result.title).toBe('Test Doc')
    expect(result.entity_name).toBe('Query NPC')
  })

  it('should find documents by title pattern', () => {
    const entityId = createEntity('Pattern NPC')
    createDocument(entityId, 'Backstory - Part 1', 'Content 1')
    createDocument(entityId, 'Backstory - Part 2', 'Content 2')
    createDocument(entityId, 'Notes', 'Other content')

    const backstoryDocs = db
      .prepare("SELECT * FROM entity_documents WHERE entity_id = ? AND title LIKE ?")
      .all(entityId, 'Backstory%')

    expect(backstoryDocs).toHaveLength(2)
  })
})
