// The shebang is added by the build's esbuild banner (see package.json).
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { readFile } from 'node:fs/promises'
import { basename, extname, resolve } from 'node:path'

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

/** POST multipart/form-data (images, PDFs) – no JSON content-type header */
async function callApiForm(path: string, form: FormData): Promise<ApiResult> {
  let lastErr: Error | null = null
  for (const base of baseCandidates) {
    try {
      const res = await fetch(`${base}${path}`, { method: 'POST', body: form })
      const text = await res.text()
      let body: unknown
      try {
        body = text ? JSON.parse(text) : null
      }
      catch {
        body = text
      }
      return { ok: res.ok, status: res.status, body }
    }
    catch (err) {
      lastErr = err as Error
    }
  }
  return { ok: false, status: 0, body: `Could not reach DM Hero at ${baseUrl}. Is the app running? (${lastErr?.message ?? 'unknown error'})` }
}

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp'])
const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.pdf': 'application/pdf',
}

/**
 * Load a file for upload from a local path (the MCP runs on the user's machine,
 * same as the app) or a http(s) URL. Returns null + reason on failure.
 */
async function loadFile(source: { filePath?: string, url?: string }, allowedExt: Set<string>, maxBytes: number): Promise<{ blob: Blob, name: string } | { error: string }> {
  if (source.filePath) {
    const abs = resolve(source.filePath)
    const ext = extname(abs).toLowerCase()
    if (!allowedExt.has(ext)) return { error: `Unsupported file type "${ext}". Allowed: ${[...allowedExt].join(', ')}` }
    try {
      const data = await readFile(abs)
      if (data.byteLength > maxBytes) return { error: `File is too large (${Math.round(data.byteLength / 1024 / 1024)} MB, max ${Math.round(maxBytes / 1024 / 1024)} MB)` }
      return { blob: new Blob([data], { type: MIME_BY_EXT[ext] }), name: basename(abs) }
    }
    catch (err) {
      return { error: `Could not read "${abs}": ${(err as Error).message}` }
    }
  }
  if (source.url) {
    let res: Response
    try {
      res = await fetch(source.url)
    }
    catch (err) {
      return { error: `Could not download "${source.url}": ${(err as Error).message}` }
    }
    if (!res.ok) return { error: `Could not download "${source.url}": HTTP ${res.status}` }
    const data = await res.arrayBuffer()
    if (data.byteLength > maxBytes) return { error: `Download is too large (max ${Math.round(maxBytes / 1024 / 1024)} MB)` }
    // Name from the URL path, fall back to the content-type
    let name = basename(new URL(source.url).pathname) || 'download'
    if (!allowedExt.has(extname(name).toLowerCase())) {
      const ct = res.headers.get('content-type') || ''
      const ext = ct.includes('png') ? '.png' : ct.includes('gif') ? '.gif' : ct.includes('webp') ? '.webp' : ct.includes('pdf') ? '.pdf' : ct.includes('jpeg') || ct.includes('jpg') ? '.jpg' : ''
      if (!ext || !allowedExt.has(ext)) return { error: `Unsupported file type from "${source.url}" (content-type ${ct || 'unknown'})` }
      name = `${name}${ext}`
    }
    return { blob: new Blob([data], { type: MIME_BY_EXT[extname(name).toLowerCase()] }), name }
  }
  return { error: 'Pass either filePath or url.' }
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
  description: z.string().optional().describe('Markdown. Cross-link other entities of this payload with {{ref:npc:1}} (or existing ones with {{ref:existing:12}}) – resolved to real links on import.'),
  metadata: z.record(z.string(), z.any()).optional().describe('Per-type fields (race/class/type/rarity…). See get_contract. Values may be keys or localized names.'),
  tags: z.array(z.string()).optional().describe('Lowercase a-z + hyphens; created if missing.'),
  folder: z.string().optional().describe('Folder name for NPC/Item/Faction/Lore; created if missing.'),
})
const relationSchema = z.object({
  from: z.string().describe('A payload ref ("npc:1"), OR an entity that already exists as "existing:<id>" (find ids with search_entities).'),
  to: z.string().describe('A payload ref ("item:1"), OR an entity that already exists as "existing:<id>".'),
  type: z.string().describe('Relation key — see get_contract.relationTypes (e.g. owns, knows, livesIn).'),
})

