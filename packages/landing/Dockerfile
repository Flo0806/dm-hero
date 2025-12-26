# Stage 1: Build
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy root package files for monorepo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy landing package
COPY packages/landing ./packages/landing

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build the SSR app
WORKDIR /app/packages/landing
RUN pnpm build

# Stage 2: Production runtime
FROM node:22-bookworm-slim

WORKDIR /app

# Copy built output from builder
COPY --from=builder /app/packages/landing/.output ./.output

# Create uploads directory
RUN mkdir -p ./uploads

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# Run the Nitro server
CMD ["node", ".output/server/index.mjs"]
