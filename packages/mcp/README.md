# @dm-hero/mcp

A tiny **stdio MCP server** that lets an AI agent (Claude Desktop, Claude Code, Cursor, …) put content into a running **DM Hero** instance — NPCs, locations, items, factions and lore, with relations, tags and folders.

The AI never needs DM Hero's source. It talks only to the app's local HTTP API:

1. `get_contract` — learns the schema (entity types, all relation keys, races/classes/item types, metadata shapes, an example).
2. `preview_import` — dry-runs a payload (validates, shows what would be created, writes nothing).
3. `import_entities` — commits.

## Build

```bash
pnpm --filter @dm-hero/mcp build   # → dist/mcp.mjs
```

## Connect your AI

Pass the running app's URL as the only argument.

- **Electron app (default):** `http://127.0.0.1:3456`
- **Dev server:** `http://localhost:3000`

`localhost` is auto-retried as `127.0.0.1` (Node resolves `localhost` to IPv6 first, the server binds IPv4), so it's reliable across platforms.

### Claude Code

```bash
claude mcp add --transport stdio dm-hero -- \
  node /abs/path/to/packages/mcp/dist/mcp.mjs http://127.0.0.1:3456
```

### Claude Desktop / Cursor (mcp config)

```json
{
  "mcpServers": {
    "dm-hero": {
      "command": "node",
      "args": ["/abs/path/to/packages/mcp/dist/mcp.mjs", "http://127.0.0.1:3456"]
    }
  }
}
```

Then start a new agent session. Keep DM Hero running (it serves the API).

> The packaged app will offer a one-click "Connect your AI" that writes this config for you (see issue #321).
