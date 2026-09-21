/**
 * MIGRACIÓN: PostgreSQL → Firestore (fusión sin borrar)
 * =====================================================
 *
 *   npm run migrar:firestore -- --simular   (solo informa, no escribe)
 *   npm run migrar:firestore                (aplica)
 *
 * Reglas (decisión del usuario, 2026-09-18: opción "fusionar sin borrar"):
 *   - Nada se borra en Firestore.
 *   - Catálogos (turnos, grupos, lugares, roles): ya existen por
 *     código en Firestore; solo se construye el mapa uuid → código.
 *   - Usuarios por documento, productos y líneas por código: si existen,
 *     se reutiliza el documento de Firestore; si no, se crean CON EL
 *     MISMO UUID de PostgreSQL (así los ids de auditoría siguen valiendo).
 *   - Remisiones por consecutivo (anio-numero): si ya existe en Firestore
 *     NO se migra (un consecutivo no se renumera) y se informa. Sus
 *     versiones y auditoría tampoco.
 *   - Programación y configuración de turno por su identidad de negocio:
 *     si existen, se omiten.
 *   - Consecutivos: se deja el mayor de los dos.
 *
 * Necesita en .env tanto DATABASE_URL como las credenciales de Firebase.
 */

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../generated/prisma/client.js';
import { claveFecha, COLECCION } from './firestore/cliente-firestore.js';
import { FirestoreService } from './firestore/firestore.service.js';

const SIMULAR = process.argv.includes('--simular');
/** Migrar solo catálogos, usuarios, productos, líneas, MFR y su auditoría: sin remisiones. */
const SIN_REMISIONES = process.argv.includes('--sin-remisiones');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const db = new FirestoreService().db;

const informe: Record<string, { migrados: number; reutilizados: number; omitidos: string[] }> = {};
function cuenta(entidad: string) {
  return (informe[entidad] ??= { migrados: 0, reutilizados: 0, omitidos: [] });
}

/** uuid de PostgreSQL → id del documento en Firestore */
const mapa = new Map<string, string>();
const m = (id: string | null | undefined): string | null => (id ? (mapa.get(id) ?? id) : null);

async function escribir(coleccion: string, id: string, datos: Record<string, unknown>): Promise<void> {
  if (!SIMULAR) await db.collection(coleccion).doc(id).set(datos);
}

// ------------------------------------------------------------
// Catálogos: solo mapa uuid → código
// ------------------------------------------------------------

async function mapearCatalogos(): Promise<void> {
  for (const t of await prisma.turno.findMany()) mapa.set(t.id, t.codigo);
  for (const p of await prisma.grupo.findMany()) mapa.set(p.id, p.codigo);
  for (const l of await prisma.lugar.findMany()) mapa.set(l.id, l.codigo);
  for (const r of await prisma.rol.findMany()) mapa.set(r.id, r.codigo);
  console.log('  Catálogos: mapeados por código');
}

// ------------------------------------------------------------
// Usuarios (por documento)
// ------------------------------------------------------------

async function migrarUsuarios(): Promise<void> {
  const c = cuenta('usuarios');
  const existentes = await db.collection(COLECCION.usuarios).get();
  const porDocumento = new Map(existentes.docs.map((d) => [d.get('documento') as string, d.id]));

  for (const u of await prisma.usuario.findMany()) {
    const yaEsta = porDocumento.get(u.documento);
    if (yaEsta) {
      mapa.set(u.id, yaEsta);
      c.reutilizados++;
      continue;
    }
    await escribir(COLECCION.usuarios, u.id, {
      documento: u.documento,
      nombre: u.nombre,
      email: u.email,
      passwordHash: u.passwordHash,
      activo: u.activo,
      rolId: m(u.rolId),
      creadoEn: u.creadoEn,
      actualizadoEn: u.actualizadoEn,
    });
    mapa.set(u.id, u.id);
    c.migrados++;
  }
}

// ------------------------------------------------------------
// Productos (por código) y líneas (por código)
// ------------------------------------------------------------

async function migrarProductos(): Promise<void> {
  const c = cuenta('productos');
  const existentes = await db.collection(COLECCION.productos).get();
  const porCodigo = new Map(existentes.docs.map((d) => [d.get('codigo') as string, d.id]));

  for (const p of await prisma.producto.findMany()) {
    const yaEsta = porCodigo.get(p.codigo);
    if (yaEsta) {
      mapa.set(p.id, yaEsta);
      c.reutilizados++;
      continue;
    }
    await escribir(COLECCION.productos, p.id, {
      codigo: p.codigo,
      descripcion: p.descripcion,
      proceso: p.proceso,
      unidadesPorCaja: p.unidadesPorCaja,
      cajasPorEstiba: p.cajasPorEstiba,
      personasIdeal: p.personasIdeal,
      subdescripcion: p.subdescripcion,
      cajasPorHora: p.cajasPorHora === null ? null : Number(p.cajasPorHora),
      pesoNetoKg: p.pesoNetoKg === null ? null : Number(p.pesoNetoKg),
      activo: p.activo,
      creadoEn: p.creadoEn,
      actualizadoEn: p.actualizadoEn,
    });
    mapa.set(p.id, p.id);
    c.migrados++;
  }
}

