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
- **8 migrations currently:**
  1. Initial schema (entities, types, relations, tags, sessions, FTS5)
  2. Campaigns + soft-delete (campaign_id, deleted_at columns)
  3. Reference data (races & classes with D&D 5e seed data)
  4. Entity images table (image gallery support)
  5. Markdown documents table (rich documentation per entity)
  6. Reserved for future use
  7. Reserved for future use
  8. **FTS5 metadata search** - Extended FTS5 to index JSON metadata fields
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
- **FTS5 Fuzzy Search** (implemented 2025-10-29):
  - Debounced search (300ms) - server-side FTS5 query
  - Searches name, description, AND metadata (race, class, location, etc.)
  - Prefix matching with `*` wildcard (e.g., "gandlf*" finds "Gandalf")
  - Ranked results by relevance
  - Shows cached entities when no search, API results when searching
- **Location Relations**:
  - Link NPCs to locations with relation type
  - Editable relations with notes
  - Suggested relation types (i18n): "lebt in", "arbeitet bei", etc.
  - Edit and delete relations via UI
- **Image Gallery**:
  - Upload and manage multiple images per NPC
  - Set primary image for display
  - Download images with one-click (useImageDownload composable)
  - Images stored in `public/uploads/` with UUID filenames
- **Markdown Documents**:
  - Rich documentation per NPC (backstory, notes, secrets)
  - md-editor-v3 integration (preview, edit, fullscreen)
  - Auto-save with 500ms debounce
  - i18n support (German/English UI)
  - Images, tables, code blocks, task lists supported

### ✅ Location Management
- **Page**: `/locations`
- Full CRUD with soft-delete
- Fields: name, description, type, region, notes
- View dialog shows all connected NPCs with relation types
- **FTS5 Fuzzy Search** (backend ready, frontend pending)
- **Image Gallery**: Same as NPCs
- **Markdown Documents**: Same as NPCs

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

## Items & Factions
### ✅ Items Management
- **Page**: `/items`
- Full CRUD with soft-delete
- Fields: name, description, type, rarity, notes, value
- **FTS5 Fuzzy Search** (backend ready, frontend pending)
- **Image Gallery**: Same as NPCs
- View dialog with all details

### ✅ Factions Management
- **Page**: `/factions`
- Full CRUD with soft-delete
- Fields: name, description, type (guild, government, criminal, religious, etc.)
- **FTS5 Fuzzy Search** (backend ready, frontend pending)

## TODO / Not Yet Implemented
- ⏳ Universal fuzzy search UI (FTS5 backend ready, `/` shortcut dialog pending)
- ⏳ Apply FTS5 search to Items, Locations, Factions pages (backend ready)
- ⏳ Quests page
- ⏳ Session logs with entity mentions
- ⏳ Relationship graph visualization
- ⏳ Duplicate detection
- ⏳ Tag system (tables exist, UI pending)

---

## 🔍 Search Implementation Deep Dive

### FTS5 Full-Text Search (Migration 8 - 2025-10-29)

**Problem:** User has 100,000+ entities and needs fast, fuzzy search across all fields.

**Solution:** SQLite FTS5 (Full-Text Search 5) - a built-in virtual table feature.

#### Why FTS5 over Levenshtein Distance?

**Levenshtein Algorithm** (Edit Distance):
- Calculates minimum operations to transform one string into another
- Great for ranking similar strings (e.g., "gandlf" → "gandalf" = 1 edit)
- BUT: O(n) complexity - must check EVERY entity

**FTS5 Advantages:**
- O(log n) complexity - uses inverted index (like search engines)
- Searches 100,000 entities in milliseconds
- Built into SQLite - no external dependencies
- Supports prefix matching (`gandlf*` finds `gandalf`)
- Ranks results by relevance automatically
- Handles basic typos with prefix matching

**Hybrid Approach (Future):**
1. FTS5 filters to 100-200 candidates (fast)
2. Levenshtein ranks by similarity (accurate)
3. Show top 20 results

**Current Implementation:** FTS5 only (good enough for 99% of cases)

#### Migration 8: Extending FTS5 to Metadata

**Before (Migration 1):**
```sql
CREATE VIRTUAL TABLE entities_fts USING fts5(
  name,
  description,
  content='entities',
  content_rowid='id'
)
```
Only searched `name` and `description` fields.

**After (Migration 8):**
```sql
CREATE VIRTUAL TABLE entities_fts USING fts5(
  name,
  description,
  metadata,  -- NEW! Now searches JSON fields
  content='entities',
  content_rowid='id'
)
```

Now searches inside metadata like:
- `{"race": "Elf", "class": "Ranger"}` (NPCs)
- `{"type": "Longsword", "rarity": "legendary"}` (Items)
- `{"type": "tavern", "region": "Waterdeep"}` (Locations)

#### FTS5 Query Pattern

**Backend API Pattern (all entity endpoints):**
```typescript
const searchQuery = query.search as string | undefined

if (searchQuery && searchQuery.trim().length > 0) {
  const ftsQuery = `${searchQuery.trim()}*`  // Add wildcard for prefix matching

  npcs = db.prepare(`
    SELECT e.*
    FROM entities_fts fts
    INNER JOIN entities e ON fts.rowid = e.id
    WHERE entities_fts MATCH ?
      AND e.type_id = ?
      AND e.campaign_id = ?
      AND e.deleted_at IS NULL
    ORDER BY rank  -- FTS5 automatically ranks by relevance
  `).all(ftsQuery, entityType.id, campaignId)
} else {
  // No search - return all entities
}
```

**Frontend Pattern (Debounced Search):**
```typescript
const searchQuery = ref('')
const searchResults = ref<NPC[]>([])
const searching = ref(false)

// Debounce: wait 300ms after user stops typing
let searchTimeout: ReturnType<typeof setTimeout> | null = null
watch(searchQuery, async (query) => {
  if (searchTimeout) clearTimeout(searchTimeout)

  if (!query || query.trim().length === 0) {
    searchResults.value = []
    return
  }

  searchTimeout = setTimeout(async () => {
    searching.value = true
    try {
      const results = await $fetch<NPC[]>('/api/npcs', {
        query: {
          campaignId: activeCampaignId.value,
          search: query.trim(),
        },
      })
      searchResults.value = results
    } finally {
      searching.value = false
    }
  }, 300)
})

// Show search results OR cached entities
const filteredNpcs = computed(() => {
  if (searchQuery.value && searchQuery.value.trim().length > 0) {
    return searchResults.value
  }
  return npcs.value || []
})
```

**Why 300ms debounce?**
- User types "gandalf" - that's 7 keystrokes
- WITHOUT debounce: 7 API calls ("g", "ga", "gan", ...)
- WITH 300ms debounce: 1 API call (after user finishes typing)
- Reduces server load by ~80%

#### FTS5 Backend Implementation Status

