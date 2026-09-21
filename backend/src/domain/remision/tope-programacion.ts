/**
 * TOPE DE LO PROGRAMADO — "ni una caja más de lo que pidió PepsiCo"
 * =================================================================
 *
 * Decisión del área (2026-09-18): lo remisionado de un SKU en un día
 * debe ser exactamente lo que el DPP programó (Σ T de sus bloques).
 *
 *   - "Ni más" se IMPIDE aquí: al crear, editar o aprobar una remisión,
 *     lo ya aprobado del SKU más esta remisión no puede superar lo
 *     programado. Solo cuentan APROBADAS y VALIDADAS (decisión del área),
 *     por eso la regla se aplica también al aprobar.
 *   - "Ni menos" no se puede impedir; se controla al cerrar el turno
 *     (ver `faltantes-turno.ts`).
 *   - Excepción: la remisión EXTRAOFICIAL (pedido de emergencia, con
 *     motivo) no entra en esta cuenta ni en el MFR.
 *   - Sin DPP cargado el día: se bloquea (decisión del área), salvo
 *     extraoficial.
 */

import {
  ProductoNoProgramadoError,
  RemisionExcedeProgramacionError,
  SinProgramacionDelDiaError,
} from './remision.errors.js';

export interface SituacionProgramada {
  /** Fecha operativa en YYYY-MM-DD, para el mensaje. */
  fecha: string;
  /** false cuando el día no tiene ningún bloque cargado. */
  hayProgramacionDelDia: boolean;
  /** Σ T del SKU en el día; null si el SKU no está programado. */
  programadoCajas: number | null;
  /** Cajas ya APROBADAS o VALIDADAS del SKU en el día, sin extraoficiales. */
  aprobadasCajas: number;
}

export function verificarTopeProgramacion(
  situacion: SituacionProgramada,
  remision: { codigoProducto: string; cantidadCajas: number; extraoficial: boolean },
): void {
  if (remision.extraoficial) return;

  if (!situacion.hayProgramacionDelDia) {
    throw new SinProgramacionDelDiaError(situacion.fecha);
  }
  if (situacion.programadoCajas === null) {
    throw new ProductoNoProgramadoError(
      `El producto ${remision.codigoProducto} no está en la programación (DPP) del ${situacion.fecha}. ` +
        'Si es un pedido de emergencia, márquela como extraoficial.',
    );
  }
  if (situacion.aprobadasCajas + remision.cantidadCajas > situacion.programadoCajas) {
    throw new RemisionExcedeProgramacionError(
      remision.codigoProducto,
      situacion.programadoCajas,
      situacion.aprobadasCajas,
      remision.cantidadCajas,
    );
  }
}
