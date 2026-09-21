/**
 * ASISTENCIA DEL TURNO — personal que llegó por grupo
 * ===================================================
 *
 * Decisión del área (2026-09-21): cada grupo tiene un número fijo de
 * personas que debería enviar (`Grupo.personasEsperadas`). El
 * coordinador registra cuántas llegaron realmente a cada turno y el
 * sistema dice si la productividad del turno queda "a fin" o afectada.
 *
 * Reglas:
 *   - la comparación es SOLO contra las personas esperadas del grupo
 *     (la "línea ideal" del DPP se muestra como referencia, no decide);
 *   - en un turno pueden trabajar varios grupos: se registra cada uno;
 *   - identidad: (fecha operativa, turno, grupo). Registrar de nuevo
 *     corrige el valor (se audita con el anterior).
 */

import { DatosMfrInvalidosError } from './mfr.errors.js';
import type { BloqueCalculado } from './calculo-mfr.js';

export interface DatosAsistencia {
  fechaOperativa: Date;
  turnoId: string;
  grupoId: string;
  personasLlegaron: number;
  observacion: string | null;
}

export interface AsistenciaTurno extends DatosAsistencia {
  id: string;
  registradaPorId: string;
  fechaRegistro: Date;
}

export function validarAsistencia(datos: DatosAsistencia): DatosAsistencia {
  const exigir = (condicion: boolean, mensaje: string): void => {
    if (!condicion) throw new DatosMfrInvalidosError(mensaje);
  };
  exigir(datos.fechaOperativa instanceof Date && !Number.isNaN(datos.fechaOperativa.getTime()), 'La fecha operativa no es válida.');
  exigir((datos.turnoId ?? '').length > 0, 'El turno es obligatorio.');
  exigir((datos.grupoId ?? '').length > 0, 'El grupo es obligatorio.');
  exigir(
    Number.isInteger(datos.personasLlegaron) && datos.personasLlegaron >= 0,
    'Las personas que llegaron deben ser un entero mayor o igual a cero.',
  );
  const observacion = datos.observacion?.trim() || null;
  exigir(observacion === null || observacion.length <= 300, 'La observación no puede superar 300 caracteres.');
  return { ...datos, observacion };
}

export interface AsistenciaRepository {
  listarPorFecha(fechaOperativa: Date): Promise<AsistenciaTurno[]>;
  buscarPorIdentidad(fechaOperativa: Date, turnoId: string, grupoId: string): Promise<AsistenciaTurno | null>;
  /** Crea o reemplaza la asistencia de (fecha, turno, grupo). */
  guardar(datos: DatosAsistencia, registradaPorId: string, momento: Date): Promise<AsistenciaTurno>;
}

export const ASISTENCIA_REPOSITORY = Symbol('AsistenciaRepository');

// ------------------------------------------------------------
// Evaluación: ¿alcanza el personal para la productividad?
// ------------------------------------------------------------

export type EstadoPersonal = 'A_FIN' | 'AFECTADA' | 'SIN_DATO';

export interface PersonalGrupo {
  grupoId: string;
  esperadas: number | null;
  llegaron: number;
  faltante: number;
  /** Σ personas del grupo asignadas a líneas en el turno (`asignacion-linea.ts`); null si no se pasó. */
  asignadas: number | null;
  observacion: string | null;
  /** SIN_DATO cuando el grupo no tiene personas esperadas definidas. */
  estado: EstadoPersonal;
}

export interface PersonalTurno {
  grupos: PersonalGrupo[];
  esperadas: number;
  llegaron: number;
  faltante: number;
  /** Referencia del DPP: Σ por línea del máximo de personas de sus bloques en el turno. */
  requeridasDpp: number;
  /** AFECTADA si algún grupo llegó por debajo; A_FIN si todos cumplen; SIN_DATO si nada registrado. */
  estado: EstadoPersonal;
}

export function evaluarPersonalTurno(
  turnoId: string,
  asistencias: AsistenciaTurno[],
  grupos: Array<{ id: string; personasEsperadas: number | null }>,
  bloques: BloqueCalculado[],
  asignadasPorGrupo: Map<string, number> | null = null,
): PersonalTurno {
  const esperadasDe = new Map(grupos.map((g) => [g.id, g.personasEsperadas]));

  const porGrupo: PersonalGrupo[] = asistencias
    .filter((a) => a.turnoId === turnoId)
    .map((a) => {
      const esperadas = esperadasDe.get(a.grupoId) ?? null;
      const faltante = esperadas === null ? 0 : Math.max(0, esperadas - a.personasLlegaron);
      return {
        grupoId: a.grupoId,
        esperadas,
        llegaron: a.personasLlegaron,
        faltante,
        asignadas: asignadasPorGrupo ? (asignadasPorGrupo.get(a.grupoId) ?? 0) : null,
        observacion: a.observacion,
        estado: esperadas === null ? 'SIN_DATO' : faltante > 0 ? 'AFECTADA' : 'A_FIN',
      };
    });

  const maxPorLinea = new Map<string, number>();
  for (const b of bloques.filter((x) => x.turnoId === turnoId)) {
    maxPorLinea.set(b.lineaId, Math.max(maxPorLinea.get(b.lineaId) ?? 0, b.personasAsignadas ?? 0));
  }

  const estado: EstadoPersonal = porGrupo.some((g) => g.estado === 'AFECTADA')
    ? 'AFECTADA'
    : porGrupo.some((g) => g.estado === 'A_FIN')
      ? 'A_FIN'
      : 'SIN_DATO';

  return {
    grupos: porGrupo,
    esperadas: porGrupo.reduce((s, g) => s + (g.esperadas ?? 0), 0),
    llegaron: porGrupo.reduce((s, g) => s + g.llegaron, 0),
    faltante: porGrupo.reduce((s, g) => s + g.faltante, 0),
    requeridasDpp: [...maxPorLinea.values()].reduce((s, v) => s + v, 0),
    estado,
  };
}
