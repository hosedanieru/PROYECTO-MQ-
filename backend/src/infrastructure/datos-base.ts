/**
 * DATOS BASE DEL APLICATIVO MQ
 * ============================
 *
 * Catálogos que no dependen del levantamiento pendiente: permisos,
 * roles, turnos con horarios, lugar y grupos. Es la ÚNICA fuente
 * de verdad; la leen el seed de PostgreSQL (`prisma/seed.ts`) y el de
 * Firestore (`seed-firestore.ts`).
 *
 * No importa nada de Prisma ni de Firebase: solo datos.
 */

export type DiaSemanaBase = 'LUNES' | 'MARTES' | 'MIERCOLES' | 'JUEVES' | 'VIERNES' | 'SABADO' | 'DOMINGO';

// ============================================================
// PERMISOS
// ============================================================

export const PERMISOS = [
  // Remisiones
  { codigo: 'remision.crear', modulo: 'remision', descripcion: 'Crear remisiones (coordinador MQ)' },
  { codigo: 'remision.consultar', modulo: 'remision', descripcion: 'Consultar remisiones' },
  { codigo: 'remision.editar', modulo: 'remision', descripcion: 'Editar remisiones en borrador o en rectificación' },
  { codigo: 'remision.entregar', modulo: 'remision', descripcion: 'Entregar la remisión al OPA (patinador)' },
  { codigo: 'remision.registrar_aprobacion', modulo: 'remision', descripcion: 'Registrar aprobación o rechazo del OPA' },
  { codigo: 'remision.rectificar', modulo: 'remision', descripcion: 'Rectificar una remisión rechazada' },
  { codigo: 'remision.validar', modulo: 'remision', descripcion: 'Validar / conciliar remisiones aprobadas' },
  { codigo: 'remision.exportar', modulo: 'remision', descripcion: 'Exportar remisiones a Excel o PDF' },

  // Catálogos
  { codigo: 'catalogo.consultar', modulo: 'catalogo', descripcion: 'Consultar catálogos' },
  { codigo: 'catalogo.editar', modulo: 'catalogo', descripcion: 'Crear y editar catálogos' },
  { codigo: 'catalogo.editar_estandares', modulo: 'catalogo', descripcion: 'Editar estándares de producción por SKU' },

  // Administración
  { codigo: 'admin.usuarios', modulo: 'admin', descripcion: 'Administrar usuarios y roles' },
  { codigo: 'admin.auditoria', modulo: 'admin', descripcion: 'Consultar el registro de auditoría' },

  // MFR — Manufacturing Fill Rate
  { codigo: 'mfr.consultar', modulo: 'mfr', descripcion: 'Ver la programación del día (DPP) e indicadores' },
  { codigo: 'mfr.cargar_programacion', modulo: 'mfr', descripcion: 'Cargar, importar, copiar y corregir los bloques del DPP' },
  { codigo: 'mfr.configurar_turno', modulo: 'mfr', descripcion: 'Cerrar el turno (congela sus bloques)' },
] as const;

export type CodigoPermiso = (typeof PERMISOS)[number]['codigo'];

// ============================================================
// ROLES
// ============================================================

export const ROLES: ReadonlyArray<{
  codigo: string;
  nombre: string;
  descripcion: string;
  permisos: readonly CodigoPermiso[];
}> = [
  {
    codigo: 'ADMINISTRADOR',
    nombre: 'Administrador',
    descripcion: 'Acceso total. Único rol que edita estándares de producción.',
    permisos: PERMISOS.map((p) => p.codigo),
  },
  {
    codigo: 'COORDINADOR_MQ',
    nombre: 'Coordinador de Maquila',
    descripcion: 'Coordinador en turno. Crea remisiones, registra el resultado del OPA, rectifica y concilia.',
    permisos: [
      'remision.crear', 'remision.consultar', 'remision.editar', 'remision.registrar_aprobacion',
      'remision.rectificar', 'remision.validar', 'remision.exportar', 'catalogo.consultar',
      // Grupos: el coordinador puede crearlos y editarlos (área, 2026-09-21).
      // Se le da `catalogo.editar` completo por decisión del usuario.
      'catalogo.editar',
      // MFR: el coordinador carga la programación y arma su turno.
      'mfr.consultar', 'mfr.cargar_programacion', 'mfr.configurar_turno',
    ],
  },
  {
    codigo: 'PATINADOR',
    nombre: 'Patinador / Auxiliar logístico',
    descripcion: 'Entrega la remisión al OPA, firma como verificador e ingresa el PT al WMS de bodega.',
    // Decisión del área (2026-09-16): la respuesta del OPA la registra solo el coordinador.
    permisos: ['remision.consultar', 'remision.entregar', 'catalogo.consultar'],
  },
  {
    codigo: 'CONSULTA',
    nombre: 'Consulta',
    descripcion: 'Solo lectura. No modifica información.',
    permisos: ['remision.consultar', 'remision.exportar', 'catalogo.consultar', 'mfr.consultar'],
  },
];

// ============================================================
// TURNOS Y HORARIOS
// ============================================================

