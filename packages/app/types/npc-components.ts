/**
 * Component-specific types for NPC edit dialog and related components.
 * These are VIEW MODELS that the parent component creates from API responses.
 */

/**
 * NPC → Item relation for NpcItemsTab component
 */
export interface NpcItem {
  id: number // Relation ID
  relation_id: number // Same as id (legacy)
  name: string
  description?: string | null
  relation_type: string
  quantity?: number | null
  equipped?: boolean | null
  rarity?: string | null
  image_url?: string | null
}

/**
 * NPC → Faction membership for NpcMembershipsTab component
 */
export interface NpcMembership {
  id: number // Relation ID
  from_entity_id: number
  to_entity_id: number
  to_entity_name: string
  to_entity_type: string
  relation_type: string
  notes: Record<string, unknown> | null
  created_at: string
}

/**
 * Lore item for v-select dropdown in NpcLoreTab
 */
export interface LoreSelectItem {
  title: string
  value: number
}
