/**
 * INVENTARIO — Implementación con Prisma
 * ======================================
 *
 *   unidad_medida                      catálogo de unidades base
 *   pi, insumo                         un catálogo por tipo (mismo repositorio, tabla según el tipo)
 *   item_inventario                    la existencia de un PT, PI o insumo
 *   movimiento_inventario              el kardex
 *   entrada_mercancia                  encabezado de lo que llega en un documento
 *   receta, receta_componente          receta versionada del PT (lista de materiales)
 *
 * El ítem lee código, descripción, unidad y "activo" de su catálogo (no
 * los guarda). Los enums de Prisma se traducen con un Record explícito.
 */

import type {
  Prisma,
  TipoItemInventario as TipoItemPrisma,
  TipoMovimientoInventario as TipoMovPrisma,
} from '../../../generated/prisma/client.js';
import type {
  EntradaMercancia,
  EntradaMercanciaRepository,
  NuevaEntrada,
} from '../../../domain/inventario/entrada-mercancia.js';
import {
  UNIDAD_PT,
  type DatosDelCatalogo,
  type FiltroItems,
  type ItemInventario,
  type ItemInventarioRepository,
  type TipoItem,
} from '../../../domain/inventario/item-inventario.js';
import type { DatosMaterial, Material, MaterialRepository, TipoMaterial } from '../../../domain/inventario/material.js';
import type {
  FiltroMovimientos,
  MovimientoInventario,
  MovimientoInventarioRepository,
  NuevoMovimiento,
  TipoMovimiento,
} from '../../../domain/inventario/movimiento-inventario.js';
import type { NuevaRecetaPt, RecetaPt, RecetaRepository, ResumenReceta } from '../../../domain/inventario/receta.js';
import type { DatosUnidad, UnidadMedida, UnidadMedidaRepository } from '../../../domain/inventario/unidad-medida.js';
import type { ClientePrisma } from './cliente-prisma.js';

const TIPO_ITEM: Record<TipoItemPrisma, TipoItem> = { INSUMO: 'INSUMO', PI: 'PI', PT: 'PT' };
const TIPO_MOV: Record<TipoMovPrisma, TipoMovimiento> = { ENTRADA: 'ENTRADA', SALIDA: 'SALIDA', AJUSTE: 'AJUSTE' };

// ---------- Unidades de medida ----------

export class UnidadMedidaPrismaRepository implements UnidadMedidaRepository {
  constructor(private readonly cliente: ClientePrisma) {}

  listar(): Promise<UnidadMedida[]> {
    return this.cliente.unidadMedida.findMany({ orderBy: { codigo: 'asc' } });
  }

  buscarPorId(id: string): Promise<UnidadMedida | null> {
    return this.cliente.unidadMedida.findUnique({ where: { id } });
  }

  buscarPorCodigo(codigo: string): Promise<UnidadMedida | null> {
    return this.cliente.unidadMedida.findUnique({ where: { codigo } });
  }

  crear(datos: DatosUnidad): Promise<UnidadMedida> {
    return this.cliente.unidadMedida.create({ data: datos });
  }

  actualizar(id: string, cambios: Partial<DatosUnidad> & { activo?: boolean }): Promise<UnidadMedida> {
    return this.cliente.unidadMedida.update({ where: { id }, data: cambios });
  }
}

// ---------- PI e insumos ----------

const CON_UNIDAD = { unidadBase: { select: { codigo: true } }, presentacion: { select: { codigo: true } } } as const;
type FilaMaterial = Prisma.PiGetPayload<{ include: typeof CON_UNIDAD }>;

/** Decimal de Prisma → número del dominio (3 decimales caben sin pérdida en un double). */
const aNumero = (d: Prisma.Decimal): number => d.toNumber();

function materialADominio(tipo: TipoMaterial, f: FilaMaterial): Material {
  return {
    id: f.id,
    tipo,
    codigo: f.codigo,
    descripcion: f.descripcion,
    unidadBaseId: f.unidadBaseId,
    unidadBase: f.unidadBase.codigo,
    presentacionId: f.presentacionId,
    presentacion: f.presentacion?.codigo ?? null,
    contenidoPresentacion: f.contenidoPresentacion === null ? null : aNumero(f.contenidoPresentacion),
    unidadesPorCaja: f.unidadesPorCaja,
    cajasPorEstiba: f.cajasPorEstiba,
    activo: f.activo,
  };
}

/**
 * Un repositorio para las dos tablas: tienen la misma forma. `tabla(tipo)`
 * elige `pi` o `insumo`; el tipo común evita duplicar cada consulta.
 */
export class MaterialPrismaRepository implements MaterialRepository {
  constructor(private readonly cliente: ClientePrisma) {}

