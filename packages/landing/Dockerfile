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

# Build the static site
WORKDIR /app/packages/landing
RUN pnpm build

# Stage 2: Serve with Nginx
FROM nginx:stable-alpine

# Copy built static files
COPY --from=builder /app/packages/landing/.output/public /usr/share/nginx/html

# Copy custom nginx config for SPA routing
COPY packages/landing/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
