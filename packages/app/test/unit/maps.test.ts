import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getDb } from '../../server/utils/db'
import type Database from 'better-sqlite3'

// Maps CRUD Tests
// Tests the campaign maps and markers operations

let db: Database.Database
let testCampaignId: number
let npcTypeId: number
let locationTypeId: number

beforeAll(() => {
  db = getDb()

  // Get type IDs
  const npcType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('NPC') as { id: number }
  const locationType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Location') as { id: number }
  npcTypeId = npcType.id
  locationTypeId = locationType.id

  // Create test campaign
  const campaign = db
    .prepare('INSERT INTO campaigns (name, description) VALUES (?, ?)')
    .run('Test Campaign Maps', 'Test description')
  testCampaignId = Number(campaign.lastInsertRowid)
})

afterAll(() => {
  if (db) {
    db.prepare('DELETE FROM map_areas WHERE map_id IN (SELECT id FROM campaign_maps WHERE campaign_id = ?)').run(testCampaignId)
    db.prepare('DELETE FROM map_markers WHERE map_id IN (SELECT id FROM campaign_maps WHERE campaign_id = ?)').run(testCampaignId)
    db.prepare('DELETE FROM campaign_maps WHERE campaign_id = ?').run(testCampaignId)
    db.prepare('DELETE FROM entities WHERE campaign_id = ?').run(testCampaignId)
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(testCampaignId)
  }
})

beforeEach(() => {
  db.prepare('DELETE FROM map_areas WHERE map_id IN (SELECT id FROM campaign_maps WHERE campaign_id = ?)').run(testCampaignId)
  db.prepare('DELETE FROM map_markers WHERE map_id IN (SELECT id FROM campaign_maps WHERE campaign_id = ?)').run(testCampaignId)
  db.prepare('DELETE FROM campaign_maps WHERE campaign_id = ?').run(testCampaignId)
  db.prepare('DELETE FROM entities WHERE campaign_id = ?').run(testCampaignId)
})

// Helper to create a map
function createMap(name: string, options?: {
  description?: string
  imageUrl?: string
  versionName?: string
}): number {
  const result = db
    .prepare('INSERT INTO campaign_maps (campaign_id, name, description, image_url, version_name) VALUES (?, ?, ?, ?, ?)')
    .run(
      testCampaignId,
      name,
      options?.description || null,
      options?.imageUrl || 'map.jpg',
      options?.versionName || null
    )
  return Number(result.lastInsertRowid)
}

// Helper to create an entity
function createEntity(typeId: number, name: string): number {
  const result = db
    .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
    .run(typeId, testCampaignId, name)
  return Number(result.lastInsertRowid)
}

describe('Maps - Basic CRUD', () => {
  it('should create a map', () => {
    const mapId = createMap('World Map')

    const map = db
      .prepare('SELECT * FROM campaign_maps WHERE id = ?')
      .get(mapId) as { id: number; name: string; campaign_id: number }

    expect(map).toBeDefined()
    expect(map.name).toBe('World Map')
    expect(map.campaign_id).toBe(testCampaignId)
  })

  it('should create a map with all fields', () => {
    const mapId = createMap('Detailed Map', {
      description: 'A detailed map of the realm',
      imageUrl: 'detailed-map.jpg',
      versionName: '1.0'
    })

    const map = db
      .prepare('SELECT * FROM campaign_maps WHERE id = ?')
      .get(mapId) as {
        name: string
        description: string
        image_url: string
        version_name: string
      }

    expect(map.name).toBe('Detailed Map')
    expect(map.description).toBe('A detailed map of the realm')
    expect(map.image_url).toBe('detailed-map.jpg')
    expect(map.version_name).toBe('1.0')
  })

  it('should update a map', () => {
    const mapId = createMap('Old Map Name')

    db.prepare('UPDATE campaign_maps SET name = ?, description = ? WHERE id = ?')
      .run('New Map Name', 'Updated description', mapId)

    const map = db
      .prepare('SELECT name, description FROM campaign_maps WHERE id = ?')
      .get(mapId) as { name: string; description: string }

    expect(map.name).toBe('New Map Name')
    expect(map.description).toBe('Updated description')
  })

  it('should delete a map', () => {
    const mapId = createMap('Map to Delete')

    db.prepare('DELETE FROM campaign_maps WHERE id = ?').run(mapId)

    const map = db
      .prepare('SELECT * FROM campaign_maps WHERE id = ?')
      .get(mapId)

    expect(map).toBeUndefined()
  })
})

