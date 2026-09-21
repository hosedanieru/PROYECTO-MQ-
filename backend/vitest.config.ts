import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`.
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
    // app.controller.spec importa AppModule completo (Puppeteer, exceljs…);
    // en arranque frío puede superar los 5 s por defecto.
    testTimeout: 30_000,
  },
});
