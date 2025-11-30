#!/bin/bash
# Sync DM Hero project to Windows for native Electron builds
# Run from WSL: ./scripts/sync-to-windows.sh

set -e

# Configuration
WINDOWS_TARGET="/mnt/c/projects/dm-hero"
SOURCE_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== DM Hero: Sync to Windows ===${NC}"
echo "Source: $SOURCE_DIR"
echo "Target: $WINDOWS_TARGET"
echo ""

# Create target directory if it doesn't exist
if [ ! -d "$WINDOWS_TARGET" ]; then
    echo -e "${YELLOW}Creating target directory...${NC}"
    mkdir -p "$WINDOWS_TARGET"
fi

# Sync using rsync (excludes build artifacts, node_modules, etc.)
echo -e "${YELLOW}Syncing files...${NC}"
rsync -av --delete \
    --exclude 'node_modules' \
    --exclude '.output' \
    --exclude '.nuxt' \
    --exclude 'dist-electron' \
    --exclude 'data' \
    --exclude 'uploads' \
    --exclude '.git' \
    --exclude '*.log' \
    --exclude '.DS_Store' \
    "$SOURCE_DIR/" "$WINDOWS_TARGET/"

echo ""
echo -e "${GREEN}✅ Sync complete!${NC}"
echo ""
echo "Next steps (in Windows PowerShell):"
echo ""
echo "  cd C:\\projects\\dm-hero"
echo "  pnpm install"
echo "  pnpm build"
echo "  pnpm electron:rebuild"
echo "  pnpm electron:start        # Test"
echo "  pnpm electron:build:win    # Build .exe"
echo ""
