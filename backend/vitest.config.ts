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
    // Las pruebas del dominio corren en milisegundos, pero en arranque
    // frío la transpilación de los módulos puede superar los tiempos por
    // defecto (5 s por prueba, 10 s por hook).
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
