// The shebang is added by the build's esbuild banner (see package.json).
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

/**
 * dm-hero-mcp — stdio MCP server that lets an AI agent put content into a
 * running DM Hero instance (the packaged Electron app, or the dev server).
 *
 * The AI never needs the source: it calls `get_contract` to learn the schema,
 * `preview_import` to dry-run, then `import_entities` to commit. All it talks to
 * is the app's local HTTP API.
 *
 * App URL resolution (most reliable first):
 *   1. first CLI argument            (the "Connect your AI" helper passes this)
 *   2. env DM_HERO_URL
 *   3. default http://127.0.0.1:3456 (Electron production Nitro port)
 * Dev server users pass http://localhost:3000.
 */
const baseUrl = (process.argv[2] || process.env.DM_HERO_URL || 'http://127.0.0.1:3456').replace(/\/+$/, '')

interface ApiResult { ok: boolean, status: number, body: unknown }

// Candidate base URLs to try in order. Node's fetch resolves `localhost` to
// IPv6 ::1 first, but the dev/Electron server binds IPv4 127.0.0.1 — so a
// `localhost` URL can fail with "fetch failed" even though the app is up. We
// transparently fall back to the 127.0.0.1 form for cross-platform reliability.
const baseCandidates = [baseUrl, baseUrl.replace('localhost', '127.0.0.1')]
  .filter((v, i, a) => a.indexOf(v) === i)

async function fetchJson(url: string, init?: RequestInit): Promise<ApiResult> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  let body: unknown
  const text = await res.text()
  try {
    body = text ? JSON.parse(text) : null
  }
  catch {
    body = text
  }
  return { ok: res.ok, status: res.status, body }
}

async function callApi(path: string, init?: RequestInit): Promise<ApiResult> {
  let lastErr: Error | null = null
  for (const base of baseCandidates) {
    try {
      return await fetchJson(`${base}${path}`, init)
    }
    catch (err) {
      lastErr = err as Error // connection error → try the next candidate
    }
  }
  return {
    ok: false,
    status: 0,
    body: `Could not reach DM Hero at ${baseUrl}. Is the app running? (${lastErr?.message ?? 'unknown error'})`,
  }
}

function asText(value: unknown): { content: { type: 'text', text: string }[] } {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  return { content: [{ type: 'text', text }] }
}

// --- payload schema (the server does authoritative validation; this gives the
// AI structured guidance + catches obvious shape mistakes early) ---
const entitySchema = z.object({
  ref: z.string().describe('Local id within this payload, e.g. "npc:1". Relations reference these.'),
  type: z.enum(['NPC', 'Location', 'Item', 'Faction', 'Lore']),
  name: z.string(),
  description: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional().describe('Per-type fields (race/class/type/rarity…). See get_contract. Values may be keys or localized names.'),
  tags: z.array(z.string()).optional().describe('Lowercase a-z + hyphens; created if missing.'),
  folder: z.string().optional().describe('Folder name for NPC/Item/Faction/Lore; created if missing.'),
})
const relationSchema = z.object({
  from: z.string().describe('An entity ref from this payload.'),
  to: z.string().describe('An entity ref from this payload.'),
  type: z.string().describe('Relation key — see get_contract.relationTypes (e.g. owns, knows, livesIn).'),
})

const server = new McpServer({ name: 'dm-hero', version: '1.0.0' })

server.registerTool('get_contract', {
  description: 'ALWAYS CALL THIS FIRST. Returns DM Hero\'s import contract: valid entity types, all relation-type keys (grouped by what they connect), available races/classes/item-types/rarities, the metadata shape per entity type, and a full example payload. Use it to build a valid import.',
  inputSchema: {
    campaignId: z.number().int().positive().optional().describe('Reflect this campaign\'s custom races/classes/item types too.'),
  },
}, async ({ campaignId }) => {
  const q = campaignId ? `?campaignId=${campaignId}` : ''
  const r = await callApi(`/api/import/contract${q}`)
  return asText(r.body)
})

server.registerTool('preview_import', {
  description: 'Dry-run an import: validates the payload and returns what WOULD be created (resolved metadata keys, counts, new tags/folders) WITHOUT writing anything. Always preview before importing so the user can confirm.',
  inputSchema: {
    campaignId: z.number().int().positive(),
    entities: z.array(entitySchema).min(1),
    relations: z.array(relationSchema).optional(),
  },
}, async (payload) => {
  const r = await callApi('/api/import/bulk?dryRun=true', { method: 'POST', body: JSON.stringify(payload) })
  return asText(r.body)
})

server.registerTool('import_entities', {
  description: 'Commit an import: creates the entities + relations (+ tags/folders) in DM Hero and returns a summary with the new ids. Only call this after the user has confirmed a preview_import.',
  inputSchema: {
    campaignId: z.number().int().positive(),
    entities: z.array(entitySchema).min(1),
    relations: z.array(relationSchema).optional(),
  },
}, async (payload) => {
  const r = await callApi('/api/import/bulk', { method: 'POST', body: JSON.stringify(payload) })
  return asText(r.body)
})

const transport = new StdioServerTransport()
await server.connect(transport)
