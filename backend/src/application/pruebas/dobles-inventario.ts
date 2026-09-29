/**
 * DOBLES DE PRUEBA — Inventario
 * =============================
 *
 * Solo se importan desde archivos `*.spec.ts`.
 */

import type {
  CambiosItem,
  DatosItem,
  FiltroItems,
  ItemInventario,
  ItemInventarioRepository,
} from '../../domain/inventario/item-inventario.js';
import type {
  FiltroMovimientos,
  MovimientoInventario,
  MovimientoInventarioRepository,
  NuevoMovimiento,
} from '../../domain/inventario/movimiento-inventario.js';
import type { ProductoRepository } from '../../domain/producto/producto.repository.js';
import type {
  EntradaMercancia,
  EntradaMercanciaRepository,
  NuevaEntrada,
} from '../../domain/inventario/entrada-mercancia.js';

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

export class ItemInventarioRepositorioFalso implements ItemInventarioRepository {
  readonly items: ItemInventario[] = [];
  private secuencia = 0;

  /** Con los productos, el PT resuelve su código y descripción como la base real. */
  constructor(private readonly productos?: ProductoRepository) {}

  agregar(item: ItemInventario): void {
    this.items.push(item);
  }

  listar(filtro: FiltroItems): Promise<ItemInventario[]> {
    return Promise.resolve(this.items.filter((i) => (!filtro.tipo || i.tipo === filtro.tipo) && (!filtro.soloActivos || i.activo)));
  }

  buscarPorId(id: string): Promise<ItemInventario | null> {
    const i = this.items.find((x) => x.id === id);
    return Promise.resolve(i ? { ...i } : null);
  }

  buscarPorCodigo(codigo: string): Promise<ItemInventario | null> {
    return Promise.resolve(this.items.find((x) => x.tipo !== 'PT' && x.codigo === codigo) ?? null);
  }

  buscarPorProducto(productoId: string): Promise<ItemInventario | null> {
    return Promise.resolve(this.items.find((x) => x.productoId === productoId) ?? null);
  }

  async crear(datos: DatosItem): Promise<ItemInventario> {
    const producto = datos.productoId ? await this.productos?.buscarPorId(datos.productoId) : null;
    const nuevo: ItemInventario = {
      id: `item-${++this.secuencia}`,
      tipo: datos.tipo,
      codigo: producto?.codigo ?? datos.codigo ?? '',
      descripcion: producto?.descripcion ?? datos.descripcion ?? '',
      unidadMedida: datos.unidadMedida,
      productoId: datos.productoId,
      existencia: 0,
      activo: true,
    };
    this.items.push(nuevo);
    return { ...nuevo };
  }

  actualizar(id: string, cambios: CambiosItem): Promise<ItemInventario> {
    const i = this.items.findIndex((x) => x.id === id);
    this.items[i] = { ...this.items[i], ...(cambios as Partial<ItemInventario>) };
    return Promise.resolve({ ...this.items[i] });
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
