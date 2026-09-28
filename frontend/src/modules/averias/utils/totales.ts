/**
 * Total del formulario ANTES de enviar, para que quien reporta lo vea.
 * Es una vista previa: el total que vale es el que calcula el servidor
 * (`totalizarUnidades` en el dominio), con las mismas equivalencias.
 */

import type { UnidadMedidaAveria } from '../../../shared/types/averia'

/** Bolsa: PENDIENTE DE DEFINIR con el área; no se convierte. */
const UNIDADES_POR_MEDIDA: Record<UnidadMedidaAveria, number | null> = { UNIDAD: 1, DOCENA: 12, SIX: 6, BOLSA: null }

export function totalEnUnidades(registros: ReadonlyArray<{ cantidad: number; unidadMedida: UnidadMedidaAveria }>) {
  let unidades = 0
  let bolsas = 0
  for (const r of registros) {
    const factor = UNIDADES_POR_MEDIDA[r.unidadMedida]
    if (factor === null) bolsas += r.cantidad
    else unidades += r.cantidad * factor
  }
  return { unidades, bolsas }
}
