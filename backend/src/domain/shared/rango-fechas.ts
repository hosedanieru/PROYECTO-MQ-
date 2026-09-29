/**
 * RANGO DE FECHAS OPERATIVAS
 * ==========================
 *
 * Validación común de los listados por periodo (averías, inventario).
 * El tope es técnico: en Firestore los listados leen el rango completo y
 * filtran en memoria (mismo criterio que remisiones).
 */

import { ErrorDominio } from './errores.js';

export const MAXIMO_DIAS_RANGO = 93;

const DIA_MS = 86_400_000;

export class RangoFechasInvalidoError extends ErrorDominio {
  readonly codigo = 'RANGO_FECHAS_INVALIDO';
}

export function validarRango(desde: Date, hasta: Date): void {
  const dias = (hasta.getTime() - desde.getTime()) / DIA_MS;
  if (dias < 0) throw new RangoFechasInvalidoError('La fecha "desde" no puede ser posterior a "hasta".');
  if (dias > MAXIMO_DIAS_RANGO) {
    throw new RangoFechasInvalidoError(`El rango máximo es de ${MAXIMO_DIAS_RANGO} días.`);
  }
}

/** Cada fecha operativa del rango, inclusive. */
export function diasDelRango(desde: Date, hasta: Date): Date[] {
  const dias: Date[] = [];
  for (let t = desde.getTime(); t <= hasta.getTime(); t += DIA_MS) dias.push(new Date(t));
  return dias;
}
