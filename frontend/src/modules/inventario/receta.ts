/**
 * Reglas de forma de cantidades y recetas en la pantalla (espejo de
 * `domain/inventario/cantidad.ts` y `receta.ts`; la validación real es
 * del backend).
 */

import { cantidad as fmt } from '../../shared/utils/numeros'
import { DECIMALES_CANTIDAD, MAXIMO_COMPONENTES_RECETA, type ComponenteReceta } from '../../shared/types/inventario'

const FACTOR = 10 ** DECIMALES_CANTIDAD

/** Redondea a 3 decimales: quita el ruido de las sumas (0,1 + 0,2). */
export function redondear(n: number): number {
  return Math.round(n * FACTOR) / FACTOR
}

/** Texto de un campo → número; acepta coma decimal ("1,8"). Vacío → NaN. */
export function leerCantidad(texto: string): number {
  return texto.trim() === '' ? NaN : Number(texto.replace(',', '.'))
}

/** Mayor que cero y con 3 decimales como máximo; `soloEnteros` para el PT (cajas). */
export function cantidadValida(n: number, soloEnteros = false): boolean {
  if (!Number.isFinite(n) || n <= 0) return false
  return soloEnteros ? Number.isInteger(n) : Math.abs(n * FACTOR - Math.round(n * FACTOR)) < 1e-6
}

/** Al menos un componente, cantidades válidas y sin repetidos. */
export function recetaValida(componentes: ComponenteReceta[]): boolean {
  const ids = new Set(componentes.map((c) => c.itemId))
  return (
    componentes.length > 0 &&
    componentes.length <= MAXIMO_COMPONENTES_RECETA &&
    ids.size === componentes.length &&
    componentes.every((c) => cantidadValida(c.cantidad))
  )
}

/** "12 UNIDAD por caja", "1,8 METRO por caja". */
export function textoEquivalenciaReceta(cantidad: number, unidad: string): string {
  return `${fmt(cantidad)} ${unidad} por caja`
}
