import { describe, it, expect } from 'vitest'
import { QUICK_LINK_CONFIG, SIMPLE_RELATION_TYPE, type SourceEntityType } from '../../types/quick-link'

const ALL_ENTITY_TYPES: SourceEntityType[] = ['NPC', 'Item', 'Location', 'Faction', 'Lore', 'Player']
const VALID_TARGET_TYPES = ['NPC', 'Item', 'Location', 'Faction', 'Lore', 'Player']

describe('Quick Link Configuration', () => {
  describe('coverage', () => {
    it('should have config for all 6 entity types', () => {
      for (const entityType of ALL_ENTITY_TYPES) {
        expect(QUICK_LINK_CONFIG[entityType]).toBeDefined()
        expect(Array.isArray(QUICK_LINK_CONFIG[entityType])).toBe(true)
        expect(QUICK_LINK_CONFIG[entityType].length).toBeGreaterThan(0)
      }
    })

    it('should only have configs for known entity types', () => {
      const configuredTypes = Object.keys(QUICK_LINK_CONFIG)
      for (const type of configuredTypes) {
        expect(ALL_ENTITY_TYPES).toContain(type)
      }
    })
  })

  describe('structure validation', () => {
    for (const sourceType of ALL_ENTITY_TYPES) {
      describe(`${sourceType} config`, () => {
        const configs = QUICK_LINK_CONFIG[sourceType]

        it('should have no duplicate target types', () => {
          const targetTypes = configs.map((c) => c.targetType)
          const uniqueTargets = new Set(targetTypes)
          expect(targetTypes.length).toBe(uniqueTargets.size)
        })

        it('should not link to itself (except NPC, Faction, Item)', () => {
          // NPC-to-NPC, Faction-to-Faction, and Item-to-Item relations are valid
          if (sourceType !== 'NPC' && sourceType !== 'Faction' && sourceType !== 'Item') {
            const targetTypes = configs.map((c) => c.targetType)
            expect(targetTypes).not.toContain(sourceType)
          }
        })

        for (const config of configs) {
          describe(`-> ${config.targetType}`, () => {
            it('should have valid target type', () => {
              expect(VALID_TARGET_TYPES).toContain(config.targetType)
            })

            it('should have labelKey', () => {
              expect(config.labelKey).toBeDefined()
              expect(config.labelKey.length).toBeGreaterThan(0)
              expect(config.labelKey).toMatch(/^quickLink\./)
            })

            it('should have valid mdi icon', () => {
              expect(config.icon).toBeDefined()
              expect(config.icon).toMatch(/^mdi-/)
            })

            it('should have non-empty relationTypes', () => {
              expect(config.relationTypes).toBeDefined()
              expect(Array.isArray(config.relationTypes)).toBe(true)
              expect(config.relationTypes.length).toBeGreaterThan(0)
            })

            it('should have i18nPrefix', () => {
              expect(config.i18nPrefix).toBeDefined()
              expect(config.i18nPrefix.length).toBeGreaterThan(0)
            })

            it('should have no empty relation type strings', () => {
              for (const relationType of config.relationTypes) {
                expect(relationType.length).toBeGreaterThan(0)
              }
            })
          })
        }
      })
    }
  })

  describe('SIMPLE_RELATION_TYPE', () => {
    it('should have exactly one entry', () => {
      expect(SIMPLE_RELATION_TYPE.length).toBe(1)
    })

    it('should be "related"', () => {
      expect(SIMPLE_RELATION_TYPE[0]).toBe('related')
    })
  })

  describe('bidirectional consistency', () => {
    // If NPC can link to Item, Item should be able to link to NPC
    it('NPC <-> Item links should be bidirectional', () => {
      const npcToItem = QUICK_LINK_CONFIG.NPC.find((c) => c.targetType === 'Item')
      const itemToNpc = QUICK_LINK_CONFIG.Item.find((c) => c.targetType === 'NPC')
      expect(npcToItem).toBeDefined()
      expect(itemToNpc).toBeDefined()
    })

    it('NPC <-> Location links should be bidirectional', () => {
      const npcToLocation = QUICK_LINK_CONFIG.NPC.find((c) => c.targetType === 'Location')
      const locationToNpc = QUICK_LINK_CONFIG.Location.find((c) => c.targetType === 'NPC')
      expect(npcToLocation).toBeDefined()
      expect(locationToNpc).toBeDefined()
    })

    it('NPC <-> Faction links should be bidirectional', () => {
      const npcToFaction = QUICK_LINK_CONFIG.NPC.find((c) => c.targetType === 'Faction')
      const factionToNpc = QUICK_LINK_CONFIG.Faction.find((c) => c.targetType === 'NPC')
      expect(npcToFaction).toBeDefined()
      expect(factionToNpc).toBeDefined()
    })

    it('Location <-> Faction links should be bidirectional', () => {
      const locationToFaction = QUICK_LINK_CONFIG.Location.find((c) => c.targetType === 'Faction')
      const factionToLocation = QUICK_LINK_CONFIG.Faction.find((c) => c.targetType === 'Location')
      expect(locationToFaction).toBeDefined()
      expect(factionToLocation).toBeDefined()
    })

    it('Faction <-> Faction links should exist (faction relations)', () => {
      const factionToFaction = QUICK_LINK_CONFIG.Faction.find((c) => c.targetType === 'Faction')
      expect(factionToFaction).toBeDefined()
    })
  })

  describe('submenu behavior', () => {
    // Single relation type = no submenu (direct click)
    // Multiple relation types = submenu shown
    it('Lore links should use SIMPLE_RELATION_TYPE (no submenu)', () => {
      const loreConfigs = QUICK_LINK_CONFIG.Lore
      for (const config of loreConfigs) {
        expect(config.relationTypes.length).toBe(1)
        expect(config.relationTypes[0]).toBe('related')
      }
    })

    it('NPC-to-NPC should have multiple relation types (shows submenu)', () => {
      const npcToNpc = QUICK_LINK_CONFIG.NPC.find((c) => c.targetType === 'NPC')
      expect(npcToNpc).toBeDefined()
      expect(npcToNpc!.relationTypes.length).toBeGreaterThan(1)
    })
  })
})
