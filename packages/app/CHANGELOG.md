# @dm-hero/app

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
