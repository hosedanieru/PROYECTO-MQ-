/**
 * Conteo mixto en la pantalla (espejo de `domain/inventario/conteo.ts`):
 * qué campos mostrar según las equivalencias del ítem y el total que va a
 * resultar, para verlo mientras se digita. La conversión que cuenta la
 * hace el backend.
 */

import type { Conteo, ItemInventario } from '../../shared/types/inventario'
import { cantidad as fmt } from '../../shared/utils/numeros'
import { cantidadValida, leerCantidad, redondear } from './receta'

export type Campos = Record<keyof Conteo, string>

export const CAMPOS_VACIOS: Campos = { estibas: '', cajas: '', presentaciones: '', medida: '' }

export interface Escalon {
  campo: keyof Conteo
  etiqueta: string
  /** Estibas, cajas y presentaciones se cuentan cerradas. */
  enteros: boolean
}

/** Campos a mostrar, en orden estiba → caja → presentación → medida suelta. */
export function escalonesDe(item: Pick<ItemInventario, 'unidadMedida' | 'equivalencias'>): Escalon[] {
  const eq = item.equivalencias
  const presentacion = eq?.presentacion && eq.contenidoPresentacion ? eq.presentacion : null
  const escalones: Escalon[] = []
  if (eq?.cajasPorEstiba && eq.unidadesPorCaja) escalones.push({ campo: 'estibas', etiqueta: 'Estibas', enteros: true })
  if (eq?.unidadesPorCaja) escalones.push({ campo: 'cajas', etiqueta: 'Cajas', enteros: true })
  if (presentacion) escalones.push({ campo: 'presentaciones', etiqueta: presentacion, enteros: true })
  escalones.push({ campo: 'medida', etiqueta: presentacion || eq?.unidadesPorCaja ? `${item.unidadMedida} sueltos` : item.unidadMedida, enteros: false })
  return escalones
}

/** "2 estibas + 5 cajas + 3 ROLLO + 12,5 METRO" (lo digitado, para mostrar). */
export function textoConteo(conteo: Conteo, item: Pick<ItemInventario, 'unidadMedida' | 'equivalencias'>): string {
  return [
    conteo.estibas > 0 ? `${fmt(conteo.estibas)} ${conteo.estibas === 1 ? 'estiba' : 'estibas'}` : null,
    conteo.cajas > 0 ? `${fmt(conteo.cajas)} ${conteo.cajas === 1 ? 'caja' : 'cajas'}` : null,
    conteo.presentaciones > 0 ? `${fmt(conteo.presentaciones)} ${item.equivalencias?.presentacion ?? ''}` : null,
    conteo.medida > 0 ? `${fmt(conteo.medida)} ${item.unidadMedida}` : null,
  ]
    .filter(Boolean)
    .join(' + ')
}

/** Texto de los campos → conteo (vacío = 0; inválido = NaN). */
export function leerConteo(campos: Campos): Conteo {
  const valor = (t: string) => (t.trim() === '' ? 0 : leerCantidad(t))
  return { estibas: valor(campos.estibas), cajas: valor(campos.cajas), presentaciones: valor(campos.presentaciones), medida: valor(campos.medida) }
}

/**
 * Total en la medida del ítem, o null si algún campo es inválido.
 * `permitirCero` para el conteo físico (ajuste).
 */
export function totalDeConteo(conteo: Conteo, item: Pick<ItemInventario, 'equivalencias'>, permitirCero = false): number | null {
  const eq = item.equivalencias
  const enteroOCero = (n: number) => Number.isInteger(n) && n >= 0
  if (!enteroOCero(conteo.estibas) || !enteroOCero(conteo.cajas) || !enteroOCero(conteo.presentaciones)) return null
  if (!(conteo.medida === 0 || cantidadValida(conteo.medida))) return null

  const porPresentacion = eq?.presentacion && eq.contenidoPresentacion ? eq.contenidoPresentacion : 0
  const porCaja = eq?.unidadesPorCaja ? eq.unidadesPorCaja * (porPresentacion || 1) : 0
  const porEstiba = eq?.cajasPorEstiba ? eq.cajasPorEstiba * porCaja : 0
  const total = redondear(conteo.estibas * porEstiba + conteo.cajas * porCaja + conteo.presentaciones * porPresentacion + conteo.medida)
  return total > 0 || permitirCero ? total : null
}