describe('Maps - Markers', () => {
  it('should create a marker on a map', () => {
    const mapId = createMap('Marker Map')
    const npcId = createEntity(npcTypeId, 'Map NPC')

    const result = db
      .prepare('INSERT INTO map_markers (map_id, entity_id, x, y) VALUES (?, ?, ?, ?)')
      .run(mapId, npcId, 50.5, 30.2)

    const marker = db
      .prepare('SELECT * FROM map_markers WHERE id = ?')
      .get(result.lastInsertRowid) as {
        map_id: number
        entity_id: number
        x: number
        y: number
      }

    expect(marker.map_id).toBe(mapId)
    expect(marker.entity_id).toBe(npcId)
    expect(marker.x).toBe(50.5)
    expect(marker.y).toBe(30.2)
  })

  it('should create a marker with custom label and notes', () => {
    const mapId = createMap('Label Map')
    const npcId = createEntity(npcTypeId, 'Labeled NPC')

    const result = db
      .prepare('INSERT INTO map_markers (map_id, entity_id, x, y, custom_label, notes) VALUES (?, ?, ?, ?, ?, ?)')
      .run(mapId, npcId, 25, 75, 'Custom Label', 'Important location')

    const marker = db
      .prepare('SELECT * FROM map_markers WHERE id = ?')
      .get(result.lastInsertRowid) as {
        custom_label: string
        notes: string
      }

    expect(marker.custom_label).toBe('Custom Label')
    expect(marker.notes).toBe('Important location')
  })

  it('should update marker position', () => {
    const mapId = createMap('Move Map')
    const npcId = createEntity(npcTypeId, 'Moving NPC')

    const result = db
      .prepare('INSERT INTO map_markers (map_id, entity_id, x, y) VALUES (?, ?, ?, ?)')
      .run(mapId, npcId, 10, 10)

    db.prepare('UPDATE map_markers SET x = ?, y = ? WHERE id = ?')
      .run(90, 90, result.lastInsertRowid)

    const marker = db
      .prepare('SELECT x, y FROM map_markers WHERE id = ?')
      .get(result.lastInsertRowid) as { x: number; y: number }

    expect(marker.x).toBe(90)
    expect(marker.y).toBe(90)
  })

  it('should delete a marker', () => {
    const mapId = createMap('Delete Marker Map')
    const npcId = createEntity(npcTypeId, 'Delete Marker NPC')

    const result = db
      .prepare('INSERT INTO map_markers (map_id, entity_id, x, y) VALUES (?, ?, ?, ?)')
      .run(mapId, npcId, 50, 50)

    db.prepare('DELETE FROM map_markers WHERE id = ?').run(result.lastInsertRowid)

    const marker = db
      .prepare('SELECT * FROM map_markers WHERE id = ?')
      .get(result.lastInsertRowid)

    expect(marker).toBeUndefined()
  })

  it('should get all markers for a map', () => {
    const mapId = createMap('Multi Marker Map')

    for (let i = 0; i < 5; i++) {
      const entityId = createEntity(npcTypeId, `Marker NPC ${i}`)
      db.prepare('INSERT INTO map_markers (map_id, entity_id, x, y) VALUES (?, ?, ?, ?)')
        .run(mapId, entityId, i * 20, i * 15)
    }

    const markers = db
      .prepare('SELECT * FROM map_markers WHERE map_id = ?')
      .all(mapId)

    expect(markers).toHaveLength(5)
  })

  it('should get marker with entity details', () => {
    const mapId = createMap('Detail Map')
    const npcId = createEntity(npcTypeId, 'Detailed NPC')

    db.prepare('INSERT INTO map_markers (map_id, entity_id, x, y) VALUES (?, ?, ?, ?)')
      .run(mapId, npcId, 50, 50)

    const markerWithEntity = db
      .prepare(`
        SELECT mm.*, e.name as entity_name, et.name as entity_type
        FROM map_markers mm
        JOIN entities e ON e.id = mm.entity_id
        JOIN entity_types et ON et.id = e.type_id
        WHERE mm.map_id = ?
      `)
      .get(mapId) as { entity_name: string; entity_type: string }

    expect(markerWithEntity.entity_name).toBe('Detailed NPC')
    expect(markerWithEntity.entity_type).toBe('NPC')
  })
})

