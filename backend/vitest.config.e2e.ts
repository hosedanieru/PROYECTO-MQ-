import { defineConfig } from 'vitest/config';

/**
 * Pruebas de integración: tocan PostgreSQL de verdad (base `mq_test`).
 *
 *   npm run test:e2e
 *
 * Corren en un solo hilo porque comparten la base y la vacían entre
 * casos; en paralelo se pisarían.
 */
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    setupFiles: ['./test/setup-e2e.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
