/**
 * Generic entity relation type returned by /api/entities/[id]/related/[entityType]
 * Used for NPC → Items, NPC → Lore, Item → Locations, etc.
 */
export interface EntityRelation<TMetadata = Record<string, unknown>, TNotes = unknown> {
  id: number // Relation ID
  from_entity_id: number
  to_entity_id: number
  relation_type: string
  notes: TNotes | null
  created_at: string
  name: string
  description: string | null
  metadata: TMetadata | null
  image_url: string | null
  direction: 'outgoing' | 'incoming'
}

/**
 * Specific relation types for common use cases
 */

// NPC → Item relation (with item-specific metadata)
export type NpcItemRelation = EntityRelation<
  {
    type?: string
    rarity?: string
    value?: string
    weight?: string
    attunement?: boolean
    charges?: string
    properties?: string
  },
  {
    quantity?: number
    equipped?: boolean
  }
>

// NPC → Lore relation
export type NpcLoreRelation = EntityRelation<
  {
    type?: string
    date?: string
  },
  unknown
>

// NPC → Faction relation (membership)
export type NpcFactionRelation = EntityRelation<
  {
    type?: string
    alignment?: string
    goals?: string
    headquarters?: string
  },
  {
    rank?: string
  }
>

// Location → NPC relation
export type LocationNpcRelation = EntityRelation<
  {
    race?: string
    class?: string
    location?: string
    faction?: string
    relationship?: string
    type?: string
    status?: string
    age?: number
    gender?: string
  },
  unknown
>
