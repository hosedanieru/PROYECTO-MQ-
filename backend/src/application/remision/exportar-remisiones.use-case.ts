/**
 * CASO DE USO: EXPORTAR REMISIONES (EXCEL)
 * ========================================
 *
 * Mismos filtros que el listado, sin paginación. Resuelve nombres de
 * catálogo y delega en el exportador. Lectura: sin unidad de trabajo.
 */

import type { CatalogoRepository } from '../../domain/catalogo/catalogo.repository.js';
import type { GrupoRepository } from '../../domain/grupo/grupo.repository.js';
import type { ExportadorExcelRemision } from '../../domain/remision/exportador-excel.js';
import type { RemisionParaImprimir } from '../../domain/remision/generador-pdf.js';
import type { Remision } from '../../domain/remision/remision.entity.js';
import type {
  FiltroRemisiones,
  RemisionRepository,
} from '../../domain/remision/remision.repository.js';

export type FiltroExportacion = Omit<FiltroRemisiones, 'pagina' | 'porPagina'>;

/** Lo que hace falta para poner nombres (no ids) en PDF y Excel. */
export interface FuentesDeNombres {
  catalogos: CatalogoRepository;
  grupos: GrupoRepository;
}

export class ExportarRemisionesUseCase {
  constructor(
    private readonly remisiones: RemisionRepository,
    private readonly fuentes: FuentesDeNombres,
    private readonly exportador: ExportadorExcelRemision,
  ) {}

  async ejecutar(filtro: FiltroExportacion): Promise<Buffer> {
    const remisiones = await this.remisiones.listarTodas(filtro);
    return this.exportador.generar(await resolverNombres(this.fuentes, remisiones));
  }
}

/** Compartido con la impresión: nombres de turno, grupo y lugar. */
export async function resolverNombres(
  fuentes: FuentesDeNombres,
  remisiones: Remision[],
): Promise<RemisionParaImprimir[]> {
  const [turnos, grupos, lugares] = await Promise.all([
    fuentes.catalogos.listarTurnos(),
    fuentes.grupos.listar(),
    fuentes.catalogos.listarLugares(),
  ]);
  const buscar = (lista: { id: string; codigo: string; nombre: string }[], id: string) =>
    lista.find((i) => i.id === id);

  return remisiones.map((remision) => {
    const d = remision.aObjeto();
    return {
      remision,
      turno: buscar(turnos, d.turnoId)?.codigo ?? '—',
      grupo: buscar(grupos, d.grupoId)?.nombre ?? '—',
      lugar: buscar(lugares, d.lugarId)?.nombre ?? '—',
    };
  });
}
