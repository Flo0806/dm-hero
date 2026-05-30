import { chmodSync } from 'node:fs'
import { build } from 'esbuild'

/**
 * Bundle the stdio MCP server into a single self-contained ESM file.
 *
 * Uses esbuild's JS API rather than the CLI so the shebang banner (which
 * contains a space) needs no shell quoting — the previous `--banner:js='…'`
 * form broke on Windows CI, where the shell doesn't strip single quotes and
 * esbuild then saw two input files.
 */
await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  outfile: 'dist/mcp.mjs',
  banner: { js: '#!/usr/bin/env node' },
  legalComments: 'none',
})

// Best-effort executable bit (no-op / non-fatal on Windows).
try {
  chmodSync('dist/mcp.mjs', 0o755)
}
catch {}
