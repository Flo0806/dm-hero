# @dm-hero/app

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
