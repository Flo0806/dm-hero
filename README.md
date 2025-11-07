# DM Hero

> A personal D&D campaign management tool for Dungeon Masters

[![Build](https://github.com/Flo0806/dm-hero/actions/workflows/docker-build.yml/badge.svg)](https://github.com/Flo0806/dm-hero/actions/workflows/docker-build.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

DM Hero helps Dungeon Masters organize their D&D campaigns by solving the problem of scattered information across multiple documents. Quickly find NPCs, locations, items, and track relationships between entities with powerful fuzzy search.

### Key Features

- 🔍 **Universal Fuzzy Search** - Find entities even with typos using FTS5 + Levenshtein distance
- 🗺️ **Entity Management** - NPCs, Locations, Items, Factions, Quests, Sessions
- 🔗 **Relationship Tracking** - Link entities with typed relationships (e.g., "lives in", "works for")
- 📝 **Session Logs** - Track campaign timeline with entity mentions
- 🖼️ **Image Galleries** - Multiple images per entity with primary image selection
- 📄 **Markdown Documents** - Rich documentation with live preview
- 🌐 **i18n Support** - German and English localization
- 🎨 **Themed UI** - Dark (Midnight Tavern) and Light (Aged Parchment) themes

## Tech Stack

- **Framework**: Nuxt 4
- **UI**: Vuetify 3
- **Database**: SQLite with better-sqlite3
- **Search**: FTS5 (Full-Text Search) + fastest-levenshtein
- **i18n**: @nuxtjs/i18n
- **State**: Pinia

## Quick Start

### Development

```bash
# Prerequisites: Node.js 22.20+
nvm use

# Install dependencies
pnpm install

# Approve better-sqlite3 native build (pnpm security)
pnpm approve-builds

# Start dev server
pnpm dev
```

Visit `http://localhost:3000`

### Docker (Production)

```bash
# Using docker-compose
docker-compose up -d

# Or pull from GHCR
docker pull ghcr.io/flo0806/dm-hero:latest
docker run -d -p 4444:3000 -v ./data:/app/data ghcr.io/flo0806/dm-hero:latest
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

## Project Structure

```
dm-hero/
├── app/                    # Nuxt 4 application code
│   ├── pages/             # Route pages (campaigns, npcs, locations, etc.)
│   ├── components/        # Vue components
│   ├── composables/       # Reusable composition functions
│   └── plugins/           # Vuetify and other plugins
├── server/                # Nitro server
│   ├── api/              # API routes
│   ├── utils/            # Database & migrations
│   └── plugins/          # Server plugins
├── i18n/locales/         # German/English translations
├── data/                 # SQLite database (gitignored)
└── CLAUDE.md             # Comprehensive project documentation
```

## Database

- **SQLite** with 13 migrations (auto-run on startup)
- **FTS5** for full-text search with Unicode normalization
- **Soft-delete** everywhere (deleted_at timestamps)
- **Auto-backup** before each migration

See [CLAUDE.md](./CLAUDE.md) for detailed schema documentation.

## Contributing

This is a personal project, but contributions are welcome!

1. Fork the repository
2. Create a feature branch
3. Make your changes (follow ESLint + Prettier rules)
4. Run tests: `pnpm test`
5. Submit a pull request

### Code Style

- **Comments**: English
- **Commit messages**: German or English
- **Variables**: English
- **UI text**: i18n (de/en)

Run linter before committing:
```bash
pnpm lint:fix
pnpm format
```

## License

MIT © Florian Heuberger

## Acknowledgments

- Built with [Nuxt 4](https://nuxt.com/)
- UI powered by [Vuetify 3](https://vuetifyjs.com/)
- Search powered by SQLite [FTS5](https://www.sqlite.org/fts5.html)
- Markdown editor: [md-editor-v3](https://github.com/imzbf/md-editor-v3)
