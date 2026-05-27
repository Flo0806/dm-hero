import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getTestDb } from '../utils/test-db'

describe('Image Gallery Synchronization', () => {
  let db: ReturnType<typeof getTestDb>
  let testEntityId: number

  beforeEach(async () => {
    db = getTestDb()

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
      .run(campaign.id, npcType.id, 'Test Image Sync Entity', 'Test description')

    testEntityId = result.lastInsertRowid as number
  })

  afterEach(() => {
    // Clean up test entity (cascades to entity_images)
    db.prepare('DELETE FROM entity_images WHERE entity_id = ?').run(testEntityId)
    db.prepare('DELETE FROM entities WHERE id = ?').run(testEntityId)
  })

  describe('set-image API behavior', () => {
    it('should add image to entity_images when setting main image', () => {
      const imageUrl = `test-set-image-${Date.now()}.png`

      // Simulate set-image API behavior: add to gallery + set as primary
      db.prepare('UPDATE entity_images SET is_primary = 0 WHERE entity_id = ?').run(testEntityId)

      const maxOrderResult = db
        .prepare('SELECT COALESCE(MAX(display_order), -1) as max_order FROM entity_images WHERE entity_id = ?')
        .get(testEntityId) as { max_order: number }

      db.prepare(
        `INSERT INTO entity_images (entity_id, image_url, is_primary, display_order)
         VALUES (?, ?, 1, ?)`,
      ).run(testEntityId, imageUrl, maxOrderResult.max_order + 1)

      db.prepare('UPDATE entities SET image_url = ? WHERE id = ?').run(imageUrl, testEntityId)

      // Verify image is in gallery
      const galleryImages = db
        .prepare('SELECT * FROM entity_images WHERE entity_id = ?')
        .all(testEntityId) as Array<{ image_url: string, is_primary: number }>

      expect(galleryImages).toHaveLength(1)
      expect(galleryImages[0].image_url).toBe(imageUrl)
      expect(galleryImages[0].is_primary).toBe(1)

      // Verify entity has the image
      const entity = db.prepare('SELECT image_url FROM entities WHERE id = ?').get(testEntityId) as {
        image_url: string
      }
      expect(entity.image_url).toBe(imageUrl)
    })

    it('should make existing image primary if it already exists in gallery', () => {
      const imageUrl = `existing-image-${Date.now()}.png`

      // First, add image to gallery (not primary)
      db.prepare(
        `INSERT INTO entity_images (entity_id, image_url, is_primary, display_order)
         VALUES (?, ?, 0, 0)`,
      ).run(testEntityId, imageUrl)

      // Add another image as primary
      db.prepare(
        `INSERT INTO entity_images (entity_id, image_url, is_primary, display_order)
         VALUES (?, ?, 1, 1)`,
      ).run(testEntityId, 'other-image.png')

      // Now simulate set-image with the first image
      const existingImage = db
        .prepare('SELECT id FROM entity_images WHERE entity_id = ? AND image_url = ?')
        .get(testEntityId, imageUrl) as { id: number } | undefined

      expect(existingImage).toBeDefined()

      // Reset primaries and set existing as primary
      db.prepare('UPDATE entity_images SET is_primary = 0 WHERE entity_id = ?').run(testEntityId)
      db.prepare('UPDATE entity_images SET is_primary = 1 WHERE id = ?').run(existingImage!.id)
      db.prepare('UPDATE entities SET image_url = ? WHERE id = ?').run(imageUrl, testEntityId)

      // Verify
      const images = db
        .prepare('SELECT image_url, is_primary FROM entity_images WHERE entity_id = ? ORDER BY display_order')
        .all(testEntityId) as Array<{ image_url: string, is_primary: number }>

      expect(images).toHaveLength(2)

      const primaryImage = images.find(img => img.is_primary === 1)
      expect(primaryImage?.image_url).toBe(imageUrl)
    })

    it('should only have one primary image at a time', () => {
      // Add multiple images
      const images = ['img1.png', 'img2.png', 'img3.png']
      for (let i = 0; i < images.length; i++) {
        db.prepare(
          `INSERT INTO entity_images (entity_id, image_url, is_primary, display_order)
           VALUES (?, ?, ?, ?)`,
        ).run(testEntityId, images[i], i === 0 ? 1 : 0, i)
      }

      // Set third image as primary (simulating set-image)
      db.prepare('UPDATE entity_images SET is_primary = 0 WHERE entity_id = ?').run(testEntityId)
      db.prepare('UPDATE entity_images SET is_primary = 1 WHERE entity_id = ? AND image_url = ?').run(
        testEntityId,
        'img3.png',
      )

      // Count primary images
      const primaryCount = db
        .prepare('SELECT COUNT(*) as count FROM entity_images WHERE entity_id = ? AND is_primary = 1')
        .get(testEntityId) as { count: number }

      expect(primaryCount.count).toBe(1)

      // Verify it's the correct one
      const primaryImage = db
        .prepare('SELECT image_url FROM entity_images WHERE entity_id = ? AND is_primary = 1')
        .get(testEntityId) as { image_url: string }

      expect(primaryImage.image_url).toBe('img3.png')
    })
  })

  describe('upload-image API behavior', () => {
    it('should set uploaded image as primary when uploading from details tab', () => {
      // First, add an existing primary image
      db.prepare(
        `INSERT INTO entity_images (entity_id, image_url, is_primary, display_order)
         VALUES (?, ?, 1, 0)`,
      ).run(testEntityId, 'old-primary.png')

      // Simulate upload-image behavior: new upload becomes primary
      const newImageUrl = `new-upload-${Date.now()}.png`

      // Reset existing primaries
      db.prepare('UPDATE entity_images SET is_primary = 0 WHERE entity_id = ?').run(testEntityId)

      // Add new image as primary
      const maxOrderResult = db
        .prepare('SELECT COALESCE(MAX(display_order), -1) as max_order FROM entity_images WHERE entity_id = ?')
        .get(testEntityId) as { max_order: number }

      db.prepare(
        `INSERT INTO entity_images (entity_id, image_url, is_primary, display_order)
         VALUES (?, ?, 1, ?)`,
      ).run(testEntityId, newImageUrl, maxOrderResult.max_order + 1)

      // Update entity
      db.prepare('UPDATE entities SET image_url = ? WHERE id = ?').run(newImageUrl, testEntityId)

      // Verify
      const images = db
        .prepare('SELECT image_url, is_primary FROM entity_images WHERE entity_id = ?')
        .all(testEntityId) as Array<{ image_url: string, is_primary: number }>

      expect(images).toHaveLength(2)

      const primaryImages = images.filter(img => img.is_primary === 1)
      expect(primaryImages).toHaveLength(1)
      expect(primaryImages[0].image_url).toBe(newImageUrl)

      // Old image should not be primary anymore
      const oldImage = images.find(img => img.image_url === 'old-primary.png')
      expect(oldImage?.is_primary).toBe(0)
    })
  })
})