  // Pi e Insumo tienen exactamente los mismos campos: se usa el delegado del PI como tipo común.
  private tabla(tipo: TipoMaterial): ClientePrisma['pi'] {
    return (tipo === 'PI' ? this.cliente.pi : this.cliente.insumo) as unknown as ClientePrisma['pi'];
  }

  async listar(tipo?: TipoMaterial): Promise<Material[]> {
    const tipos: TipoMaterial[] = tipo ? [tipo] : ['PI', 'INSUMO'];
    const listas = await Promise.all(
      tipos.map(async (t) => (await this.tabla(t).findMany({ include: CON_UNIDAD, orderBy: { codigo: 'asc' } })).map((f) => materialADominio(t, f))),
    );
    return listas.flat();
  }

  async buscarPorId(tipo: TipoMaterial, id: string): Promise<Material | null> {
    const f = await this.tabla(tipo).findUnique({ where: { id }, include: CON_UNIDAD });
    return f ? materialADominio(tipo, f) : null;
  }

  async buscarPorCodigo(codigo: string): Promise<Material | null> {
    for (const tipo of ['PI', 'INSUMO'] as const) {
      const f = await this.tabla(tipo).findUnique({ where: { codigo }, include: CON_UNIDAD });
      if (f) return materialADominio(tipo, f);
    }
    return null;
  }

  async crear(tipo: TipoMaterial, datos: DatosMaterial): Promise<Material> {
    return materialADominio(tipo, await this.tabla(tipo).create({ data: datos, include: CON_UNIDAD }));
  }

  async actualizar(tipo: TipoMaterial, id: string, cambios: Partial<DatosMaterial> & { activo?: boolean }): Promise<Material> {
    return materialADominio(tipo, await this.tabla(tipo).update({ where: { id }, data: cambios, include: CON_UNIDAD }));
  }
}

// ---------- Ítems (existencias) ----------

const DEL_MATERIAL = {
  codigo: true,
  descripcion: true,
  activo: true,
  unidadBase: { select: { codigo: true } },
  presentacion: { select: { codigo: true } },
  contenidoPresentacion: true,
  unidadesPorCaja: true,
  cajasPorEstiba: true,
} as const;
const CON_CATALOGO = {
  producto: { select: { codigo: true, descripcion: true, activo: true } },
  pi: { select: DEL_MATERIAL },
  insumo: { select: DEL_MATERIAL },
} satisfies Prisma.ItemInventarioInclude;
type FilaItem = Prisma.ItemInventarioGetPayload<{ include: typeof CON_CATALOGO }>;

function itemADominio(f: FilaItem): ItemInventario {
  // La restricción CHECK de la base garantiza que hay exactamente uno.
  const material = f.pi ?? f.insumo;
  const catalogo: DatosDelCatalogo = f.producto
    ? { codigo: f.producto.codigo, descripcion: f.producto.descripcion, unidadMedida: UNIDAD_PT, activo: f.producto.activo, equivalencias: null }
    : {
        codigo: material!.codigo,
        descripcion: material!.descripcion,
        unidadMedida: material!.unidadBase.codigo,
        activo: material!.activo,
        equivalencias: {
          presentacion: material!.presentacion?.codigo ?? null,
          contenidoPresentacion: material!.contenidoPresentacion === null ? null : aNumero(material!.contenidoPresentacion),
          unidadesPorCaja: material!.unidadesPorCaja,
          cajasPorEstiba: material!.cajasPorEstiba,
        },
      };
  return {
    id: f.id,
    tipo: TIPO_ITEM[f.tipo],
    referenciaId: (f.productoId ?? f.piId ?? f.insumoId)!,
    ...catalogo,
    existencia: aNumero(f.existencia),
  };
}

const COLUMNA_REFERENCIA = { PT: 'productoId', PI: 'piId', INSUMO: 'insumoId' } as const satisfies Record<TipoItem, keyof FilaItem>;

export class ItemInventarioPrismaRepository implements ItemInventarioRepository {
  constructor(private readonly cliente: ClientePrisma) {}

  async listar(filtro: FiltroItems): Promise<ItemInventario[]> {
    const filas = await this.cliente.itemInventario.findMany({
      where: filtro.tipo ? { tipo: filtro.tipo } : {},
      include: CON_CATALOGO,
    });
    // Código, descripción y "activo" viven en tres catálogos distintos: se
    // filtra después de resolverlos (el catálogo es de cientos, no millones).
    const texto = filtro.texto?.trim().toLowerCase();
    return filas
      .map(itemADominio)
      .filter(
        (i) =>
          (!filtro.soloActivos || i.activo) &&
          (!texto || i.codigo.toLowerCase().includes(texto) || i.descripcion.toLowerCase().includes(texto)),
      )
      .sort((a, b) => a.tipo.localeCompare(b.tipo) || a.codigo.localeCompare(b.codigo));
  }