| Entity Type | Backend API | Frontend UI |
|-------------|-------------|-------------|
| NPCs        | ✅ Ready    | ✅ Implemented |
| Items       | ✅ Ready    | ⏳ Pending |
| Locations   | ✅ Ready    | ⏳ Pending |
| Factions    | ✅ Ready    | ⏳ Pending |

**Files Modified:**
- `/server/utils/migrations.ts` - Migration 8 (lines 369-422)
- `/server/api/npcs/index.get.ts` - FTS5 query support (lines 26-44)
- `/server/api/items/index.get.ts` - FTS5 query support
- `/server/api/locations/index.get.ts` - FTS5 query support
- `/server/api/factions/index.get.ts` - FTS5 query support
- `/app/pages/npcs/index.vue` - Debounced search UI (lines 1117-1185)

---

## 🖼️ Image Management System

### Architecture

**Database (Migration 4):**
```sql
CREATE TABLE entity_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_id INTEGER NOT NULL,
  image_url TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
)
```

**File Storage:**
- Location: `public/uploads/`
- Naming: UUID v4 (e.g., `a3f2b1c4-...-.jpg`)
- Formats: JPG, PNG, WebP, GIF
- Max size: 10MB (configurable in backend)

### useImageDownload Composable

**Purpose:** One-click image download from server to local filesystem.

**File:** `/app/composables/useImageDownload.ts`

**Usage:**
```vue
<script setup lang="ts">
const { downloadImage, downloading } = useImageDownload()
</script>

<template>
  <v-btn
    :loading="downloading"
    @click="downloadImage('/uploads/image.jpg', 'Gandalf.jpg')"
  >
    Download Image
  </v-btn>
</template>
```

**How it works:**
1. Fetches image as Blob from server
2. Creates temporary object URL
3. Triggers browser download with custom filename
4. Cleans up object URL

**Why composable?**
- Reusable across all entity pages (NPCs, Items, Locations)
- Centralized loading state management
- Proper error handling and cleanup

---

## 📝 Markdown Document System

### Architecture (Migration 5)

**Database:**
```sql
CREATE TABLE entity_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
)
```

**md-editor-v3 Integration:**
- Library: `md-editor-v3` (Vue 3 compatible)
- Features: Preview, Edit, Fullscreen modes
- Auto-save: 500ms debounce (prevents excessive API calls)
- i18n: German/English UI translation
- Supports: Images, tables, code blocks, task lists, math (KaTeX)

### EntityDocuments Component

**Purpose:** Reusable markdown document editor for any entity type.

**File:** `/app/components/EntityDocuments.vue`

**Usage:**
```vue
<EntityDocuments
  :entity-id="npc.id"
  entity-type="NPC"
/>
```

**Features:**
- Tab-based interface (one tab per document)
- Create/rename/delete documents
- Live preview
- Auto-save with visual feedback
- Fullscreen mode for focused writing

**Why separate component?**
- Used by NPCs, Items, Locations (DRY principle)
- Encapsulates complex editor logic
- Maintains consistent UX across entity types

---

## 🧩 Component Extraction Pattern

### PageHeader Component

**Problem:** Every entity page had duplicate header code:
```vue
<!-- Repeated in npcs, items, locations, factions -->
<div class="d-flex justify-space-between align-center mb-4">
  <div>
    <h1>{{ $t('npcs.title') }}</h1>
    <p class="text-medium-emphasis">{{ $t('npcs.subtitle') }}</p>
  </div>
  <v-btn color="primary" @click="createDialog = true">
    <v-icon>mdi-plus</v-icon>
    {{ $t('npcs.create') }}
  </v-btn>
</div>
```

**Solution:** Extract to reusable component.

**File:** `/app/components/PageHeader.vue`

**Usage:**
```vue
<PageHeader
  :title="$t('npcs.title')"
  :subtitle="$t('npcs.subtitle')"
  :create-label="$t('npcs.create')"
  @create="createDialog = true"
/>
```

**Benefits:**
- 15 lines → 5 lines per page
- Consistent styling across pages
- Single source of truth for header layout
- Easier to update globally (e.g., add breadcrumbs)

**When to extract components?**
1. Code repeated 3+ times
2. Complex logic that can be encapsulated
3. Improves readability of parent component

---

## 🎨 UI/UX Patterns

### Debouncing Best Practices

**When to debounce:**
- Search inputs (300ms)
- Auto-save (500ms)
- Resize/scroll events (100-200ms)

**When NOT to debounce:**
- Button clicks (use loading state instead)
- Form submissions (single action)

### Loading States

**Pattern:**
```typescript
const loading = ref(false)

async function saveData() {
  loading.value = true
  try {
    await $fetch('/api/...')
  } finally {
    loading.value = false  // Always reset, even on error
  }
}
```

**Visual feedback:**
```vue
<v-btn :loading="loading" @click="saveData">
  Save
</v-btn>
```

### Cached vs Live Data

**Entities Store Pattern:**
```typescript
// Load once on page mount
const npcs = computed(() => entitiesStore.npcs)

// Search uses live API calls (debounced)
const searchResults = ref<NPC[]>([])

// Show search OR cached
const display = computed(() => {
  return searchQuery.value ? searchResults.value : npcs.value
})
```

**Why?**
- Instant page loads (cached data)
- Fresh search results (live API)
- Reduced server load (only search queries hit API)

---

## Important Notes
- **Soft-delete everywhere**: NEVER hard-delete. Always set `deleted_at`
- **Comments in English**: All code comments must be English
- **i18n**: All UI text must go through translation files
- **Node version critical**: 22.20.0+ required for Vite 7
- **pnpm security**: Must run `pnpm approve-builds` for better-sqlite3
- **Migrations auto-run**: Database initializes on first start
- **Campaign required**: App redirects to `/campaigns` if no active campaign
- **FTS5 metadata search**: Search now includes JSON metadata fields (race, class, type, etc.)

---

## 📅 Changelog

### 2025-11-02 - Lore-NPC Linking & TypeScript Fixes

**✅ Lore Linking in NPC Dialog - Fully Implemented!**

1. **New "Lore" Tab in NPC Dialog**
   - Autocomplete dropdown to select Lore entries
   - "Link" button to add relations
   - List of all linked Lore entries with images and descriptions
   - Delete button per linked Lore entry
   - Empty state when no Lore is linked

2. **Backend Endpoints Created:**
   - `/api/npcs/[id]/lore` (GET) - Loads all Lore entries linked to an NPC
   - `/api/entity-relations/find` (GET) - Finds specific relation between two entities
   - Uses existing `/api/entity-relations` (POST/DELETE) for CRUD

3. **Frontend Logic:**
   - `entitiesStore.fetchLore()` now called when loading NPCs page
   - `loreForSelect` computed property from Entities Store
   - `loadLinkedLore()` - Loads linked Lore when opening dialog (watch on editingNpc.id)
   - `addLoreRelation()` - Creates new relation with type "kennt" (knows)
   - `removeLoreRelation()` - Finds relation via `/find` endpoint and deletes it

