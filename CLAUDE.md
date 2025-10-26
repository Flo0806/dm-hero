# DM Hero - Project Context

## Project Overview
DM Hero is a personal D&D campaign management tool for Dungeon Masters. The main goal is to solve the problem of scattered information across multiple Word documents, making it hard to find NPCs, locations, and connections between entities.

## Core Problem
- User has 10+ Word files with session notes, NPCs, locations, etc.
- Hard to find specific information (e.g., "3 bounty hunters")
- Names are duplicated, misspelled, or scattered across files
- No clear overview of relationships between entities

## Solution Approach
A local-first web app with:
- Universal fuzzy search (THE key feature)
- Entity management (NPCs, Locations, Items, Factions, Quests, Sessions)
- Automatic entity linking (like Obsidian)
- Relationship graph visualization
- Session logs with timeline
- Duplicate detection

## Tech Stack
- **Framework**: Nuxt 4 (new folder structure: app/ for client code)
- **UI**: Vuetify 3 (no elevation, as configured in plugin)
- **Database**: SQLite with better-sqlite3
- **i18n**: German (default) + English
- **Node**: 22.20.0 (see .nvmrc) - **IMPORTANT: Vite 7 requires Node 22.20+**

## Quick Start (for fresh clone)
```bash
# 1. Use correct Node version
nvm use

# 2. Install dependencies
pnpm install

# 3. Approve better-sqlite3 build (pnpm security feature)
pnpm approve-builds

# 4. Start dev server
pnpm dev

# Database will be auto-created in data/dm-hero.db
# Migrations run automatically on server start
```

## Design Principles
1. **Functional over fancy** - This is a personal tool, utility is #1 priority
2. **Search-first** - Global search accessible via `/` keyboard shortcut
3. **No bloat** - Only features that directly help the DM
4. **Local-first** - All data stored locally in SQLite
5. **Safe migrations** - Always create backup before schema changes
6. **Soft-delete everywhere** - NEVER hard-delete data. Always use `deleted_at` timestamp for recovery

## Code Style
- **Comments**: Always in English
- **Commit messages**: German or English (TBD by user)
- **Variable names**: English
- **UI text**: i18n (de/en)

## Database Architecture

### Core Tables
- **campaigns**: Campaign management (name, description, soft-delete)
- **entities**: Main table for all entity types (NPCs, Locations, Items, etc.)
- **entity_types**: Type definitions (NPC, Location, Item, Faction, Quest)
- **entity_relations**: Links between entities with type and notes
- **tags**: Flexible categorization
- **entity_tags**: Many-to-many tag relationships
- **sessions**: Session logs per campaign
- **session_mentions**: Which entities were mentioned in which session
- **entities_fts**: Full-text search index (FTS5) for fuzzy matching

### Reference Data Tables
- **races**: D&D 5e races (16 pre-seeded: Mensch, Elf, Zwerg, Halbling, etc.)
- **classes**: D&D 5e classes (12 pre-seeded: Barbar, Barde, Druide, etc.)
- Both tables support soft-delete and custom entries

### Multi-Campaign Architecture
- User can create multiple campaigns
- All entities are scoped to a campaign via `campaign_id`
- Campaign selection page shows card overview
- Active campaign stored in localStorage (activeCampaignId, activeCampaignName)
- Soft-delete for campaigns (deleted_at timestamp)

### Entity Relations System
- Bidirectional relationships between entities
- Relation types: "lebt in", "arbeitet bei", "besucht oft", etc. (i18n)
- Each relation can have optional notes
- Relations have unique constraint on (from_entity, to_entity, type)
- API routes for CRUD operations on relations

## Migration System
- Located in `server/utils/migrations.ts`
- **3 migrations currently:**
  1. Initial schema (entities, types, relations, tags, sessions, FTS5)
  2. Campaigns + soft-delete (campaign_id, deleted_at columns)
  3. Reference data (races & classes with D&D 5e seed data)
- Auto-backup before each migration run
- Version tracking in `schema_version` table
- Backups stored in `data/backups/`
- Migrations run automatically on server start via plugin

## Theme Colors
**Dark Theme (Midnight Tavern)**:
- Background: #1A1D29 (dark tavern)
- Primary: #D4A574 (warm gold)
- Secondary: #8B7355 (dark leather)
- Accent: #CC8844 (amber)

**Light Theme (Aged Parchment)**:
- Background: #F5F1E8 (warm parchment)
- Primary: #8B4513 (saddle brown)
- Secondary: #B8860B (dark goldenrod)
- Accent: #8B0000 (burgundy)

## Implemented Features

### ✅ Campaign Management
- **Page**: `/campaigns`
- Create, edit, delete (soft) campaigns
- Card-based overview with creation date
- Active campaign indicator in dashboard and sidebar
- localStorage persistence for active campaign selection

