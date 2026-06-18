import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'node',
    include: ['__tests__/e2e/**/*.test.ts'],
    // Load .env before any test module imports run (so Prisma gets DATABASE_URL)
    setupFiles: ['__tests__/e2e/setup.ts'],
    testTimeout: 30000,
    // Run e2e files serially — the lifecycle test shares state across steps
    sequence: { concurrent: false },
  },
})
