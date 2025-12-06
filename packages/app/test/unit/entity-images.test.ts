import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getDb } from '../../server/utils/db'
import type Database from 'better-sqlite3'

// Entity Images Tests
// Tests for entity image gallery functionality

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
    .run('Test Campaign Images', 'Test description')
  testCampaignId = Number(campaign.lastInsertRowid)
})

afterAll(() => {
  if (db) {
    db.prepare('DELETE FROM entity_images WHERE entity_id IN (SELECT id FROM entities WHERE campaign_id = ?)').run(testCampaignId)
    db.prepare('DELETE FROM entities WHERE campaign_id = ?').run(testCampaignId)
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(testCampaignId)
  }
})

beforeEach(() => {
  db.prepare('DELETE FROM entity_images WHERE entity_id IN (SELECT id FROM entities WHERE campaign_id = ?)').run(testCampaignId)
  db.prepare('DELETE FROM entities WHERE campaign_id = ?').run(testCampaignId)
})

// Helper to create an entity
function createEntity(name: string): number {
  const result = db
    .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
    .run(npcTypeId, testCampaignId, name)
  return Number(result.lastInsertRowid)
}

// Helper to create an image
function createImage(entityId: number, imageUrl: string, options?: {
  caption?: string
  isPrimary?: boolean
  displayOrder?: number
}): number {
  const result = db
    .prepare(`
      INSERT INTO entity_images (entity_id, image_url, caption, is_primary, display_order)
      VALUES (?, ?, ?, ?, ?)
    `)
    .run(
      entityId,
      imageUrl,
      options?.caption || null,
      options?.isPrimary ? 1 : 0,
      options?.displayOrder || 0
    )
  return Number(result.lastInsertRowid)
}

describe('Entity Images - Basic CRUD', () => {
  it('should create an image for an entity', () => {
    const entityId = createEntity('Test NPC')
    const imageId = createImage(entityId, 'images/npc-portrait.jpg')

    const image = db
      .prepare('SELECT * FROM entity_images WHERE id = ?')
      .get(imageId) as { id: number; entity_id: number; image_url: string }

    expect(image).toBeDefined()
    expect(image.entity_id).toBe(entityId)
    expect(image.image_url).toBe('images/npc-portrait.jpg')
  })

  it('should create an image with caption', () => {
    const entityId = createEntity('Captioned NPC')
    const imageId = createImage(entityId, 'images/portrait.jpg', {
      caption: 'Character portrait in battle armor'
    })

    const image = db
      .prepare('SELECT caption FROM entity_images WHERE id = ?')
      .get(imageId) as { caption: string }

    expect(image.caption).toBe('Character portrait in battle armor')
  })

  it('should update an image', () => {
    const entityId = createEntity('Update NPC')
    const imageId = createImage(entityId, 'images/old.jpg')

    db.prepare('UPDATE entity_images SET image_url = ?, caption = ? WHERE id = ?')
      .run('images/new.jpg', 'Updated caption', imageId)

    const image = db
      .prepare('SELECT image_url, caption FROM entity_images WHERE id = ?')
      .get(imageId) as { image_url: string; caption: string }

    expect(image.image_url).toBe('images/new.jpg')
    expect(image.caption).toBe('Updated caption')
  })

  it('should delete an image', () => {
    const entityId = createEntity('Delete NPC')
    const imageId = createImage(entityId, 'images/delete.jpg')

    db.prepare('DELETE FROM entity_images WHERE id = ?').run(imageId)

    const image = db
      .prepare('SELECT * FROM entity_images WHERE id = ?')
      .get(imageId)

    expect(image).toBeUndefined()
  })
})

describe('Entity Images - Multiple Images', () => {
  it('should support multiple images per entity', () => {
    const entityId = createEntity('Gallery NPC')

    createImage(entityId, 'images/portrait1.jpg')
    createImage(entityId, 'images/portrait2.jpg')
    createImage(entityId, 'images/portrait3.jpg')

    const images = db
      .prepare('SELECT * FROM entity_images WHERE entity_id = ?')
      .all(entityId)

    expect(images).toHaveLength(3)
  })

  it('should order images by display_order', () => {
    const entityId = createEntity('Ordered NPC')

    const img1 = createImage(entityId, 'images/first.jpg', { displayOrder: 2 })
    const img2 = createImage(entityId, 'images/second.jpg', { displayOrder: 0 })
    const img3 = createImage(entityId, 'images/third.jpg', { displayOrder: 1 })

    const images = db
      .prepare('SELECT image_url FROM entity_images WHERE entity_id = ? ORDER BY display_order')
      .all(entityId) as Array<{ image_url: string }>

    expect(images[0].image_url).toBe('images/second.jpg')
    expect(images[1].image_url).toBe('images/third.jpg')
    expect(images[2].image_url).toBe('images/first.jpg')
  })

  it('should count images for an entity', () => {
    const entityId = createEntity('Count NPC')

    for (let i = 0; i < 5; i++) {
      createImage(entityId, `images/image${i}.jpg`)
    }

    const count = db
      .prepare('SELECT COUNT(*) as count FROM entity_images WHERE entity_id = ?')
      .get(entityId) as { count: number }

    expect(count.count).toBe(5)
  })
})

