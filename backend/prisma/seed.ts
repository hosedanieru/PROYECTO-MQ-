/**
 * SEED — Datos base del aplicativo MQ
 * ===================================
 *
 * Carga los catálogos que no dependen del levantamiento pendiente:
 * roles, permisos, turnos con sus horarios, lugar y grupos.
 *
 * El catálogo de PRODUCTOS se carga por separado mediante un script de
 * importación desde Excel, porque los datos de origen tienen duplicados
 * y contradicciones que requieren validación del área.
 *
 * Es idempotente: se puede correr varias veces sin duplicar registros.
 *
 *   npx prisma db seed
 */

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';

import { PrismaClient } from '../src/generated/prisma/client.js';
// Los datos base (permisos, roles, turnos, lugar, grupos) viven en un
// archivo neutral compartido con el seed de Firestore.
import {
  cruzaMedianoche,
  LINEAS_PRODUCCION,
  LUGARES,
  PERMISOS,
  GRUPOS,
  ROLES,
  TURNOS,
  VIGENTE_DESDE,
} from '../src/infrastructure/datos-base.js';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

// ============================================================
// EJECUCIÓN
// ============================================================

async function sembrarPermisos(): Promise<void> {
  for (const permiso of PERMISOS) {
    await prisma.permiso.upsert({
      where: { codigo: permiso.codigo },
      update: { modulo: permiso.modulo, descripcion: permiso.descripcion },
      create: permiso,
    });
  }
  console.log(`  Permisos: ${PERMISOS.length}`);
}

async function sembrarRoles(): Promise<void> {
  for (const rol of ROLES) {
    const registro = await prisma.rol.upsert({
      where: { codigo: rol.codigo },
      update: { nombre: rol.nombre, descripcion: rol.descripcion },
      create: {
        codigo: rol.codigo,
        nombre: rol.nombre,
        descripcion: rol.descripcion,
      },
    });

    // Se reemplaza el conjunto de permisos para que el seed sea la
    // fuente de verdad del rol.
    await prisma.rolPermiso.deleteMany({ where: { rolId: registro.id } });

    const permisos = await prisma.permiso.findMany({
      where: { codigo: { in: [...rol.permisos] } },
      select: { id: true },
    });

    await prisma.rolPermiso.createMany({
      data: permisos.map((p) => ({ rolId: registro.id, permisoId: p.id })),
      skipDuplicates: true,
    });

    console.log(`  Rol ${rol.codigo}: ${permisos.length} permisos`);
  }
}

async function sembrarTurnos(): Promise<void> {
  for (const turno of TURNOS) {
    const registro = await prisma.turno.upsert({
      where: { codigo: turno.codigo },
      update: { nombre: turno.nombre },
      create: { codigo: turno.codigo, nombre: turno.nombre },
    });

    for (const horario of turno.horarios) {
      await prisma.turnoHorario.upsert({
        where: {
          turnoId_diaSemana_vigenteDesde: {
            turnoId: registro.id,
            diaSemana: horario.diaSemana,
            vigenteDesde: VIGENTE_DESDE,
          },
        },
        update: {
          horaInicio: horario.horaInicio,
          horaFin: horario.horaFin,
          cruzaMedianoche: cruzaMedianoche(horario.horaInicio, horario.horaFin),
        },
        create: {
          turnoId: registro.id,
          diaSemana: horario.diaSemana,
          horaInicio: horario.horaInicio,
          horaFin: horario.horaFin,
          cruzaMedianoche: cruzaMedianoche(horario.horaInicio, horario.horaFin),
          vigenteDesde: VIGENTE_DESDE,
        },
      });
    }

    console.log(`  Turno ${turno.codigo}: ${turno.horarios.length} horarios`);
  }
}

async function sembrarLugares(): Promise<void> {
  for (const lugar of LUGARES) {
    await prisma.lugar.upsert({
      where: { codigo: lugar.codigo },
      update: { nombre: lugar.nombre },
      create: lugar,
    });
  }
  console.log(`  Lugares: ${LUGARES.length}`);
}

async function sembrarGrupos(): Promise<void> {
  for (const grupo of GRUPOS) {
    // Solo se asegura que exista: descripción y personas esperadas las
    // mantiene el administrador y el seed no las pisa.
    await prisma.grupo.upsert({
      where: { codigo: grupo.codigo },
      update: {},
      create: grupo,
    });
  }
  console.log(`  Grupos: ${GRUPOS.length}`);
}

async function sembrarLineas(): Promise<void> {
  for (const linea of LINEAS_PRODUCCION) {
    await prisma.lineaProduccion.upsert({
      where: { codigo: linea.codigo },
      update: { nombre: linea.nombre, tipo: linea.tipo, capacidadKgHora: linea.capacidadKgHora, orden: linea.orden },
      create: linea,
    });
  }
  console.log(`  Líneas de producción: ${LINEAS_PRODUCCION.length}`);
}

/**
 * Administrador inicial. Sin él nadie podría entrar al sistema para crear
 * a los demás usuarios.
 *
 * A diferencia del resto del seed, NO es un upsert: si el usuario ya
 * existe no se toca. Así una corrida posterior del seed no le pisa la
 * contraseña a un administrador que ya la cambió. Las credenciales
 * vienen del entorno, nunca del código.
 */
async function sembrarAdministradorInicial(): Promise<void> {
  const documento = process.env.ADMIN_INICIAL_DOCUMENTO?.trim();
  const contrasena = process.env.ADMIN_INICIAL_PASSWORD;
  const nombre = process.env.ADMIN_INICIAL_NOMBRE?.trim() || 'Administrador';

  if (!documento || !contrasena) {
    console.log(
      '  Administrador inicial: omitido (faltan ADMIN_INICIAL_DOCUMENTO / ADMIN_INICIAL_PASSWORD)',
    );
    return;
  }
  if (contrasena.length < 8) {
    throw new Error('ADMIN_INICIAL_PASSWORD debe tener al menos 8 caracteres.');
  }

  const existente = await prisma.usuario.findUnique({ where: { documento } });
  if (existente) {
    console.log(`  Administrador inicial: ya existe (${documento}), sin cambios`);
    return;
  }

  const rolAdmin = await prisma.rol.findUniqueOrThrow({
    where: { codigo: 'ADMINISTRADOR' },
  });

  await prisma.usuario.create({
    data: {
      documento,
      nombre,
      passwordHash: await bcrypt.hash(contrasena, 10),
      rolId: rolAdmin.id,
    },
  });
  console.log(`  Administrador inicial: creado (${documento})`);
}

async function main(): Promise<void> {
  console.log('Sembrando datos base del aplicativo MQ...\n');

  await sembrarPermisos();
  await sembrarRoles();
  await sembrarTurnos();
  await sembrarLugares();
  await sembrarGrupos();
  await sembrarLineas();
  await sembrarAdministradorInicial();

  console.log('\nListo. El catálogo de productos se carga aparte.');
}

main()
  .catch((error) => {
    console.error('Error al sembrar:', error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
