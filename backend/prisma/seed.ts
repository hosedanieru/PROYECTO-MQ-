/**
 * SEED — Datos base del aplicativo MQ
 * ===================================
 *
 * Carga los catálogos que no dependen del levantamiento pendiente:
 * roles, permisos, turnos con sus horarios, lugar y proveedores.
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

import { DiaSemana, PrismaClient } from '../src/generated/prisma/client.js';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

// ============================================================
// PERMISOS
// ============================================================

const PERMISOS = [
  // Remisiones
  {
    codigo: 'remision.crear',
    modulo: 'remision',
    descripcion: 'Crear remisiones',
  },
  {
    codigo: 'remision.consultar',
    modulo: 'remision',
    descripcion: 'Consultar remisiones',
  },
  {
    codigo: 'remision.editar',
    modulo: 'remision',
    descripcion: 'Editar remisiones en borrador',
  },
  {
    codigo: 'remision.entregar',
    modulo: 'remision',
    descripcion: 'Registrar la entrega al OPA',
  },
  {
    codigo: 'remision.registrar_aprobacion',
    modulo: 'remision',
    descripcion: 'Registrar la aprobación o rechazo del OPA',
  },
  {
    codigo: 'remision.rectificar',
    modulo: 'remision',
    descripcion: 'Rectificar una remisión rechazada',
  },
  {
    codigo: 'remision.validar',
    modulo: 'remision',
    descripcion: 'Validar y conciliar remisiones',
  },
  {
    codigo: 'remision.exportar',
    modulo: 'remision',
    descripcion: 'Exportar remisiones a Excel o PDF',
  },

  // Catálogos
  {
    codigo: 'catalogo.consultar',
    modulo: 'catalogo',
    descripcion: 'Consultar catálogos',
  },
  {
    codigo: 'catalogo.editar',
    modulo: 'catalogo',
    descripcion: 'Crear y editar catálogos',
  },
  {
    codigo: 'catalogo.editar_estandares',
    modulo: 'catalogo',
    descripcion: 'Editar estándares de producción por SKU',
  },

  // Administración
  {
    codigo: 'admin.usuarios',
    modulo: 'admin',
    descripcion: 'Administrar usuarios y roles',
  },
  {
    codigo: 'admin.auditoria',
    modulo: 'admin',
    descripcion: 'Consultar el registro de auditoría',
  },
] as const;

// ============================================================
// ROLES
// ============================================================

const ROLES = [
  {
    codigo: 'ADMINISTRADOR',
    nombre: 'Administrador',
    descripcion: 'Acceso total. Único rol que edita estándares de producción.',
    permisos: PERMISOS.map((p) => p.codigo),
  },
  {
    codigo: 'COORDINADOR_MQ',
    nombre: 'Coordinador de Maquila',
    descripcion:
      'Coordinador en turno. Crea remisiones, registra el resultado del OPA, rectifica y concilia.',
    permisos: [
      'remision.crear',
      'remision.consultar',
      'remision.editar',
      'remision.registrar_aprobacion',
      'remision.rectificar',
      'remision.validar',
      'remision.exportar',
      'catalogo.consultar',
    ],
  },
  {
    codigo: 'PATINADOR',
    nombre: 'Patinador / Auxiliar logístico',
    descripcion:
      'Entrega la remisión al OPA, firma como verificador e ingresa el PT al WMS de bodega.',
    permisos: [
      'remision.consultar',
      'remision.entregar',
      'remision.registrar_aprobacion',
      'catalogo.consultar',
    ],
  },
  {
    codigo: 'CONSULTA',
    nombre: 'Consulta',
    descripcion: 'Solo lectura. No modifica información.',
    permisos: ['remision.consultar', 'remision.exportar', 'catalogo.consultar'],
  },
] as const;

// ============================================================
// TURNOS Y HORARIOS
// ============================================================

/**
 *        LUNES        MAR-VIE      SÁBADO
 *   T1   08:00-14:00  06:00-14:00  06:00-10:00
 *   T2   14:00-20:00  14:00-22:00  10:00-14:00
 *   T3   20:00-06:00  22:00-06:00  N/A
 *
 * PENDIENTE DE DEFINIR: si se produce los domingos, y si hay actividad
 * los lunes entre las 06:00 y las 08:00.
 */
const DIAS_HABILES_MEDIO = [
  DiaSemana.MARTES,
  DiaSemana.MIERCOLES,
  DiaSemana.JUEVES,
  DiaSemana.VIERNES,
];

const VIGENTE_DESDE = new Date('2026-01-01T00:00:00.000Z');

type HorarioSeed = {
  diaSemana: DiaSemana;
  horaInicio: string;
  horaFin: string;
};

const TURNOS: Array<{
  codigo: string;
  nombre: string;
  horarios: HorarioSeed[];
}> = [
  {
    codigo: 'T1',
    nombre: 'Turno 1',
    horarios: [
      { diaSemana: DiaSemana.LUNES, horaInicio: '08:00', horaFin: '14:00' },
      ...DIAS_HABILES_MEDIO.map((d) => ({
        diaSemana: d,
        horaInicio: '06:00',
        horaFin: '14:00',
      })),
      { diaSemana: DiaSemana.SABADO, horaInicio: '06:00', horaFin: '10:00' },
    ],
  },
  {
    codigo: 'T2',
    nombre: 'Turno 2',
    horarios: [
      { diaSemana: DiaSemana.LUNES, horaInicio: '14:00', horaFin: '20:00' },
      ...DIAS_HABILES_MEDIO.map((d) => ({
        diaSemana: d,
        horaInicio: '14:00',
        horaFin: '22:00',
      })),
      { diaSemana: DiaSemana.SABADO, horaInicio: '10:00', horaFin: '14:00' },
    ],
  },
  {
    codigo: 'T3',
    nombre: 'Turno 3',
    horarios: [
      { diaSemana: DiaSemana.LUNES, horaInicio: '20:00', horaFin: '06:00' },
      ...DIAS_HABILES_MEDIO.map((d) => ({
        diaSemana: d,
        horaInicio: '22:00',
        horaFin: '06:00',
      })),
      // Sábado: no hay T3
    ],
  },
];

/** Un turno cruza la medianoche cuando su hora de fin es menor que la de inicio. */
function cruzaMedianoche(horaInicio: string, horaFin: string): boolean {
  return horaFin < horaInicio;
}

// ============================================================
// LUGAR Y PROVEEDORES
// ============================================================

const LUGARES = [
  { codigo: 'MQ_PEPSICO_SD', nombre: 'MAQUILA PEPSICO SANTO DOMINGO' },
];

/** Empresas que operan los turnos. Tomadas del histórico 2026. */
const PROVEEDORES = [
  { codigo: 'LOGICMARD', nombre: 'LOGICMARD' },
  { codigo: 'MAXISERVICE', nombre: 'MAXISERVICE' },
  { codigo: 'APOYOS_MAXI', nombre: 'APOYOS MAXI' },
  { codigo: 'MIX', nombre: 'MIX' },
];

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

async function sembrarProveedores(): Promise<void> {
  for (const proveedor of PROVEEDORES) {
    await prisma.proveedor.upsert({
      where: { codigo: proveedor.codigo },
      update: { nombre: proveedor.nombre },
      create: proveedor,
    });
  }
  console.log(`  Proveedores: ${PROVEEDORES.length}`);
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
  await sembrarProveedores();
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
