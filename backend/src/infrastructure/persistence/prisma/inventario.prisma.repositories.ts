/**
 * INVENTARIO — Implementación con Prisma
 * ======================================
 *
 * `item_inventario` y `movimiento_inventario`. El PT lee código y
 * descripción del producto enlazado (no los guarda). Los enums de Prisma
 * se traducen con un Record explícito.
 */

import type {
  Prisma,
  TipoItemInventario as TipoItemPrisma,
  TipoMovimientoInventario as TipoMovPrisma,
} from '../../../generated/prisma/client.js';
import type {
  CambiosItem,
  DatosItem,
  FiltroItems,
  ItemInventario,
  ItemInventarioRepository,
  TipoItem,
} from '../../../domain/inventario/item-inventario.js';
import type {
  EntradaMercancia,
  EntradaMercanciaRepository,
  NuevaEntrada,
} from '../../../domain/inventario/entrada-mercancia.js';
import type {
  FiltroMovimientos,
  MovimientoInventario,
  MovimientoInventarioRepository,
  NuevoMovimiento,
  TipoMovimiento,
} from '../../../domain/inventario/movimiento-inventario.js';
import type { ClientePrisma } from './cliente-prisma.js';

const TIPO_ITEM: Record<TipoItemPrisma, TipoItem> = { INSUMO: 'INSUMO', PI: 'PI', PT: 'PT' };
const TIPO_MOV: Record<TipoMovPrisma, TipoMovimiento> = { ENTRADA: 'ENTRADA', SALIDA: 'SALIDA', AJUSTE: 'AJUSTE' };

const CON_PRODUCTO = { producto: { select: { codigo: true, descripcion: true } } } satisfies Prisma.ItemInventarioInclude;
type FilaItem = Prisma.ItemInventarioGetPayload<{ include: typeof CON_PRODUCTO }>;

function itemADominio(f: FilaItem): ItemInventario {
  return {
    id: f.id,
    tipo: TIPO_ITEM[f.tipo],
    // PT: del producto enlazado; INSUMO / PI: propios.
    codigo: f.producto?.codigo ?? f.codigo ?? '',
    descripcion: f.producto?.descripcion ?? f.descripcion ?? '',
    unidadMedida: f.unidadMedida,
    productoId: f.productoId,
    existencia: Number(f.existencia),
    activo: f.activo,
  };
}

export class ItemInventarioPrismaRepository implements ItemInventarioRepository {
  constructor(private readonly cliente: ClientePrisma) {}

