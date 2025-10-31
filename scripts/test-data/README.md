# Test Data Scripts

This folder contains SQL scripts to populate the database with test data for development and testing.

## Available Scripts

### `insert-100-npcs.sql`
Inserts 100 diverse NPCs with:
- **20 fully filled NPCs** - Complete with race, class, status, type, location, detailed descriptions
- **40 medium filled NPCs** - Partial metadata, some descriptions
- **40 minimal filled NPCs** - Just name and minimal info

**Features:**
- Diverse names with umlauts (ä, ö, ü, å, é, etc.)
- Special characters (ç, ñ, æ, ø, etc.)
- Various races: Human, Elf, Dwarf, Halfling, Gnome, Half-Elf, Half-Orc, Tiefling, Dragonborn
- All D&D 5e classes represented
- Different statuses: alive, undead
- Different types: ally, enemy, neutral, merchant, questgiver, villain
- Creative descriptions and backstories

## Usage

```bash
# From project root
sqlite3 data/dm-hero.db < scripts/test-data/insert-100-npcs.sql
```

## Notes

- Scripts assume a campaign already exists in the database
- NPCs are inserted into the first available campaign
- FTS index is automatically updated
- Scripts are idempotent (can be run multiple times without creating duplicates, though they will create new entries each time)

## Future Scripts

This folder will contain more test data scripts for:
- Locations
- Items
- Factions
- Quests
- Sessions
