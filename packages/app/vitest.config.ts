import { defineConfig } from 'vitest/config'
import { defineVitestProject } from '@nuxt/test-utils/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  test: {
    projects: [
      // Unit tests (Node environment) - for server utils, API routes, etc.
      {
        test: {
          name: 'unit',
          include: ['test/{e2e,unit}/**/*.{test,spec}.ts'],
          environment: 'node',
          // Run test files sequentially to avoid SQLite conflicts
          fileParallelism: false,
        },
        resolve: {
          alias: {
            '~': fileURLToPath(new URL('./app', import.meta.url)),
            '@': fileURLToPath(new URL('./app', import.meta.url)),
          },
        },
      },
      // Nuxt tests (Nuxt environment) - for components, composables, etc.
      await defineVitestProject({
        test: {
          name: 'nuxt',
          include: ['test/nuxt/**/*.{test,spec}.ts'],
          environment: 'nuxt',
        },
      }),
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
})
