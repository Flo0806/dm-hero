---
"@dm-hero/app": patch
---

fix: the MCP server is now actually bundled in released builds and reachable at a stable path (#332). The release CI didn't build `@dm-hero/mcp` before packaging, so the shipped app showed "Connect your AI: not built". CI now builds the MCP before electron-builder on all platforms. Additionally, the bundled `mcp.mjs` is copied to userData on startup and that stable path is handed to the dialog — so on AppImage the registered `claude mcp add …` command no longer points at the per-launch `/tmp/.mount_*` directory and survives restarts.