4. **i18n Translations Added:**
   - German: `selectLore`, `selectLorePlaceholder`, `addRelation`, `noLinkedLore`, `noLinkedLoreText`
   - English: Corresponding translations

5. **Entity Images Bug Fix:**
   - Problem: `/api/entity-images/[imageId]/set-primary` returned 404
   - Root Cause: Nitro route conflict between `[imageId].delete.ts` and `[imageId]/set-primary.patch.ts`
   - Solution: Moved `[imageId].delete.ts` → `[imageId]/index.delete.ts` (into subdirectory)
   - Fixed import paths: `../../utils/db` → `../../../utils/db`
   - Now working: GET /[entityId], DELETE /[imageId], PATCH /[imageId]/set-primary, PATCH /[imageId]/caption

6. **TypeScript Errors Fixed:**
   - Lore page: `(v: string)` for validation rules, `(isGenerating: boolean)` for event handler
   - NPCs page: All implicit `any` types fixed
     - Validation rules: `[(v: string) => ...]`
     - Map functions: `(r: typeof races.value[0])`, `(c: typeof classes.value[0])`
     - Constants: `(type: typeof NPC_TYPES[number])`, `(status: typeof NPC_STATUSES[number])`
     - Filters: `(r: typeof npcRelations[0])`
     - Lore: `(lore: { id: number, name: string })`

**How Lore Linking Works:**
1. Open NPC in edit mode
2. Go to "Wissen" (Lore) tab (last tab)
3. Select Lore entry from dropdown
4. Click "Verknüpfen" (Link)
5. Lore appears in list with image, name, description
6. Relation stored in `entity_relations` with `relation_type = "kennt"`

**Files Modified:**
- `/app/pages/npcs/index.vue` - Added Lore tab, fetchLore() in onMounted, TypeScript fixes
- `/app/pages/lore/index.vue` - TypeScript fixes
- `/server/api/npcs/[id]/lore.get.ts` - NEW: Loads linked Lore for NPC
- `/server/api/entity-relations/find.get.ts` - NEW: Finds specific relation
- `/server/api/entity-images/[imageId]/index.delete.ts` - Moved (fix routing conflict)
- `/server/api/entity-images/[imageId]/set-primary.patch.ts` - Fixed import path
- `/server/api/entity-images/[imageId]/caption.patch.ts` - Fixed import path
- `/app/components/EntityImageGallery.vue` - Fixed set-primary endpoint URL
- `/i18n/locales/de.json` - Lore linking texts
- `/i18n/locales/en.json` - Lore linking texts

---

## 🚀 NEXT STEPS (for next session)

### 1. **Lore → NPCs Tab (Reverse Direction)**
**Goal:** In Lore dialog, show which NPCs know this Lore

**To Do:**
- New "NPCs" tab in `/app/pages/lore/index.vue` (similar to Lore tab in NPCs)
- Create endpoint `/api/lore/[id]/npcs.get.ts` (GET: Load all NPCs that know this Lore)
- Same UI as Lore tab: Autocomplete + list with images
- Relations are bidirectional → same `entity_relations` table
- Query: `WHERE to_entity_id = loreId AND from_entity.type = 'NPC'`

**Estimated Time:** 30-45 minutes

### 2. **NPC Cross-Search via Linked Lore Names**
**Goal:** Find NPCs through linked Lore names

**Example:**
- Lore "Ring of Power" is linked to NPC "Gandalf"
- Search for "Ring" → finds "Gandalf" (because he knows the Lore)

**To Do:**
- Extend `/server/api/npcs/index.get.ts`:
  - JOIN with `entity_relations` + `entities` (type=Lore)
  - `GROUP_CONCAT(DISTINCT lore.name) as linked_lore_names`
  - Levenshtein check also for `linked_lore_names` (similar to Locations cross-search)
  - Word-level splitting: "Ring of Power" → ["ring", "of", "power"]
- All 3 filters (Simple/OR/AND) must check Lore names
- Lore name match → Score bonus (e.g. -20 points)

**Reference Implementation:**
- See `/server/api/locations/index.get.ts` (Lines ~180-280)
- Pattern: Load ALL with JOINs → Filter with Levenshtein → Sort by score
- Unicode normalization via `normalizeText()` already available

**Estimated Time:** 1-2 hours

### 3. **Add Lore to Global Search**
**To Do:**
- Extend `/server/api/search.get.ts`
- Add Lore type to entity type mapping
- Route: `/lore?highlight={id}&search={query}`
- Icon: `mdi-book-open-variant`

**Estimated Time:** 15-30 minutes

---

## 💡 Important Patterns for Next Session

### Cross-Search Pattern (for NPC → Lore names):
```typescript
// 1. Load ALL NPCs with JOINs (no FTS5 pre-filter!)
const npcs = db.prepare(`
  SELECT e.*,
    GROUP_CONCAT(DISTINCT lore.name) as linked_lore_names
  FROM entities e
  LEFT JOIN entity_relations lore_rel ON lore_rel.from_entity_id = e.id
  LEFT JOIN entities lore ON lore.id = lore_rel.to_entity_id
    AND lore.type_id = ? AND lore.deleted_at IS NULL
  WHERE e.type_id = ? AND e.campaign_id = ? AND e.deleted_at IS NULL
  GROUP BY e.id
`).all(loreTypeId, npcTypeId, campaignId)

// 2. Filter with Levenshtein (word-level!)
const loreNames = linkedLoreNamesLower.split(',').map(n => n.trim())
for (const loreName of loreNames) {
  const loreWords = loreName.split(/\s+/)  // ← IMPORTANT!
  for (const word of loreWords) {
    if (word.length < 3) continue
    const levDist = levenshtein(normalizeText(term), normalizeText(word))
    if (levDist <= maxDist) return true
  }
}

// 3. Score bonus for Lore match
if (matchedViaLore) score -= 20
```

### Bidirectional Relations Pattern:
```typescript
// NPC → Lore: from_entity_id = NPC, to_entity_id = Lore
// Lore → NPCs: Same table, just queried in reverse!

// Query for Lore → NPCs:
SELECT npc.*
FROM entity_relations er
INNER JOIN entities npc ON npc.id = er.from_entity_id
WHERE er.to_entity_id = ? AND npc.type_id = ?
```

---

### 2025-10-31 (Late Evening) - Unicode Normalization & Global Search UX

**🔤 Unicode Normalization für Akzent-Suche:**
- ✅ **Problem**: "andre" findet "andré" nicht, weil é ≠ e
- ✅ **Lösung**: `normalizeText()` Utility-Funktion erstellt
  - Verwendet `String.normalize('NFD')` - zerlegt Zeichen (é → e + Akzent)
  - Entfernt Akzent-Marks mit Regex `/[\u0300-\u036f]/g`
  - Macht `.toLowerCase()` für Case-Insensitivity
