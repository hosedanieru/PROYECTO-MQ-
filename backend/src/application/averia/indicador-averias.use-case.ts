/**
 * CASO DE USO: INDICADOR DE AVERÍAS DE UN PERIODO
 * ===============================================
 *
 * Reúne lo que el cálculo necesita y se lo entrega al dominio:
 *   - el T de cada bloque del DPP de cada día (misma cuenta que el MFR),
 *   - los reportes de averías del periodo,
 *   - las unidades por caja de los productos.
 *
 * Solo lee: no abre transacción.
 */

import { calcularIndicadorAverias, type IndicadorAverias, type ProgramadoBloque } from '../../domain/averia/indicador-averias.js';
import type { ReporteAveriaRepository } from '../../domain/averia/reporte-averia.js';
import { diasDelRango, validarRango } from '../../domain/shared/rango-fechas.js';
import type { BloqueRepository } from '../../domain/mfr/bloque-programacion.js';
import { calcularBloque } from '../../domain/mfr/calculo-mfr.js';
import type { ProductoRepository } from '../../domain/producto/producto.repository.js';

export class IndicadorAveriasUseCase {
  constructor(
    private readonly bloques: BloqueRepository,
    private readonly reportes: ReporteAveriaRepository,
    private readonly productos: ProductoRepository,
  ) {}

  async ejecutar(desde: Date, hasta: Date): Promise<IndicadorAverias> {
    validarRango(desde, hasta);

    const [bloquesPorDia, reportes, productos] = await Promise.all([
      Promise.all(diasDelRango(desde, hasta).map((d) => this.bloques.listarPorFecha(d))),
      this.reportes.listar({ desde, hasta }),
      this.productos.listar({}),
    ]);

    // El peso no hace falta aquí: solo el T en cajas (targetCajas).
    const programado: ProgramadoBloque[] = bloquesPorDia.flat().map((b) => {
      const d = b.aObjeto();
      return {
        fechaOperativa: d.fechaOperativa.toISOString().slice(0, 10),
        turnoId: d.turnoId,
        productoId: d.productoId,
        cajas: calcularBloque(d, undefined).targetCajas,
      };
    });

    return calcularIndicadorAverias(programado, reportes, productos);
  }
}
