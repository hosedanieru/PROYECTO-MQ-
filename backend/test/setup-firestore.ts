/**
 * Preparación de las pruebas contra Firestore.
 *
 * Carga `.env.firestore.test` pisando el entorno. Protección: solo se
 * corre contra el emulador o contra un proyecto cuyo id contenga "test"
 * o "prueba", porque las pruebas VACÍAN colecciones.
 */

import path from 'node:path';

import { config } from 'dotenv';

const raiz = path.resolve(import.meta.dirname, '..');
config({ path: path.join(raiz, '.env.firestore.test'), override: true });

process.env.PERSISTENCIA = 'firestore';

const proyecto = process.env.FIREBASE_PROJECT_ID ?? '';
if (!proyecto) {
  throw new Error('Falta FIREBASE_PROJECT_ID en .env.firestore.test (ver .env.firestore.test.example).');
}
if (!process.env.FIRESTORE_EMULATOR_HOST && !/test|prueba/i.test(proyecto)) {
  throw new Error(
    `El proyecto "${proyecto}" no parece de pruebas (debe contener "test" o "prueba"). ` +
      'Estas pruebas borran datos: use un proyecto aparte o el emulador.',
  );
}