- ✅ **Implementiert in**:
  - `/server/utils/normalize.ts` - Neue Utility-Funktion
  - `/server/api/npcs/index.get.ts` - Alle `.toLowerCase()` → `normalizeText()`
  - `/server/api/locations/index.get.ts` - Alle `.toLowerCase()` → `normalizeText()`
- ✅ **Beispiele die jetzt funktionieren**:
  - "andre" findet "André"
  - "muller" findet "Müller"
  - "sao paulo" findet "São Paulo"

**🔍 Global Search UX Improvements:**
- ✅ **Fixed entity type bug**: `/server/api/search.get.ts` gab `entity_type` zurück, Frontend erwartete `type`
- ✅ **Locations Highlight Feature** (analog zu NPCs):
  - Query params: `?highlight=123&search=EntityName`
  - Suchbegriff wird in Searchbar eingetragen
  - Entity wird hervorgehoben mit Animation
  - Auto-scroll zur highlighted Entity
  - Highlight wird bei manueller Suche entfernt
  - CSS Animation: `highlight-pulse` mit box-shadow

**🐛 Critical Bugfixes:**
- ✅ **Nuxt 4 useFetch Warning**: `useFetch` in Composables führte zu "Component already mounted" Warnings
  - **Problem**: `useRaceName()`/`useClassName()` Composables verwendeten `useFetch` intern
  - **Root Cause**: Composables wurden in `computed()` aufgerufen → `useFetch` nach Component-Mount
  - **Lösung**: Composables refactored - erwarten jetzt Objekt statt String
  - **Pattern**: NPCs laden races/classes mit `$fetch` in `onMounted`, dann an Composables übergeben
- ✅ **Vue Variable Declaration Order**:
  - **Problem**: `searchQuery` wurde im Template verwendet bevor deklariert
  - **Root Cause**: Template wird evaluiert wenn Component mounted, aber Variable kam erst später im Script
  - **Lösung**: `searchQuery` GANZ OBEN im `<script setup>` deklarieren (direkt nach Interfaces)
  - **WICHTIG**: In `<script setup>` müssen Template-gebundene refs VOR allen anderen Code-Blöcken stehen!

**📝 Composables Pattern Update:**

**VORHER (funktioniert nicht in Nuxt 4):**
```typescript
// ❌ BAD: useFetch in Composable
export function useRaceName(race: string) {
  const { data: races } = useFetch('/api/races') // Problem!
  const raceData = races.value?.find(r => r.name === race)
  return raceData?.name_de || race
}

// Verwendung in computed
const raceItems = computed(() => {
  return races.value.map(r => ({
    title: useRaceName(r.name), // Ruft useFetch in computed auf!
    value: r.name
  }))
})
```

**NACHHER (Nuxt 4 kompatibel):**
```typescript
// ✅ GOOD: Composable erwartet Daten
export function useRaceName(race: ReferenceData) {
  const { locale } = useI18n()
  if (race.name_de && race.name_en) {
    return locale.value === 'de' ? race.name_de : race.name_en
  }
  return race.name
}

// Daten laden in onMounted mit $fetch
onMounted(async () => {
  const racesData = await $fetch('/api/races')
  races.value = racesData
})

// Verwendung in computed mit geladenen Daten
const raceItems = computed(() => {
  return races.value.map(r => ({
    title: useRaceName(r), // Kein useFetch, nur Daten-Transformation
    value: r.name
  }))
})
```

**🎯 Vue 3 Script Setup Order Pattern (WICHTIG!):**

```vue
<script setup lang="ts">
// 1. TypeScript Interfaces (optional)
interface MyData {
  id: number
  name: string
}

// 2. Template-gebundene Refs (WICHTIG: VOR allem anderen!)
const searchQuery = ref('')
const items = ref<MyData[]>([])

// 3. Composables & Stores
const { t } = useI18n()
const router = useRouter()
const store = useMyStore()

// 4. Computed Properties
const filteredItems = computed(() => {
  return items.value.filter(i => i.name.includes(searchQuery.value))
})

// 5. Functions
function doSomething() {
  // ...
}

// 6. Lifecycle Hooks
onMounted(() => {
  // ...
})

// 7. Watchers
watch(searchQuery, () => {
  // ...
})
</script>
```

**💡 Eselsbrücken für morgen:**
1. **Unicode-Suche**: "André" wird "andre" → `normalize('NFD')` + Regex entfernt Akzente
2. **Composables**: NIEMALS `useFetch` in Composables → immer Daten als Parameter übergeben
3. **Script Order**: Template-refs müssen ZUERST kommen, sonst "Cannot access before initialization"
4. **Global Search**: `type` nicht `entity_type` (API ↔ Frontend Mapping!)

**Files Modified:**
- `/server/utils/normalize.ts` - NEW: Unicode normalization utility
- `/server/api/npcs/index.get.ts` - Added normalizeText for accent-insensitive search
- `/server/api/locations/index.get.ts` - Added normalizeText for accent-insensitive search
- `/server/api/search.get.ts` - Fixed `entity_type` → `type` mapping
- `/app/composables/useReferenceData.ts` - Removed internal useFetch, now expects data objects
- `/app/pages/npcs/index.vue` - Load races/classes with $fetch, pass to composables
- `/app/pages/locations/index.vue` - Added highlight feature, fixed variable order
- `/app/app.vue` - Fixed getEntityPath for all entity types

---

### 2025-10-31 - Locations Cross-Entity Search - FINAL (Evening)

**🗺️ Cross-Search für Locations - Vollständig implementiert:**
- ✅ **Removed bm25() incompatibility**: Cannot use `bm25()` with `GROUP_CONCAT` - switched to full table scan
- ✅ **Always load all locations**: Ditched FTS5 pre-filter, load ALL locations with linked NPCs/Items
- ✅ **Word-level Levenshtein**: Split NPC/Item names into words ("Günther Müller" → ["günther", "müller"])
- ✅ **Description word matching**: Also check description words with Levenshtein (not just includes())
- ✅ **All 3 Filters Updated**: Simple/OR/AND filters check each word individually
- ✅ **Test Data Added**: 50 Locations with 287 relations to NPCs and Items

**Beispiel - Jetzt funktioniert:**
```typescript
// Location "Taverne zum Goldenen Drachen" mit NPCs "Günther" + "Søren"
Suche: "Gunther" (Typo!)
  → Split: ["günther", "søren"]
  → Levenshtein-Distance zu "günther": 1 ✅
  → Findet "Taverne zum Goldenen Drachen"! 🎉

// Location "Schatzkammer" mit Item "Çağlars Ring"
Suche: "Caglar" (ohne Umlaut)
  → Levenshtein-Distance zu "çağlar": 2 ✅
  → Findet "Schatzkammer"! 🎉
```

