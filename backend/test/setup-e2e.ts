/**
 * PREPARACIÓN DE LAS PRUEBAS DE INTEGRACIÓN
 * =========================================
 *
 * Corre una vez antes de cada archivo `*.e2e-spec.ts`:
 *   1. Carga `.env.test` PISANDO cualquier variable ya presente, para que
 *      jamás se corra contra la base de desarrollo.
 *   2. Crea la base de pruebas si no existe.
 *   3. Aplica las migraciones (`prisma migrate deploy`).
 *
 * Exige que la base se llame con sufijo `_test`: es la última barrera
 * contra vaciar por error una base con datos reales.
 */

import { execSync } from 'node:child_process';
import path from 'node:path';

import { config } from 'dotenv';
import pg from 'pg';

const raiz = path.resolve(import.meta.dirname, '..');
config({ path: path.join(raiz, '.env.test'), override: true });

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('Falta DATABASE_URL en .env.test (ver .env.test.example).');
}

const parseada = new URL(url);
const nombreBase = parseada.pathname.replace(/^\//, '');
if (!nombreBase.endsWith('_test')) {
  throw new Error(
    `La base de pruebas debe terminar en "_test" (recibido "${nombreBase}"). ` +
      'Es una protección contra borrar datos reales.',
  );
}

async function asegurarBase(): Promise<void> {
  const admin = new URL(url!);
  admin.pathname = '/postgres';
  admin.search = '';
  const cliente = new pg.Client({ connectionString: admin.toString() });
  await cliente.connect();
  try {
    const existe = await cliente.query('SELECT 1 FROM pg_database WHERE datname = $1', [nombreBase]);
    if (existe.rowCount === 0) {
      await cliente.query(`CREATE DATABASE "${nombreBase}"`);
    }
  } finally {
    await cliente.end();
  }
}

await asegurarBase();
execSync('npx prisma migrate deploy', {
  cwd: raiz,
  stdio: 'pipe',
  env: { ...process.env, DATABASE_URL: url },
});
