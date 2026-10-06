/**
 * PERSONAS ESPERADAS DE UN GRUPO EN UN TURNO
 * ==========================================
 *
 * Decisión del usuario (2026-10-03): las esperadas son FIJAS POR GRUPO Y
 * TURNO (se configuran en el grupo) y un día puntual se pueden AJUSTAR con
 * motivo (un festivo, un pedido especial). Esta es la única regla que dice
 * cuántas se esperan en (día, turno, grupo):
 *
 *   1. el ajuste de ese día, si existe (puede ser 0: "ese día no viene");
 *   2. si no, lo fijo del grupo para ese turno;
 *   3. si no, sin dato (no se compara).
 *
 * Llegar MÁS de las esperadas se permite, pero con observación obligatoria
 * (`exigirMotivoSiLleganDeMas`).
 */

import type { Grupo } from '../grupo/grupo.repository.js';
import { DatosMfrInvalidosError } from './mfr.errors.js';

export interface DatosAjusteEsperadas {
  fechaOperativa: Date;
  turnoId: string;
  grupoId: string;
  /** 0 = ese día el grupo no se espera en el turno. */
  personas: number;
  motivo: string;
}

export interface AjusteEsperadas extends DatosAjusteEsperadas {
  id: string;
  usuarioId: string;
  fechaRegistro: Date;
}

export const MAXIMO_PERSONAS_AJUSTE = 500;

export function validarAjusteEsperadas(datos: DatosAjusteEsperadas): DatosAjusteEsperadas {
  const exigir = (condicion: boolean, mensaje: string): void => {
    if (!condicion) throw new DatosMfrInvalidosError(mensaje);
  };
  exigir(datos.fechaOperativa instanceof Date && !Number.isNaN(datos.fechaOperativa.getTime()), 'La fecha operativa no es válida.');
  exigir((datos.turnoId ?? '').length > 0, 'El turno es obligatorio.');
  exigir((datos.grupoId ?? '').length > 0, 'El grupo es obligatorio.');
  exigir(
    Number.isInteger(datos.personas) && datos.personas >= 0 && datos.personas <= MAXIMO_PERSONAS_AJUSTE,
    `Las personas esperadas del día deben ser un entero entre 0 y ${MAXIMO_PERSONAS_AJUSTE}.`,
  );
  const motivo = datos.motivo?.trim() ?? '';
  exigir(motivo.length >= 5 && motivo.length <= 300, 'El motivo del ajuste es obligatorio (5 a 300 caracteres).');
  return { ...datos, motivo };
}

export interface AjusteEsperadasRepository {
  listarPorFecha(fechaOperativa: Date): Promise<AjusteEsperadas[]>;
  /** Crea o reemplaza el ajuste de (fecha, turno, grupo). */
  guardar(datos: DatosAjusteEsperadas, usuarioId: string, momento: Date): Promise<AjusteEsperadas>;
}

export const AJUSTE_ESPERADAS_REPOSITORY = Symbol('AjusteEsperadasRepository');

export type OrigenEsperadas = 'AJUSTE' | 'FIJA' | 'SIN_DATO';

export interface EsperadasResueltas {
  personas: number | null;
  origen: OrigenEsperadas;
  /** Motivo del ajuste del día, si lo hay. */
  motivo: string | null;
}

export function esperadasDe(
  grupo: Pick<Grupo, 'id' | 'esperadasPorTurno'> | undefined,
  turnoId: string,
  ajustes: ReadonlyArray<Pick<AjusteEsperadas, 'turnoId' | 'grupoId' | 'personas' | 'motivo'>>,
): EsperadasResueltas {
  if (!grupo) return { personas: null, origen: 'SIN_DATO', motivo: null };
  const ajuste = ajustes.find((a) => a.turnoId === turnoId && a.grupoId === grupo.id);
  if (ajuste) return { personas: ajuste.personas, origen: 'AJUSTE', motivo: ajuste.motivo };
  const fija = grupo.esperadasPorTurno[turnoId];
  return fija === undefined ? { personas: null, origen: 'SIN_DATO', motivo: null } : { personas: fija, origen: 'FIJA', motivo: null };
}

export class AsistenciaDeMasSinMotivoError extends DatosMfrInvalidosError {
  constructor(esperadas: number, llegaron: number) {
    super(`Llegaron ${llegaron} personas y se esperaban ${esperadas}. Escriba en la observación por qué llegaron de más.`);
  }
}

/** Llegar de más se permite solo explicándolo (usuario, 2026-10-03). */
export function exigirMotivoSiLleganDeMas(esperadas: number | null, llegaron: number, observacion: string | null): void {
  if (esperadas !== null && llegaron > esperadas && !observacion?.trim()) {
    throw new AsistenciaDeMasSinMotivoError(esperadas, llegaron);
  }
}