**Wichtige Erkenntnisse:**

1. **SQLite Limitation - bm25() + GROUP_CONCAT:**
   - `bm25()` ist eine FTS5-Aggregatfunktion
   - Kann NICHT mit `GROUP BY` + `GROUP_CONCAT` kombiniert werden
   - Error: "unable to use function bm25 in the requested context"
   - **Lösung**: Entferne `bm25()`, nutze nur Levenshtein-Ranking

2. **FTS5 durchsucht nur entity fields, nicht Relations:**
   - FTS5 indexiert nur `name`, `description`, `metadata` der **Location selbst**
   - Verknüpfte NPCs/Items sind NICHT im FTS5-Index
   - Suche nach "Günther" findet nur Locations wo "Günther" im Namen/Description steht
   - **Lösung**: Lade ALLE Locations mit JOINs, filtere mit Levenshtein

3. **Word-level Levenshtein für Namen:**
   - "Günther Müller" muss gesplittet werden: ["günther", "müller"]
   - Suche nach "Günter" matched gegen "günther" (Distance 1) ✅
   - Ohne Split: "Günter" vs "Günther Müller" (Distance ~8) ❌

**Code-Änderungen:**
```typescript
// Always load ALL locations with linked entities
locations = db.prepare(`
  SELECT e.*,
    GROUP_CONCAT(DISTINCT npc.name) as linked_npc_names,
    GROUP_CONCAT(DISTINCT item.name) as linked_item_names
  FROM entities e
  LEFT JOIN entity_relations npc_rel ON npc_rel.to_entity_id = e.id
  LEFT JOIN entities npc ON npc.id = npc_rel.from_entity_id AND npc.type_id = 1
  LEFT JOIN entity_relations item_rel ON item_rel.to_entity_id = e.id
  LEFT JOIN entities item ON item.id = item_rel.from_entity_id AND item.type_id = 3
  WHERE e.type_id = 2 AND e.campaign_id = ? AND e.deleted_at IS NULL
  GROUP BY e.id
`).all(campaignId)

// Split NPC names into WORDS and check each
const npcNames = linkedNpcNamesLower.split(',').map(n => n.trim())
for (const npcName of npcNames) {
  const npcWords = npcName.split(/\s+/)  // ← WICHTIG!
  for (const word of npcWords) {
    const levDist = levenshtein(term, word)
    if (levDist <= maxDist) return true
  }
}

// Also check description WORDS (not just includes)
const descWords = descriptionLower.split(/\s+/)
for (const word of descWords) {
  if (word.length < 3) continue  // Skip "der", "am", etc.
  const levDist = levenshtein(term, word)
  if (levDist <= maxDist) return true
}
```

**Performance:**
- Bei 50 Locations + 287 Relations: ~10-15ms
- Full table scan (keine FTS5 pre-filter mehr)
- Levenshtein-Filter macht die eigentliche Arbeit

**Files Modified:**
- `/server/api/locations/index.get.ts` - Removed bm25(), always load all locations, word-level Levenshtein

---

### 2025-10-31 - Search UI Improvements (Afternoon)

**🎨 Search Loading Overlay (Locations):**
- ✅ **Removed `:loading` from v-text-field** - No more loading bar in search input
- ✅ **Added v-overlay with v-progress-circular** - Beautiful centered loading animation over cards
- ✅ **Consistent UX across all entity pages** - NPCs, Items, Locations, Factions now have identical search UI

**Implementation Pattern:**
```vue
<!-- Search Bar (no :loading prop) -->
<v-text-field
  v-model="searchQuery"
  :placeholder="$t('common.search')"
  prepend-inner-icon="mdi-magnify"
  variant="outlined"
  clearable
/>

<!-- Cards with Overlay -->
<div v-else-if="filteredLocations.length > 0" class="position-relative">
  <!-- Search Loading Overlay -->
  <v-overlay
    :model-value="searching"
    contained
    persistent
    class="align-center justify-center"
    scrim="surface"
    opacity="0.8"
  >
    <div class="text-center">
      <v-progress-circular indeterminate size="64" color="primary" />
      <div class="text-h6">{{ $t('common.searching') }}</div>
    </div>
  </v-overlay>

  <!-- Entity Cards -->
  <v-row>...</v-row>
</div>
```

**Why this is better:**
- Cleaner search input (no distracting progress bar)
- Clear visual feedback during search (centered spinner over content)
- User sees what they're searching through while loading
- Professional UX consistent with modern apps

**Files Modified:**
- `/app/pages/locations/index.vue` - Added v-overlay, removed `:loading` from search field

---

### 2025-10-31 - Fuzzy Search for Linked NPC Names (Morning)

**🎯 Levenshtein für verknüpfte Namen (Morning):**
- ✅ **Fuzzy-Search für `leader_name`**: Levenshtein-Check jetzt auch für verknüpfte NPC-Namen
- ✅ **Alle 3 Filter aktualisiert**: Simple/OR/AND Query Filter prüfen jetzt Leader-Namen
- ✅ **LIMIT erhöht**: Von 100 auf 300 Candidates → mehr Treffer bei großen Datenmengen

**Beispiel - Jetzt funktioniert:**
```typescript
// Faction "Harpers" mit Anführer "Bernhard"
Suche: "Bernard" (Typo!)
  → Levenshtein-Distance zu "Bernhard": 1 ✅
  → Findet "Harpers" faction! 🎉
```

**Code-Änderungen:**
```typescript
// Neu in allen 3 Filtern (Simple/OR/AND):
// Check Levenshtein for leader_name
if (leaderNameLower.length > 0) {
  const leaderLevDist = levenshtein(term, leaderNameLower)
  if (leaderLevDist <= maxDist) {
    return true  // Match! ✅
  }
}
```

**Performance:**
- LIMIT 100 → 300: Mehr Candidates für Levenshtein
- Bei 300 Factions: Alle werden durchsucht ✅
- Bei 1000+ Factions: Top 300 werden durchsucht (immer noch <50ms)

**Files Modified:**
- `/server/api/factions/index.get.ts` - Added Levenshtein checks for leader_name in 3 filters

---

### 2025-10-30 - Faction Leader as NPC Relation

**🔗 Faction Leader Verknüpfung (Evening):**
- ✅ **Backend**: Faction leader now stored as entity_relation (type: "Anführer") instead of metadata.leader
- ✅ **SQL Queries**: All faction queries extended with LEFT JOIN for leader NPC
  ```sql
  LEFT JOIN entity_relations leader_rel ON leader_rel.to_entity_id = e.id AND leader_rel.relation_type = 'Anführer'
  LEFT JOIN entities leader_npc ON leader_npc.id = leader_rel.from_entity_id
  ```
