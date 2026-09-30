/**
 * CONSUMO DE PI E INSUMOS AL APROBAR UNA REMISIÓN
 * ===============================================
 *
 * Decisiones del usuario (2026-09-29):
 *   - El PT descuenta sus PI e insumos cuando el OPA APRUEBA la remisión
 *     (el mismo momento en que cuenta el MFR): cajas × receta vigente.
 *   - Las remisiones extraoficiales también descuentan: no entran al MFR
 *     ni al tope, pero el producto sí se armó.
 *   - Si el PT no tiene receta → se BLOQUEA la aprobación.
 *   - Si algún componente no alcanza → se BLOQUEA la aprobación (se
 *     mantiene "sin existencia negativa"); se dice qué falta y cuánto.
 *
 * Un componente que se desactivó después de guardar la receta se descuenta
 * igual: el producto se armó con él.
 */

import { redondear } from './cantidad.js';
import { ErrorInventario, ItemInventarioNoEncontradoError } from './inventario.errors.js';
import type { ItemInventario } from './item-inventario.js';
import { consumoDe, type RecetaPt } from './receta.js';

/** El PT no tiene receta: no se sabe qué descontar. */
export class PtSinRecetaError extends ErrorInventario {
  readonly codigo = 'INVENTARIO_PT_SIN_RECETA';

  constructor(codigoPt: string) {
    super(`El PT ${codigoPt} no tiene receta: no se puede aprobar sin saber qué PI e insumos descontar. Digítela en Inventario → PT → Receta.`);
  }
}

export interface Faltante {
  codigo: string;
  unidad: string;
  hay: number;
  seNecesita: number;
}

/** No alcanza la existencia de uno o más componentes. */
export class ConsumoInsuficienteError extends ErrorInventario {
  readonly codigo = 'INVENTARIO_CONSUMO_INSUFICIENTE';

  constructor(readonly faltantes: Faltante[]) {
    super(
      `No alcanza el inventario para aprobar: ${faltantes
        .map((f) => `${f.codigo} (hay ${f.hay} ${f.unidad}, se necesitan ${f.seNecesita})`)
        .join('; ')}. Registre la entrada o el ajuste que falta y vuelva a aprobar.`,
    );
  }
}

export interface LineaConsumo {
  item: ItemInventario;
  /** Lo que se descuenta (positivo). */
  cantidad: number;
  /** Existencia que queda. */
  saldo: number;
}

/**
 * Qué descontar por `cajas` cajas del PT. Lanza si no hay receta, si un
 * componente no existe o si alguno no alcanza (reporta TODOS los que faltan,
 * no solo el primero).
 */
export function calcularConsumo(
  receta: RecetaPt | null,
  cajas: number,
  items: Map<string, ItemInventario | null>,
  codigoPt: string,
): LineaConsumo[] {
  if (!receta) throw new PtSinRecetaError(codigoPt);

  const lineas = receta.componentes.map((c): LineaConsumo => {
    const item = items.get(c.itemId);
    if (!item) throw new ItemInventarioNoEncontradoError(`Un componente de la receta de ${codigoPt} ya no existe en el inventario.`);
    const cantidad = consumoDe(c, cajas);
    return { item, cantidad, saldo: redondear(item.existencia - cantidad) };
  });

  const faltantes = lineas
    .filter((l) => l.saldo < 0)
    .map((l) => ({ codigo: l.item.codigo, unidad: l.item.unidadMedida, hay: l.item.existencia, seNecesita: l.cantidad }));
  if (faltantes.length > 0) throw new ConsumoInsuficienteError(faltantes);

  return lineas;
}
