/**
 * ASIGNACIÓN DE GRUPOS A LÍNEAS — quién trabaja dónde
 * ===================================================
 *
 * Decisión del área (2026-09-21): por día operativo y turno, el
 * coordinador indica qué grupos trabajan en cada línea y con cuántas
 * personas. Un grupo puede repartirse entre varias líneas y una línea
 * puede tener varios grupos.
 *
 * Con las personas por línea se compara contra la "línea ideal" del DPP
 * (`personasAsignadas` de los bloques de esa línea en el turno): si la
 * línea tiene menos personas de las que el SKU necesita, queda
 * INCOMPLETA. Es una comparación distinta a la de la asistencia
 * (`asistencia-turno.ts`), que mira si el grupo envió a las personas
 * que debía.
 *
 * Identidad: (fecha operativa, turno, línea, grupo). Guardar de nuevo
 * corrige el número de personas.
 */

import { DatosMfrInvalidosError } from './mfr.errors.js';
import type { BloqueCalculado } from './calculo-mfr.js';

export interface DatosAsignacion {
  fechaOperativa: Date;
  turnoId: string;
  lineaId: string;
  grupoId: string;
  personas: number;
}

export interface AsignacionLinea extends DatosAsignacion {
  id: string;
  registradaPorId: string;
  fechaRegistro: Date;
}

export function validarAsignacion(datos: DatosAsignacion): DatosAsignacion {
  const exigir = (condicion: boolean, mensaje: string): void => {
    if (!condicion) throw new DatosMfrInvalidosError(mensaje);
  };
  exigir(datos.fechaOperativa instanceof Date && !Number.isNaN(datos.fechaOperativa.getTime()), 'La fecha operativa no es válida.');
  exigir((datos.turnoId ?? '').length > 0, 'El turno es obligatorio.');
  exigir((datos.lineaId ?? '').length > 0, 'La línea es obligatoria.');
  exigir((datos.grupoId ?? '').length > 0, 'El grupo es obligatorio.');
  exigir(Number.isInteger(datos.personas) && datos.personas > 0, 'Las personas asignadas deben ser un entero mayor que cero.');
  return datos;
}

export interface AsignacionRepository {
  listarPorFecha(fechaOperativa: Date): Promise<AsignacionLinea[]>;
  buscarPorId(id: string): Promise<AsignacionLinea | null>;
  buscarPorIdentidad(fechaOperativa: Date, turnoId: string, lineaId: string, grupoId: string): Promise<AsignacionLinea | null>;
  /** Crea o reemplaza la asignación de (fecha, turno, línea, grupo). */
  guardar(datos: DatosAsignacion, registradaPorId: string, momento: Date): Promise<AsignacionLinea>;
  eliminar(id: string): Promise<void>;
}

export const ASIGNACION_REPOSITORY = Symbol('AsignacionRepository');

// ------------------------------------------------------------
// Evaluación: ¿la línea tiene las personas que el DPP pide?
// ------------------------------------------------------------

export type EstadoLinea = 'CUBIERTA' | 'INCOMPLETA' | 'SIN_DATO';

export interface PersonalLinea {
  lineaId: string;
  grupos: Array<{ asignacionId: string; grupoId: string; personas: number }>;
  /** Σ personas asignadas a la línea en el turno. */
  personas: number;
  /** Línea ideal del DPP: máximo `personasAsignadas` de los bloques de la línea en el turno (0 si no hay dato). */
  requeridasDpp: number;
  faltante: number;
  /** SIN_DATO si nada asignado o si el DPP no trae línea ideal; INCOMPLETA si faltan; CUBIERTA si alcanza. */
  estado: EstadoLinea;
}

/**
 * Evalúa las líneas de un turno. Entran las líneas que tienen bloques en
 * el turno o que tienen alguna asignación, ordenadas según `ordenDe`.
 */
export function evaluarLineasTurno(
  turnoId: string,
  asignaciones: AsignacionLinea[],
  bloques: BloqueCalculado[],
  ordenDe: (lineaId: string) => number,
): PersonalLinea[] {
  const requeridas = new Map<string, number>();
  for (const b of bloques.filter((x) => x.turnoId === turnoId)) {
    requeridas.set(b.lineaId, Math.max(requeridas.get(b.lineaId) ?? 0, b.personasAsignadas ?? 0));
  }
  const delTurno = asignaciones.filter((a) => a.turnoId === turnoId);
  const lineas = new Set([...requeridas.keys(), ...delTurno.map((a) => a.lineaId)]);

  return [...lineas]
    .sort((a, b) => ordenDe(a) - ordenDe(b) || a.localeCompare(b))
    .map((lineaId) => {
      const grupos = delTurno
        .filter((a) => a.lineaId === lineaId)
        .map((a) => ({ asignacionId: a.id, grupoId: a.grupoId, personas: a.personas }));
      const personas = grupos.reduce((s, g) => s + g.personas, 0);
      const requeridasDpp = requeridas.get(lineaId) ?? 0;
      const faltante = Math.max(0, requeridasDpp - personas);
      const estado: EstadoLinea =
        grupos.length === 0 || requeridasDpp === 0 ? 'SIN_DATO' : faltante > 0 ? 'INCOMPLETA' : 'CUBIERTA';
      return { lineaId, grupos, personas, requeridasDpp, faltante, estado };
    });
}

/** Σ personas que cada grupo tiene asignadas en líneas del turno (para contrastar con las que llegaron). */
export function asignadasPorGrupo(turnoId: string, asignaciones: AsignacionLinea[]): Map<string, number> {
  const suma = new Map<string, number>();
  for (const a of asignaciones.filter((x) => x.turnoId === turnoId)) {
    suma.set(a.grupoId, (suma.get(a.grupoId) ?? 0) + a.personas);
  }
  return suma;
}