- ✅ **Search Enhancement**: Faction search now includes linked leader NPC name
  - Leader name match gets -30 point bonus (high relevance)
  - All filters (Simple/OR/AND) search through leader_name
- ✅ **Frontend**: Leader field changed from text input to NPC dropdown (v-select)
- ✅ **Save Logic**: Automatically manages leader relation on faction save/update

**Why This Is Better:**
- **Consistency**: Leader is now a real entity relation (like "Mitglieder")
- **Searchable**: Can find factions by searching for leader NPC name
- **Type-safe**: Dropdown prevents typos, ensures valid NPC references
- **Flexible**: Leader can be changed easily, relation is tracked in database

**Example:**
- Faction "Harpers" has leader NPC "Remallia Haventree"
- Search for "Remallia" → finds "Harpers" faction ✅
- Future: Will support fuzzy search ("Remalja" → "Remallia")

**Files Modified:**
- `/server/api/factions/index.get.ts` - Added leader JOIN to all queries, search logic
- `/app/pages/factions/index.vue` - UI changed to NPC dropdown, save logic updated

---

### 2025-11-01 - AI Image Generation for Locations & Factions

**🎨 DALL-E 3 Integration mit Entity-spezifischen Prompts:**

Die AI-Bildgenerierung nutzt einen **zweistufigen Prozess**:
1. **GPT-4o-mini** optimiert den User-Prompt für DALL-E
2. **DALL-E 3** generiert das Bild basierend auf optimiertem Prompt

**Backend-Architektur (`/server/api/ai/generate-image.post.ts`):**

```typescript
// Entity-spezifische System-Prompts für GPT-4o-mini
if (entityType === 'NPC') {
  // → Character portraits, waist-up, personality visible
  systemPrompt = "...fantasy character portraits..."
}
else if (entityType === 'Location') {
  // → Environment art, establishing shots, atmospheric
  systemPrompt = "...fantasy location and environment art..."
}
else if (entityType === 'Faction') {
  // → Heraldic symbols, emblems, guild crests
  systemPrompt = "...heraldic symbols and faction logos..."
}
else if (entityType === 'Item') {
  // → Isolated object renders, product photography
  systemPrompt = "...clean, isolated object renders..."
}

// Schritt 1: GPT-4o-mini optimiert den Prompt
const gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
  model: 'gpt-4o-mini',  // Günstiger als gpt-4
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: objectDescription }
  ]
})

// Schritt 2: DALL-E 3 generiert Bild
const dalleResponse = await fetch('https://api.openai.com/v1/images/generations', {
  model: 'dall-e-3',
  prompt: enhancedPrompt,
  size: '1024x1024',
  quality: 'standard',
  style: 'natural'  // Minimiert kreatives Umschreiben
})
```

**WICHTIG: Endpoint-Unterschied beim Speichern:**

❌ **FALSCH** (führt zu Timestamp-Prefix):
```typescript
// Problem: /upload-image erwartet FormData mit File
await $fetch(`/api/entities/${id}/upload-image`, {
  method: 'POST',
  body: { imageUrl: filename }  // ← 400 Error!
})
// Resultat: 1762022415398-uuid.png (mit Timestamp!)
```

✅ **RICHTIG** (nutzt neuen Endpoint):
```typescript
// Lösung: /add-generated-image nimmt String-Pfad
await $fetch(`/api/entities/${id}/add-generated-image`, {
  method: 'POST',
  body: { imageUrl: filename }  // ← String ohne /uploads/
})
// Resultat: uuid.png (ohne Timestamp!)
```

**Endpoint-Implementierung (`/server/api/entities/[id]/add-generated-image.post.ts`):**

```typescript
export default defineEventHandler(async (event) => {
  const entityId = getRouterParam(event, 'id')
  const body = await readBody<{ imageUrl: string }>(event)

  const db = getDb()

  // Zähle existierende Bilder
  const count = db.prepare('SELECT COUNT(*) as count FROM entity_images WHERE entity_id = ?')
    .get(Number(entityId)) as { count: number }

  // Füge Bild direkt ein (KEIN Upload!)
  db.prepare(`
    INSERT INTO entity_images (entity_id, image_url, is_primary, display_order)
    VALUES (?, ?, ?, ?)
  `).run(
    Number(entityId),
    body.imageUrl,  // Nur Filename, kein /uploads/
    count.count === 0 ? 1 : 0,  // Erstes Bild = Primary
    count.count
  )

  // Update entity.image_url wenn erstes Bild
  if (count.count === 0) {
    db.prepare('UPDATE entities SET image_url = ? WHERE id = ?')
      .run(body.imageUrl, Number(entityId))
  }
})
```

**Frontend Button-Layout Pattern (NPCs, Locations, Factions, Items):**

```vue
<div class="d-flex align-start gap-4">
  <!-- Avatar Preview (links) -->
  <div class="position-relative" style="min-width: 120px;">
    <v-avatar
      size="120"
      rounded="lg"
      style="cursor: pointer;"
      @click="openImagePreview(...)"
    >
      <v-img :src="`/uploads/${entity.image_url}`" />
    </v-avatar>
    <v-progress-circular
      v-if="uploadingImage || generatingImage"
      indeterminate
      style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);"
    />
  </div>

  <!-- Action Buttons (rechts) -->
  <div style="max-width: 280px; margin-left: 16px;">
    <!-- Upload Button -->
    <v-btn
      prepend-icon="mdi-camera"
      variant="tonal"
      block
      class="mb-2"
      :disabled="uploadingImage || deletingImage || generatingImage"
      @click="triggerImageUpload"
    >
      {{ $t('entity.uploadImage') }}
    </v-btn>

    <!-- AI Generate Button -->
    <v-btn
      prepend-icon="mdi-creation"
      variant="tonal"
      block
      class="mb-2"
      :loading="generatingImage"
      :disabled="generateButtonDisabled"
      @click="generateImage"
    >
      {{ $t('entity.generateImage') }}
    </v-btn>

    <!-- Download Button (nur wenn Bild existiert) -->
    <v-btn
      v-if="entity.image_url"
      prepend-icon="mdi-download"
      variant="outlined"
      block
      class="mb-2"
      :disabled="uploadingImage || generatingImage"
      @click="downloadImage(...)"
    >
      Download
    </v-btn>

    <!-- Delete Button (nur wenn Bild existiert) -->
    <v-btn
      v-if="entity.image_url"
      prepend-icon="mdi-delete"
      color="error"
      variant="outlined"
      block
      :loading="deletingImage"
      :disabled="uploadingImage || generatingImage"
      @click="deleteImage"
    >
      {{ $t('entity.deleteImage') }}
    </v-btn>

    <!-- AI Hint (nur wenn kein API Key) -->
    <div v-if="!hasApiKey" class="text-caption text-medium-emphasis mt-3">
      <v-icon size="small" class="mr-1">mdi-information-outline</v-icon>
      KI-Generierung: OpenAI API-Key in Einstellungen hinterlegen
    </div>
  </div>
</div>
```