/**
 * Decisión del 2026-09-18: los turnos siguen el DPP de PepsiCo
 * ("Shift 1-3: 06:00 AM – 06:00 AM"), todos los días de la semana:
 *
 *   T1   06:00-13:30
 *   T2   14:00-21:30
 *   T3   22:00-05:30
 *
 * (7,5 h productivas cada uno; la media hora entre turnos es pausa.)
 * Los horarios anteriores por día de la semana (lunes 08:00-14:00,
 * sábado sin T3, etc.) quedan en pausa: PENDIENTE DE DEFINIR si algún
 * día opera distinto.
 */
const TODOS_LOS_DIAS: DiaSemanaBase[] = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];

export const VIGENTE_DESDE = new Date('2026-01-01T00:00:00.000Z');

export interface HorarioBase {
  diaSemana: DiaSemanaBase;
  horaInicio: string;
  horaFin: string;
}

const todosLosDias = (horaInicio: string, horaFin: string): HorarioBase[] =>
  TODOS_LOS_DIAS.map((diaSemana) => ({ diaSemana, horaInicio, horaFin }));

export const TURNOS: ReadonlyArray<{ codigo: string; nombre: string; horarios: HorarioBase[] }> = [
  { codigo: 'T1', nombre: 'Turno 1', horarios: todosLosDias('06:00', '13:30') },
  { codigo: 'T2', nombre: 'Turno 2', horarios: todosLosDias('14:00', '21:30') },
  { codigo: 'T3', nombre: 'Turno 3', horarios: todosLosDias('22:00', '05:30') },
];

// ============================================================
// LÍNEAS DE PRODUCCIÓN (plataformas del DPP de PepsiCo)
// ============================================================

/**
 * Tomadas de los DPP de PepsiCo. `nombre` es exactamente como lo escribe
 * PepsiCo en la columna "Line" de Bar Details (así se cruza al importar
 * el PDF); la capacidad es la fila "Capacity" del schedule.
 *
 * L1–L4, MANUAL 1/2 y las dos de REEMPAQUE salieron del DPP diario del
 * 2026-09-16. **L5 se agregó el 2026-09-22** al aparecer en el DPP
 * semanal de la W4–W5 (páginas 49–58, "Platform: LINEA 5"): sin ella,
 * sus bloques se omitían en cada importación.
 *
 * `PENDIENTE DE CONFIRMAR con el área`: el schedule marca L5 como MANUAL
 * pero con capacidad **306 kg/h**, la de las MULTIPACK, no los 249 de
 * las otras manuales. Se respeta lo que dice el DPP porque es la misma
 * fuente de la que salieron las ocho anteriores, pero conviene
 * verificarlo en planta.
 */
export const LINEAS_PRODUCCION: ReadonlyArray<{
  codigo: string;
  nombre: string;
  tipo: 'MULTIPACK' | 'MANUAL';
  capacidadKgHora: number;
  orden: number;
}> = [
  { codigo: 'L1', nombre: 'L1', tipo: 'MULTIPACK', capacidadKgHora: 306, orden: 1 },
  { codigo: 'L2', nombre: 'L2', tipo: 'MULTIPACK', capacidadKgHora: 306, orden: 2 },
  { codigo: 'L3', nombre: 'L3', tipo: 'MULTIPACK', capacidadKgHora: 306, orden: 3 },
  { codigo: 'L4', nombre: 'L4', tipo: 'MULTIPACK', capacidadKgHora: 306, orden: 4 },
  { codigo: 'L5', nombre: 'L5', tipo: 'MANUAL', capacidadKgHora: 306, orden: 5 },
  { codigo: 'MANUAL-1', nombre: 'MANUAL 1', tipo: 'MANUAL', capacidadKgHora: 249, orden: 6 },
  { codigo: 'MANUAL-2', nombre: 'MANUAL 2', tipo: 'MANUAL', capacidadKgHora: 249, orden: 7 },
  { codigo: 'REEMPAQU-2', nombre: 'REEMPAQU 2', tipo: 'MANUAL', capacidadKgHora: 203, orden: 8 },
  { codigo: 'REEMPAQUES', nombre: 'REEMPAQUES', tipo: 'MANUAL', capacidadKgHora: 203, orden: 9 },
];

/** Un turno cruza la medianoche cuando su hora de fin es menor que la de inicio. */
export function cruzaMedianoche(horaInicio: string, horaFin: string): boolean {
  return horaFin < horaInicio;
}

// ============================================================
// LUGAR Y GRUPOS
// ============================================================

export const LUGARES = [{ codigo: 'MQ_PEPSICO_SD', nombre: 'MAQUILA PEPSICO SANTO DOMINGO' }] as const;

/**
 * Grupos (antes "proveedores", decisión del área 2026-09-21): quienes
 * ponen el personal del turno. Tomados del histórico 2026. La
 * descripción (proveedor real) y las personas esperadas las completa el
 * administrador desde el panel: PENDIENTE DE DEFINIR sus valores.
 */
export const GRUPOS: ReadonlyArray<{ codigo: string; nombre: string; descripcion: string | null; personasEsperadas: number | null }> = [
  { codigo: 'LOGICMARD', nombre: 'LOGICMARD', descripcion: null, personasEsperadas: null },
  { codigo: 'MAXISERVICE', nombre: 'MAXISERVICE', descripcion: null, personasEsperadas: null },
  { codigo: 'APOYOS_MAXI', nombre: 'APOYOS MAXI', descripcion: null, personasEsperadas: null },
  { codigo: 'MIX', nombre: 'MIX', descripcion: null, personasEsperadas: null },
];