const updateSchema = z.object({
  id: z.number().int().positive().describe('Existing entity id (get it via search_entities).'),
  name: z.string().optional().describe('New name.'),
  description: z.string().optional().describe('New description ("" clears it).'),
  metadata: z.record(z.string(), z.any()).optional().describe('Fields to MERGE into existing metadata; set a key to null to remove it. See get_contract for per-type fields.'),
  folder: z.string().nullable().optional().describe('Folder name (created if missing); "" or null removes from folder.'),
  tags: z.array(z.string()).optional().describe('REPLACES the entity\'s whole tag set (lowercase a-z + hyphens).'),
})

const server = new McpServer({ name: 'dm-hero', version: '1.1.0' })

server.registerTool('what_can_i_do', {
  description: 'Call this when the user asks what you can do with DM Hero, or at the start of a bigger job (e.g. "import this one-shot PDF"). Returns a plain-language overview of every capability, how to ask for it, and the rules you follow (preview → confirm). Repeat it to the user in THEIR language.',
  inputSchema: {},
}, async () => asText({
  overview: 'I can turn adventure material (PDFs, notes, your descriptions) into a complete DM Hero campaign – and maintain it afterwards. Everything I do goes through DM Hero\'s local API on this machine; nothing leaves your computer.',
  capabilities: [
    { area: 'Campaigns', canDo: 'list campaigns, create a new campaign', askLike: '"Put this into my Curse of Strahd campaign" / "Create a campaign called Frostmaw"' },
    { area: 'Entities', canDo: 'create NPCs, locations, items, factions and lore entries – with race/class/type/rarity metadata, tags and folders; cross-link them in descriptions; link them with relations (owns, livesIn, knows, memberOf, …); edit or rename existing ones; archive or delete them', askLike: '"Create all NPCs and places from this PDF" / "Make Borin the owner of the Sword of Dawn" / "Archive everything from chapter 1"' },
    { area: 'Images', canDo: 'set a portrait/image for any entity and a cover for a session – from a file on this computer or a URL', askLike: '"Use ~/Downloads/borin.png as Borin\'s portrait" / "Set this map as the session cover"' },
    { area: 'Documents', canDo: 'attach markdown documents (letters, handouts, backstories, stat blocks) or PDFs to an entity', askLike: '"Attach the letter from page 12 to the mayor"' },
    { area: 'Sessions', canDo: 'list sessions, create a session with number, date, in-game date, summary and notes; update summaries/notes afterwards', askLike: '"Summarize what happened tonight into session 4" / "Create session 1 for the one-shot with the intro text as notes"' },
    { area: 'Groups', canDo: 'list groups, create groups (the party, a cult, the villains of a chapter) and add members', askLike: '"Group the three cultists as \'Cult of the Eye\'"' },
    { area: 'Maps', canDo: 'create maps from an image, place NPCs/items as markers and locations as areas (circles) on them', askLike: '"Add the region map from page 3 and place Eichwald and the ruins on it"' },
    { area: 'Encounters', canDo: 'prepare combat encounters with participants (NPCs as monsters) and HP, optionally attached to a session', askLike: '"Prepare the ambush encounter with 4 goblins and the boss"' },
    { area: 'Reading', canDo: 'look up what already exists: search entities, read one entity in full (relations, documents, tags), list sessions/groups/maps/encounters', askLike: '"What do we know about the mayor?" / "Which sessions exist?"' },
  ],
  rules: [
    'I never guess the campaign – I list campaigns and ask if unclear.',
    'Before creating or changing anything I show a short summary (preview) and wait for your OK. Deleting always shows a preview first and needs an explicit confirmation.',
    'I prefer linking to existing entities over creating duplicates (previews warn me about same-name entities).',
    'I archive rather than delete unless you explicitly want something gone.',
  ],
  typicalWorkflow: [
    '1. You hand me a source (PDF/text) and name the campaign.',
    '2. I call get_contract, extract NPCs/locations/items/factions/lore, plan groups, maps and encounters, and show you the plan.',
    '3. After your OK: import_entities (with cross-links), then images, documents, groups, map markers, encounters, and a session with the intro.',
    '4. I report what was created with ids, and you can ask me to adjust anything.',
  ],
}))

