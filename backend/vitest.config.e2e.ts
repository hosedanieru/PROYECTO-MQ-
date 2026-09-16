import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Las pruebas e2e levantan la app completa (incluida la conexión a la
    // base de datos), así que necesitan las variables de .env.
    setupFiles: ['dotenv/config'],
  },
});