  async buscarPorId(id: string): Promise<ItemInventario | null> {
    const f = await this.cliente.itemInventario.findUnique({ where: { id }, include: CON_CATALOGO });
    return f ? itemADominio(f) : null;
  }

  async buscarPorReferencia(tipo: TipoItem, referenciaId: string): Promise<ItemInventario | null> {
    const f = await this.cliente.itemInventario.findFirst({
      where: { [COLUMNA_REFERENCIA[tipo]]: referenciaId },
      include: CON_CATALOGO,
    });
    return f ? itemADominio(f) : null;
  }

  async crear(tipo: TipoItem, referenciaId: string, catalogo: DatosDelCatalogo): Promise<ItemInventario> {
    const f = await this.cliente.itemInventario.create({ data: { tipo, [COLUMNA_REFERENCIA[tipo]]: referenciaId } });
    return { id: f.id, tipo, referenciaId, ...catalogo, existencia: aNumero(f.existencia) };
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

// ---------- Movimientos (kardex) ----------

type FilaMovimiento = Prisma.MovimientoInventarioGetPayload<Record<string, never>>;

function movimientoADominio(f: FilaMovimiento): MovimientoInventario {
  return {
    id: f.id,
    itemId: f.itemId,
    tipo: TIPO_MOV[f.tipo],
    cantidad: aNumero(f.cantidad),
    saldo: aNumero(f.saldo),
    fechaHoraRegistro: f.fechaHoraRegistro,
    fechaOperativa: f.fechaOperativa,
    turnoId: f.turnoId,
    usuarioId: f.usuarioId,
    usuarioNombre: f.usuarioNombre,
    referencia: f.referencia,
    observacion: f.observacion,
    motivo: f.motivo,
    entradaId: f.entradaId,
    remisionId: f.remisionId,
    conteoTexto: f.conteoTexto,
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

// ---------- Recetas del PT ----------

const CON_COMPONENTES = { componentes: { select: { itemId: true, cantidad: true } } } as const;
type FilaReceta = Prisma.RecetaGetPayload<{ include: typeof CON_COMPONENTES }>;

const recetaADominio = (f: FilaReceta): RecetaPt => ({
  id: f.id,
  productoId: f.productoId,
  version: f.version,
  vigenteDesde: f.vigenteDesde,
  creadaPorId: f.creadaPorId,
  creadaPorNombre: f.creadaPorNombre,
  componentes: f.componentes.map((c) => ({ itemId: c.itemId, cantidad: aNumero(c.cantidad) })),
});

export class RecetaPrismaRepository implements RecetaRepository {
  constructor(private readonly cliente: ClientePrisma) {}

  async vigente(productoId: string): Promise<RecetaPt | null> {
    const f = await this.cliente.receta.findFirst({ where: { productoId }, orderBy: { version: 'desc' }, include: CON_COMPONENTES });
    return f ? recetaADominio(f) : null;
  }

  async versiones(productoId: string): Promise<RecetaPt[]> {
    const filas = await this.cliente.receta.findMany({ where: { productoId }, orderBy: { version: 'desc' }, include: CON_COMPONENTES });
    return filas.map(recetaADominio);
  }

  async resumenVigentes(): Promise<ResumenReceta[]> {
    // `distinct` con el orden por versión descendente deja la vigente de cada PT.
    const filas = await this.cliente.receta.findMany({
      orderBy: [{ productoId: 'asc' }, { version: 'desc' }],
      distinct: ['productoId'],
      select: { productoId: true, version: true, vigenteDesde: true, _count: { select: { componentes: true } } },
    });
    return filas.map((f) => ({ productoId: f.productoId, version: f.version, vigenteDesde: f.vigenteDesde, componentes: f._count.componentes }));
  }

  async vigentes(): Promise<RecetaPt[]> {
    const filas = await this.cliente.receta.findMany({
      orderBy: [{ productoId: 'asc' }, { version: 'desc' }],
      distinct: ['productoId'],
      include: CON_COMPONENTES,
    });
    return filas.map(recetaADominio);
  }

  async crear(receta: NuevaRecetaPt): Promise<RecetaPt> {
    const { componentes, ...encabezado } = receta;
    const f = await this.cliente.receta.create({
      data: { ...encabezado, componentes: { create: componentes } },
      include: CON_COMPONENTES,
    });
    return recetaADominio(f);
  }
}

// ---------- Entradas de mercancía ----------

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