async function migrarLineas(): Promise<void> {
  const c = cuenta('lineasProduccion');
  const existentes = await db.collection(COLECCION.lineasProduccion).get();
  const porCodigo = new Map(existentes.docs.map((d) => [d.get('codigo') as string, d.id]));

  for (const l of await prisma.lineaProduccion.findMany()) {
    const yaEsta = porCodigo.get(l.codigo);
    if (yaEsta) {
      mapa.set(l.id, yaEsta);
      c.reutilizados++;
      continue;
    }
    await escribir(COLECCION.lineasProduccion, l.id, {
      codigo: l.codigo,
      nombre: l.nombre,
      tipo: l.tipo,
      capacidadKgHora: l.capacidadKgHora === null ? null : Number(l.capacidadKgHora),
      orden: l.orden,
      activo: l.activo,
    });
    mapa.set(l.id, l.id);
    c.migrados++;
  }
}

// ------------------------------------------------------------
// Remisiones (por consecutivo) + versiones + consecutivos
// ------------------------------------------------------------

const remisionesMigradas = new Set<string>();

async function migrarRemisiones(): Promise<void> {
  const c = cuenta('remisiones');
  const existentes = await db.collection(COLECCION.remisiones).select('anioNumero').get();
  const consecutivosEnFirestore = new Set(existentes.docs.map((d) => d.get('anioNumero') as string));

  for (const r of await prisma.remision.findMany({ include: { estibas: true }, orderBy: [{ anio: 'asc' }, { numero: 'asc' }] })) {
    const anioNumero = `${r.anio}-${String(r.numero).padStart(4, '0')}`;
    if (consecutivosEnFirestore.has(anioNumero)) {
      c.omitidos.push(`${anioNumero} (ya existe en Firestore)`);
      continue;
    }
    await escribir(COLECCION.remisiones, r.id, {
      anio: r.anio,
      numero: r.numero,
      anioNumero,
      version: r.version,
      estado: r.estado,
      fechaOperativa: r.fechaOperativa,
      fechaOperativaTexto: claveFecha(r.fechaOperativa),
      fechaHoraRegistro: r.fechaHoraRegistro,
      turnoId: m(r.turnoId),
      grupoId: m(r.grupoId),
      lugarId: m(r.lugarId),
      productoId: m(r.productoId),
      codigoSnapshot: r.codigoSnapshot,
      descripcionSnapshot: r.descripcionSnapshot,
      fechaVencimiento: r.fechaVencimiento,
      cantidadCajas: r.cantidadCajas,
      cantidadUnidades: r.cantidadUnidades,
      estibasCompletas: r.estibasCompletas,
      cajasSueltas: r.cajasSueltas,
      numerosEstiba: r.estibas.map((e) => e.numeroEstiba).sort((a, b) => a - b),
      observaciones: r.observaciones,
      creadaPorId: m(r.creadaPorId),
      entregadaPorId: m(r.entregadaPorId),
      fechaEntrega: r.fechaEntrega,
      opaNombre: r.opaNombre,
      opaCargo: r.opaCargo,
      fechaAprobacion: r.fechaAprobacion,
      motivoUltimoRechazo: r.motivoUltimoRechazo,
      validadaPorId: m(r.validadaPorId),
      fechaValidacion: r.fechaValidacion,
      conciliadoCon: r.conciliadoCon,
    });
    remisionesMigradas.add(r.id);
    c.migrados++;
  }
}

async function migrarVersiones(): Promise<void> {
  const c = cuenta('remisionVersiones');
  for (const v of await prisma.remisionVersion.findMany()) {
    if (!remisionesMigradas.has(v.remisionId)) {
      c.omitidos.push(`v${v.version} de remisión omitida`);
      continue;
    }
    await escribir(COLECCION.remisionVersiones, `${v.remisionId}-v${v.version}`, {
      remisionId: v.remisionId,
      version: v.version,
      motivoRechazo: v.motivoRechazo,
      datosAnteriores: v.datosAnteriores,
      rectificadaPorId: m(v.rectificadaPorId),
      fechaRectificacion: v.fechaRectificacion,
    });
    c.migrados++;
  }
}

