import type { Material } from '../../shared/types/inventario'
import { cantidad, miles } from '../../shared/utils/numeros'

type ConEquivalencias = Pick<Material, 'unidadesPorCaja' | 'cajasPorEstiba' | 'unidadBase' | 'presentacion' | 'contenidoPresentacion'>

/**
 * Equivalencias de un PI o insumo, escalonadas estiba → caja → presentación
 * → medida (usuario, 2026-09-29):
 *   "1 estiba = 40 cajas · 1 caja = 36 ROLLO · 1 ROLLO = 50 METRO"
 */
export function textoEquivalencia(m: ConEquivalencias): string {
  const dentroDeCaja = m.presentacion ?? m.unidadBase
  const partes = [
    m.cajasPorEstiba ? `1 estiba = ${miles(m.cajasPorEstiba)} cajas` : null,
    m.unidadesPorCaja ? `1 caja = ${miles(m.unidadesPorCaja)} ${dentroDeCaja}` : null,
    m.presentacion && m.contenidoPresentacion ? `1 ${m.presentacion} = ${cantidad(m.contenidoPresentacion)} ${m.unidadBase}` : null,
  ].filter(Boolean)
  return partes.length > 0 ? partes.join(' · ') : `Solo por ${m.unidadBase}`
}