server.registerTool('list_campaigns', {
  description: 'List the campaigns in DM Hero (id + name). Call this whenever you need a campaignId. NEVER guess a campaignId — if the user has not clearly named which campaign to import into, call this and ASK the user which one. Entities must land in the campaign the user intends, never a random one.',
  inputSchema: {},
}, async () => {
  const r = await callApi('/api/campaigns')
  if (!r.ok) return asText(r.body)
  const list = Array.isArray(r.body)
    ? (r.body as { id: number, name: string }[]).map(c => ({ id: c.id, name: c.name }))
    : r.body
  return asText(list)
})

server.registerTool('create_campaign', {
  description: 'Create a NEW campaign in DM Hero and return its id + name. Use this when the user wants the imported content to live in a fresh campaign rather than an existing one — then pass the returned id to preview_import / import_entities. Ask the user before creating; do not invent campaigns unprompted.',
  inputSchema: {
    name: z.string().min(1).describe('Campaign name.'),
    description: z.string().optional().describe('Optional short description.'),
  },
}, async ({ name, description }) => {
  const r = await callApi('/api/campaigns', { method: 'POST', body: JSON.stringify({ name, description }) })
  if (!r.ok) return asText(r.body)
  const c = r.body as { id: number, name: string }
  return asText({ id: c.id, name: c.name })
})

server.registerTool('get_contract', {
  description: 'ALWAYS CALL THIS FIRST before importing. Returns DM Hero\'s import contract: valid entity types, all relation-type keys (grouped by what they connect), available races/classes/item-types/rarities (global, including custom ones), the metadata shape per entity type, and a full example payload. Use it to build a valid import.',
  inputSchema: {},
}, async () => {
  const r = await callApi('/api/import/contract')
  return asText(r.body)
})

