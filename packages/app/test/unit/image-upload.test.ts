import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { getDb } from '../../server/utils/db'

describe('Image Upload System', () => {
  let db: ReturnType<typeof getDb>
  let testEntityId: number
  const uploadsPath = join(process.cwd(), 'public', 'uploads')

  beforeEach(async () => {
    db = getDb()

    // Get campaign ID
    const campaign = db.prepare('SELECT id FROM campaigns LIMIT 1').get() as { id: number }

    // Get entity type ID for NPC
    const npcType = db.prepare("SELECT id FROM entity_types WHERE name = 'NPC'").get() as {
      id: number
    }

    // Create test entity
    const result = db
      .prepare(
        `INSERT INTO entities (campaign_id, type_id, name, description)
         VALUES (?, ?, ?, ?)`,
      )
      .run(campaign.id, npcType.id, 'Test Upload NPC', 'Test description')

    testEntityId = result.lastInsertRowid as number
  })

  afterEach(() => {
    // Clean up test images from entity_images table
    const images = db
      .prepare('SELECT image_url FROM entity_images WHERE entity_id = ?')
      .all(testEntityId) as Array<{ image_url: string }>

    for (const img of images) {
      const filePath = join(uploadsPath, img.image_url)
      if (existsSync(filePath)) {
        unlinkSync(filePath)
      }
    }

    // Delete test entity (cascades to entity_images)
    db.prepare('DELETE FROM entities WHERE id = ?').run(testEntityId)
  })

  it('should store image in entity_images table', () => {
    // Simulate image upload (without actual HTTP request)
    const mockImageUrl = `test-${Date.now()}.png`

    db.prepare(
      `INSERT INTO entity_images (entity_id, image_url, is_primary, display_order)
       VALUES (?, ?, ?, ?)`,
    ).run(testEntityId, mockImageUrl, 1, 0)

    const images = db
      .prepare('SELECT * FROM entity_images WHERE entity_id = ?')
      .all(testEntityId) as Array<{
      id: number
      entity_id: number
      image_url: string
      is_primary: number
      display_order: number
    }>

    expect(images).toHaveLength(1)
    expect(images[0].image_url).toBe(mockImageUrl)
    expect(images[0].is_primary).toBe(1)
    expect(images[0].display_order).toBe(0)
  })

  it('should update entities.image_url when first image is uploaded', () => {
    const mockImageUrl = `test-${Date.now()}.png`

    // Insert into entity_images
    db.prepare(
      `INSERT INTO entity_images (entity_id, image_url, is_primary, display_order)
       VALUES (?, ?, ?, ?)`,
    ).run(testEntityId, mockImageUrl, 1, 0)

    // Update entity
    db.prepare('UPDATE entities SET image_url = ? WHERE id = ?').run(mockImageUrl, testEntityId)

    const entity = db.prepare('SELECT image_url FROM entities WHERE id = ?').get(testEntityId) as {
      image_url: string
    }

    expect(entity.image_url).toBe(mockImageUrl)
  })

  it('should set first image as primary', () => {
    const image1 = `test-1-${Date.now()}.png`
    const image2 = `test-2-${Date.now()}.png`

    // Insert first image (primary)
    db.prepare(
      `INSERT INTO entity_images (entity_id, image_url, is_primary, display_order)
       VALUES (?, ?, ?, ?)`,
    ).run(testEntityId, image1, 1, 0)

    // Insert second image (not primary)
    db.prepare(
      `INSERT INTO entity_images (entity_id, image_url, is_primary, display_order)
       VALUES (?, ?, ?, ?)`,
    ).run(testEntityId, image2, 0, 1)

    const images = db
      .prepare('SELECT * FROM entity_images WHERE entity_id = ? ORDER BY display_order')
      .all(testEntityId) as Array<{
      image_url: string
      is_primary: number
    }>

    expect(images).toHaveLength(2)
    expect(images[0].is_primary).toBe(1) // First image
    expect(images[1].is_primary).toBe(0) // Second image
  })

  it('should maintain correct display_order for multiple images', () => {
    const images = ['img1.png', 'img2.png', 'img3.png']

    for (let i = 0; i < images.length; i++) {
      db.prepare(
        `INSERT INTO entity_images (entity_id, image_url, is_primary, display_order)
         VALUES (?, ?, ?, ?)`,
      ).run(testEntityId, images[i], i === 0 ? 1 : 0, i)
    }

    const result = db
      .prepare('SELECT image_url, display_order FROM entity_images WHERE entity_id = ? ORDER BY display_order')
      .all(testEntityId) as Array<{
      image_url: string
      display_order: number
    }>

    expect(result).toHaveLength(3)
    expect(result[0].display_order).toBe(0)
    expect(result[1].display_order).toBe(1)
    expect(result[2].display_order).toBe(2)
  })

  it('should update entities.image_url when uploading replacement image', () => {
    const oldImage = `old-${Date.now()}.png`
    const newImage = `new-${Date.now()}.png`

    // First upload
    db.prepare('UPDATE entities SET image_url = ? WHERE id = ?').run(oldImage, testEntityId)
    db.prepare(
      `INSERT INTO entity_images (entity_id, image_url, is_primary, display_order)
       VALUES (?, ?, ?, ?)`,
    ).run(testEntityId, oldImage, 1, 0)

    // Second upload (should update entity.image_url)
    db.prepare('UPDATE entities SET image_url = ? WHERE id = ?').run(newImage, testEntityId)
    db.prepare(
      `INSERT INTO entity_images (entity_id, image_url, is_primary, display_order)
       VALUES (?, ?, ?, ?)`,
    ).run(testEntityId, newImage, 0, 1)

    const entity = db.prepare('SELECT image_url FROM entities WHERE id = ?').get(testEntityId) as {
      image_url: string
    }

    expect(entity.image_url).toBe(newImage) // Should be updated to newest upload
  })

  it('should handle UUID-only filenames (no timestamp prefix)', () => {
    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|gif|webp)$/i

    const mockImageUrl = 'a1b2c3d4-1234-4567-89ab-0123456789ab.png'

    expect(uuidRegex.test(mockImageUrl)).toBe(true)

    // Should NOT have timestamp prefix
    const timestampPrefixRegex = /^\d{13}-/
    expect(timestampPrefixRegex.test(mockImageUrl)).toBe(false)
  })
})
