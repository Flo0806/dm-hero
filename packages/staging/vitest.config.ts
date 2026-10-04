import { defineConfig } from 'vitest/config'

// Relay unit tests (Node) - Nitro's auto-imports are provided by test/setup.ts
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['test/setup.ts'],
  },
})
