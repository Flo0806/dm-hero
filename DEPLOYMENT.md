# Deployment Guide

This guide explains how to deploy DM Hero using Docker and GitHub Container Registry (GHCR).

## How It Works

1. **GitHub Actions** builds the Docker image on every push to `main`
2. Image is pushed to GitHub Container Registry: `ghcr.io/USERNAME/dm-hero:latest`
3. Your server pulls the latest image periodically (e.g., every 10 minutes via cron)
4. If a new image is available, the container is automatically restarted

## Server Requirements

- Docker & Docker Compose installed
- GitHub Personal Access Token (PAT) with `read:packages` scope
- Port 4444 available (or configure different port)

## Server Setup

### 1. GitHub Container Registry Login

Create a Personal Access Token:
- Go to: https://github.com/settings/tokens/new
- Scope: `read:packages`
- Save the token

Login on your server:
```bash
echo "YOUR_GITHUB_PAT" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

### 2. Create Directory Structure

```bash
mkdir -p /path/to/dm-hero/{data,uploads,logs}
cd /path/to/dm-hero
```

### 3. Create docker-compose.yml

```yaml
services:
  dm-hero:
    image: ghcr.io/YOUR_GITHUB_USERNAME/dm-hero:latest
    container_name: dm-hero
    restart: unless-stopped
    ports:
      - '4444:3000'
    volumes:
      - ./data:/app/data
      - ./uploads:/app/.output/public/uploads
    environment:
      NODE_ENV: production
      NITRO_PORT: 3000
      NITRO_HOST: 0.0.0.0
    healthcheck:
      test: ['CMD', 'node', '-e', "require('http').get('http://localhost:3000/', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"]
      interval: 30s
      timeout: 10s
      start_period: 40s
      retries: 3
```

### 4. Start the Application

```bash
docker-compose pull
docker-compose up -d
```

### 5. Setup Auto-Update (Optional)

Create an update script `update-app.sh`:

```bash
#!/bin/bash
set -e

IMAGE="ghcr.io/YOUR_GITHUB_USERNAME/dm-hero:latest"
CONTAINER_NAME="dm-hero"

echo "[$(date)] Checking for updates..."

# Pull latest image
if docker pull "$IMAGE" 2>&1 | grep -q "Image is up to date"; then
    echo "[$(date)] Already up-to-date"
    exit 0
fi

echo "[$(date)] New image found, restarting..."

# Restart container
docker stop "$CONTAINER_NAME"
docker rm "$CONTAINER_NAME"
docker-compose up -d

echo "[$(date)] Update completed"
```

Make it executable and add to crontab:
```bash
chmod +x update-app.sh

# Run every 10 minutes
crontab -e
# Add: */10 * * * * /path/to/dm-hero/update-app.sh >> /path/to/dm-hero/logs/update.log 2>&1
```

## Data Persistence

- **Database**: Stored in `./data/dm-hero.db` (volume-mounted)
- **Uploads**: Stored in `./uploads/` (volume-mounted)
- **Logs**: Container logs via `docker logs dm-hero`

## Useful Commands

```bash
# View logs
docker logs -f dm-hero

# Restart container
docker-compose restart

# Force update (pull latest image)
docker-compose pull && docker-compose up -d --force-recreate

# Cleanup old images
docker image prune -a
```

## GitHub Actions Workflow

The workflow (`.github/workflows/docker-build.yml`) automatically:
- Builds the Docker image on push to `main` or tags
- Pushes to GHCR with tags:
  - `latest` (main branch)
  - `v1.0.0` (git tags)
  - `main-abc1234` (commit SHA)

### Manual Trigger

You can manually trigger a build via GitHub Actions UI:
1. Go to Actions tab
2. Select "Build and Push Docker Image"
3. Click "Run workflow"

## Troubleshooting

**Cannot pull image:**
- Check GHCR login: `docker login ghcr.io`
- Verify PAT has `read:packages` scope

**Container won't start:**
- Check logs: `docker logs dm-hero`
- Verify port 4444 is available

**Database errors after update:**
- Migrations run automatically on startup
- Check logs for migration errors

**Port already in use:**
- Change port in `docker-compose.yml`: `'ANOTHER_PORT:3000'`
