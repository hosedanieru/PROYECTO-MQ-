/**
 * CASO DE USO: IMPRIMIR REMISIONES (PDF)
 * ======================================
 *
 * Carga las remisiones pedidas, resuelve los nombres de turno,
 * grupo y lugar (el formato impreso muestra nombres, no ids) y
 * delega en el generador. Es una lectura: no pasa por la unidad de
 * trabajo ni audita.
 */

import type { GeneradorPdfRemision } from '../../domain/remision/generador-pdf.js';
import { RemisionNoEncontradaError } from '../../domain/remision/remision.errors.js';
import type { RemisionRepository } from '../../domain/remision/remision.repository.js';
import { resolverNombres, type FuentesDeNombres } from './exportar-remisiones.use-case.js';

export class ImprimirRemisionesUseCase {
  constructor(
    private readonly remisiones: RemisionRepository,
    private readonly fuentes: FuentesDeNombres,
    private readonly generador: GeneradorPdfRemision,
  ) {}

  async ejecutar(ids: string[]): Promise<Buffer> {
    const remisiones = await this.remisiones.buscarPorIds(ids);
    if (remisiones.length === 0) {
      throw new RemisionNoEncontradaError('No existe ninguna de las remisiones pedidas.');
    }
    return this.generador.generar(await resolverNombres(this.fuentes, remisiones));
  }
}