  async listar(filtro: FiltroItems): Promise<ItemInventario[]> {
    const texto = filtro.texto?.trim();
    const filas = await this.cliente.itemInventario.findMany({
      where: {
        ...(filtro.tipo ? { tipo: filtro.tipo } : {}),
        ...(filtro.soloActivos ? { activo: true } : {}),
        ...(texto
          ? {
              OR: [
                { codigo: { contains: texto, mode: 'insensitive' } },
                { descripcion: { contains: texto, mode: 'insensitive' } },
                { producto: { codigo: { contains: texto, mode: 'insensitive' } } },
                { producto: { descripcion: { contains: texto, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      include: CON_PRODUCTO,
    });
    return filas.map(itemADominio).sort((a, b) => a.tipo.localeCompare(b.tipo) || a.codigo.localeCompare(b.codigo));
  }

  async buscarPorId(id: string): Promise<ItemInventario | null> {
    const f = await this.cliente.itemInventario.findUnique({ where: { id }, include: CON_PRODUCTO });
    return f ? itemADominio(f) : null;
  }

  async buscarPorCodigo(codigo: string): Promise<ItemInventario | null> {
    const f = await this.cliente.itemInventario.findUnique({ where: { codigo }, include: CON_PRODUCTO });
    return f ? itemADominio(f) : null;
  }

  async buscarPorProducto(productoId: string): Promise<ItemInventario | null> {
    const f = await this.cliente.itemInventario.findUnique({ where: { productoId }, include: CON_PRODUCTO });
    return f ? itemADominio(f) : null;
  }

  async crear(datos: DatosItem): Promise<ItemInventario> {
    const f = await this.cliente.itemInventario.create({ data: datos, include: CON_PRODUCTO });
    return itemADominio(f);
  }

  async actualizar(id: string, cambios: CambiosItem): Promise<ItemInventario> {
    const f = await this.cliente.itemInventario.update({ where: { id }, data: cambios, include: CON_PRODUCTO });
    return itemADominio(f);
  }

  /**
   * SELECT ... FOR UPDATE: un segundo movimiento sobre el mismo ítem
   * espera a que el primero confirme y parte de su saldo. Sin esto, dos
   * salidas simultáneas podrían sacar la misma existencia.
   */
  async bloquearParaMovimiento(id: string): Promise<ItemInventario | null> {
    await this.cliente.$queryRaw`SELECT id FROM item_inventario WHERE id = ${id} FOR UPDATE`;
    return this.buscarPorId(id);
  }

  async fijarExistencia(id: string, existencia: number): Promise<void> {
    await this.cliente.itemInventario.update({ where: { id }, data: { existencia } });
  }
}

type FilaMovimiento = Prisma.MovimientoInventarioGetPayload<Record<string, never>>;

function movimientoADominio(f: FilaMovimiento): MovimientoInventario {
  return {
    id: f.id,
    itemId: f.itemId,
    tipo: TIPO_MOV[f.tipo],
    cantidad: Number(f.cantidad),
    saldo: Number(f.saldo),
    fechaHoraRegistro: f.fechaHoraRegistro,
    fechaOperativa: f.fechaOperativa,
    turnoId: f.turnoId,
    usuarioId: f.usuarioId,
    usuarioNombre: f.usuarioNombre,
    referencia: f.referencia,
    observacion: f.observacion,
    motivo: f.motivo,
    entradaId: f.entradaId,
  };
}

export class MovimientoInventarioPrismaRepository implements MovimientoInventarioRepository {
  constructor(private readonly cliente: ClientePrisma) {}

  async crear(movimiento: NuevoMovimiento): Promise<MovimientoInventario> {
    return movimientoADominio(await this.cliente.movimientoInventario.create({ data: movimiento }));
  }

  async listarPorEntrada(entradaId: string): Promise<MovimientoInventario[]> {
    const filas = await this.cliente.movimientoInventario.findMany({ where: { entradaId }, orderBy: { id: 'asc' } });
    return filas.map(movimientoADominio);
  }

  async listarPorItem(itemId: string, limite: number): Promise<MovimientoInventario[]> {
    const filas = await this.cliente.movimientoInventario.findMany({
      where: { itemId },
      orderBy: { fechaHoraRegistro: 'desc' },
      take: limite,
    });
    return filas.map(movimientoADominio);
  }

  async listar(filtro: FiltroMovimientos): Promise<MovimientoInventario[]> {
    const filas = await this.cliente.movimientoInventario.findMany({
      where: {
        fechaOperativa: { gte: filtro.desde, lte: filtro.hasta },
        ...(filtro.tipo ? { tipo: filtro.tipo } : {}),
      },
      orderBy: { fechaHoraRegistro: 'desc' },
    });
    return filas.map(movimientoADominio);
  }
}

export class EntradaMercanciaPrismaRepository implements EntradaMercanciaRepository {
  constructor(private readonly cliente: ClientePrisma) {}

  crear(entrada: NuevaEntrada): Promise<EntradaMercancia> {
    return this.cliente.entradaMercancia.create({ data: entrada });
  }

  buscarPorId(id: string): Promise<EntradaMercancia | null> {
    return this.cliente.entradaMercancia.findUnique({ where: { id } });
  }

  listar(desde: Date, hasta: Date): Promise<EntradaMercancia[]> {
    return this.cliente.entradaMercancia.findMany({
      where: { fechaOperativa: { gte: desde, lte: hasta } },
      orderBy: { fechaHoraRegistro: 'desc' },
    });
  }
}
