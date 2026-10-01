/**
 * DOBLES DE PRUEBA — Inventario
 * =============================
 *
 * Solo se importan desde archivos `*.spec.ts`.
 */

import type {
  EntradaMercancia,
  EntradaMercanciaRepository,
  NuevaEntrada,
} from '../../domain/inventario/entrada-mercancia.js';
import type {
  DatosDelCatalogo,
  FiltroItems,
  ItemInventario,
  ItemInventarioRepository,
  TipoItem,
} from '../../domain/inventario/item-inventario.js';
import type { DatosMaterial, Material, MaterialRepository, TipoMaterial } from '../../domain/inventario/material.js';
import type {
  FiltroMovimientos,
  MovimientoInventario,
  MovimientoInventarioRepository,
  NuevoMovimiento,
} from '../../domain/inventario/movimiento-inventario.js';
import type { NuevaRecetaPt, RecetaPt, RecetaRepository, ResumenReceta } from '../../domain/inventario/receta.js';
import type { DatosUnidad, UnidadMedida, UnidadMedidaRepository } from '../../domain/inventario/unidad-medida.js';

export class RecetaRepositorioFalso implements RecetaRepository {
  readonly recetas: RecetaPt[] = [];

  versiones(productoId: string): Promise<RecetaPt[]> {
    return Promise.resolve(this.recetas.filter((r) => r.productoId === productoId).sort((a, b) => b.version - a.version));
  }

  async vigente(productoId: string): Promise<RecetaPt | null> {
    return (await this.versiones(productoId))[0] ?? null;
  }

  vigentes(): Promise<RecetaPt[]> {
    const vigentes = new Map<string, RecetaPt>();
    for (const r of this.recetas) {
      if ((vigentes.get(r.productoId)?.version ?? 0) < r.version) vigentes.set(r.productoId, r);
    }
    return Promise.resolve([...vigentes.values()]);
  }

  async resumenVigentes(): Promise<ResumenReceta[]> {
    return (await this.vigentes()).map((r) => ({ productoId: r.productoId, version: r.version, vigenteDesde: r.vigenteDesde, componentes: r.componentes.length }));
  }

  crear(receta: NuevaRecetaPt): Promise<RecetaPt> {
    // Igual que la restricción única de la base.
    if (this.recetas.some((r) => r.productoId === receta.productoId && r.version === receta.version)) {
      return Promise.reject(new Error('Versión de receta repetida'));
    }
    const creada = { ...receta, id: `receta-${this.recetas.length + 1}` };
    this.recetas.push(creada);
    return Promise.resolve(creada);
  }
}

export class UnidadMedidaRepositorioFalso implements UnidadMedidaRepository {
  readonly unidades: UnidadMedida[] = [{ id: 'u-unidad', codigo: 'UNIDAD', nombre: 'Unidad', activo: true }];

  listar(): Promise<UnidadMedida[]> {
    return Promise.resolve([...this.unidades]);
  }

  buscarPorId(id: string): Promise<UnidadMedida | null> {
    return Promise.resolve(this.unidades.find((u) => u.id === id) ?? null);
  }

  buscarPorCodigo(codigo: string): Promise<UnidadMedida | null> {
    return Promise.resolve(this.unidades.find((u) => u.codigo === codigo) ?? null);
  }

  crear(datos: DatosUnidad): Promise<UnidadMedida> {
    const nueva = { ...datos, id: `u-${this.unidades.length + 1}`, activo: true };
    this.unidades.push(nueva);
    return Promise.resolve(nueva);
  }

  actualizar(id: string, cambios: Partial<DatosUnidad> & { activo?: boolean }): Promise<UnidadMedida> {
    const i = this.unidades.findIndex((u) => u.id === id);
    this.unidades[i] = { ...this.unidades[i], ...cambios };
    return Promise.resolve(this.unidades[i]);
  }
}

export class MaterialRepositorioFalso implements MaterialRepository {
  readonly materiales: Material[] = [];

  constructor(private readonly unidades = new UnidadMedidaRepositorioFalso()) {}

  listar(tipo?: TipoMaterial): Promise<Material[]> {
    return Promise.resolve(this.materiales.filter((m) => !tipo || m.tipo === tipo));
  }

  buscarPorId(tipo: TipoMaterial, id: string): Promise<Material | null> {
    return Promise.resolve(this.materiales.find((m) => m.tipo === tipo && m.id === id) ?? null);
  }

  buscarPorCodigo(codigo: string): Promise<Material | null> {
    return Promise.resolve(this.materiales.find((m) => m.codigo === codigo) ?? null);
  }

