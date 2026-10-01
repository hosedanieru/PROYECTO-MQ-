/**
 * CONSUMO DE PI E INSUMOS DE UNA REMISIÓN APROBADA
 * ================================================
 *
 * Lo usa la aprobación de la remisión, en DOS pasos dentro de la misma
 * transacción (regla de Firestore: todas las lecturas antes que cualquier
 * escritura):
 *
 *   prepararConsumo   SOLO LEE: receta vigente del PT, bloquea cada
 *                     componente y calcula qué descontar. Si no hay
 *                     receta o no alcanza, lanza y la remisión no cambia.
 *   registrarConsumo  SOLO ESCRIBE: una SALIDA por componente en el
 *                     kardex, enlazada a la remisión, y las existencias.
 *
 * Las reglas (qué bloquea, cuánto se descuenta) están en el dominio:
 * `domain/inventario/consumo.ts`.
 */

import { calcularConsumo, type LineaConsumo } from '../../domain/inventario/consumo.js';
import type { ItemInventario } from '../../domain/inventario/item-inventario.js';
import type { RecetaPt } from '../../domain/inventario/receta.js';
import type { ContextoTransaccional } from '../../domain/shared/unidad-de-trabajo.js';
import type { MomentoOperativo } from '../shared/momento-operativo.js';

export interface RemisionAConsumir {
  id: string;
  productoId: string;
  codigoProducto: string;
  cantidadCajas: number;
  /** Para la referencia del kardex: "Remisión 2026-0012". */
  consecutivo: string;
}

export interface ConsumoPreparado {
  receta: RecetaPt;
  lineas: LineaConsumo[];
  usuarioNombre: string;
}

export async function prepararConsumo(ctx: ContextoTransaccional, remision: RemisionAConsumir, usuarioId: string): Promise<ConsumoPreparado> {
  const receta = await ctx.recetas.vigente(remision.productoId);
  // Los ítems se bloquean siempre en el mismo orden (por id), como en las
  // entradas: dos aprobaciones simultáneas no se esperan mutuamente.
  const items = new Map<string, ItemInventario | null>();
  for (const id of (receta?.componentes.map((c) => c.itemId) ?? []).sort()) {
    items.set(id, await ctx.itemsInventario.bloquearParaMovimiento(id));
  }
  const lineas = calcularConsumo(receta, remision.cantidadCajas, items, remision.codigoProducto);
  const usuario = await ctx.usuarios.buscarPorId(usuarioId);
  return { receta: receta!, lineas, usuarioNombre: usuario?.nombre ?? usuarioId };
}

export async function registrarConsumo(
  ctx: ContextoTransaccional,
  remision: RemisionAConsumir,
  consumo: ConsumoPreparado,
  momento: MomentoOperativo,
  usuarioId: string,
): Promise<void> {
  for (const { item, cantidad, saldo } of consumo.lineas) {
    await ctx.movimientosInventario.crear({
      itemId: item.id,
      tipo: 'SALIDA',
      cantidad: -cantidad,
      saldo,
      ...momento,
      usuarioId,
      usuarioNombre: consumo.usuarioNombre,
      referencia: `Remisión ${remision.consecutivo}`,
      observacion: `Consumo por receta v${consumo.receta.version}: ${remision.cantidadCajas} cajas de ${remision.codigoProducto}`,
      motivo: null,
      entradaId: null,
      remisionId: remision.id,
      conteoTexto: null,
      cierreId: null,
    });
    await ctx.itemsInventario.fijarExistencia(item.id, saldo);
  }
}
