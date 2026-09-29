/**
 * Formatos numéricos de la interfaz.
 *
 * El separador depende del idioma: en español "1.234" son mil
 * doscientos treinta y cuatro y en inglés eso se escribe "1,234". Por
 * eso nunca se formatea a mano en una pantalla: siempre por aquí, que
 * es lo único que sabe en qué idioma está la aplicación.
 */

import { localeDeFormato } from '../idioma/locale'

/** 1234 → "1.234" en español, "1,234" en inglés. */
export function miles(valor: number): string {
  return new Intl.NumberFormat(localeDeFormato(), { maximumFractionDigits: 0 }).format(valor)
}

/** Cantidades de inventario: hasta 3 decimales (kilos, metros). 1234.5 → "1.234,5". */
export function cantidad(valor: number): string {
  return new Intl.NumberFormat(localeDeFormato(), { maximumFractionDigits: 3 }).format(valor)
}

/**
 * 95.37 → "95,4 %" en español, "95.4 %" en inglés. `decimales` = 2 para
 * porcentajes chicos que se comparan contra un umbral (averías: 1 %).
 */
export function porcentaje(valor: number | null, sinDato = '—', decimales = 1): string {
  if (valor === null || Number.isNaN(valor)) return sinDato
  const numero = new Intl.NumberFormat(localeDeFormato(), { maximumFractionDigits: decimales }).format(valor)
  return `${numero} %`
}

/**
 * Parte sobre total en porcentaje, con el total en cero resuelto.
 *
 * Devuelve `null` y no 0 cuando no hay contra qué comparar: "no hay
 * programación" y "no se ha producido nada" son cosas distintas y no
 * pueden pintarse igual.
 */
export function proporcion(parte: number, total: number): number | null {
  if (!total) return null
  return (parte / total) * 100
}