server.registerTool('preview_import', {
  description: 'Dry-run an import: validates the payload and returns what WOULD be created (resolved metadata keys, counts, new tags/folders, text links) WITHOUT writing anything, plus WARNINGS for entities that already exist with the same name (link those as existing:<id> instead of creating twins). Always preview before importing and show the user a short summary of what will be created; only import after they confirm.',
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

server.registerTool('search_entities', {
  description: 'Find entities that ALREADY EXIST in a campaign and get their ids. Real use: a PDF says "lives in Eichwald, knows Mayor Hane, owns the Sword of Y" — search each name to get its id, then reference it in a relation as "existing:<id>" (import_entities) or edit it (update_entities). With no query it lists what the campaign has (optionally filtered by type). ALWAYS prefer linking to an existing entity over creating a duplicate.',
  inputSchema: {
    campaignId: z.number().int().positive(),
    query: z.string().optional().describe('Name to search for (case-insensitive substring). Omit to list all.'),
    type: z.enum(['NPC', 'Location', 'Item', 'Faction', 'Lore']).optional(),
    limit: z.number().int().positive().optional().describe('Max results (default 100, capped 500).'),
  },
}, async ({ campaignId, query, type, limit }) => {
  const params = new URLSearchParams({ campaignId: String(campaignId) })
  if (query) params.set('q', query)
  if (type) params.set('type', type)
  if (limit) params.set('limit', String(limit))
  const r = await callApi(`/api/import/entities?${params.toString()}`)
  return asText(r.body)
})

server.registerTool('preview_update', {
  description: 'Dry-run an edit of existing entities: validates and returns what WOULD change (merged metadata, resolved folder/tags) WITHOUT writing. Always preview before updating so the user can confirm.',
  inputSchema: {
    campaignId: z.number().int().positive(),
    updates: z.array(updateSchema).min(1),
  },
}, async (payload) => {
  const r = await callApi('/api/import/update?dryRun=true', { method: 'POST', body: JSON.stringify(payload) })
  return asText(r.body)
})

server.registerTool('update_entities', {
  description: 'Edit existing entities the user asked you to change: set name/description, MERGE metadata (a key set to null removes it), move to a folder, or REPLACE tags. Target each by its id (from search_entities). Only the fields you pass change. Preview with preview_update first and only commit after the user confirms.',
  inputSchema: {
    campaignId: z.number().int().positive(),
    updates: z.array(updateSchema).min(1),
  },
}, async (payload) => {
  const r = await callApi('/api/import/update', { method: 'POST', body: JSON.stringify(payload) })
  return asText(r.body)
})

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

server.registerTool('set_entity_image', {
  description: 'Give an existing entity (NPC, location, item, faction, lore) a portrait/image. Pass a LOCAL file path (the app and this MCP run on the same machine) OR a http(s) URL. jpg/png/gif/webp, max 8 MB. The new image becomes the primary image (older ones stay in the gallery). Get the entity id via search_entities.',
  inputSchema: {
    entityId: z.number().int().positive(),
    filePath: z.string().optional().describe('Absolute or relative local path to the image file.'),
    url: z.string().url().optional().describe('http(s) URL of the image (downloaded by the MCP, then uploaded to DM Hero).'),
  },
}, async ({ entityId, filePath, url }) => {
  const file = await loadFile({ filePath, url }, IMAGE_EXT, 8 * 1024 * 1024)
  if ('error' in file) return asText({ ok: false, error: file.error })
  const form = new FormData()
  form.append('images', file.blob, file.name)
  const r = await callApiForm(`/api/entities/${entityId}/upload-image`, form)
  return asText(r.body)
})

server.registerTool('set_session_cover', {
  description: 'Set the cover image of a session. Pass a LOCAL file path OR a http(s) URL (jpg/png/gif/webp, max 8 MB). Get the session id via list_sessions.',
  inputSchema: {
    sessionId: z.number().int().positive(),
    filePath: z.string().optional(),
    url: z.string().url().optional(),
  },
}, async ({ sessionId, filePath, url }) => {
  const file = await loadFile({ filePath, url }, IMAGE_EXT, 8 * 1024 * 1024)
  if ('error' in file) return asText({ ok: false, error: file.error })
  const form = new FormData()
  form.append('sessionId', String(sessionId))
  form.append('images', file.blob, file.name)
  const r = await callApiForm('/api/session-images/upload', form)
  return asText(r.body)
})

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

server.registerTool('add_document', {
  description: 'Attach a document to an existing entity: either a text/markdown document (title + content, e.g. a letter, a handout, a backstory) OR a PDF from a local file path. Entity links like {{npc:123}} are allowed in content. Get the entity id via search_entities.',
  inputSchema: {
    entityId: z.number().int().positive(),
    title: z.string().min(1),
    content: z.string().optional().describe('Markdown content for a text document.'),
    pdfPath: z.string().optional().describe('Local path to a PDF (max 20 MB) instead of content.'),
    date: z.string().optional().describe('ISO date (YYYY-MM-DD) shown on the document; defaults to today.'),
  },
}, async ({ entityId, title, content, pdfPath, date }) => {
  if (pdfPath) {
    const file = await loadFile({ filePath: pdfPath }, new Set(['.pdf']), 20 * 1024 * 1024)
    if ('error' in file) return asText({ ok: false, error: file.error })
    const form = new FormData()
    form.append('entityId', String(entityId))
    form.append('title', title)
    form.append('document_type', 'pdf')
    form.append('file', file.blob, file.name)
    const r = await callApiForm('/api/entity-documents/upload-pdf', form)
    return asText(r.body)
  }
  if (content === undefined) return asText({ ok: false, error: 'Pass either content (markdown) or pdfPath.' })
  const r = await callApi(`/api/entities/${entityId}/documents`, {
    method: 'POST',
    body: JSON.stringify({ title, content, date: date || new Date().toISOString().slice(0, 10) }),
  })
  return asText(r.body)
})

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

const sessionFields = {
  title: z.string().min(1).optional(),
  session_number: z.number().int().optional(),
  date: z.string().optional().describe('Real-world date, ISO (YYYY-MM-DD).'),
  summary: z.string().optional().describe('Short summary shown on the session card.'),
  notes: z.string().optional().describe('Full session notes (markdown, entity links like {{npc:123}} allowed).'),
  duration_minutes: z.number().int().nonnegative().optional(),
  in_game_year_start: z.number().int().optional(),
  in_game_month_start: z.number().int().min(1).optional().describe('1-based month in the campaign calendar.'),
  in_game_day_start: z.number().int().min(1).optional().describe('Day of month (1-31).'),
  in_game_year_end: z.number().int().optional(),
  in_game_month_end: z.number().int().min(1).optional(),
  in_game_day_end: z.number().int().min(1).optional(),
}

interface SessionRow {
  id: number
  session_number: number | null
  title: string
  date: string | null
  summary: string | null
  notes: string | null
  duration_minutes: number | null
  in_game_date_start: string | null
  in_game_date_end: string | null
  in_game_year_start: number | null
  in_game_month_start: number | null
  in_game_day_start: number | null
  in_game_year_end: number | null
  in_game_month_end: number | null
  in_game_day_end: number | null
}

async function fetchSessions(campaignId: number): Promise<SessionRow[] | ApiResult> {
  const r = await callApi(`/api/sessions?campaignId=${campaignId}`)
  if (!r.ok || !Array.isArray(r.body)) return r
  return r.body as SessionRow[]
}

server.registerTool('list_sessions', {
  description: 'List the sessions of a campaign (id, number, title, date, in-game date, summary). Use it to find a sessionId for update_session / set_session_cover, or to know what already happened.',
  inputSchema: { campaignId: z.number().int().positive() },
}, async ({ campaignId }) => {
  const sessions = await fetchSessions(campaignId)
  if (!Array.isArray(sessions)) return asText(sessions.body)
  return asText(sessions.map(s => ({
    id: s.id,
    session_number: s.session_number,
    title: s.title,
    date: s.date,
    in_game: s.in_game_year_start ? `${s.in_game_year_start}-${s.in_game_month_start}-${s.in_game_day_start}` : null,
    duration_minutes: s.duration_minutes,
    summary: s.summary,
  })))
})

server.registerTool('create_session', {
  description: 'Create a session (play session / game night) in a campaign with title, number, date, summary, notes and optional in-game date. Ask the user for the campaign if unclear (list_campaigns).',
  inputSchema: {
    campaignId: z.number().int().positive(),
    ...sessionFields,
    title: z.string().min(1),
  },
}, async (payload) => {
  const r = await callApi('/api/sessions', { method: 'POST', body: JSON.stringify(payload) })
  return asText(r.body)
})

server.registerTool('update_session', {
  description: 'Edit an existing session. Only the fields you pass change (e.g. append notes, set a summary, fix the date). Get the id via list_sessions.',
  inputSchema: {
    campaignId: z.number().int().positive(),
    sessionId: z.number().int().positive(),
    ...sessionFields,
  },
}, async ({ campaignId, sessionId, ...changes }) => {
  // The app's PATCH replaces every field, so merge with the current row first
  const sessions = await fetchSessions(campaignId)
  if (!Array.isArray(sessions)) return asText(sessions.body)
  const current = sessions.find(s => s.id === sessionId)
  if (!current) return asText({ ok: false, error: `Session ${sessionId} not found in campaign ${campaignId}` })
  const merged = { ...current, ...Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined)) }
  const r = await callApi(`/api/sessions/${sessionId}`, { method: 'PATCH', body: JSON.stringify(merged) })
  return asText(r.body)
})

