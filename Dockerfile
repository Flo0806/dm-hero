# ==========================================
# Stage 1: Build Stage
# ==========================================
FROM node:22.20-alpine AS builder

# Install build dependencies for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Set working directory
WORKDIR /app

# Copy workspace config and lockfile
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy app package.json
COPY packages/app/package.json ./packages/app/

# Install dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# Workaround: pnpm bug with optional dependencies (OXC bindings)
# Explicitly install Linux bindings to ensure GitHub Actions build succeeds
RUN pnpm --filter @dm-hero/app add -D \
  @oxc-parser/binding-linux-x64-gnu \
  @oxc-transform/binding-linux-x64-gnu \
  @oxc-minify/binding-linux-x64-gnu \
  @oxc-resolver/binding-linux-x64-gnu || true

# Copy app source code
COPY packages/app ./packages/app

# Build the application
RUN pnpm --filter @dm-hero/app build

# Rebuild better-sqlite3 for production (ensures native bindings are correct)
RUN cd packages/app/node_modules/better-sqlite3 && npm run build-release

# ==========================================
# Stage 2: Production Stage
# ==========================================
FROM node:22.20-alpine AS runner

# Install build dependencies for native modules (needed for runtime)
RUN apk add --no-cache python3 make g++

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Set working directory
WORKDIR /app

# Copy built output to .output/ (keep Nuxt's directory structure)
COPY --from=builder /app/packages/app/.output .output

# Copy package files for production install
COPY --from=builder /app/packages/app/package.json .output/server/
COPY --from=builder /app/pnpm-lock.yaml .output/server/

# Install production dependencies directly into .output/server/node_modules
WORKDIR /app/.output/server
RUN pnpm install --prod --frozen-lockfile

# Build better-sqlite3 native bindings (CRITICAL!)
# Use find to locate better-sqlite3 regardless of version
RUN cd $(find node_modules/.pnpm -type d -name "better-sqlite3" -path "*/node_modules/better-sqlite3" | head -1) && \
    npm run build-release

# Go back to app root
WORKDIR /app

# Create data directory for SQLite database and upload directories
RUN mkdir -p /app/data && \
    mkdir -p /app/.output/public/uploads && \
    mkdir -p /app/.output/public/uploads/audio && \
    chown -R node:node /app

# Use non-root user for security
USER node

# Expose port
EXPOSE 3000

# Health check (Nuxt 4 provides /__nuxt_health endpoint)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start the application (note: .output/server/ path)
CMD ["node", ".output/server/index.mjs"]
