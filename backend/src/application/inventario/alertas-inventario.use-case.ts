/**
 * CASO DE USO: ALERTAS DE INVENTARIO DEL DÍA (fase D)
 * ===================================================
 *
 * Reúne existencias, recetas vigentes, el DPP del día y lo ya aprobado, y
 * aplica la regla pura `calcularAlertasInventario`. Es una lectura: sin
 * unidad de trabajo ni auditoría. Nada se guarda: se calcula en el momento.
 */

import { calcularAlertasInventario, type AlertaInventario } from '../../domain/inventario/alertas-inventario.js';
import type { ItemInventarioRepository } from '../../domain/inventario/item-inventario.js';
import type { RecetaRepository } from '../../domain/inventario/receta.js';
import type { BloqueRepository } from '../../domain/mfr/bloque-programacion.js';
import { calcularBloques, ESTADOS_QUE_CUENTAN } from '../../domain/mfr/calculo-mfr.js';
import type { EstandarRepository } from '../../domain/mfr/estandar-produccion.js';
import type { RemisionRepository } from '../../domain/remision/remision.repository.js';

export interface AlertasInventarioDia {
  fechaOperativa: Date;
  /** Sin DPP no se puede calcular "no alcanza" ni saber qué PT urgen. */
  hayDpp: boolean;
  alertas: AlertaInventario[];
}

export class AlertasInventarioUseCase {
  constructor(
    private readonly items: ItemInventarioRepository,
    private readonly recetas: RecetaRepository,
    private readonly bloques: BloqueRepository,
    private readonly estandares: EstandarRepository,
    private readonly remisiones: RemisionRepository,
  ) {}

  async ejecutar(fechaOperativa: Date): Promise<AlertasInventarioDia> {
    const [items, recetasVigentes, bloquesDia, estandares, aprobadas] = await Promise.all([
      this.items.listar({}),
      this.recetas.vigentes(),
      this.bloques.listarPorFecha(fechaOperativa),
      this.estandares.listar(),
      this.remisiones.totalizarCajas(fechaOperativa, ESTADOS_QUE_CUENTAN),
    ]);

    // Lo que falta producir hoy por PT = programado (Σ T) − ya aprobado (oficial).
    // Lo aprobado ya descontó su consumo; las extraoficiales no están en el DPP.
    const pendientePorProducto = new Map<string, number>();
    for (const b of calcularBloques(bloquesDia.map((x) => x.aObjeto()), estandares)) {
      pendientePorProducto.set(b.productoId, (pendientePorProducto.get(b.productoId) ?? 0) + b.targetCajas);
    }
    for (const p of aprobadas) {
      if (p.extraoficial || !pendientePorProducto.has(p.productoId)) continue;
      pendientePorProducto.set(p.productoId, Math.max(0, pendientePorProducto.get(p.productoId)! - p.cajas));
    }
    for (const [productoId, cajas] of pendientePorProducto) pendientePorProducto.set(productoId, Math.ceil(cajas));

    return {
      fechaOperativa,
      hayDpp: bloquesDia.length > 0,
      alertas: calcularAlertasInventario({ items, recetasVigentes, pendientePorProducto }),
    };
  }
}
