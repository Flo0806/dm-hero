# @dm-hero/app

## 1.0.0-beta.20

### Minor Changes

- [`b104abc`](https://github.com/Flo0806/dm-hero/commit/b104abc602427a27832aa0e244b2f845e3e933cd) Thanks [@Flo0806](https://github.com/Flo0806)! - ## Calendar Weather System
  - Add weather for calendar days (sunny, cloudy, rain, snow, etc.)
  - Season-specific weather generation based on explicit weather_type field
  - Manual weather editing per day via CalendarWeatherDialog
  - Weather icons displayed on calendar days

  ## Expanded Entity Icons
  - 48 location type icons (settlements, nature, religious, ruins, etc.)
  - 40 item type icons (weapons, magic, consumables, tools, etc.)
  - Color coding for location types by category
  - Type-specific icons in global search, entity previews, and relation lists

  ## Other Improvements
  - docker-compose.example.yml for easy deployment
  - Season settings UI with weather type dropdown

## 1.0.0-alpha.19

### Minor Changes

- [`0b213b3`](https://github.com/Flo0806/dm-hero/commit/0b213b304fc50331dbc43e3bd50755a83f183641) Thanks [@Flo0806](https://github.com/Flo0806)! - feat(ai): enhance DALL-E prompts with structured entity data and safety-filter handling
  - Add structured entity data support for richer DALL-E prompts (NPC, Location, Item, Faction, Player, Session)
  - Change default style from fantasy-art to realistic with anti-3D/CGI instructions
  - Add 16:9 format (1792x1024) for session cover images
  - Add GPT-4 safety-filter-friendly rephrasing for session prompts
  - Add custom description field for session cover image generation
  - Add meaningful error messages for safety filter rejections
  - Add unsaved changes warning for image generation across all entity dialogs
  - Disable dialog buttons during image generation

## 1.0.0-alpha.18

### Patch Changes

- [#85](https://github.com/Flo0806/dm-hero/pull/85) [`107c2c9`](https://github.com/Flo0806/dm-hero/commit/107c2c90213a84ae6d9c9dfa81d49bde2ef36654) Thanks [@Flo0806](https://github.com/Flo0806)! - fix: update NPC relation counts when deleting an NPC

  When an NPC is deleted, all other NPCs that had relations to it now have their relation counts decremented automatically. This ensures the relation count badges on NPC cards stay accurate without requiring a page refresh.

## 1.0.0-alpha.17

### Minor Changes

- [`cc80972`](https://github.com/Flo0806/dm-hero/commit/cc80972ed3af0e626d21755ec1ff2a538e2bcfb9) Thanks [@Flo0806](https://github.com/Flo0806)! - feat: interactive campaign maps and chaos graph filters
  - Interactive campaign maps with Leaflet.js
  - Map markers linked to entities (NPC, Item, Location, Faction, Lore, Player)
  - Location areas (circles) for marking regions
  - Measurement tool with configurable scale
  - Map editing dialog (rename, change image, set scale)
  - Entity type filter for map markers
  - Location field for all entities with map sync
  - Entity type filter for chaos graph
  - Snackbar notifications for map actions

## 1.0.0-alpha.16

### Patch Changes

- [`533a3cd`](https://github.com/Flo0806/dm-hero/commit/533a3cdb8d77c8bef2690956f9d1641eead5fa4f) Thanks [@Flo0806](https://github.com/Flo0806)! - feat: improve keyboard shortcut display with v-hotkey component
  - Replace text-based keyboard hint with Vuetify v-hotkey component
  - Add platform detection (Mac/PC) including Electron support
  - Fix session cards minimum width (350px)
  - Fix v-empty-state hydration mismatch on sessions page
  - Fix README badge link for release workflow

## 1.0.0-alpha.15

### Features

- Global search now shows linked entities (chips) for all entity types with bidirectional relation support
- Audio player improvements: preloads audio fully, shows buffering indicator, smoother timeline seeking
- Delete confirmation dialog for audio files (replaces browser alert)

### Bug Fixes

- Fix global search not finding linked entities for Items, Factions, Players, Lore
- Fix audio player hanging on first timeline click (especially in Electron)
- Fix entity-specific search (NPCs, Items, Lore, Players) count chips loading infinitely
- Fix missing i18n keys for factions, lore, and players search hints
- Add missing `factions.types.academic` translation

### Patch Changes

- [`4d33153`](https://github.com/Flo0806/dm-hero/commit/4d33153e0967bcf74ad882a23f2f6c3737fa973c) Thanks [@Flo0806](https://github.com/Flo0806)! - Include bindings and file-uri-to-path dependencies for Electron build

## 1.0.0-alpha.13

### Patch Changes

- [`f41ffb0`](https://github.com/Flo0806/dm-hero/commit/f41ffb02576cc42d2425405f0cea139546e7cf43) Thanks [@Flo0806](https://github.com/Flo0806)! - Include better-sqlite3 in extraResources for Electron build

## 1.0.0-alpha.12

### Patch Changes

- [`ec177f1`](https://github.com/Flo0806/dm-hero/commit/ec177f12c7cc63251b88f7f8906376b3960a94d3) Thanks [@Flo0806](https://github.com/Flo0806)! - Switch Windows build from NSIS installer to ZIP archive for better compatibility

## 1.0.0-alpha.11

### Patch Changes

- [`33103a5`](https://github.com/Flo0806/dm-hero/commit/33103a56981353b6ebbe944ccf68518a317782c7) Thanks [@Flo0806](https://github.com/Flo0806)! - Use NSIS installer instead of portable exe for Windows builds

## 1.0.0-alpha.10

### Patch Changes

- [`ff475d7`](https://github.com/Flo0806/dm-hero/commit/ff475d7406d48c4cd37b7e8dd14a4fd73903a23a) Thanks [@Flo0806](https://github.com/Flo0806)! - Switch Windows build from portable to NSIS installer

## 1.0.0

### Patch Changes

- [`9ffa508`](https://github.com/Flo0806/dm-hero/commit/9ffa50810f0c1adf3b043bacebbeacdaba846c78) Thanks [@Flo0806](https://github.com/Flo0806)! - Fix Windows build to create portable .exe instead of directory

## 1.0.0

### Patch Changes

- [`562cb39`](https://github.com/Flo0806/dm-hero/commit/562cb39c532ea826342a59d264fc9fa0efb220fb) Thanks [@Flo0806](https://github.com/Flo0806)! - Fix Windows Electron build scripts in monorepo

## 1.0.0-alpha.7

### Features

- Initial monorepo setup
- Fuzzy search with FTS5 and Levenshtein distance
- Entity management (NPCs, Locations, Items, Factions, Lore, Players, Sessions)
- Bidirectional relationships between entities
- Entity linking with `{{type:id}}` syntax
- In-game calendar with absolute day system
- AI integration (GPT name generation, DALL-E portraits)
- Rich Markdown editor
- Chaos Graph visualization
- Dark and Light themes
- i18n support (German + English)
- Electron desktop app for Windows
- Docker support for self-hosted deployment