// ---------------------------------------------------------------------------
// Archive / delete
// ---------------------------------------------------------------------------

server.registerTool('archive_entities', {
  description: 'Archive (hide) or unarchive entities. Archived entities stay in the database and can be restored – prefer this over delete_entities. Child entities are archived along. Get ids via search_entities and confirm with the user first.',
  inputSchema: {
    entityIds: z.array(z.number().int().positive()).min(1),
    archive: z.boolean().default(true).describe('true = archive, false = restore.'),
  },
}, async ({ entityIds, archive }) => {
  const results = []
  for (const id of entityIds) {
    const r = await callApi(`/api/entities/${id}/archive`, { method: 'PATCH', body: JSON.stringify({ archive }) })
    results.push({ id, ok: r.ok, result: r.body })
  }
  return asText(results)
})

const TYPE_ROUTES: Record<string, string> = { NPC: 'npcs', Location: 'locations', Item: 'items', Faction: 'factions', Lore: 'lore' }

server.registerTool('delete_entities', {
  description: 'Soft-delete entities (they disappear from the app; relations, map markers and pins are cleaned up). DESTRUCTIVE: first call with confirm=false to get a preview (names + types), show it to the user, and only call again with confirm=true after they agreed. Consider archive_entities instead.',
  inputSchema: {
    entityIds: z.array(z.number().int().positive()).min(1),
    confirm: z.boolean().default(false).describe('false = preview only (nothing is deleted).'),
  },
}, async ({ entityIds, confirm }) => {
  const preview: Array<{ id: number, name?: string, type?: string, error?: string }> = []
  for (const id of entityIds) {
    const r = await callApi(`/api/entities/${id}`)
    if (!r.ok) {
      preview.push({ id, error: `not found (HTTP ${r.status})` })
      continue
    }
    const body = r.body as { entity?: { name?: string }, type?: { name?: string } }
    preview.push({ id, name: body.entity?.name, type: body.type?.name })
  }
  if (!confirm) return asText({ preview, note: 'Nothing deleted. Call again with confirm=true after the user agreed.' })

  const results = []
  for (const p of preview) {
    const route = p.type ? TYPE_ROUTES[p.type] : undefined
    if (!route) {
      results.push({ id: p.id, ok: false, error: p.error ?? `unsupported type ${p.type}` })
      continue
    }
    const r = await callApi(`/api/${route}/${p.id}`, { method: 'DELETE' })
    results.push({ id: p.id, name: p.name, ok: r.ok, result: r.ok ? 'deleted' : r.body })
  }
  return asText(results)
})