### ✅ NPC Management
- **Page**: `/npcs`
- Full CRUD with soft-delete
- Fields: name, description, race, class, location, faction, relationship
- Race & class selection with autocomplete (from reference data)
- Live search/filter on name, description, metadata
- **Location Relations**:
  - Link NPCs to locations with relation type
  - Editable relations with notes
  - Suggested relation types (i18n): "lebt in", "arbeitet bei", etc.
  - Edit and delete relations via UI

### ✅ Location Management
- **Page**: `/locations`
- Full CRUD with soft-delete
- Fields: name, description, type, region, notes
- View dialog shows all connected NPCs with relation types
- Search functionality

### ✅ Reference Data Management
- **Page**: `/reference-data`
- Manage races and classes (D&D 5e pre-seeded)
- Tab-based interface (Races | Classes)
- Create custom races/classes
- Edit existing entries
- Delete protection: prevents deletion if in use by NPCs
- 16 races, 12 classes pre-seeded in German

### ✅ UI/UX Features
- Dark/Light theme toggle (D&D themed colors)
- i18n support (de/en) with full translations
- Sidebar navigation with active campaign display
- Search dialog placeholder (press `/` to open)
- No elevation design (flat cards)
- Responsive layout

## API Routes Structure
```
server/api/
├── campaigns/
│   ├── index.get.ts          # List all campaigns
│   ├── index.post.ts         # Create campaign
│   ├── [id].patch.ts         # Update campaign
│   └── [id].delete.ts        # Soft-delete campaign
├── npcs/
│   ├── index.get.ts          # List NPCs (filtered by campaign)
│   ├── index.post.ts         # Create NPC
│   ├── [id].patch.ts         # Update NPC
│   ├── [id].delete.ts        # Soft-delete NPC
│   └── [id]/
│       ├── relations.get.ts  # Get NPC relations
│       └── relations.post.ts # Create NPC relation
├── locations/
│   ├── index.get.ts          # List locations
│   ├── index.post.ts         # Create location
│   ├── [id].patch.ts         # Update location
│   ├── [id].delete.ts        # Soft-delete location
│   └── [id]/
│       └── npcs.get.ts       # Get connected NPCs
├── races/
│   ├── index.get.ts          # List all races
│   ├── index.post.ts         # Create race
│   ├── [id].patch.ts         # Update race
│   └── [id].delete.ts        # Soft-delete with "in use" check
├── classes/
│   ├── index.get.ts          # List all classes
│   ├── index.post.ts         # Create class
│   ├── [id].patch.ts         # Update class
│   └── [id].delete.ts        # Soft-delete with "in use" check
└── entity-relations/
    ├── index.post.ts         # Create relation
    ├── [id].patch.ts         # Update relation (type & notes)
    └── [id].delete.ts        # Delete relation
```

## File Structure
```
dm-hero/
├── .nvmrc                   # Node 22.20.0
├── app/
│   ├── app.vue              # Main layout with sidebar + search
│   ├── pages/
│   │   ├── index.vue        # Dashboard
│   │   ├── campaigns.vue    # Campaign management
│   │   ├── npcs/
│   │   │   └── index.vue    # NPC management with relations
│   │   ├── locations/
│   │   │   └── index.vue    # Location management
│   │   └── reference-data.vue # Races & classes management
│   └── plugins/
│       └── vuetify.ts       # Vuetify config + themes
├── server/
│   ├── utils/
│   │   ├── db.ts            # Database connection & backup
│   │   └── migrations.ts    # Migration system (3 migrations)
│   ├── plugins/
│   │   └── database.ts      # Auto-run migrations on startup
│   └── api/                 # See API Routes Structure above
├── i18n/
│   └── locales/
│       ├── de.json          # German translations
│       └── en.json          # English translations
├── data/                    # .gitignored
│   ├── dm-hero.db           # SQLite database
│   └── backups/             # Auto-generated backups
└── CLAUDE.md                # This file
```

## TODO / Not Yet Implemented
- ⏳ Universal fuzzy search (FTS5 index ready, UI pending)
- ⏳ Items, Factions, Quests pages
- ⏳ Session logs with entity mentions
- ⏳ Relationship graph visualization
- ⏳ Duplicate detection
- ⏳ Tag system (tables exist, UI pending)

## Important Notes
- **Soft-delete everywhere**: NEVER hard-delete. Always set `deleted_at`
- **Comments in English**: All code comments must be English
- **i18n**: All UI text must go through translation files
- **Node version critical**: 22.20.0+ required for Vite 7
- **pnpm security**: Must run `pnpm approve-builds` for better-sqlite3
- **Migrations auto-run**: Database initializes on first start
- **Campaign required**: App redirects to `/campaigns` if no active campaign
