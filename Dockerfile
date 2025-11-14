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

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# Workaround: pnpm bug with optional dependencies (OXC bindings)
# Explicitly install Linux bindings to ensure GitHub Actions build succeeds
RUN pnpm add -D \
  @oxc-parser/binding-linux-x64-gnu \
  @oxc-transform/binding-linux-x64-gnu \
  @oxc-minify/binding-linux-x64-gnu \
  @oxc-resolver/binding-linux-x64-gnu || true

# Copy source code
COPY . .

# Build the application
RUN pnpm build

# Rebuild better-sqlite3 for production (ensures native bindings are correct)
RUN cd node_modules/better-sqlite3 && npm run build-release

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
COPY --from=builder /app/.output .output

# Copy package files
COPY --from=builder /app/package.json /app/pnpm-lock.yaml .output/server/

# Install production dependencies directly into .output/server/node_modules
WORKDIR /app/.output/server
RUN pnpm install --prod --frozen-lockfile

# Build better-sqlite3 native bindings (CRITICAL!)
RUN cd node_modules/.pnpm/better-sqlite3@12.4.1/node_modules/better-sqlite3 && \
    npm run build-release

# Go back to app root
WORKDIR /app

# Create data directory for SQLite database
RUN mkdir -p /app/data && \
    mkdir -p /app/.output/public/uploads && \
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