**Computed Property für Button-Disabled State:**

```typescript
const generateButtonDisabled = computed(() => {
  return uploadingImage.value
    || deletingImage.value
    || !entityForm.value.name  // Name ist Pflichtfeld
    || !hasApiKey.value
})
```

**Dialog Persistence während Operations:**

```vue
<v-dialog
  v-model="showCreateDialog"
  max-width="800"
  :persistent="saving || uploadingImage || generatingImage"
>
  <!-- Dialog kann nicht geschlossen werden während Upload/Generation läuft -->
</v-dialog>
```

**Detaillierte Prompt-Generierung (Beispiel Factions):**

```typescript
async function generateImage() {
  const details = []

  // Type (guild, government, criminal, etc.)
  if (factionForm.value.metadata.type) {
    details.push(factionForm.value.metadata.type)
  }

  // Name (Pflichtfeld)
  details.push(factionForm.value.name)

  // Description
  if (factionForm.value.description) {
    details.push(factionForm.value.description)
  }

  // Goals (was will die Fraktion?)
  if (factionForm.value.metadata.goals) {
    details.push(factionForm.value.metadata.goals)
  }

  // Alignment (lawful, chaotic, etc.)
  if (factionForm.value.metadata.alignment) {
    details.push(factionForm.value.metadata.alignment)
  }

  // Notes (zusätzlicher Kontext)
  if (factionForm.value.metadata.notes) {
    details.push(factionForm.value.metadata.notes)
  }

  const prompt = details.filter(d => d).join(', ')

  // API Call
  const result = await $fetch('/api/ai/generate-image', {
    method: 'POST',
    body: {
      prompt,
      entityName: factionForm.value.name,
      entityType: 'Faction',
      style: 'fantasy-art'
    }
  })

  // Speichern mit korrektem Endpoint
  await $fetch(`/api/entities/${editingFaction.value.id}/add-generated-image`, {
    method: 'POST',
    body: { imageUrl: result.imageUrl.replace('/uploads/', '') }
  })
}
```

**Kosten-Beispiel (OpenAI Pricing):**
- GPT-4o-mini Prompt-Optimierung: ~$0.0002 pro Bild
- DALL-E 3 (1024x1024, standard): $0.040 pro Bild
- **Gesamt: ~$0.04 pro generiertes Bild**

**Wichtige Lessons Learned:**

1. **Endpoint-Unterschied beachten:**
   - `/upload-image` = FormData Upload → Timestamp-Prefix
   - `/add-generated-image` = String-Pfad → Kein Timestamp

2. **Button-Layout Konsistenz:**
   - Block-Buttons (volle Breite) statt Icon-Buttons
   - Avatar links, Buttons rechts
   - Progress-Indicator zentriert über Avatar

3. **Entity-spezifische Prompts:**
   - NPCs → Character Portraits
   - Locations → Environment Art
   - Factions → Heraldic Emblems
   - Items → Object Renders

4. **Dialog Persistence:**
   - `:persistent` verhindert Schließen während Operations
   - Alle Buttons disabled während Upload/Generation

5. **API Key Check:**
   - Prüfung in `onMounted` via `/api/settings/check-api-key`
   - Hint anzeigen wenn kein Key vorhanden

**Files Implemented:**
- ✅ `/server/api/ai/generate-image.post.ts` - Location & Faction prompts
- ✅ `/server/api/entities/[id]/add-generated-image.post.ts` - Neuer Endpoint
- ✅ `/app/pages/locations/index.vue` - Vollständige Implementation
- ✅ `/app/pages/factions/index.vue` - Vollständige Implementation
- ✅ `/app/pages/npcs/index.vue` - Bereits existierend (Referenz)
- ✅ `/app/pages/items/index.vue` - Bereits existierend (Referenz)

---

### 2025-10-29 - FTS5 Search Implementation

**🔍 Search System (Morning):**
- ✅ **Migration 8**: Extended FTS5 to search metadata (race, class, type, rarity, etc.)
- ✅ Added FTS5 search support to all entity APIs:
  - `/server/api/npcs/index.get.ts` - Added `?search=...` parameter
  - `/server/api/items/index.get.ts` - Added `?search=...` parameter
  - `/server/api/locations/index.get.ts` - Added `?search=...` parameter (with image gallery join)
  - `/server/api/factions/index.get.ts` - Added `?search=...` parameter
- ✅ Implemented debounced FTS5 search in NPCs page (300ms debounce)
- ✅ Replaced client-side `.filter()` with server-side FTS5 queries
- ✅ Search now indexes JSON metadata for all entity types

**Algorithm Discussion:**
- Discussed **Levenshtein Distance** (Edit Distance) for fuzzy string matching
- Decided on **FTS5** as primary solution due to O(log n) performance
- FTS5 can handle 100,000+ entities in milliseconds
- Hybrid approach (FTS5 + Levenshtein) documented as future enhancement

**🚀 Search Enhancement v2 (Afternoon):**
- ✅ **Installed `fastest-levenshtein`** - High-performance edit distance library
- ✅ **BM25 Weighted Scoring** - Name gets 10x weight vs description (1x) and metadata (0.5x)
- ✅ **Hybrid Ranking Algorithm** implemented in all entity APIs:
  1. FTS5 filters to top 100 candidates (fast)
  2. Levenshtein calculates edit distance to search term
  3. Combined score (FTS + Levenshtein) ranks results
  4. Top results sorted by relevance

**Why This Is Better:**
- **Typo Tolerance**: `"gandlf"` now finds `"Gandalf"` (edit distance: 1)
- **Smart Ranking**: Exact name matches rank higher than description matches
- **Still Fast**: Levenshtein only runs on 100 candidates, not all entities
- **Better UX**: Most relevant results always appear first

**Technical Implementation:**
```typescript
// 1. FTS5 with weighted BM25
const results = db.prepare(`
  SELECT e.*, bm25(entities_fts, 10.0, 1.0, 0.5) as fts_score
  FROM entities_fts fts
  INNER JOIN entities e ON fts.rowid = e.id
  WHERE entities_fts MATCH ?
  ORDER BY fts_score
  LIMIT 100
`).all(ftsQuery, entityType.id, campaignId)

// 2. Apply Levenshtein ranking
results = results.map(entity => {
  const nameDistance = distance(searchTerm, entity.name.toLowerCase())
  return {
    ...entity,
    _final_score: entity.fts_score + nameDistance
  }
})

// 3. Sort by combined score
results.sort((a, b) => a._final_score - b._final_score)
```

**Performance Improvements:**
- Reduced API calls by ~80% with 300ms debounce
- Server-side filtering instead of client-side (faster, scales better)
- Only matching results returned (reduced network payload)
- Name matches rank 10x higher than description matches
- Typos handled gracefully with edit distance scoring

