# DM Hero

A personal D&D campaign management tool for Dungeon Masters.

## Features

- Universal fuzzy search for NPCs, locations, items, and more
- Entity relationship management
- Session logs with timeline
- Full-text search with SQLite FTS5
- Dark/Light theme with D&D-inspired colors
- i18n support (German/English)

## Prerequisites

**Node.js 22.19.0** is required. Use nvm to switch:

```bash
nvm use
# or
nvm install 22.19.0
```

## Setup

Install dependencies:

```bash
pnpm install
```

## Development Server

Start the development server:

```bash
pnpm dev
```

The app will be available at `http://localhost:3000` (or 3001 if 3000 is busy).

## Database

The SQLite database is automatically initialized on first start with migrations.

- Database location: `data/dm-hero.db`
- Backups: `data/backups/`
- Migrations are run automatically on server start
- A backup is created before each migration

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.
