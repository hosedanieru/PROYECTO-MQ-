/**
 * ALERTAS DE INVENTARIO (fase D)
 * ==============================
 *
 * Lo que el usuario pidió vigilar (2026-09-29): PT sin receta, componente
 * inactivo, agotado y "no alcanza para el DPP". Se CALCULAN en el momento
 * con lo que ya está guardado (existencias, recetas vigentes, DPP y
 * remisiones aprobadas); no se almacenan. Función pura.
 *
 *   PT_SIN_RECETA         PT activo sin receta. CRÍTICA si tiene cajas
 *                         pendientes en el DPP del día: sin receta no se
 *                         puede aprobar su remisión.
 *   COMPONENTE_INACTIVO   la receta vigente de un PT activo usa un PI o
 *                         insumo desactivado (se sigue descontando).
 *   AGOTADO               PI o insumo activo con existencia 0. CRÍTICA si
 *                         alguna receta vigente lo usa.
 *   NO_ALCANZA_DPP        lo que falta producir hoy según el DPP necesita
 *                         más de lo que hay. Dice cuánto falta.
 *
 * "Lo que falta producir" = programado (Σ T del DPP) − ya aprobado, por
 * PT: lo aprobado ya descontó su consumo al aprobarse, así que contarlo
 * otra vez duplicaría el requerimiento.
 *
 * Si un ítem no alcanza para el DPP, no se repite como AGOTADO: la alerta
 * de "no alcanza" dice lo mismo y además cuánto falta.
 */

import { redondear } from './cantidad.js';
import type { ItemInventario } from './item-inventario.js';
import type { RecetaPt } from './receta.js';

export type TipoAlertaInventario = 'PT_SIN_RECETA' | 'COMPONENTE_INACTIVO' | 'AGOTADO' | 'NO_ALCANZA_DPP';
export type GravedadAlerta = 'CRITICA' | 'ADVERTENCIA';

export interface AlertaInventario {
  tipo: TipoAlertaInventario;
  gravedad: GravedadAlerta;
  /** El PT (PT_SIN_RECETA, COMPONENTE_INACTIVO) o el PI/insumo (AGOTADO, NO_ALCANZA_DPP). */
  itemId: string;
  codigo: string;
  descripcion: string;
  mensaje: string;
  /** Solo NO_ALCANZA_DPP. */
  necesita?: number;
  hay?: number;
  falta?: number;
  unidad?: string;
}

export interface EntradaAlertas {
  items: ItemInventario[];
  /** La versión vigente de cada PT que tiene receta. */
  recetasVigentes: RecetaPt[];
  /** Cajas que faltan por producir hoy por PT (programado − aprobado, ≥ 0). */
  pendientePorProducto: Map<string, number>;
}

const ORDEN_TIPO: Record<TipoAlertaInventario, number> = { NO_ALCANZA_DPP: 0, PT_SIN_RECETA: 1, AGOTADO: 2, COMPONENTE_INACTIVO: 3 };

export function calcularAlertasInventario({ items, recetasVigentes, pendientePorProducto }: EntradaAlertas): AlertaInventario[] {
  const alertas: AlertaInventario[] = [];
  const itemPorId = new Map(items.map((i) => [i.id, i]));
  const recetaDe = new Map(recetasVigentes.map((r) => [r.productoId, r]));
  const ptsActivos = items.filter((i) => i.tipo === 'PT' && i.activo);

  // Componentes usados por alguna receta vigente de un PT activo, y lo que necesita el DPP pendiente.
  const usados = new Set<string>();
  const necesario = new Map<string, number>();

  for (const pt of ptsActivos) {
    const receta = recetaDe.get(pt.referenciaId);
    const pendiente = pendientePorProducto.get(pt.referenciaId) ?? 0;

    if (!receta) {
      alertas.push({
        tipo: 'PT_SIN_RECETA',
        gravedad: pendiente > 0 ? 'CRITICA' : 'ADVERTENCIA',
        itemId: pt.id,
        codigo: pt.codigo,
        descripcion: pt.descripcion,
        mensaje:
          pendiente > 0
            ? `Tiene ${pendiente} cajas programadas pendientes y no tiene receta: su remisión no se podrá aprobar.`
            : 'No tiene receta: sus remisiones no se podrán aprobar.',
      });
      continue;
    }

    for (const c of receta.componentes) {
      usados.add(c.itemId);
      if (pendiente > 0) necesario.set(c.itemId, redondear((necesario.get(c.itemId) ?? 0) + c.cantidad * pendiente));
      const componente = itemPorId.get(c.itemId);
      if (componente && !componente.activo) {
        alertas.push({
          tipo: 'COMPONENTE_INACTIVO',
          gravedad: 'ADVERTENCIA',
          itemId: pt.id,
          codigo: pt.codigo,
          descripcion: pt.descripcion,
          mensaje: `Su receta usa ${componente.codigo} (${componente.descripcion}), que está inactivo. Revise la receta.`,
        });
      }
    }
  }

  const noAlcanza = new Set<string>();
  for (const [itemId, necesita] of necesario) {
    const item = itemPorId.get(itemId);
    if (!item || necesita <= item.existencia) continue;
    const falta = redondear(necesita - item.existencia);
    noAlcanza.add(itemId);
    alertas.push({
      tipo: 'NO_ALCANZA_DPP',
      gravedad: 'CRITICA',
      itemId,
      codigo: item.codigo,
      descripcion: item.descripcion,
      mensaje: `Lo que falta producir hoy necesita ${necesita} ${item.unidadMedida} y hay ${item.existencia}: faltan ${falta}.`,
      necesita,
      hay: item.existencia,
      falta,
      unidad: item.unidadMedida,
    });
  }

  for (const item of items) {
    if (item.tipo === 'PT' || !item.activo || item.existencia > 0 || noAlcanza.has(item.id)) continue;
    alertas.push({
      tipo: 'AGOTADO',
      gravedad: usados.has(item.id) ? 'CRITICA' : 'ADVERTENCIA',
      itemId: item.id,
      codigo: item.codigo,
      descripcion: item.descripcion,
      mensaje: usados.has(item.id) ? 'Agotado y lo usa al menos una receta vigente.' : 'Agotado.',
    });
  }

  // Primero lo crítico; dentro de cada gravedad, por tipo y código.
  return alertas.sort(
    (a, b) =>
      Number(a.gravedad !== 'CRITICA') - Number(b.gravedad !== 'CRITICA') ||
      ORDEN_TIPO[a.tipo] - ORDEN_TIPO[b.tipo] ||
      a.codigo.localeCompare(b.codigo),
  );
}
