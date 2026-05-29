import { defineBuildConfig } from 'unbuild'

// Builds the standalone stdio MCP bin: src/index.ts -> dist/mcp.mjs.
// The shebang in src/index.ts is preserved so the bin is directly executable.
export default defineBuildConfig({
  entries: [
    { input: 'src/index', name: 'mcp' },
  ],
  declaration: false,
  clean: true,
  rollup: {
    inlineDependencies: false,
    esbuild: { target: 'node18' },
  },
})
