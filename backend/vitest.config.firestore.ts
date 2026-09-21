import { defineConfig } from 'vitest/config';

/**
 * Pruebas de integración contra Firestore REAL (o el emulador).
 *
 *   npm run test:firestore
 *
 * Carga `.env.firestore.test` (ver .env.firestore.test.example). Vacían
 * colecciones, así que exigen un proyecto cuyo id contenga "test" o
 * "prueba", o el emulador.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.firestore-spec.ts'],
    setupFiles: ['./test/setup-firestore.ts'],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
