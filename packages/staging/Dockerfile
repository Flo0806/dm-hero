# DM Hero game table (player app + relay) - table.dm-hero.com
# Stage 1: Build
FROM node:24-bookworm-slim AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.34.0 --activate

# Root package files for the monorepo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# The player app + the shared encryption/protocol package it uses
COPY packages/seal ./packages/seal
COPY packages/staging ./packages/staging

RUN pnpm install --frozen-lockfile --filter @dm-hero/staging...

WORKDIR /app/packages/staging
RUN pnpm build

# Stage 2: Production runtime (node:sqlite is built in - no native modules)
FROM node:24-bookworm-slim

WORKDIR /app

COPY --from=builder /app/packages/staging/.output ./.output

# Database + encrypted files live here - mount a volume to keep games across updates
RUN mkdir -p /data && chown node:node /data
VOLUME /data

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV NUXT_DATABASE_PATH=/data/staging.db
ENV NUXT_FILES_DIR=/data/files

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:3000/api/v1/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", ".output/server/index.mjs"]
