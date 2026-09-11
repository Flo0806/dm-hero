# @dm-hero/mcp

A tiny **stdio MCP server** that lets an AI agent (Claude Desktop, Claude Code, Cursor, …) put content into a running **DM Hero** instance — NPCs, locations, items, factions and lore, with relations, tags and folders.

The AI never needs DM Hero's source. It talks only to the app's local HTTP API. Tools:

- `list_campaigns` / `create_campaign` — pick the target campaign, or make a new one.
- `get_contract` — learn the schema (entity types, all relation keys, races/classes/item types, metadata shapes, an example).
- `search_entities` — find entities that already exist and get their ids.
- `preview_import` / `import_entities` — dry-run, then commit: create entities (with tags, folders, relations) and link to existing entities via `existing:<id>`.
- `preview_update` / `update_entities` — dry-run, then commit edits to existing entities (merge metadata, replace tags, move folder, rename).
- `set_entity_image` / `set_session_cover` — give an entity a portrait or a session a cover, from a local file path or a URL (jpg/png/gif/webp, max 8 MB).
- `add_document` — attach a markdown document (title + content) or a PDF (local path) to an entity.
- `list_sessions` / `create_session` / `update_session` — read and write play sessions (title, number, date, summary, notes, in-game date, duration).
- `archive_entities` — archive or restore entities (reversible, preferred over deleting).
- `delete_entities` — soft-delete entities; `confirm=false` returns a preview, `confirm=true` commits after the user agreed.
- `get_entity` — read one entity in full (metadata, relations, documents, tags) to check before changing.
- `list_groups` / `create_group` / `add_group_members` — groups (the party, a cult, the villains of a chapter).
- `list_maps` / `create_map` / `add_map_marker` / `add_map_area` — maps from an image file/URL, entities as markers, locations as circles (percent coordinates).
- `list_encounters` / `create_encounter` — prepared combats with participants and HP, optionally attached to a session.
- `what_can_i_do` — plain-language overview of all capabilities, how to ask, and the preview → confirm rules; the AI can read it back to the user.

Descriptions may cross-link entities of the same payload with `{{ref:npc:1}}` (or `{{ref:existing:12}}`); the import resolves them to real `{{npc:123}}` links. Previews warn about entities that already exist with the same name.

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

> The packaged app has a **"Connect your AI"** dialog on the dashboard that shows these exact commands (with the right path and URL filled in) to copy-paste.