async function migrarConsecutivos(): Promise<void> {
  const c = cuenta('consecutivos');
  for (const k of await prisma.consecutivo.findMany()) {
    const ref = db.collection(COLECCION.consecutivos).doc(`${k.tipo}-${k.anio}`);
    const actual = await ref.get();
    const ultimo = Math.max(k.ultimo, actual.exists ? Number(actual.get('ultimo') ?? 0) : 0);
    await escribir(COLECCION.consecutivos, ref.id, { tipo: k.tipo, anio: k.anio, ultimo });
    c.migrados++;
    console.log(`  Consecutivo ${k.tipo}-${k.anio}: Postgres=${k.ultimo}, Firestore=${actual.get('ultimo') ?? 0} → ${ultimo}`);
  }
}

// ------------------------------------------------------------
// Auditoría (solo de entidades presentes en Firestore)
// ------------------------------------------------------------

function coleccionDe(entidad: string): string {
  return (
    {
      usuario: COLECCION.usuarios,
      producto: COLECCION.productos,
      linea_produccion: COLECCION.lineasProduccion,
      bloque_programacion: COLECCION.bloquesProgramacion,
      remision: COLECCION.remisiones,
    } as Record<string, string>
  )[entidad] ?? entidad;
}

async function migrarAuditoria(): Promise<void> {
  const c = cuenta('auditoria');
  for (const a of await prisma.auditoria.findMany({ orderBy: { creadoEn: 'asc' } })) {
    if (a.entidad === 'remision' && !remisionesMigradas.has(a.entidadId)) {
      c.omitidos.push(`${a.accion} de remisión omitida`);
      continue;
    }
    // Sin id mapeado (entidad que no se migró) no tiene sentido copiar el rastro.
    if (!mapa.has(a.entidadId) && a.entidad !== 'remision') {
      const existe = (await db.collection(coleccionDe(a.entidad)).doc(a.entidadId).get()).exists;
      if (!existe) {
        c.omitidos.push(`${a.accion} de ${a.entidad} inexistente en Firestore`);
        continue;
      }
    }
    const entidadId = m(a.entidadId) ?? a.entidadId;
    await escribir(COLECCION.auditoria, a.id, {
      entidad: a.entidad,
      entidadId,
      accion: a.accion,
      valorAnterior: a.valorAnterior ?? null,
      valorNuevo: a.valorNuevo ?? null,
      motivo: a.motivo,
      usuarioId: m(a.usuarioId),
      ip: a.ip,
      creadoEn: a.creadoEn,
    });
    c.migrados++;
  }
}

// ------------------------------------------------------------
// MFR
// ------------------------------------------------------------

async function migrarBloques(): Promise<void> {
  const c = cuenta('bloquesProgramacion');
  for (const b of await prisma.bloqueProgramacion.findMany()) {
    if ((await db.collection(COLECCION.bloquesProgramacion).doc(b.id).get()).exists) {
      c.omitidos.push(`${b.id} (ya existe)`);
      continue;
    }
    await escribir(COLECCION.bloquesProgramacion, b.id, {
      fechaOperativa: b.fechaOperativa,
      fechaOperativaTexto: claveFecha(b.fechaOperativa),
      lineaId: m(b.lineaId),
      turnoId: m(b.turnoId),
      productoId: m(b.productoId),
      horaInicio: b.horaInicio,
      horaFin: b.horaFin,
      cajasPorHora: Number(b.cajasPorHora),
      eficienciaPorcentaje: Number(b.eficienciaPorcentaje),
      loop: b.loop,
      personasAsignadas: b.personasAsignadas,
      origen: b.origen,
      creadoPorId: m(b.creadoPorId),
      fechaCreacion: b.fechaCreacion,
      cerradoEn: b.cerradoEn,
      cerradoPorId: m(b.cerradoPorId),
    });
    mapa.set(b.id, b.id);
    c.migrados++;
  }
}

// ------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`Migración PostgreSQL → Firestore (${SIMULAR ? 'SIMULACIÓN, no escribe' : 'APLICANDO'})\n`);
  await mapearCatalogos();
  await migrarUsuarios();
  await migrarProductos();
  await migrarLineas();
  if (SIN_REMISIONES) {
    console.log('  Remisiones, versiones y consecutivos: NO se migran (--sin-remisiones)');
  } else {
    await migrarRemisiones();
    await migrarVersiones();
    await migrarConsecutivos();
  }
  await migrarBloques();
  await migrarAuditoria();

  console.log('\nResumen:');
  for (const [entidad, r] of Object.entries(informe)) {
    console.log(`  ${entidad.padEnd(20)} migrados=${r.migrados}  reutilizados=${r.reutilizados}  omitidos=${r.omitidos.length}`);
    for (const o of r.omitidos.slice(0, 8)) console.log(`      - ${o}`);
    if (r.omitidos.length > 8) console.log(`      … y ${r.omitidos.length - 8} más`);
  }
}

main()
  .catch((e) => {
    console.error('Error en la migración:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await db.terminate();
  });
