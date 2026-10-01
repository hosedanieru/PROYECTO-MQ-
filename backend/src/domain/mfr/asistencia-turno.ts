/**
 * ASISTENCIA DEL TURNO — personal que llegó por grupo
 * ===================================================
 *
 * Decisión del área (2026-09-21): cada grupo tiene un número fijo de
 * personas que debería enviar (`Grupo.personasEsperadas`). El
 * coordinador registra cuántas llegaron realmente a cada turno y el
 * sistema dice si la productividad del turno queda "a fin" o afectada.
 *
 * Cambio del usuario (2026-09-30): el personal debe ser PROPORCIONAL A LO
 * QUE PIDE EL DPP. Se usan DOS comparaciones y el turno queda AFECTADO si
 * falla cualquiera:
 *   - contra el DPP: llegaron (todos los grupos) vs requeridas del turno =
 *     Σ por línea del MÁXIMO de personas de sus bloques en el turno (si la
 *     línea cambia de producto, la gente llega para todo el turno y debe
 *     cubrir el pico). Cobertura % = llegaron ÷ requeridas: base del
 *     indicador de afectación.
 *   - contra cada grupo: llegaron vs sus personas esperadas (de más no
 *     compensa a otro grupo).
 *
 * Reglas de registro:
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
  /** Σ personas esperadas de los grupos registrados. */
  esperadas: number;
  llegaron: number;
  /** Faltante contra lo esperado de cada grupo (de más en un grupo no compensa a otro). */
  faltante: number;
  /** Lo que pide el DPP: Σ por línea del máximo de personas de sus bloques en el turno. */
  requeridasDpp: number;
  /** max(0, requeridasDpp − llegaron). */
  faltanteDpp: number;
  /** llegaron ÷ requeridasDpp × 100 (1 decimal); null sin DPP o sin asistencia. */
  coberturaDpp: number | null;
  /** Líneas del turno con algún bloque sin personas definidas: las requeridas quedan cortas. */
  lineasSinDato: number;
  /** Contra el DPP: AFECTADA si llegaron menos de las requeridas. */
  estadoDpp: EstadoPersonal;
  /** Contra los grupos: AFECTADA si algún grupo llegó por debajo de lo esperado. */
  estadoGrupos: EstadoPersonal;
  /** AFECTADA si falla cualquiera de las dos; A_FIN si alguna se pudo evaluar y ninguna falla; SIN_DATO si nada registrado. */
  estado: EstadoPersonal;
}

export interface PersonalDia {
  /** Σ de los turnos que ya registraron asistencia y tienen DPP. */
  requeridasDpp: number;
  llegaron: number;
  faltanteDpp: number;
  coberturaDpp: number | null;
  /** AFECTADA si algún turno quedó afectado (por el DPP o por un grupo). */
  estado: EstadoPersonal;
}

/**
 * Personal del día: suma los turnos YA evaluados contra el DPP. Un turno
 * que todavía no registra asistencia (el T3 a media mañana) no cuenta:
 * si no, la cobertura del día bajaría por gente que aún no debía llegar.
 */
export function resumirPersonalDia(turnos: PersonalTurno[]): PersonalDia {
  const evaluados = turnos.filter((t) => t.estadoDpp !== 'SIN_DATO');
  const requeridasDpp = evaluados.reduce((s, t) => s + t.requeridasDpp, 0);
  const llegaron = evaluados.reduce((s, t) => s + t.llegaron, 0);
  return {
    requeridasDpp,
    llegaron,
    faltanteDpp: evaluados.reduce((s, t) => s + t.faltanteDpp, 0),
    coberturaDpp: requeridasDpp === 0 ? null : Math.round((llegaron / requeridasDpp) * 1000) / 10,
    estado: combinar(...turnos.map((t) => t.estado)),
  };
}

/** Combina estados: cualquier AFECTADA manda; si no, basta un A_FIN. */
function combinar(...estados: EstadoPersonal[]): EstadoPersonal {
  if (estados.includes('AFECTADA')) return 'AFECTADA';
  return estados.includes('A_FIN') ? 'A_FIN' : 'SIN_DATO';
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

  // Lo que pide el DPP: por línea, el máximo de personas de sus bloques en el turno.
  const maxPorLinea = new Map<string, number>();
  const lineasSinDato = new Set<string>();
  for (const b of bloques.filter((x) => x.turnoId === turnoId)) {
    maxPorLinea.set(b.lineaId, Math.max(maxPorLinea.get(b.lineaId) ?? 0, b.personasAsignadas ?? 0));
    if (b.personasAsignadas === null) lineasSinDato.add(b.lineaId);
  }
  const requeridasDpp = [...maxPorLinea.values()].reduce((s, v) => s + v, 0);
  const llegaron = porGrupo.reduce((s, g) => s + g.llegaron, 0);
  const hayAsistencia = porGrupo.length > 0;

  // Sin asistencia registrada no se evalúa (todavía no se sabe quién llegó).
  const estadoDpp: EstadoPersonal = !hayAsistencia || requeridasDpp === 0 ? 'SIN_DATO' : llegaron < requeridasDpp ? 'AFECTADA' : 'A_FIN';
  const estadoGrupos = combinar(...porGrupo.map((g) => g.estado));

  return {
    grupos: porGrupo,
    esperadas: porGrupo.reduce((s, g) => s + (g.esperadas ?? 0), 0),
    llegaron,
    faltante: porGrupo.reduce((s, g) => s + g.faltante, 0),
    requeridasDpp,
    faltanteDpp: Math.max(0, requeridasDpp - llegaron),
    coberturaDpp: estadoDpp === 'SIN_DATO' ? null : Math.round((llegaron / requeridasDpp) * 1000) / 10,
    lineasSinDato: lineasSinDato.size,
    estadoDpp,
    estadoGrupos,
    estado: combinar(estadoDpp, estadoGrupos),
  };
}
