#!/bin/bash
# Sync DM Hero monorepo to Windows for native Electron builds
# Run from WSL: ./packages/app/scripts/sync-to-windows.sh
# Or from monorepo root: ./packages/app/scripts/sync-to-windows.sh

set -e

# Configuration
WINDOWS_TARGET="/mnt/c/projects/dm-hero"

# Find monorepo root (look for pnpm-workspace.yaml)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MONOREPO_ROOT="$SCRIPT_DIR/../../.."

# Verify we found the monorepo root
if [ ! -f "$MONOREPO_ROOT/pnpm-workspace.yaml" ]; then
    echo "❌ Could not find monorepo root (pnpm-workspace.yaml not found)"
    echo "   Script dir: $SCRIPT_DIR"
    echo "   Looking in: $MONOREPO_ROOT"
    exit 1
fi

MONOREPO_ROOT="$(cd "$MONOREPO_ROOT" && pwd)"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== DM Hero: Sync Monorepo to Windows ===${NC}"
echo "Source: $MONOREPO_ROOT"
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
    "$MONOREPO_ROOT/" "$WINDOWS_TARGET/"

echo ""
echo -e "${GREEN}✅ Sync complete!${NC}"
echo ""
echo "Next steps (in Windows PowerShell):"
echo ""
echo "  cd C:\\projects\\dm-hero"
echo "  pnpm install"
echo "  pnpm build                  # Build the app"
echo "  pnpm electron:rebuild       # Rebuild native modules for Electron"
echo "  pnpm electron:start         # Test Electron app"
echo "  pnpm electron:build:win     # Build .exe (use :win on Windows!)"
echo ""
