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
- **campaigns**: Campaign management (name, description, created_at, deleted_at)
- **entities**: Main table for all entity types (with campaign_id)
- **entity_types**: NPCs, Locations, Items, Factions, Quests
- **entity_relations**: Links between entities (lives_in, member_of, owns, etc.)
- **tags**: Flexible categorization
- **sessions**: Session logs (with campaign_id)
- **session_mentions**: Which entities were mentioned in which session
- **FTS5**: Full-text search index for fuzzy matching

**Multi-Campaign Architecture:**
- User can create multiple campaigns
- All entities are scoped to a campaign via `campaign_id`
- Campaign selection page shows beautiful cards overview
- Active campaign stored in session/localStorage
- Soft-delete for campaigns (deleted_at timestamp)

## Migration System
- Located in `server/utils/migrations.ts`
- Auto-backup before each migration run
- Version tracking in `schema_version` table
- Backups stored in `data/backups/`

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

## Key Features To Implement
1. ✅ Basic layout with sidebar
2. ✅ Theme system (light/dark)
3. ✅ i18n (de/en)
4. ✅ SQLite + migrations
5. ⏳ Universal search with fuzzy matching
6. ⏳ CRUD for NPCs
7. ⏳ CRUD for Locations
8. ⏳ Entity linking system
9. ⏳ Relationship graph visualization
10. ⏳ Session logs
11. ⏳ Duplicate detection

## File Structure
```
dm-hero/
├── app/
│   ├── app.vue               # Main layout with sidebar + search
│   ├── pages/
│   │   └── index.vue         # Dashboard
│   └── ...
├── server/
│   ├── utils/
│   │   ├── db.ts            # Database connection & backup
│   │   └── migrations.ts    # Migration system
│   └── plugins/
│       └── database.ts      # Auto-run migrations on startup
├── plugins/
│   └── vuetify.ts           # Vuetify config + themes
├── locales/
│   ├── de.json
│   └── en.json
├── data/                    # .gitignored
│   ├── dm-hero.db
│   └── backups/
└── ...
```

## Important Notes
- User wants this to be PRACTICAL, not overengineered
- Focus on search & entity management first
- Keep UI clean and functional
- Always use migrations for DB changes
- Test with user's real-world data once basic features work
