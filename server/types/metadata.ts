/**
 * Shared metadata type definitions for entity types
 * Used across API endpoints for type-safe metadata parsing
 */

/**
 * NPC Metadata
 * Stored in entities.metadata for NPCs
 */
export interface NpcMetadata {
  race?: string
  class?: string
  type?: string
  status?: string
  location?: string
  faction?: string
  relationship?: string
  [key: string]: unknown // Allow additional custom properties
}

/**
 * Item Metadata
 * Stored in entities.metadata for Items
 */
export interface ItemMetadata {
  type?: string
  rarity?: string
  value?: number
  attunement?: boolean
  weight?: number
  damage?: string
  armor_class?: number
  [key: string]: unknown
}

/**
 * Location Metadata
 * Stored in entities.metadata for Locations
 */
export interface LocationMetadata {
  type?: string
  region?: string
  population?: number
  [key: string]: unknown
}

/**
 * Faction Metadata
 * Stored in entities.metadata for Factions
 */
export interface FactionMetadata {
  type?: string
  size?: string
  alignment?: string
  [key: string]: unknown
}

/**
 * Generic entity metadata union type
 * Use when parsing metadata without knowing the specific entity type
 */
export type EntityMetadata = NpcMetadata | ItemMetadata | LocationMetadata | FactionMetadata