// ---------------------------------------------------------------------------
// Read back
// ---------------------------------------------------------------------------

server.registerTool('get_entity', {
  description: 'Read one entity in full: name, description, metadata, tags, folder, image, its relations (both directions, with the linked entity names) and its documents. Use it to check what is already known before adding/changing something, or to verify an import.',
  inputSchema: { entityId: z.number().int().positive() },
}, async ({ entityId }) => {
  const [entity, relations, documents, tags] = await Promise.all([
    callApi(`/api/entities/${entityId}`),
    callApi(`/api/entities/${entityId}/connections`),
    callApi(`/api/entities/${entityId}/documents`),
    callApi(`/api/entities/${entityId}/tags`),
  ])
  if (!entity.ok) return asText(entity.body)
  const docs = Array.isArray(documents.body)
    ? (documents.body as Array<{ id: number, title: string, date: string, content?: string, document_type?: string }>)
        .map(d => ({ id: d.id, title: d.title, date: d.date, type: d.document_type ?? 'text', content: d.content }))
    : documents.body
  return asText({ ...(entity.body as object), relations: relations.body, documents: docs, tags: tags.body })
})

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

server.registerTool('list_groups', {
  description: 'List the entity groups of a campaign (id, name, description, member count). Groups collect entities that belong together (a party, a cult, "the villains of chapter 2").',
  inputSchema: { campaignId: z.number().int().positive() },
}, async ({ campaignId }) => {
  const r = await callApi(`/api/groups?campaignId=${campaignId}`)
  if (!r.ok || !Array.isArray(r.body)) return asText(r.body)
  return asText((r.body as Array<{ id: number, name: string, description: string | null, _counts?: { total?: number } }>)
    .map(g => ({ id: g.id, name: g.name, description: g.description, members: g._counts?.total ?? null })))
})

