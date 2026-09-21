/**
 * AYUDANTES DE LAS PRUEBAS DE INTEGRACIÓN
 * =======================================
 *
 * Un cliente Prisma contra la base de pruebas, limpieza de tablas entre
 * casos y los catálogos mínimos que toda remisión necesita.
 */

import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';

import { PrismaClient } from '../src/generated/prisma/client.js';

export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/** Vacía las tablas de datos (no los catálogos) en orden de dependencias. */
export async function limpiarDatos(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE remision_estiba, remision_version, auditoria, remision, consecutivo, bloque_programacion, asistencia_turno, asignacion_linea RESTART IDENTITY CASCADE',
  );
}

/**
 * Programa el DPP mínimo de un día: un bloque de 06:00 a 13:30 en L1
 * con target exacto `targetCajas` (E = 100 %). Sin esto ninguna
 * remisión oficial se puede crear ("ni una caja más de lo programado").
 */
export async function programarDia(fechaOperativa: Date, productoId: string, targetCajas: number): Promise<void> {
  const linea = await prisma.lineaProduccion.upsert({
    where: { codigo: 'L1' },
    update: {},
    create: { codigo: 'L1', nombre: 'L1', tipo: 'MULTIPACK', capacidadKgHora: 306, orden: 1 },
  });
  const turno = await prisma.turno.findUniqueOrThrow({ where: { codigo: 'T1' } });
  const admin = await prisma.usuario.findFirstOrThrow({ where: { documento: 'admin-test' } });
  await prisma.bloqueProgramacion.create({
    data: {
      fechaOperativa,
      lineaId: linea.id,
      turnoId: turno.id,
      productoId,
      horaInicio: '06:00',
      horaFin: '13:30',
      cajasPorHora: targetCajas / 7.5,
      eficienciaPorcentaje: 100,
      origen: 'MANUAL',
      creadoPorId: admin.id,
    },
  });
}

export interface CatalogosBase {
  turnoId: string;
  grupoId: string;
  lugarId: string;
  productoId: string;
  adminId: string;
  /** Credenciales del administrador de pruebas. */
  admin: { documento: string; contrasena: string };
}

/** Crea (o reutiliza) lo mínimo para operar: turno, grupo, lugar, producto, rol y admin. */
export async function catalogosBase(): Promise<CatalogosBase> {
  const turno = await prisma.turno.upsert({
    where: { codigo: 'T1' },
    update: {},
    create: { codigo: 'T1', nombre: 'Turno 1' },
  });
  const grupo = await prisma.grupo.upsert({
    where: { codigo: 'LOGICMARD' },
    update: {},
    create: { codigo: 'LOGICMARD', nombre: 'LOGICMARD' },
  });
  const lugar = await prisma.lugar.upsert({
    where: { codigo: 'MQ_PEPSICO_SD' },
    update: {},
    create: { codigo: 'MQ_PEPSICO_SD', nombre: 'MAQUILA PEPSICO SANTO DOMINGO' },
  });
  const producto = await prisma.producto.upsert({
    where: { codigo: '300058141' },
    update: {},
    create: {
      codigo: '300058141',
      descripcion: 'SURTIDO MEGA LONCHERA 586GX3X1 BX22',
      unidadesPorCaja: 4,
      cajasPorEstiba: 36,
    },
  });

  // Rol con todos los permisos que existan (como el seed real).
  const codigosPermiso = [
    'remision.crear', 'remision.consultar', 'remision.editar', 'remision.entregar',
    'remision.registrar_aprobacion', 'remision.rectificar', 'remision.validar',
    'remision.exportar', 'catalogo.consultar', 'catalogo.editar', 'admin.usuarios', 'admin.auditoria',
  ];
  for (const codigo of codigosPermiso) {
    await prisma.permiso.upsert({
      where: { codigo },
      update: {},
      create: { codigo, modulo: codigo.split('.')[0] },
    });
  }
  const rol = await prisma.rol.upsert({
    where: { codigo: 'ADMINISTRADOR' },
    update: {},
    create: { codigo: 'ADMINISTRADOR', nombre: 'Administrador' },
  });
  const permisos = await prisma.permiso.findMany({ select: { id: true } });
  await prisma.rolPermiso.createMany({
    data: permisos.map((p) => ({ rolId: rol.id, permisoId: p.id })),
    skipDuplicates: true,
  });

  const admin = { documento: 'admin-test', contrasena: 'clave-de-pruebas' };
  const usuario = await prisma.usuario.upsert({
    where: { documento: admin.documento },
    update: {},
    create: {
      documento: admin.documento,
      nombre: 'Admin de pruebas',
      passwordHash: await bcrypt.hash(admin.contrasena, 4), // rondas bajas: es una prueba
      rolId: rol.id,
    },
  });

  return {
    turnoId: turno.id,
    grupoId: grupo.id,
    lugarId: lugar.id,
    productoId: producto.id,
    adminId: usuario.id,
    admin,
  };
}
