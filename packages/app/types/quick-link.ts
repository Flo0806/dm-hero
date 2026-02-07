import {
  NPC_RELATION_TYPES,
  NPC_LOCATION_RELATION_TYPES,
  NPC_ITEM_RELATION_TYPES,
} from './npc'
import { ITEM_RELATION_TYPES } from './item'
import { LOCATION_ITEM_RELATION_TYPES } from './location'
import { FACTION_RELATION_TYPES, FACTION_LOCATION_TYPES, FACTION_MEMBERSHIP_TYPES } from './faction'
import { PLAYER_RELATION_TYPES } from './player'

export interface QuickLinkTargetConfig {
  targetType: 'NPC' | 'Location' | 'Item' | 'Faction' | 'Lore' | 'Player'
  labelKey: string
  icon: string
  relationTypes: readonly string[]
  i18nPrefix: string
}

// Simple relation type for entities that don't need specific types (e.g., Lore)
// When an entity has only this single type, the context menu skips the submenu
export const SIMPLE_RELATION_TYPE = ['related'] as const

// Quick link configuration per source entity type
export const QUICK_LINK_CONFIG: Record<string, QuickLinkTargetConfig[]> = {
  // NPC can link to: NPC, Location, Item, Faction, Player
  NPC: [
    {
      targetType: 'NPC',
      labelKey: 'quickLink.linkNpc',
      icon: 'mdi-account',
      relationTypes: NPC_RELATION_TYPES,
      i18nPrefix: 'npcs.npcRelationTypes',
    },
    {
      targetType: 'Location',
      labelKey: 'quickLink.linkLocation',
      icon: 'mdi-map-marker',
      relationTypes: NPC_LOCATION_RELATION_TYPES,
      i18nPrefix: 'npcs.relationTypes',
    },
    {
      targetType: 'Item',
      labelKey: 'quickLink.linkItem',
      icon: 'mdi-sword',
      relationTypes: NPC_ITEM_RELATION_TYPES,
      i18nPrefix: 'items.ownerRelationTypes',
    },
    {
      targetType: 'Faction',
      labelKey: 'quickLink.joinFaction',
      icon: 'mdi-shield-account',
      relationTypes: FACTION_MEMBERSHIP_TYPES,
      i18nPrefix: 'factions.membershipTypes',
    },
    {
      targetType: 'Player',
      labelKey: 'quickLink.linkPlayer',
      icon: 'mdi-account-star',
      relationTypes: PLAYER_RELATION_TYPES,
      i18nPrefix: 'players.relationTypes',
    },
  ],

  // Item can link to: NPC (owner), Location, Item, Faction, Lore, Player
  Item: [
    {
      targetType: 'NPC',
      labelKey: 'quickLink.linkNpc',
      icon: 'mdi-account',
      relationTypes: NPC_ITEM_RELATION_TYPES,
      i18nPrefix: 'items.ownerRelationTypes',
    },
    {
      targetType: 'Location',
      labelKey: 'quickLink.linkLocation',
      icon: 'mdi-map-marker',
      relationTypes: ['contains'] as const, // Fixed type like in ItemEditDialog
      i18nPrefix: 'locations.itemRelationTypes',
    },
    {
      targetType: 'Item',
      labelKey: 'quickLink.linkItem',
      icon: 'mdi-sword',
      relationTypes: ITEM_RELATION_TYPES,
      i18nPrefix: 'items.itemRelationTypes',
    },
    {
      targetType: 'Faction',
      labelKey: 'quickLink.linkFaction',
      icon: 'mdi-shield-account',
      relationTypes: ['possesses'] as const, // Fixed type like in ItemEditDialog
      i18nPrefix: 'items.factionRelationTypes',
    },
    {
      targetType: 'Lore',
      labelKey: 'quickLink.linkLore',
      icon: 'mdi-book-open-variant',
      relationTypes: ['references'] as const, // Fixed type like in ItemEditDialog
      i18nPrefix: 'items.loreRelationTypes',
    },
    {
      targetType: 'Player',
      labelKey: 'quickLink.linkPlayer',
      icon: 'mdi-account-star',
      relationTypes: PLAYER_RELATION_TYPES,
      i18nPrefix: 'players.relationTypes',
    },
  ],

  // Location can link to: NPC, Item, Faction, Lore, Player
  Location: [
    {
      targetType: 'NPC',
      labelKey: 'quickLink.linkNpc',
      icon: 'mdi-account',
      relationTypes: NPC_LOCATION_RELATION_TYPES,
      i18nPrefix: 'npcs.relationTypes',
    },
    {
      targetType: 'Item',
      labelKey: 'quickLink.linkItem',
      icon: 'mdi-sword',
      relationTypes: LOCATION_ITEM_RELATION_TYPES,
      i18nPrefix: 'locations.itemRelationTypes',
    },
    {
      targetType: 'Faction',
      labelKey: 'quickLink.linkFaction',
      icon: 'mdi-shield-account',
      relationTypes: FACTION_LOCATION_TYPES,
      i18nPrefix: 'factions.locationTypes',
    },
    {
      targetType: 'Lore',
      labelKey: 'quickLink.linkLore',
      icon: 'mdi-book-open-variant',
      relationTypes: SIMPLE_RELATION_TYPE,
      i18nPrefix: 'quickLink',
    },
    {
      targetType: 'Player',
      labelKey: 'quickLink.linkPlayer',
      icon: 'mdi-account-star',
      relationTypes: NPC_LOCATION_RELATION_TYPES,
      i18nPrefix: 'npcs.relationTypes',
    },
  ],

  // Faction can link to: NPC, Faction, Location, Item, Lore, Player
  Faction: [
    {
      targetType: 'NPC',
      labelKey: 'quickLink.linkNpc',
      icon: 'mdi-account',
      relationTypes: FACTION_MEMBERSHIP_TYPES,
      i18nPrefix: 'factions.membershipTypes',
    },
    {
      targetType: 'Faction',
      labelKey: 'quickLink.linkFaction',
      icon: 'mdi-shield-account',
      relationTypes: FACTION_RELATION_TYPES,
      i18nPrefix: 'factions.factionRelationTypes',
    },
    {
      targetType: 'Location',
      labelKey: 'quickLink.linkLocation',
      icon: 'mdi-map-marker',
      relationTypes: FACTION_LOCATION_TYPES,
      i18nPrefix: 'factions.locationTypes',
    },
    {
      targetType: 'Item',
      labelKey: 'quickLink.linkItem',
      icon: 'mdi-sword',
      relationTypes: SIMPLE_RELATION_TYPE,
      i18nPrefix: 'quickLink',
    },
    {
      targetType: 'Lore',
      labelKey: 'quickLink.linkLore',
      icon: 'mdi-book-open-variant',
      relationTypes: SIMPLE_RELATION_TYPE,
      i18nPrefix: 'quickLink',
    },
    {
      targetType: 'Player',
      labelKey: 'quickLink.linkPlayer',
      icon: 'mdi-account-star',
      relationTypes: PLAYER_RELATION_TYPES,
      i18nPrefix: 'players.relationTypes',
    },
  ],

  // Lore can link to: NPC, Location, Item, Faction, Player
  // Lore uses simple links without relation type selection (like in LoreEditDialog)
  Lore: [
    {
      targetType: 'NPC',
      labelKey: 'quickLink.linkNpc',
      icon: 'mdi-account',
      relationTypes: SIMPLE_RELATION_TYPE,
      i18nPrefix: 'quickLink',
    },
    {
      targetType: 'Location',
      labelKey: 'quickLink.linkLocation',
      icon: 'mdi-map-marker',
      relationTypes: SIMPLE_RELATION_TYPE,
      i18nPrefix: 'quickLink',
    },
    {
      targetType: 'Item',
      labelKey: 'quickLink.linkItem',
      icon: 'mdi-sword',
      relationTypes: SIMPLE_RELATION_TYPE,
      i18nPrefix: 'quickLink',
    },
    {
      targetType: 'Faction',
      labelKey: 'quickLink.linkFaction',
      icon: 'mdi-shield-account',
      relationTypes: SIMPLE_RELATION_TYPE,
      i18nPrefix: 'quickLink',
    },
    {
      targetType: 'Player',
      labelKey: 'quickLink.linkPlayer',
      icon: 'mdi-account-star',
      relationTypes: SIMPLE_RELATION_TYPE,
      i18nPrefix: 'quickLink',
    },
  ],

  // Player can link to: NPC, Location, Item, Lore, Faction
  Player: [
    {
      targetType: 'NPC',
      labelKey: 'quickLink.linkNpc',
      icon: 'mdi-account',
      relationTypes: PLAYER_RELATION_TYPES,
      i18nPrefix: 'players.relationTypes',
    },
    {
      targetType: 'Location',
      labelKey: 'quickLink.linkLocation',
      icon: 'mdi-map-marker',
      relationTypes: PLAYER_RELATION_TYPES,
      i18nPrefix: 'players.relationTypes',
    },
    {
      targetType: 'Item',
      labelKey: 'quickLink.linkItem',
      icon: 'mdi-sword',
      relationTypes: NPC_ITEM_RELATION_TYPES,
      i18nPrefix: 'players.itemRelationTypes',
    },
    {
      targetType: 'Lore',
      labelKey: 'quickLink.linkLore',
      icon: 'mdi-book-open-variant',
      relationTypes: PLAYER_RELATION_TYPES,
      i18nPrefix: 'players.loreRelationTypes',
    },
    {
      targetType: 'Faction',
      labelKey: 'quickLink.linkFaction',
      icon: 'mdi-shield-account',
      relationTypes: FACTION_MEMBERSHIP_TYPES,
      i18nPrefix: 'factions.membershipTypes',
    },
  ],
}

export type SourceEntityType = 'NPC' | 'Item' | 'Location' | 'Faction' | 'Lore' | 'Player'

export interface QuickLinkSelection {
  targetType: string
  relationType: string
}