server.registerTool('create_group', {
  description: 'Create a group and optionally add existing entities as members (ids from search_entities / import_entities). Suggest groups to the user when a source clearly has one (the adventuring party, a gang, the villagers) and create them after confirmation.',
  inputSchema: {
    campaignId: z.number().int().positive(),
    name: z.string().min(1),
    description: z.string().optional(),
    color: z.string().optional().describe('Hex colour like #D4A574 (optional).'),
    icon: z.string().optional().describe('Material Design icon name like mdi-sword-cross (optional).'),
    memberIds: z.array(z.number().int().positive()).optional(),
  },
}, async ({ campaignId, name, description, color, icon, memberIds }) => {
  const r = await callApi('/api/groups', { method: 'POST', body: JSON.stringify({ campaignId, name, description, color, icon }) })
  if (!r.ok) return asText(r.body)
  const group = r.body as { id: number }
  let members: unknown = null
  if (memberIds?.length) {
    const m = await callApi(`/api/groups/${group.id}/members`, { method: 'POST', body: JSON.stringify({ entityIds: memberIds }) })
    members = m.body
  }
  return asText({ group: r.body, members })
})

server.registerTool('add_group_members', {
  description: 'Add existing entities to a group (ids from search_entities). Already-present members are ignored.',
  inputSchema: {
    groupId: z.number().int().positive(),
    entityIds: z.array(z.number().int().positive()).min(1),
  },
}, async ({ groupId, entityIds }) => {
  const r = await callApi(`/api/groups/${groupId}/members`, { method: 'POST', body: JSON.stringify({ entityIds }) })
  return asText(r.body)
})

// ---------------------------------------------------------------------------
// Maps
// ---------------------------------------------------------------------------

server.registerTool('list_maps', {
  description: 'List the maps of a campaign (id, name, description). Needed for add_map_marker / add_map_area.',
  inputSchema: { campaignId: z.number().int().positive() },
}, async ({ campaignId }) => {
  const r = await callApi(`/api/maps?campaignId=${campaignId}`)
  if (!r.ok || !Array.isArray(r.body)) return asText(r.body)
  return asText((r.body as Array<{ id: number, name: string, description: string | null }>).map(m => ({ id: m.id, name: m.name, description: m.description })))
})

server.registerTool('create_map', {
  description: 'Create a campaign map from an image (LOCAL file path or http(s) URL; jpg/png/gif/webp, max 50 MB) – e.g. the region or dungeon map from a module. Afterwards place entities on it with add_map_marker (NPC/item/faction/lore) and add_map_area (locations as circles).',
  inputSchema: {
    campaignId: z.number().int().positive(),
    name: z.string().min(1),
    description: z.string().optional(),
    filePath: z.string().optional(),
    url: z.string().url().optional(),
  },
}, async ({ campaignId, name, description, filePath, url }) => {
  const file = await loadFile({ filePath, url }, IMAGE_EXT, 50 * 1024 * 1024)
  if ('error' in file) return asText({ ok: false, error: file.error })
  const created = await callApi('/api/maps', { method: 'POST', body: JSON.stringify({ campaignId, name, description: description ?? null, image_url: 'placeholder' }) })
  if (!created.ok) return asText(created.body)
  const map = created.body as { id: number }
  const form = new FormData()
  form.append('image', file.blob, file.name)
  const up = await callApiForm(`/api/maps/${map.id}/upload-image`, form)
  if (!up.ok) {
    // Don't leave a map without image behind
    await callApi(`/api/maps/${map.id}`, { method: 'DELETE' })
    return asText({ ok: false, error: up.body })
  }
  return asText({ id: map.id, name, image: (up.body as { image_url?: string }).image_url })
})