describe('Entity Images - Primary Image', () => {
  it('should mark an image as primary', () => {
    const entityId = createEntity('Primary NPC')
    const imageId = createImage(entityId, 'images/primary.jpg', { isPrimary: true })

    const image = db
      .prepare('SELECT is_primary FROM entity_images WHERE id = ?')
      .get(imageId) as { is_primary: number }

    expect(image.is_primary).toBe(1)
  })

  it('should find the primary image for an entity', () => {
    const entityId = createEntity('Find Primary NPC')

    createImage(entityId, 'images/other1.jpg', { isPrimary: false })
    createImage(entityId, 'images/primary.jpg', { isPrimary: true })
    createImage(entityId, 'images/other2.jpg', { isPrimary: false })

    const primaryImage = db
      .prepare('SELECT image_url FROM entity_images WHERE entity_id = ? AND is_primary = 1')
      .get(entityId) as { image_url: string }

    expect(primaryImage.image_url).toBe('images/primary.jpg')
  })

  it('should change primary image', () => {
    const entityId = createEntity('Change Primary NPC')

    const img1 = createImage(entityId, 'images/first.jpg', { isPrimary: true })
    const img2 = createImage(entityId, 'images/second.jpg', { isPrimary: false })

    // Unset old primary
    db.prepare('UPDATE entity_images SET is_primary = 0 WHERE entity_id = ?').run(entityId)
    // Set new primary
    db.prepare('UPDATE entity_images SET is_primary = 1 WHERE id = ?').run(img2)

    const primary = db
      .prepare('SELECT id FROM entity_images WHERE entity_id = ? AND is_primary = 1')
      .get(entityId) as { id: number }

    expect(primary.id).toBe(img2)
  })
})

describe('Entity Images - Cascade Delete', () => {
  it('should delete images when entity is deleted', () => {
    const entityId = createEntity('Cascade NPC')

    createImage(entityId, 'images/img1.jpg')
    createImage(entityId, 'images/img2.jpg')

    // Verify images exist
    const imagesBefore = db
      .prepare('SELECT * FROM entity_images WHERE entity_id = ?')
      .all(entityId)
    expect(imagesBefore).toHaveLength(2)

    // Delete entity (cascade should delete images)
    db.prepare('DELETE FROM entities WHERE id = ?').run(entityId)

    const imagesAfter = db
      .prepare('SELECT * FROM entity_images WHERE entity_id = ?')
      .all(entityId)
    expect(imagesAfter).toHaveLength(0)
  })
})

describe('Entity Images - Query Patterns', () => {
  it('should get images with entity info', () => {
    const entityId = createEntity('Query NPC')
    createImage(entityId, 'images/portrait.jpg', { caption: 'Main portrait' })

    const result = db
      .prepare(`
        SELECT ei.*, e.name as entity_name
        FROM entity_images ei
        JOIN entities e ON e.id = ei.entity_id
        WHERE ei.entity_id = ?
      `)
      .get(entityId) as { image_url: string; entity_name: string; caption: string }

    expect(result.image_url).toBe('images/portrait.jpg')
    expect(result.entity_name).toBe('Query NPC')
    expect(result.caption).toBe('Main portrait')
  })

  it('should get entity with image count', () => {
    const entityId = createEntity('Count Query NPC')

    createImage(entityId, 'images/img1.jpg')
    createImage(entityId, 'images/img2.jpg')
    createImage(entityId, 'images/img3.jpg')

    const result = db
      .prepare(`
        SELECT e.name, COUNT(ei.id) as image_count
        FROM entities e
        LEFT JOIN entity_images ei ON ei.entity_id = e.id
        WHERE e.id = ?
        GROUP BY e.id
      `)
      .get(entityId) as { name: string; image_count: number }

    expect(result.name).toBe('Count Query NPC')
    expect(result.image_count).toBe(3)
  })

  it('should get entity with primary image', () => {
    const entityId = createEntity('Primary Query NPC')

    createImage(entityId, 'images/other.jpg', { isPrimary: false })
    createImage(entityId, 'images/primary.jpg', { isPrimary: true })

    const result = db
      .prepare(`
        SELECT e.name, ei.image_url as primary_image
        FROM entities e
        LEFT JOIN entity_images ei ON ei.entity_id = e.id AND ei.is_primary = 1
        WHERE e.id = ?
      `)
      .get(entityId) as { name: string; primary_image: string }

    expect(result.name).toBe('Primary Query NPC')
    expect(result.primary_image).toBe('images/primary.jpg')
  })
})

describe('Entity Images - Timestamps', () => {
  it('should set created_at on creation', () => {
    const entityId = createEntity('Timestamp NPC')
    const imageId = createImage(entityId, 'images/timestamp.jpg')

    const image = db
      .prepare('SELECT created_at FROM entity_images WHERE id = ?')
      .get(imageId) as { created_at: string }

    expect(image.created_at).toBeDefined()
    expect(new Date(image.created_at)).toBeInstanceOf(Date)
  })
})
