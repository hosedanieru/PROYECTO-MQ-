/**
 * CANTIDADES DEL INVENTARIO
 * =========================
 *
 * Usuario, 2026-09-29 (revierte "todo en enteros" del mismo día): los
 * insumos se llevan en su medida exacta (metros de cinta, por ejemplo) y
 * el PT los descuenta con decimales, porque un rollo no se gasta "por
 * caja" y el consumo varía según el producto.
 *
 * Tres decimales como máximo (milímetros si la medida es metros, gramos si
 * es kilos). Las sumas se redondean a esos 3 decimales: en JavaScript
 * 0,1 + 0,2 da 0,30000000000000004 y ese ruido no debe llegar al kardex.
 *
 * El PT sigue en cajas enteras: se programa, se remisiona y se entrega en
 * cajas (área, 2026-09-17).
 */

export const DECIMALES_CANTIDAD = 3;
const FACTOR = 10 ** DECIMALES_CANTIDAD;

/** Redondea a 3 decimales (quita el ruido de las sumas con decimales). */
export function redondear(n: number): number {
  return Math.round(n * FACTOR) / FACTOR;
}

/** Número finito con 3 decimales como máximo. */
export function tieneDecimalesValidos(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && Math.abs(n * FACTOR - Math.round(n * FACTOR)) < 1e-6;
}

export function esCantidadPositiva(n: unknown): n is number {
  return tieneDecimalesValidos(n) && n > 0;
}