**Files Modified (v2):**
- `/server/api/npcs/index.get.ts` - Added BM25 + Levenshtein ranking
- `/server/api/items/index.get.ts` - Added BM25 + Levenshtein ranking
- `/server/api/locations/index.get.ts` - Added BM25 + Levenshtein ranking
- `/server/api/factions/index.get.ts` - Added BM25 + Levenshtein ranking
- `package.json` - Added `fastest-levenshtein@1.0.16`

**Example: Search "gandlf" (typo)**
- **Before (v1)**: No results (requires `*` wildcard)
- **After (v2)**: Finds "Gandalf" with score based on 1 character difference

**Next Steps:**
- ⏳ Apply debounced FTS5 search to Items, Locations, Factions pages (backend ready)
- ⏳ Implement universal search dialog with `/` keyboard shortcut
- ⏳ **Future**: Trigram index for suffix matching (`*dalf` finds `Gandalf`)
- ⏳ **Future**: Soundex for phonetic matching (`Gandolf` → `Gandalf`)

---

### Earlier Sessions - Previous Work

**🖼️ Image Management System:**
- ✅ Created `entity_images` table (Migration 4)
- ✅ Image gallery component with upload/delete/set primary
- ✅ `useImageDownload` composable for one-click downloads
- ✅ UUID v4 filenames in `public/uploads/`

**📝 Markdown Document System:**
- ✅ Created `entity_documents` table (Migration 5)
- ✅ Integrated `md-editor-v3` (Vue 3 compatible)
- ✅ `EntityDocuments` component (reusable across entity types)
- ✅ Auto-save with 500ms debounce
- ✅ i18n support (German/English UI)
- ✅ Preview/Edit/Fullscreen modes

**🧩 Component Extraction:**
- ✅ `PageHeader` component - Reusable page header with create button
- ✅ Reduced duplication across NPCs, Items, Locations, Factions pages

**🎨 View Dialogs:**
- ✅ Items view dialog with image gallery + markdown docs
- ✅ NPCs view dialog (existing)
- ✅ Locations view dialog with connected NPCs

**🌐 Pages Implemented:**
- ✅ `/campaigns` - Campaign management
- ✅ `/npcs` - NPC management with FTS5 search
- ✅ `/items` - Item management
- ✅ `/locations` - Location management
- ✅ `/factions` - Faction management
- ✅ `/reference-data` - Races & classes management

---

## 🧠 Key Learnings & Design Decisions

### Why FTS5 over Client-Side Filtering?

**Before (Client-Side):**
```typescript
const filtered = npcs.value.filter(npc =>
  npc.name.toLowerCase().includes(query.toLowerCase())
)
```
- O(n) - checks every entity
- Blocks UI thread (JavaScript single-threaded)
- No ranking by relevance
- Can't handle 100,000+ entities

**After (FTS5 Server-Side):**
```typescript
const results = await $fetch('/api/npcs?search=gandalf')
```
- O(log n) - uses inverted index
- Non-blocking (runs in SQLite)
- Ranked by relevance
- Scales to millions of entities

### Why Debouncing Matters

**Without debounce:**
- User types "gandalf" (7 keystrokes) → 7 API calls
- Server processes 7 FTS5 queries
- Network congestion
- Poor UX (results flicker)

**With 300ms debounce:**
- User types "gandalf" → 1 API call (after typing stops)
- Server processes 1 FTS5 query
- Reduced load by 80%
- Smooth UX

### Component Extraction Philosophy

**Extract when:**
1. Code repeated 3+ times (DRY principle)
2. Complex logic that benefits from encapsulation
3. Improves parent component readability

**Don't extract when:**
1. Only used once
2. Tightly coupled to parent logic
3. Extraction adds more complexity than it removes

**Example: EntityDocuments Component**
- Used by NPCs, Items, Locations → ✅ Extract
- Complex editor logic (auto-save, tabs, i18n) → ✅ Extract
- Result: 300+ lines of reusable code

---

## 💡 Working with Claude

### What This File Is For

This CLAUDE.md file is **for Claude's benefit** - a comprehensive context document that enables:

1. **Fast Context Restoration:** When starting a new session, read this file first
2. **Architectural Understanding:** Core patterns, decisions, and "why" behind choices
3. **Consistency:** Maintain coding standards and design principles
4. **Efficiency:** Avoid re-explaining tech stack, database schema, or file structure

### How to Use This File

**At Session Start:**
1. Read CLAUDE.md to understand project context
2. Ask user what they want to work on
3. Reference relevant sections as needed

**During Development:**
1. Follow patterns documented here (FTS5, debouncing, component extraction)
2. Update this file when major decisions are made
3. Document "why" not just "what"

**Key Sections for Quick Reference:**
- **Search Implementation** → FTS5 patterns
- **UI/UX Patterns** → Debouncing, loading states
- **Component Extraction** → When and how to extract
- **API Routes Structure** → Endpoint conventions
- **Migration System** → How to add new migrations

### Example Session Start

```
User: "Add FTS5 search to the Items page"

Claude:
1. Reads CLAUDE.md → Sees FTS5 backend already implemented
2. Checks "FTS5 Backend Implementation Status" → Items API ready ✅
3. References "Frontend Pattern (Debounced Search)" section
4. Applies same pattern from NPCs page to Items page
5. Documents the change in CLAUDE.md changelog
```

**Result:** Task completed efficiently without re-explaining architecture.

---

## 🎯 Current Status Summary

**Fully Implemented:**
- ✅ Multi-campaign management
- ✅ NPC, Item, Location, Faction CRUD
- ✅ Image galleries for all entity types
- ✅ Markdown documents for all entity types
- ✅ FTS5 search backend (all entities with Unicode normalization)
- ✅ FTS5 search frontend with highlight (NPCs, Locations)
- ✅ Reference data management (races, classes)
- ✅ Entity relations (bidirectional with types)
- ✅ Global search with entity type routing
- ✅ Unicode normalization (akzent-insensitive Suche)

**Partially Implemented:**
- ⏳ FTS5 search frontend (Items, Factions pending)
- ⏳ Universal search dialog (backend ready, UI pending)

**Not Yet Implemented:**
- ❌ Quests page
- ❌ Session logs
- ❌ Relationship graph visualization
- ❌ Duplicate detection
- ❌ Tag system UI

**Next Priority (für morgen!):**
1. **Items page**: Apply same highlight + search pattern as NPCs/Locations
   - Copy pattern from locations/index.vue
   - Add highlight CSS
   - Query params handling
   - Unicode search already works (backend ready!)
2. **Factions page**: Same as Items
3. Build universal search dialog with `/` keyboard shortcut

---

**Last Updated:** 2025-10-31
**Database Version:** 8 (FTS5 with metadata search)
**Node Version:** 22.20.0
**Framework:** Nuxt 4