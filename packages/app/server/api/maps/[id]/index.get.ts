import { getDb } from '~~/server/utils/db'
import type { CampaignMap, MapMarker, MapArea } from '~~/types/map'

interface MarkerRow {
  id: number
  map_id: number
  entity_id: number
  x: number
  y: number
  custom_icon: string | null
  custom_color: string | null
  custom_label: string | null
  notes: string | null
  created_at: string
  updated_at: string
  entity_name: string
  entity_type: string
  entity_type_id: number
  entity_image_url: string | null
  entity_description: string | null
}

interface AreaRow {
  id: number
  map_id: number
  location_id: number
  center_x: number
  center_y: number
  radius: number
  color: string | null
  created_at: string
  updated_at: string
  location_name: string
  location_description: string | null
  location_image_url: string | null
}

export default defineEventHandler(async (event) => {
  const db = getDb()
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Map ID is required',
    })
  }

  const map = db
    .prepare(
      `
      SELECT * FROM campaign_maps
      WHERE id = ? AND deleted_at IS NULL
    `,
    )
    .get(Number(id)) as CampaignMap | undefined

  if (!map) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Map not found',
    })
  }

  // Get markers with entity details
  const markers = db
    .prepare(
      `
      SELECT
        mm.*,
        e.name as entity_name,
        et.name as entity_type,
        e.type_id as entity_type_id,
        e.image_url as entity_image_url,
        e.description as entity_description
      FROM map_markers mm
      JOIN entities e ON mm.entity_id = e.id
      JOIN entity_types et ON e.type_id = et.id
      WHERE mm.map_id = ? AND e.deleted_at IS NULL
      ORDER BY mm.created_at ASC
    `,
    )
    .all(Number(id)) as MarkerRow[]

  // Get areas (location circles) with location details
  const areas = db
    .prepare(
      `
      SELECT
        ma.*,
        e.name as location_name,
        e.description as location_description,
        e.image_url as location_image_url
      FROM map_areas ma
      JOIN entities e ON ma.location_id = e.id
      WHERE ma.map_id = ? AND e.deleted_at IS NULL
      ORDER BY ma.created_at ASC
    `,
    )
    .all(Number(id)) as AreaRow[]

  // Get versions (other maps with same parent or this as parent)
  const versions = db
    .prepare(
      `
      SELECT * FROM campaign_maps
      WHERE deleted_at IS NULL AND (
        (parent_map_id = ? AND id != ?) OR
        (id = ? AND parent_map_id IS NOT NULL) OR
        (parent_map_id = (SELECT parent_map_id FROM campaign_maps WHERE id = ?) AND parent_map_id IS NOT NULL)
      )
      ORDER BY version_name ASC
    `,
    )
    .all(Number(id), Number(id), Number(id), Number(id)) as CampaignMap[]

  return {
    ...map,
    markers: markers as MapMarker[],
    areas: areas as MapArea[],
    _versions: versions,
    _markerCount: markers.length,
    _areaCount: areas.length,
  }
})
