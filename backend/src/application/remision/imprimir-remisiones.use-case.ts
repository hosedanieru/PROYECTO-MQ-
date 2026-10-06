/**
 * CASO DE USO: IMPRIMIR REMISIONES (PDF)
 * ======================================
 *
 * Carga las remisiones pedidas, resuelve los nombres de turno,
 * grupo y lugar (el formato impreso muestra nombres, no ids), agrega las
 * firmas electrónicas VIGENTES de cada una (versión actual y huella igual
 * a la del contenido actual) y delega en el generador. Es una lectura: no
 * pasa por la unidad de trabajo ni audita.
 */

import { contenidoFirmable, esVigente, type CalculadorHuella, type FirmaRemisionRepository } from '../../domain/remision/firma-remision.js';
import type { GeneradorPdfRemision } from '../../domain/remision/generador-pdf.js';
import { RemisionNoEncontradaError } from '../../domain/remision/remision.errors.js';
import type { RemisionRepository } from '../../domain/remision/remision.repository.js';
import { resolverNombres, type FuentesDeNombres } from './exportar-remisiones.use-case.js';

export class ImprimirRemisionesUseCase {
  constructor(
    private readonly remisiones: RemisionRepository,
    private readonly fuentes: FuentesDeNombres,
    private readonly generador: GeneradorPdfRemision,
    private readonly firmas: FirmaRemisionRepository,
    private readonly huella: CalculadorHuella,
  ) {}

  async ejecutar(ids: string[]): Promise<Buffer> {
    const remisiones = await this.remisiones.buscarPorIds(ids);
    if (remisiones.length === 0) {
      throw new RemisionNoEncontradaError('No existe ninguna de las remisiones pedidas.');
    }
    const [conNombres, firmasPorRemision] = await Promise.all([
      resolverNombres(this.fuentes, remisiones),
      Promise.all(remisiones.map((r) => this.firmas.listarPorRemision(r.id))),
    ]);
    return this.generador.generar(
      conNombres.map((r, i) => {
        const huellaActual = this.huella.sha256(contenidoFirmable(r.remision));
        return { ...r, firmas: firmasPorRemision[i].filter((f) => esVigente(f, r.remision, huellaActual)) };
      }),
    );
  }
}
