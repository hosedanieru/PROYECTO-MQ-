/**
 * SEED — Firestore
 * ================
 *
 * Mismos datos base que el seed de PostgreSQL (`datos-base.ts`), en las
 * colecciones de Firestore. Idempotente: los documentos de catálogo
 * llevan como id su código, así que correrlo dos veces no duplica.
 *
 *   npm run seed:firestore
 *
 * Necesita en .env: PERSISTENCIA=firestore y las credenciales de
 * Firebase (o FIRESTORE_EMULATOR_HOST). El administrador inicial se
 * crea solo si no existe, desde ADMIN_INICIAL_*.
 */

import 'dotenv/config';
import bcrypt from 'bcrypt';

import { COLECCION } from './cliente-firestore.js';
import { FirestoreService } from './firestore.service.js';
import {
  cruzaMedianoche,
  LINEAS_PRODUCCION,
  LUGARES,
  PERMISOS,
  GRUPOS,
  ROLES,
  TURNOS,
  VIGENTE_DESDE,
} from '../datos-base.js';

const db = new FirestoreService().db;

async function sembrarPermisos(): Promise<void> {
  const lote = db.batch();
  for (const p of PERMISOS) {
    lote.set(db.collection(COLECCION.permisos).doc(p.codigo), { modulo: p.modulo, descripcion: p.descripcion });
  }
  await lote.commit();
  console.log(`  Permisos: ${PERMISOS.length}`);
}

async function sembrarRoles(): Promise<void> {
  for (const rol of ROLES) {
    // Los permisos van embebidos en el rol: el seed es la fuente de verdad.
    await db.collection(COLECCION.roles).doc(rol.codigo).set({
      codigo: rol.codigo,
      nombre: rol.nombre,
      descripcion: rol.descripcion,
      activo: true,
      permisos: [...rol.permisos],
    });
    console.log(`  Rol ${rol.codigo}: ${rol.permisos.length} permisos`);
  }
}

async function sembrarTurnos(): Promise<void> {
  for (const turno of TURNOS) {
    await db.collection(COLECCION.turnos).doc(turno.codigo).set({
      codigo: turno.codigo,
      nombre: turno.nombre,
      activo: true,
      horarios: turno.horarios.map((h) => ({
        ...h,
        cruzaMedianoche: cruzaMedianoche(h.horaInicio, h.horaFin),
        vigenteDesde: VIGENTE_DESDE,
        vigenteHasta: null,
      })),
    });
    console.log(`  Turno ${turno.codigo}: ${turno.horarios.length} horarios`);
  }
}

async function sembrarCatalogo(coleccion: string, items: ReadonlyArray<{ codigo: string; nombre: string }>): Promise<void> {
  for (const item of items) {
    await db.collection(coleccion).doc(item.codigo).set({ codigo: item.codigo, nombre: item.nombre, activo: true }, { merge: true });
  }
  console.log(`  ${coleccion}: ${items.length}`);
}

/**
 * Líneas del DPP. Se buscan por código: si ya existe una (creada a mano
 * o migrada), se le completan tipo, capacidad y orden sin duplicarla.
 */
async function sembrarLineas(): Promise<void> {
  const coleccion = db.collection(COLECCION.lineasProduccion);
  for (const linea of LINEAS_PRODUCCION) {
    const existente = await coleccion.where('codigo', '==', linea.codigo).limit(1).get();
    const ref = existente.empty ? coleccion.doc(linea.codigo) : existente.docs[0].ref;
    await ref.set({ ...linea, activo: true }, { merge: true });
  }
  console.log(`  Líneas de producción: ${LINEAS_PRODUCCION.length}`);
}

async function sembrarAdministradorInicial(): Promise<void> {
  const documento = process.env.ADMIN_INICIAL_DOCUMENTO?.trim();
  const contrasena = process.env.ADMIN_INICIAL_PASSWORD;
  const nombre = process.env.ADMIN_INICIAL_NOMBRE?.trim() || 'Administrador';
  if (!documento || !contrasena) {
    console.log('  Administrador inicial: omitido (faltan ADMIN_INICIAL_DOCUMENTO / ADMIN_INICIAL_PASSWORD)');
    return;
  }
  if (contrasena.length < 8) {
    throw new Error('ADMIN_INICIAL_PASSWORD debe tener al menos 8 caracteres.');
  }
  const existente = await db.collection(COLECCION.usuarios).where('documento', '==', documento).limit(1).get();
  if (!existente.empty) {
    console.log(`  Administrador inicial: ya existe (${documento}), sin cambios`);
    return;
  }
  await db.collection(COLECCION.usuarios).add({
    documento,
    nombre,
    email: null,
    passwordHash: await bcrypt.hash(contrasena, 10),
    activo: true,
    rolId: 'ADMINISTRADOR',
    creadoEn: new Date(),
    actualizadoEn: new Date(),
  });
  console.log(`  Administrador inicial: creado (${documento})`);
}

async function main(): Promise<void> {
  console.log('Sembrando datos base del aplicativo MQ en Firestore...\n');
  await sembrarPermisos();
  await sembrarRoles();
  await sembrarTurnos();
  await sembrarCatalogo(COLECCION.lugares, LUGARES);
  // Grupos: solo se asegura que existan (descripción y personas esperadas las mantiene el administrador).
  for (const grupo of GRUPOS) {
    const ref = db.collection(COLECCION.grupos).doc(grupo.codigo);
    if (!(await ref.get()).exists) await ref.set({ ...grupo, activo: true });
  }
  console.log(`  grupos: ${GRUPOS.length}`);
  await sembrarLineas();
  await sembrarAdministradorInicial();
  console.log('\nListo. El catálogo de productos se carga desde el panel.');
}

main()
  .catch((error) => {
    console.error('Error al sembrar:', error);
    process.exit(1);
  })
  .finally(() => void db.terminate());