server.registerTool('add_map_marker', {
  description: 'Place an existing entity (NPC, item, faction, lore – NOT a location, use add_map_area for those) as a marker on a map. x/y are percentages of the map image (0 = left/top, 100 = right/bottom).',
  inputSchema: {
    mapId: z.number().int().positive(),
    entityId: z.number().int().positive(),
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
    label: z.string().optional().describe('Optional custom label shown under the marker.'),
    notes: z.string().optional(),
  },
}, async ({ mapId, entityId, x, y, label, notes }) => {
  const r = await callApi(`/api/maps/${mapId}/markers`, { method: 'POST', body: JSON.stringify({ entity_id: entityId, x, y, custom_label: label ?? null, notes: notes ?? null }) })
  return asText(r.body)
})

server.registerTool('add_map_area', {
  description: 'Mark a LOCATION entity as a circle on a map (a town, a forest, a dungeon region). center x/y and radius are percentages of the map width (0-100).',
  inputSchema: {
    mapId: z.number().int().positive(),
    locationId: z.number().int().positive().describe('Id of a Location entity.'),
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
    radius: z.number().positive().max(100).default(5),
    color: z.string().optional().describe('Hex colour (optional).'),
  },
}, async ({ mapId, locationId, x, y, radius, color }) => {
  const r = await callApi(`/api/maps/${mapId}/areas`, { method: 'POST', body: JSON.stringify({ location_id: locationId, center_x: x, center_y: y, radius, color: color ?? null }) })
  return asText(r.body)
})

// ---------------------------------------------------------------------------
// Encounters
// ---------------------------------------------------------------------------

server.registerTool('list_encounters', {
  description: 'List the encounters (combats) of a campaign with their status. Prepared encounters from a module live here until the DM runs them.',
  inputSchema: { campaignId: z.number().int().positive() },
}, async ({ campaignId }) => {
  const r = await callApi(`/api/encounters?campaignId=${campaignId}`)
  if (!r.ok || !Array.isArray(r.body)) return asText(r.body)
  return asText((r.body as Array<{ id: number, name: string, status: string, session_id: number | null }>).map(e => ({ id: e.id, name: e.name, status: e.status, sessionId: e.session_id })))
})

server.registerTool('create_encounter', {
  description: 'Prepare a combat encounter: a name plus participants (existing NPC entity ids – create the monsters/enemies as NPCs first via import_entities). HP per participant is optional. Optionally attach it to a session.',
  inputSchema: {
    campaignId: z.number().int().positive(),
    name: z.string().min(1),
    sessionId: z.number().int().positive().optional(),
    participants: z.array(z.object({
      entityId: z.number().int().positive(),
      maxHp: z.number().int().positive().optional(),
      currentHp: z.number().int().nonnegative().optional(),
    })).optional(),
  },
}, async ({ campaignId, name, sessionId, participants }) => {
  const r = await callApi('/api/encounters', { method: 'POST', body: JSON.stringify({ campaignId, name, session_id: sessionId ?? null }) })
  if (!r.ok) return asText(r.body)
  const encounter = r.body as { id: number }
  let added: unknown = null
  if (participants?.length) {
    const p = await callApi(`/api/encounters/${encounter.id}/participants`, {
      method: 'POST',
      body: JSON.stringify({ participants: participants.map(x => ({ entityId: x.entityId, maxHp: x.maxHp, currentHp: x.currentHp ?? x.maxHp })) }),
    })
    added = p.body
  }
  return asText({ encounter: r.body, participants: added })
})

const transport = new StdioServerTransport()
await server.connect(transport)