  async crear(tipo: TipoMaterial, datos: DatosMaterial): Promise<Material> {
    const unidad = await this.unidades.buscarPorId(datos.unidadBaseId);
    const presentacion = datos.presentacionId ? await this.unidades.buscarPorId(datos.presentacionId) : null;
    const nuevo: Material = {
      ...datos,
      id: `${tipo.toLowerCase()}-${this.materiales.length + 1}`,
      tipo,
      unidadBase: unidad?.codigo ?? '',
      presentacion: presentacion?.codigo ?? null,
      activo: true,
    };
    this.materiales.push(nuevo);
    return nuevo;
  }

  actualizar(tipo: TipoMaterial, id: string, cambios: Partial<DatosMaterial> & { activo?: boolean }): Promise<Material> {
    const i = this.materiales.findIndex((m) => m.tipo === tipo && m.id === id);
    this.materiales[i] = { ...this.materiales[i], ...cambios };
    return Promise.resolve(this.materiales[i]);
  }
}

/**
 * Guarda el ítem con los datos de su catálogo tal como se le entregan al
 * crearlo. `desactivar` simula desactivar el PT, PI o insumo en su catálogo.
 */
export class ItemInventarioRepositorioFalso implements ItemInventarioRepository {
  readonly items: ItemInventario[] = [];
  private secuencia = 0;

  agregar(item: ItemInventario): void {
    this.items.push(item);
  }

  desactivar(id: string): void {
    this.items.find((i) => i.id === id)!.activo = false;
  }

  listar(filtro: FiltroItems): Promise<ItemInventario[]> {
    return Promise.resolve(this.items.filter((i) => (!filtro.tipo || i.tipo === filtro.tipo) && (!filtro.soloActivos || i.activo)));
  }

  buscarPorId(id: string): Promise<ItemInventario | null> {
    const i = this.items.find((x) => x.id === id);
    return Promise.resolve(i ? { ...i } : null);
  }

  buscarPorReferencia(tipo: TipoItem, referenciaId: string): Promise<ItemInventario | null> {
    return Promise.resolve(this.items.find((x) => x.tipo === tipo && x.referenciaId === referenciaId) ?? null);
  }

  crear(tipo: TipoItem, referenciaId: string, catalogo: DatosDelCatalogo): Promise<ItemInventario> {
    const nuevo: ItemInventario = { id: `item-${++this.secuencia}`, tipo, referenciaId, ...catalogo, existencia: 0 };
    this.items.push(nuevo);
    return Promise.resolve({ ...nuevo });
  }

  bloquearParaMovimiento(id: string): Promise<ItemInventario | null> {
    return this.buscarPorId(id);
  }

  fijarExistencia(id: string, existencia: number): Promise<void> {
    this.items.find((x) => x.id === id)!.existencia = existencia;
    return Promise.resolve();
  }
}

export class MovimientoInventarioRepositorioFalso implements MovimientoInventarioRepository {
  readonly movimientos: MovimientoInventario[] = [];

  crear(movimiento: NuevoMovimiento): Promise<MovimientoInventario> {
    const creado = { ...movimiento, id: `mov-${this.movimientos.length + 1}` };
    this.movimientos.push(creado);
    return Promise.resolve(creado);
  }

  listarPorEntrada(entradaId: string): Promise<MovimientoInventario[]> {
    return Promise.resolve(this.movimientos.filter((m) => m.entradaId === entradaId));
  }

  listarPorItem(itemId: string, limite: number): Promise<MovimientoInventario[]> {
    return Promise.resolve(this.movimientos.filter((m) => m.itemId === itemId).reverse().slice(0, limite));
  }

  listar(filtro: FiltroMovimientos): Promise<MovimientoInventario[]> {
    return Promise.resolve(this.movimientos.filter((m) => m.fechaOperativa >= filtro.desde && m.fechaOperativa <= filtro.hasta).reverse());
  }
}

export class EntradaMercanciaRepositorioFalso implements EntradaMercanciaRepository {
  readonly entradas: EntradaMercancia[] = [];

  crear(entrada: NuevaEntrada): Promise<EntradaMercancia> {
    const creada = { ...entrada, id: `ent-${this.entradas.length + 1}` };
    this.entradas.push(creada);
    return Promise.resolve(creada);
  }

  buscarPorId(id: string): Promise<EntradaMercancia | null> {
    return Promise.resolve(this.entradas.find((e) => e.id === id) ?? null);
  }

  listar(desde: Date, hasta: Date): Promise<EntradaMercancia[]> {
    return Promise.resolve(this.entradas.filter((e) => e.fechaOperativa >= desde && e.fechaOperativa <= hasta).reverse());
  }
}
