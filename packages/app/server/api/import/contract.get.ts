import { getDb } from '~~/server/utils/db'
import { NPC_RELATION_TYPES, NPC_TYPES, NPC_STATUSES, NPC_ITEM_RELATION_TYPES, NPC_LOCATION_RELATION_TYPES } from '~~/types/npc'
import { LORE_TYPES } from '~~/types/lore'
import { FACTION_TYPES, FACTION_RELATION_TYPES } from '~~/types/faction'

/**
 * Self-describing contract for the AI bulk-import endpoint.
 *
 * An external AI agent has only the packaged app — no source. This endpoint
 * hands it everything it needs to build a valid `/api/import/bulk` payload:
 * which entity types exist, which relation types are valid, the available
 * races/classes/item-types (so metadata is stored as keys not free text),
 * the per-type metadata shape, and a full worked example.
 *
 * GET /api/import/contract → the contract. Reference data (races/classes/item
 * types) is global — including user-created custom ones — so it is NOT scoped
 * to a campaign.
 */
export default defineEventHandler(() => {
  const db = getDb()

  const races = db.prepare('SELECT key, name_de, name_en FROM races WHERE deleted_at IS NULL ORDER BY name').all() as Array<{ key: string, name_de: string | null, name_en: string | null }>
  const classes = db.prepare('SELECT key, name_de, name_en FROM classes WHERE deleted_at IS NULL ORDER BY name').all() as Array<{ key: string, name_de: string | null, name_en: string | null }>
  const itemTypes = db.prepare('SELECT name, name_de, name_en FROM item_types WHERE deleted_at IS NULL ORDER BY name').all() as Array<{ name: string, name_de: string | null, name_en: string | null }>
  const itemRarities = db.prepare('SELECT name, name_de, name_en FROM item_rarities WHERE deleted_at IS NULL ORDER BY name').all() as Array<{ name: string, name_de: string | null, name_en: string | null }>

  return {
    version: 1,
    description: 'Contract for POST /api/import/bulk. Build a payload of entities (each with a local "ref" like "npc:1") plus relations referencing those refs. Send with ?dryRun=true first to preview, then without to commit.',

    // Entity types you can create. "maps" are intentionally NOT importable.
    entityTypes: ['NPC', 'Location', 'Item', 'Faction', 'Lore'],

    // Relation types (i18n keys) for `relations[].type`, grouped by what they
    // connect. The column is free text so any key is accepted, but prefer
    // these recognized ones — they get proper labels + icons in the UI.
    relationTypes: {
      npcToNpc: NPC_RELATION_TYPES,
      npcToItem: NPC_ITEM_RELATION_TYPES,
      npcToLocation: NPC_LOCATION_RELATION_TYPES,
      factionToFaction: FACTION_RELATION_TYPES,
    },

    // Per-type metadata. Values for race/class/type/rarity may be given as the
    // key OR a localized name — the server normalises them to keys on save.
    metadata: {
      NPC: {
        race: { type: 'string', oneOf: races.map(r => r.key), note: 'key or localized name' },
        class: { type: 'string | string[]', oneOf: classes.map(c => c.key) },
        type: { type: 'string | string[]', oneOf: NPC_TYPES },
        status: { type: 'string', oneOf: NPC_STATUSES },
        gender: { type: 'string' },
        age: { type: 'number' },
      },
      Item: {
        type: { type: 'string', oneOf: itemTypes.map(t => t.name) },
        rarity: { type: 'string', oneOf: itemRarities.map(r => r.name) },
      },
      Faction: {
        type: { type: 'string', oneOf: FACTION_TYPES },
      },
      Lore: {
        type: { type: 'string', oneOf: LORE_TYPES },
      },
      Location: {
        // Locations carry free-form metadata; no constrained keys.
      },
    },

    // Reference data (key + localized labels) so the AI can resolve names.
    referenceData: {
      races,
      classes,
      itemTypes,
      itemRarities,
    },

    // Optional extras supported per entity.
    extras: {
      tags: 'string[] — lowercase a-z + hyphens; created if missing',
      folder: 'string — folder name for NPC/Item/Faction/Lore; created if missing',
      image: 'NOT YET — image import lands in a later phase',
    },

    // A complete, valid example payload.
    example: {
      campaignId: 1,
      entities: [
        {
          ref: 'npc:1',
          type: 'NPC',
          name: 'Gandalf der Graue',
          description: 'Ein wandernder Zauberer (Istari).',
          metadata: { race: 'human', class: 'wizard', type: ['mentor'], gender: 'male' },
          tags: ['wichtig', 'magier'],
          folder: 'Gefährten',
        },
        {
          ref: 'item:1',
          type: 'Item',
          name: 'Glamdring',
          description: 'Ein altes Elbenschwert.',
          metadata: { type: 'weapon', rarity: 'rare' },
        },
        {
          ref: 'lore:1',
          type: 'Lore',
          name: 'Der Weiße Rat',
          metadata: { type: 'organization' },
        },
      ],
      relations: [
        { from: 'npc:1', to: 'item:1', type: 'owns' },
        { from: 'npc:1', to: 'lore:1', type: 'knows' },
      ],
    },

    // Linking to entities that already exist, and editing them.
    workingWithExisting: {
      search: 'GET /api/import/entities?campaignId&q&type — find existing entities by name/type and get their ids. Always prefer linking to an existing entity over creating a duplicate.',
      linkExisting: 'In a relation, a `from`/`to` may be a payload ref ("npc:1") OR an existing entity as "existing:<id>". So a new NPC can link to an entity that already exists (e.g. { from: "npc:1", to: "existing:123", type: "livesIn" }), and two existing entities can be linked too.',
      edit: 'POST /api/import/update — change existing entities by id: { campaignId, updates: [{ id, name?, description?, metadata?, folder?, tags? }] }. metadata is MERGED (a key set to null removes it); tags REPLACE the set. Supports ?dryRun=true.',
    },

    note: 'Relations are bidirectional. `type` is stored verbatim — pick from relationTypes for proper labels. Relation ends accept "existing:<id>" to link to entities that already exist (find ids via GET /api/import/entities).',
  }
})
