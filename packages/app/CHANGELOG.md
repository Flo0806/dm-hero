# @dm-hero/app

## 1.4.1

### Patch Changes

- 1a2c0a7: fix: the MCP server is now actually bundled in released builds and reachable at a stable path (#332). The release CI didn't build `@dm-hero/mcp` before packaging, so the shipped app showed "Connect your AI: not built". CI now builds the MCP before electron-builder on all platforms. Additionally, the bundled `mcp.mjs` is copied to userData on startup and that stable path is handed to the dialog — so on AppImage the registered `claude mcp add …` command no longer points at the per-launch `/tmp/.mount_*` directory and survives restarts.

## 1.4.0

### Minor Changes

- 3482ae9: feat: AI bulk-import via MCP (#321) — connect an external AI assistant (Claude, Cursor …) to DM Hero through a small stdio MCP server and let it fill a campaign for you. A self-describing contract endpoint tells the AI exactly what's possible (entity types, relation keys, per-type metadata, available races/classes/item types), so it can build valid payloads without the source. The AI can: list/create campaigns; search existing entities to get their ids; create NPCs/Locations/Items/Factions/Lore with tags, folders and relations; link new content to entities that already exist ("existing:<id>"); and edit existing entities (merge metadata, replace tags, move folder). Every write is strictly validated server-side and previewable as a dry-run before commit. The dashboard gains a "Connect your AI" dialog with copy-paste setup for common assistants, and the app shows a snackbar + refreshes its lists automatically after an AI import or edit (only for AI changes, never manual ones).
- 9a4fa7a: feat: climate zones for weather generation — per-campaign zones with temperature + weather-distribution profiles per season, a per-zone weather generator (zone A sunny while zone B rains on the same day), a zone view-switcher in the calendar, and zones drawn as circles on maps (lockable per circle, weather shown in the hover tooltip). Export/import carries zones, profiles, per-zone weather and map circles — fully backwards compatible (older exports import unchanged). Migration runner hardened against the dev double-init race.
- c0b3579: feat: emily teal "Deep Lagoon" theme (community tribute) with layered radial-gradient page background, coral-accented destructive actions, and a procedural distant-lightning easter egg on the dashboard (every 4–15 s, fresh bolt + branch each strike, screen-blend flash stays behind cards). Reduced-motion + animations toggle respected.
- b13ed45: feat: folders for NPCs, items, factions and lore — flat phase-1 UI on a nesting-ready schema, move menu, folder-open view with drag-pool, easter-egg hover animations (toggle in Settings), backwards-compatible export/import with silent `Name (1)` rename on collision
- 791a7c7: feat: tags for all entities with `#tag` search, color picker, batched store, and export/import preservation
- d28a327: feat: per-theme dashboard ambience (#322) — every theme now has its own fitting background animation on the dashboard. Seven themes use a parameterised particle field with distinct modes (rising embers/bubbles, falling dust, drifting motes, twinkling sparkles, fireflies, diagonal streaks), each in the theme's palette; the "emily" theme keeps its bespoke lightning (now a livelier cadence). All ambience sits behind the cards, is purely decorative, and is gated on the existing "Spielereien" setting + prefers-reduced-motion.
- 09bc84c: feat: upgrade to vuetify 4 with 7 themes, persistent theme switcher and reusable feature-tooltip bubble

### Patch Changes

- dcbccb3: fix: persist uploaded files in docker — `docker-compose.yml` and the dockerfile now use `/app/uploads`, which is where the server actually writes. previously uploads landed in a directory that was not the docker volume mount and were lost on container restart.
- 71d5356: fix: merge-import no longer wipes the target campaign's calendar when the import file carries an "empty" calendar (a default config row but zero months). Both the conflict check and the import step now share one guard (`hasImportableCalendar`), so a calendar is only deleted/replaced when the import actually has months. (#297)
- db60a50: fix: NPC search no longer drops the typed term when it fuzzily matches a race/class (#313). A 5-character query like "Baldu" fuzzily matched the class "barde" (Levenshtein 2) and replaced the search, so the NPC "Balduwan" was never found. Race/class/type expansion now ADDS its variants alongside the literal term prefix instead of replacing it, so name prefix matches always survive.
- ca00b6e: fix: show npc names and use correct id in the npc view relations tab (map api fields `related_npc_name` / `related_npc_id` instead of the non-existent `name` / `id`)
- f8f6041: feat: show a per-release codename in the header — each minor release gets its own name in its own font (1.4 = "The Summoning", Pirata One). Fonts are bundled locally (offline-safe).

## 1.3.4

### Patch Changes

- 6d8b5c0: chore: upgrade archiver to 8 (esm-only release, switched to named `ZipArchive` export)
- 40efe42: fix: drop pnpm version pin from ci workflows so it no longer conflicts with the packageManager field
- 1685eb2: chore: update dependencies across the monorepo, upgrade electron from 39 to 41, pin node 24 and pnpm 10.34

## 1.3.3

### Patch Changes

- 8997822: Linux: replace broken "Restart now" with "Show in folder" after auto-update download, since AppImage can't self-replace
- de575dc: chore: run unit tests against an isolated in-memory database instead of the dev DB

## 1.3.2

### Patch Changes

- b00ce9f: Linux AppImage wrapper for no-sandbox + v1.3 announcement dialog

## 1.3.1

### Patch Changes

- 4c203f1: Fix broken main.js and remove app.setName

## 1.3.0

### Minor Changes

- 232e28b: v1.3.0 release with archive, multi-class, Linux fixes

## 1.3.1

### Patch Changes

- 9995e4e: Fix broken userData path from app.setName

## 1.3.0

### Minor Changes

- 6c7df89: Add archive/unarchive functionality for all entity types
- 2d2f35b: Support multi-class and multi-type for NPCs with i18n search
- d1531ba: Show nested locations in chaos graph and improve relation labels
- 7609bd1: Add notes/info text field to NPC details tab
- ec0f25c: Add textarea field type to stat blocks

### Patch Changes

- d3d4449: Auto-backup database before update download
- 72f2e65: Preserve archived_at in export/import and add app version check
- dd37de4: Fix image not updating in dialog and card after upload
- 3cb595c: Fix Linux and Mac artifact names for auto-update downloads
- 09d751e: Fix Linux sandbox crash and improve icon handling
- f862c29: Fix hardcoded German relation type 'befindet sich in' → 'currentlyAt'
- 1863f94: Fix incorrect relation types between lore and players
- 52d53bf: Show linked NPCs and players in NPC preview dialog
- 0e239d2: Add ship icon for location type 'ship'

## 1.2.0

### Minor Changes

- af11147: Add encounter tracker with full combat flow: initiative, turn tracking, HP management, effects system, dice roller, and 49 unit tests (#247)
- 09293e9: Add multi-provider AI support: OpenAI + Google Gemini with model selection, shared abstraction, and no-text image rules (#249)
- a9668e7: Add stat block template system for NPCs and Players

  - Stat template CRUD with presets (D&D 5e, Pathfinder 2e, DSA 5, Splittermond)
  - Entity stats (assign, edit, change, remove) with all field types
  - Character sheet PDF upload/view/download
  - Export/Import support for stat templates and entity stats
  - Reference data editor with usage tracking and imported badge
  - Character sheets excluded from document counts

### Patch Changes

- cf641cb: Season name and background image are now required fields in calendar settings with validation
- 01d3ed4: Fix text formatting (newlines) being lost in view/preview dialogs
- 56e66ba: Minimize Linux Electron menu bar to match macOS (Edit + Help only)
- 32e9d4f: Add v1.2 welcome dialog announcement and fix missing hasStats in NpcCounts

## 1.1.3

### Patch Changes

- 0beeba9: Add macOS builds to release workflow (arm64 + x64, signed and notarized)

## 1.1.2

### Patch Changes

- 75c6090: fix: add missing 'knows' relation type to NPC_RELATION_TYPES
  fix: add missing 'letter' lore type
  fix: campaign import - calendar conflict detection, group deletion cascade

## 1.1.1

### Patch Changes

- 25250f1: Fix context menu and group functionality:
  - Fix: "Add to Group" in context menu now works correctly
  - Fix: "Create New Group" in context menu creates group and adds entity
  - Fix: Only one context menu can be open at a time
  - Fix: Group entity selection preserved when switching tabs
  - Fix: GroupCard can now be pinned
  - Fix: Player birthday saved to calendar on first save

## 1.1.0

### Minor Changes

- 2d78fdd: ### Features

  - Clickable count badges on entity cards - click to jump directly to the related tab (#214)
  - Character birthday with in-game calendar integration (#213)
  - Quick linking and quick create in dialogs (#208)
  - Item grouping for better organization (#205)

  ### Fixes

  - Fixed map marker placement - markers already inside location area are no longer moved
  - Improved session in-game date picker UX with checkbox pattern (#215)
  - Fixed state loss in entity details when adding relations (#212)
  - Optimized SQLite requests with parallel execution (#209)
  - Fixed Shadar-Kai translation (#206)
  - Fixed update checker download button (#202)
  - Improved calendar weather validation with reset option (#201)
  - Fixed chaos graph view/edit buttons (#198)

  ### Dependencies

  - Upgraded Nuxt to 4.3.0

## 1.0.2

### Patch Changes

- - Fix calendar weather generation validation - button now disabled with tooltip when calendar not configured
  - Add calendar reset functionality with linked data warnings
  - Add weather overwrite confirmation dialog
  - Fix electron-builder artifact naming for auto-updater

## 1.0.1

### Patch Changes

- 5454732: fix: improve image generation safety filter handling

All notable changes to this project will be documented in this file.

## 1.0.0

The first stable release of DM Hero - a personal D&D campaign management tool for Dungeon Masters.

### Core Features

- **Entity Management**: NPCs, Locations, Items, Factions, Lore, Players, Sessions
- **Fuzzy Search**: FTS5 + Levenshtein across all fields including linked entities
- **Bidirectional Relations**: NPCs know Lore, Lore shows NPCs
- **Entity Linking**: `{{npc:123}}` in Markdown for clickable badges with preview
- **Rich Markdown Editor**: Full formatting with entity links and syntax highlighting

### Campaign Tools

- **In-Game Calendar**: Configurable months, seasons, weather per day
- **Interactive Maps**: Upload world maps, place markers, link to entities
- **Chaos Graph**: Force-directed visualization of entity relationships
- **Session Management**: Track sessions with dates, notes, audio recordings

### AI Integration

- **DALL-E Image Generation**: AI portraits for entities and session covers
- **GPT Name Generation**: Context-aware name suggestions

### Platform Support

- **Desktop**: Windows (EXE/Installer) and Linux (AppImage) via Electron
- **Web/Docker**: Self-hosted deployment with SQLite database
- **Auto-Updates**: Built-in update checker with download notifications

### User Experience

- **Dark & Light Themes**: Fantasy-themed color schemes
- **i18n**: German and English language support
- **Local-First**: All data stored locally in SQLite
- **Export/Import**: Full campaign backup and sharing