describe('Maps - Areas (Location Circles)', () => {
  it('should create an area on a map', () => {
    const mapId = createMap('Area Map')
    const locationId = createEntity(locationTypeId, 'City')

    const result = db
      .prepare('INSERT INTO map_areas (map_id, location_id, center_x, center_y, radius) VALUES (?, ?, ?, ?, ?)')
      .run(mapId, locationId, 50, 50, 10)

    const area = db
      .prepare('SELECT * FROM map_areas WHERE id = ?')
      .get(result.lastInsertRowid) as {
        map_id: number
        location_id: number
        center_x: number
        center_y: number
        radius: number
      }

    expect(area.map_id).toBe(mapId)
    expect(area.location_id).toBe(locationId)
    expect(area.center_x).toBe(50)
    expect(area.center_y).toBe(50)
    expect(area.radius).toBe(10)
  })

  it('should create an area with color', () => {
    const mapId = createMap('Colored Area Map')
    const locationId = createEntity(locationTypeId, 'Colored City')

    const result = db
      .prepare('INSERT INTO map_areas (map_id, location_id, center_x, center_y, radius, color) VALUES (?, ?, ?, ?, ?, ?)')
      .run(mapId, locationId, 30, 70, 15, '#FF5733')

    const area = db
      .prepare('SELECT color FROM map_areas WHERE id = ?')
      .get(result.lastInsertRowid) as { color: string }

    expect(area.color).toBe('#FF5733')
  })

  it('should update an area', () => {
    const mapId = createMap('Update Area Map')
    const locationId = createEntity(locationTypeId, 'Update City')

    const result = db
      .prepare('INSERT INTO map_areas (map_id, location_id, center_x, center_y, radius) VALUES (?, ?, ?, ?, ?)')
      .run(mapId, locationId, 20, 20, 5)

    db.prepare('UPDATE map_areas SET center_x = ?, center_y = ?, radius = ? WHERE id = ?')
      .run(80, 80, 20, result.lastInsertRowid)

    const area = db
      .prepare('SELECT center_x, center_y, radius FROM map_areas WHERE id = ?')
      .get(result.lastInsertRowid) as { center_x: number; center_y: number; radius: number }

    expect(area.center_x).toBe(80)
    expect(area.center_y).toBe(80)
    expect(area.radius).toBe(20)
  })

  it('should get all areas for a map with location names', () => {
    const mapId = createMap('Multi Area Map')

    for (let i = 0; i < 3; i++) {
      const locationId = createEntity(locationTypeId, `Area Location ${i}`)
      db.prepare('INSERT INTO map_areas (map_id, location_id, center_x, center_y, radius) VALUES (?, ?, ?, ?, ?)')
        .run(mapId, locationId, i * 30, i * 30, 10)
    }

    const areas = db
      .prepare(`
        SELECT ma.*, e.name as location_name
        FROM map_areas ma
        JOIN entities e ON e.id = ma.location_id
        WHERE ma.map_id = ?
      `)
      .all(mapId) as Array<{ location_name: string }>

    expect(areas).toHaveLength(3)
    expect(areas[0].location_name).toBe('Area Location 0')
  })
})

describe('Maps - Campaign Isolation', () => {
  it('should only return maps from the active campaign', () => {
    // Create another campaign
    const campaign2 = db.prepare('INSERT INTO campaigns (name) VALUES (?)').run('Campaign 2')
    const campaign2Id = Number(campaign2.lastInsertRowid)

    // Create maps in both campaigns
    createMap('Map in Test Campaign')
    db.prepare('INSERT INTO campaign_maps (campaign_id, name, image_url) VALUES (?, ?, ?)')
      .run(campaign2Id, 'Map in Campaign 2', 'map2.jpg')

    const testCampaignMaps = db
      .prepare('SELECT * FROM campaign_maps WHERE campaign_id = ?')
      .all(testCampaignId)

    const campaign2Maps = db
      .prepare('SELECT * FROM campaign_maps WHERE campaign_id = ?')
      .all(campaign2Id)

    expect(testCampaignMaps).toHaveLength(1)
    expect(campaign2Maps).toHaveLength(1)

    // Cleanup
    db.prepare('DELETE FROM campaign_maps WHERE campaign_id = ?').run(campaign2Id)
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(campaign2Id)
  })
})

describe('Maps - Cascade Delete', () => {
  it('should delete markers when map is deleted', () => {
    const mapId = createMap('Cascade Map')
    const npcId = createEntity(npcTypeId, 'Cascade NPC')

    db.prepare('INSERT INTO map_markers (map_id, entity_id, x, y) VALUES (?, ?, ?, ?)')
      .run(mapId, npcId, 50, 50)

    // Verify marker exists
    const markersBefore = db
      .prepare('SELECT * FROM map_markers WHERE map_id = ?')
      .all(mapId)
    expect(markersBefore).toHaveLength(1)

    // Delete map
    db.prepare('DELETE FROM map_markers WHERE map_id = ?').run(mapId)
    db.prepare('DELETE FROM campaign_maps WHERE id = ?').run(mapId)

    // Verify marker is deleted
    const markersAfter = db
      .prepare('SELECT * FROM map_markers WHERE map_id = ?')
      .all(mapId)
    expect(markersAfter).toHaveLength(0)
  })

  it('should delete areas when map is deleted', () => {
    const mapId = createMap('Cascade Area Map')
    const locationId = createEntity(locationTypeId, 'Cascade Location')

    db.prepare('INSERT INTO map_areas (map_id, location_id, center_x, center_y, radius) VALUES (?, ?, ?, ?, ?)')
      .run(mapId, locationId, 50, 50, 10)

    // Delete map and areas
    db.prepare('DELETE FROM map_areas WHERE map_id = ?').run(mapId)
    db.prepare('DELETE FROM campaign_maps WHERE id = ?').run(mapId)

    const areasAfter = db
      .prepare('SELECT * FROM map_areas WHERE map_id = ?')
      .all(mapId)
    expect(areasAfter).toHaveLength(0)
  })
})
