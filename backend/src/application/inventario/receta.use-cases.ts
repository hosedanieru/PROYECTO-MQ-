/**
 * CASOS DE USO: RECETA DEL PT
 * ===========================
 *
 *   GuardarRecetaUseCase     crea una VERSIÓN NUEVA de la receta de un PT
 *   ConsultarRecetaUseCase   la vigente y el historial, con los datos de cada componente
 *
 * La receta nunca se edita encima: cada guardado es una versión (usuario,
 * 2026-09-29). Crear un PT también crea su versión 1 (ver
 * producto.use-cases.ts): por eso las lecturas y validaciones están en
 * `prepararReceta`, que usan los dos.
 *
 * Regla de Firestore: todas las lecturas antes de cualquier escritura.
 * `prepararReceta` solo lee; quien la llama escribe después.
 */

import type { Reloj } from '../remision/crear-remision.use-case.js';
import type { ItemInventario, ItemInventarioRepository, TipoItem } from '../../domain/inventario/item-inventario.js';
import {
  exigirComponentesValidos,
  validarComponentes,
  type ComponenteReceta,
  type RecetaPt,
  type RecetaRepository,
} from '../../domain/inventario/receta.js';
import { ProductoNoEncontradoError } from '../../domain/producto/producto.errors.js';
import type { ContextoTransaccional, UnidadDeTrabajo } from '../../domain/shared/unidad-de-trabajo.js';

export interface ComponenteDetallado extends ComponenteReceta {
  tipo: TipoItem | null;
  codigo: string;
  descripcion: string;
  unidadMedida: string;
  activo: boolean;
  existencia: number;
}

export interface RecetaDetallada extends Omit<RecetaPt, 'componentes'> {
  componentes: ComponenteDetallado[];
}

/** Completa cada componente con código, descripción, unidad y existencia de su ítem. */
export function detallarReceta(receta: RecetaPt, items: Map<string, ItemInventario | null>): RecetaDetallada {
  return {
    ...receta,
    componentes: receta.componentes.map((c) => {
      const item = items.get(c.itemId);
      return {
        ...c,
        tipo: item?.tipo ?? null,
        codigo: item?.codigo ?? '',
        descripcion: item?.descripcion ?? '(ítem no encontrado)',
        unidadMedida: item?.unidadMedida ?? '',
        activo: item?.activo ?? false,
        existencia: item?.existencia ?? 0,
      };
    }),
  };
}

export interface RecetaPreparada {
  componentes: ComponenteReceta[];
  items: Map<string, ItemInventario | null>;
  usuarioNombre: string;
}

/** SOLO LECTURAS: valida la lista, lee sus ítems y el nombre de quien guarda. */
export async function prepararReceta(
  ctx: ContextoTransaccional,
  componentes: ComponenteReceta[],
  usuarioId: string,
): Promise<RecetaPreparada> {
  const validos = validarComponentes(componentes);
  const items = new Map<string, ItemInventario | null>();
  for (const c of validos) items.set(c.itemId, await ctx.itemsInventario.buscarPorId(c.itemId));
  exigirComponentesValidos(validos, items);
  const usuario = await ctx.usuarios.buscarPorId(usuarioId);
  return { componentes: validos, items, usuarioNombre: usuario?.nombre ?? '' };
}

export interface GuardarRecetaComando {
  productoId: string;
  componentes: ComponenteReceta[];
  usuarioId: string;
}

export class GuardarRecetaUseCase {
  constructor(
    private readonly uow: UnidadDeTrabajo,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(comando: GuardarRecetaComando): Promise<RecetaDetallada> {
    return this.uow.ejecutar(async (ctx) => {
      // Lecturas.
      const producto = await ctx.productos.buscarPorId(comando.productoId);
      if (!producto) throw new ProductoNoEncontradoError(`No existe el PT "${comando.productoId}".`);
      const preparada = await prepararReceta(ctx, comando.componentes, comando.usuarioId);
      const anterior = await ctx.recetas.vigente(producto.id);

      // Escrituras.
      const receta = await ctx.recetas.crear({
        productoId: producto.id,
        version: (anterior?.version ?? 0) + 1,
        vigenteDesde: this.reloj.ahora(),
        creadaPorId: comando.usuarioId,
        creadaPorNombre: preparada.usuarioNombre,
        componentes: preparada.componentes,
      });
      await ctx.auditoria.registrar({
        entidad: 'receta',
        entidadId: receta.id,
        accion: 'CREAR',
        valorAnterior: anterior ?? undefined,
        valorNuevo: receta,
        usuarioId: comando.usuarioId,
      });
      return detallarReceta(receta, preparada.items);
    });
  }
}

export interface RecetaConHistorial {
  vigente: RecetaDetallada | null;
  /** Todas las versiones, la más reciente primero (incluye la vigente). */
  versiones: RecetaDetallada[];
}

export class ConsultarRecetaUseCase {
  constructor(
    private readonly recetas: RecetaRepository,
    private readonly items: ItemInventarioRepository,
  ) {}

  async ejecutar(productoId: string): Promise<RecetaConHistorial> {
    const versiones = await this.recetas.versiones(productoId);
    if (versiones.length === 0) return { vigente: null, versiones: [] };
    // Los ítems se leen una vez y se cruzan en memoria.
    const todos = await this.items.listar({});
    const porId = new Map<string, ItemInventario | null>(todos.map((i) => [i.id, i]));
    const detalladas = versiones.map((v) => detallarReceta(v, porId));
    return { vigente: detalladas[0], versiones: detalladas };
  }
}
