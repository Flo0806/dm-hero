# DM Hero

> A personal D&D campaign management tool for Dungeon Masters

[![Release](https://github.com/Flo0806/dm-hero/actions/workflows/release-app.yml/badge.svg)](https://github.com/Flo0806/dm-hero/actions/workflows/release-app.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

<a href="https://www.buymeacoffee.com/flo0806" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="40" ></a>

**[Website & Docs](https://dm-hero.com)** | **[Download](https://dm-hero.com/#download)**

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
└── data/                 # SQLite database (gitignored)
```

## Database

- **SQLite** with auto-migrations on startup
- **FTS5** for full-text search with Unicode normalization
- **Soft-delete** everywhere (deleted_at timestamps)
- **Auto-backup** before each migration

## Contributing

This is a personal project, but contributions are welcome!

1. Fork the repository
2. Create a feature branch
3. Make your changes (follow ESLint + Prettier rules)
4. Run tests: `pnpm test`
5. **Add a changeset** (see below)
6. Submit a pull request

### Changesets

We use [Changesets](https://github.com/changesets/changesets) to manage versioning and changelogs for the landing page. When you make changes that should be released:

```bash
# Create a changeset
pnpm changeset

# Follow the prompts:
# 1. Select package(s) to include (currently only @dm-hero/landing)
# 2. Choose version bump type (patch/minor/major)
# 3. Write a summary of your changes
```

This creates a markdown file in `.changeset/` describing your change. Commit this file with your PR.

**When to add a changeset:**
- New features or enhancements
- Bug fixes
- Breaking changes
- Documentation updates (for landing page)

**When NOT to add a changeset:**
- Internal refactoring with no user-visible changes
- Test-only changes
- CI/workflow updates

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

## Support the Project

DM Hero is completely **free and open source** - and always will be. I develop it in my spare time because I love D&D and want to help fellow Dungeon Masters run better campaigns.

If DM Hero helps you organize your adventures, consider supporting me with a small tip:

<a href="https://www.buymeacoffee.com/flo0806" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="50" ></a>

**What is "Buy Me a Coffee"?** It's a simple way to say thanks with a small donation. No account needed, no subscription - just a one-time tip if you feel like it. Every coffee helps cover hosting costs and motivates me to keep adding new features!

## License

MIT © Florian Heuberger

## Acknowledgments

- Built with [Nuxt 4](https://nuxt.com/)
- UI powered by [Vuetify 3](https://vuetifyjs.com/)
- Search powered by SQLite [FTS5](https://www.sqlite.org/fts5.html)
- Markdown editor: [md-editor-v3](https://github.com/imzbf/md-editor-v3)
