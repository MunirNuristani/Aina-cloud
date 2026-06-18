import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'node',
    // Exclude e2e tests — they need a real DB and are run separately via test:e2e
    exclude: ['__tests__/e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      include: ['lib/**', 'app/api/**'],
      exclude: ['app/api/**/__tests__/**'],
    },
  },
})
