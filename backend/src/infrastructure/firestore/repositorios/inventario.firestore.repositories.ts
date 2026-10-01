/**
 * INVENTARIO — Firestore
 * ======================
 *
 *   unidadesMedida/{id}          catálogo de unidades base
 *   pis/{id}, insumos/{id}       un catálogo por tipo (mismo repositorio, colección según el tipo)
 *   itemsInventario/{id}         la existencia de un PT, PI o insumo ({ tipo, productoId|piId|insumoId, existencia })
 *   movimientosInventario/{id}   el kardex
 *   entradasMercancia/{id}       encabezado de lo que llega en un documento
 *   recetas/{productoId}_v{n}    versión de la receta de un PT, componentes embebidos
 *
 * El ítem resuelve código, descripción, unidad y "activo" leyendo su
 * catálogo. El "bloqueo" del ítem es la lectura dentro de la transacción:
 * si otra transacción lo modifica antes de confirmar, Firestore reintenta.
 *
 * Kardex de un ítem: consulta por `itemId` y orden en memoria (evita un
 * índice compuesto). Si un ítem llega a miles de movimientos, conviene
 * crear el índice (itemId, fechaHoraRegistro) y ordenar en la consulta.
 */

import type { DocumentData, DocumentSnapshot } from 'firebase-admin/firestore';

import type { CierreInventario, CierreInventarioRepository, NuevoCierre } from '../../../domain/inventario/cierre-inventario.js';
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
} from '../../../domain/inventario/movimiento-inventario.js';
import type { NuevaRecetaPt, RecetaPt, RecetaRepository, ResumenReceta } from '../../../domain/inventario/receta.js';
import type { DatosUnidad, UnidadMedida, UnidadMedidaRepository } from '../../../domain/inventario/unidad-medida.js';
import { aDate, claveFecha, COLECCION, type ClienteFirestore } from '../cliente-firestore.js';

// ---------- Unidades de medida ----------

const unidadADominio = (s: DocumentSnapshot): UnidadMedida => ({
  id: s.id,
  codigo: s.data()!.codigo,
  nombre: s.data()!.nombre,
  activo: s.data()!.activo ?? true,
});

export class UnidadMedidaFirestoreRepository implements UnidadMedidaRepository {
  constructor(private readonly cliente: ClienteFirestore) {}

  private coleccion() {
    return this.cliente.coleccion(COLECCION.unidadesMedida);
  }

  async listar(): Promise<UnidadMedida[]> {
    const q = await this.cliente.consultar(this.coleccion());
    return q.docs.map(unidadADominio).sort((a, b) => a.codigo.localeCompare(b.codigo));
  }

  async buscarPorId(id: string): Promise<UnidadMedida | null> {
    const s = await this.cliente.obtener(this.coleccion().doc(id));
    return s.exists ? unidadADominio(s) : null;
  }

  async buscarPorCodigo(codigo: string): Promise<UnidadMedida | null> {
    const q = await this.cliente.consultar(this.coleccion().where('codigo', '==', codigo).limit(1));
    return q.empty ? null : unidadADominio(q.docs[0]);
  }

  async crear(datos: DatosUnidad): Promise<UnidadMedida> {
    const id = this.cliente.nuevoId(COLECCION.unidadesMedida);
    await this.cliente.guardar(this.coleccion().doc(id), { ...datos, activo: true });
    return { id, ...datos, activo: true };
  }

  async actualizar(id: string, cambios: Partial<DatosUnidad> & { activo?: boolean }): Promise<UnidadMedida> {
    const ref = this.coleccion().doc(id);
    const actual = await this.cliente.obtener(ref);
    await this.cliente.actualizar(ref, cambios);
    return { ...unidadADominio(actual), ...cambios };
  }
}

// ---------- PI e insumos ----------

const COLECCION_MATERIAL: Record<TipoMaterial, string> = { PI: COLECCION.pis, INSUMO: COLECCION.insumos };

export class MaterialFirestoreRepository implements MaterialRepository {
  constructor(private readonly cliente: ClienteFirestore) {}

  private async codigoUnidad(id: string | null): Promise<string | null> {
    if (!id) return null;
    const u = await this.cliente.obtener(this.cliente.coleccion(COLECCION.unidadesMedida).doc(id));
    return u.data()?.codigo ?? '';
  }

  private async aDominio(tipo: TipoMaterial, s: DocumentSnapshot): Promise<Material> {
    const d = s.data()!;
    return {
      id: s.id,
      tipo,
      codigo: d.codigo,
      descripcion: d.descripcion,
      unidadBaseId: d.unidadBaseId,
      unidadBase: (await this.codigoUnidad(d.unidadBaseId)) ?? '',
      presentacionId: d.presentacionId ?? null,
      presentacion: await this.codigoUnidad(d.presentacionId ?? null),
      contenidoPresentacion: d.contenidoPresentacion ?? null,
      unidadesPorCaja: d.unidadesPorCaja ?? null,
      cajasPorEstiba: d.cajasPorEstiba ?? null,
      activo: d.activo ?? true,
    };
  }

  async listar(tipo?: TipoMaterial): Promise<Material[]> {
    const tipos: TipoMaterial[] = tipo ? [tipo] : ['PI', 'INSUMO'];
    const listas = await Promise.all(
      tipos.map(async (t) => {
        const q = await this.cliente.consultar(this.cliente.coleccion(COLECCION_MATERIAL[t]));
        return Promise.all(q.docs.map((s) => this.aDominio(t, s)));
      }),
    );
    return listas.flat().sort((a, b) => a.codigo.localeCompare(b.codigo));
  }

  async buscarPorId(tipo: TipoMaterial, id: string): Promise<Material | null> {
    const s = await this.cliente.obtener(this.cliente.coleccion(COLECCION_MATERIAL[tipo]).doc(id));
    return s.exists ? this.aDominio(tipo, s) : null;
  }

  async buscarPorCodigo(codigo: string): Promise<Material | null> {
    for (const tipo of ['PI', 'INSUMO'] as const) {
      const q = await this.cliente.consultar(this.cliente.coleccion(COLECCION_MATERIAL[tipo]).where('codigo', '==', codigo).limit(1));
      if (!q.empty) return this.aDominio(tipo, q.docs[0]);
    }
    return null;
  }

  /** Escritura pura: la unidad ya la leyó el caso de uso (lecturas antes que escrituras). */
  async crear(tipo: TipoMaterial, datos: DatosMaterial): Promise<Material> {
    const id = this.cliente.nuevoId(COLECCION_MATERIAL[tipo]);
    await this.cliente.guardar(this.cliente.coleccion(COLECCION_MATERIAL[tipo]).doc(id), { ...datos, activo: true });
    // Los códigos de las unidades los completa el caso de uso, que ya las leyó.
    return { id, tipo, ...datos, unidadBase: '', presentacion: null, activo: true };
  }

  async actualizar(tipo: TipoMaterial, id: string, cambios: Partial<DatosMaterial> & { activo?: boolean }): Promise<Material> {
    const ref = this.cliente.coleccion(COLECCION_MATERIAL[tipo]).doc(id);
    const actual = await this.cliente.obtener(ref);
    const antes = await this.aDominio(tipo, actual);
    await this.cliente.actualizar(ref, cambios);
    return { ...antes, ...cambios };
  }
}

// ---------- Ítems (existencias) ----------

const CAMPO_REFERENCIA: Record<TipoItem, string> = { PT: 'productoId', PI: 'piId', INSUMO: 'insumoId' };

/** Lo que el ítem toma de su documento de catálogo; `unidades` resuelve los códigos por id. */
function datosDelCatalogo(tipo: TipoItem, c: DocumentData, unidades: Map<string, DocumentData>): DatosDelCatalogo {
  const base = { codigo: c.codigo ?? '', descripcion: c.descripcion ?? '', activo: c.activo ?? true };
  if (tipo === 'PT') return { ...base, unidadMedida: UNIDAD_PT, equivalencias: null };
  return {
    ...base,
    unidadMedida: unidades.get(c.unidadBaseId)?.codigo ?? '',
    equivalencias: {
      presentacion: c.presentacionId ? (unidades.get(c.presentacionId)?.codigo ?? null) : null,
      contenidoPresentacion: c.contenidoPresentacion ?? null,
      unidadesPorCaja: c.unidadesPorCaja ?? null,
      cajasPorEstiba: c.cajasPorEstiba ?? null,
    },
  };
}
const COLECCION_CATALOGO: Record<TipoItem, string> = { PT: COLECCION.productos, PI: COLECCION.pis, INSUMO: COLECCION.insumos };

export class ItemInventarioFirestoreRepository implements ItemInventarioRepository {
  constructor(private readonly cliente: ClienteFirestore) {}

  private coleccion() {
    return this.cliente.coleccion(COLECCION.itemsInventario);
  }

  /** Datos del catálogo de un ítem (producto, PI o insumo) con su medida y equivalencias. */
  private async catalogo(tipo: TipoItem, referenciaId: string): Promise<DatosDelCatalogo> {
    const s = await this.cliente.obtener(this.cliente.coleccion(COLECCION_CATALOGO[tipo]).doc(referenciaId));
    const d = s.data() ?? {};
    const unidades = new Map<string, DocumentData>();
    if (tipo !== 'PT') {
      for (const id of [d.unidadBaseId, d.presentacionId].filter(Boolean)) {
        const u = await this.cliente.obtener(this.cliente.coleccion(COLECCION.unidadesMedida).doc(id));
        if (u.exists) unidades.set(id, u.data()!);
      }
    }
    return datosDelCatalogo(tipo, d, unidades);
  }

  private async aDominio(s: DocumentSnapshot): Promise<ItemInventario | null> {
    if (!s.exists) return null;
    const d = s.data()!;
    const tipo = d.tipo as TipoItem;
    const referenciaId = d[CAMPO_REFERENCIA[tipo]];
    return { id: s.id, tipo, referenciaId, ...(await this.catalogo(tipo, referenciaId)), existencia: d.existencia ?? 0 };
  }

  async listar(filtro: FiltroItems): Promise<ItemInventario[]> {
    // Los catálogos se leen una vez y se cruzan en memoria.
    const [items, productos, pis, insumos, unidades] = await Promise.all([
      this.cliente.consultar(this.coleccion()),
      this.cliente.consultar(this.cliente.coleccion(COLECCION.productos)),
      this.cliente.consultar(this.cliente.coleccion(COLECCION.pis)),
      this.cliente.consultar(this.cliente.coleccion(COLECCION.insumos)),
      this.cliente.consultar(this.cliente.coleccion(COLECCION.unidadesMedida)),
    ]);
    const porId = (docs: DocumentSnapshot[]) => new Map(docs.map((x) => [x.id, x.data()!]));
    const catalogos: Record<TipoItem, Map<string, DocumentData>> = { PT: porId(productos.docs), PI: porId(pis.docs), INSUMO: porId(insumos.docs) };
    const unidad = porId(unidades.docs);
    const texto = filtro.texto?.trim().toLowerCase();

    return items.docs
      .map((s): ItemInventario => {
        const d = s.data();
        const tipo = d.tipo as TipoItem;
        const referenciaId = d[CAMPO_REFERENCIA[tipo]];
        const c = catalogos[tipo].get(referenciaId) ?? {};
        return { id: s.id, tipo, referenciaId, ...datosDelCatalogo(tipo, c, unidad), existencia: d.existencia ?? 0 };
      })
      .filter(
        (i) =>
          (!filtro.tipo || i.tipo === filtro.tipo) &&
          (!filtro.soloActivos || i.activo) &&
          (!texto || i.codigo.toLowerCase().includes(texto) || i.descripcion.toLowerCase().includes(texto)),
      )
      .sort((a, b) => a.tipo.localeCompare(b.tipo) || a.codigo.localeCompare(b.codigo));
  }

  async buscarPorId(id: string): Promise<ItemInventario | null> {
    return this.aDominio(await this.cliente.obtener(this.coleccion().doc(id)));
  }

  async buscarPorReferencia(tipo: TipoItem, referenciaId: string): Promise<ItemInventario | null> {
    const q = await this.cliente.consultar(this.coleccion().where(CAMPO_REFERENCIA[tipo], '==', referenciaId).limit(1));
    return q.empty ? null : this.aDominio(q.docs[0]);
  }

  /** Escritura pura: los datos del catálogo los trae el caso de uso. */
  async crear(tipo: TipoItem, referenciaId: string, catalogo: DatosDelCatalogo): Promise<ItemInventario> {
    const id = this.cliente.nuevoId(COLECCION.itemsInventario);
    await this.cliente.guardar(this.coleccion().doc(id), { tipo, [CAMPO_REFERENCIA[tipo]]: referenciaId, existencia: 0 });
    return { id, tipo, referenciaId, ...catalogo, existencia: 0 };
  }

  bloquearParaMovimiento(id: string): Promise<ItemInventario | null> {
    return this.buscarPorId(id);
  }

  async fijarExistencia(id: string, existencia: number): Promise<void> {
    await this.cliente.actualizar(this.coleccion().doc(id), { existencia });
  }
}

// ---------- Movimientos (kardex) ----------

function movimientoADominio(s: DocumentSnapshot): MovimientoInventario {
  const d = s.data()!;
  return {
    id: s.id,
    itemId: d.itemId,
    tipo: d.tipo,
    cantidad: d.cantidad,
    saldo: d.saldo,
    fechaHoraRegistro: aDate(d.fechaHoraRegistro),
    fechaOperativa: aDate(d.fechaOperativa),
    turnoId: d.turnoId,
    usuarioId: d.usuarioId,
    usuarioNombre: d.usuarioNombre,
    referencia: d.referencia ?? null,
    observacion: d.observacion ?? null,
    motivo: d.motivo ?? null,
    entradaId: d.entradaId ?? null,
    remisionId: d.remisionId ?? null,
    conteoTexto: d.conteoTexto ?? null,
    cierreId: d.cierreId ?? null,
  };
}

const masRecientePrimero = (a: MovimientoInventario, b: MovimientoInventario) =>
  b.fechaHoraRegistro.getTime() - a.fechaHoraRegistro.getTime();

export class MovimientoInventarioFirestoreRepository implements MovimientoInventarioRepository {
  constructor(private readonly cliente: ClienteFirestore) {}

  private coleccion() {
    return this.cliente.coleccion(COLECCION.movimientosInventario);
  }

  async crear(movimiento: NuevoMovimiento): Promise<MovimientoInventario> {
    const id = this.cliente.nuevoId(COLECCION.movimientosInventario);
    await this.cliente.guardar(this.coleccion().doc(id), {
      ...movimiento,
      fechaOperativaTexto: claveFecha(movimiento.fechaOperativa),
    });
    return { id, ...movimiento };
  }

  async listarPorEntrada(entradaId: string): Promise<MovimientoInventario[]> {
    const q = await this.cliente.consultar(this.coleccion().where('entradaId', '==', entradaId));
    return q.docs.map(movimientoADominio);
  }

  async listarPorItem(itemId: string, limite: number): Promise<MovimientoInventario[]> {
    const q = await this.cliente.consultar(this.coleccion().where('itemId', '==', itemId));
    return q.docs.map(movimientoADominio).sort(masRecientePrimero).slice(0, limite);
  }

  async listar(filtro: FiltroMovimientos): Promise<MovimientoInventario[]> {
    const q = await this.cliente.consultar(
      this.coleccion()
        .where('fechaOperativaTexto', '>=', claveFecha(filtro.desde))
        .where('fechaOperativaTexto', '<=', claveFecha(filtro.hasta)),
    );
    return q.docs
      .map(movimientoADominio)
      .filter((m) => !filtro.tipo || m.tipo === filtro.tipo)
      .sort(masRecientePrimero);
  }
}

// ---------- Recetas del PT ----------

function recetaADominio(s: DocumentSnapshot): RecetaPt {
  const d = s.data()!;
  return {
    id: s.id,
    productoId: d.productoId,
    version: d.version,
    vigenteDesde: aDate(d.vigenteDesde),
    creadaPorId: d.creadaPorId,
    creadaPorNombre: d.creadaPorNombre ?? '',
    componentes: d.componentes ?? [],
  };
}

/**
 * `recetas/{productoId}_v{version}` con los componentes embebidos. El id
 * determinista + `crearNuevo` impide dos versiones con el mismo número
 * (como la restricción única en PostgreSQL). Las versiones de un PT se
 * ordenan en memoria: son pocas y así no hace falta índice compuesto.
 */
export class RecetaFirestoreRepository implements RecetaRepository {
  constructor(private readonly cliente: ClienteFirestore) {}

  private coleccion() {
    return this.cliente.coleccion(COLECCION.recetas);
  }

  async versiones(productoId: string): Promise<RecetaPt[]> {
    const q = await this.cliente.consultar(this.coleccion().where('productoId', '==', productoId));
    return q.docs.map(recetaADominio).sort((a, b) => b.version - a.version);
  }

  async vigente(productoId: string): Promise<RecetaPt | null> {
    return (await this.versiones(productoId))[0] ?? null;
  }

  async vigentes(): Promise<RecetaPt[]> {
    const q = await this.cliente.consultar(this.coleccion());
    const vigentes = new Map<string, RecetaPt>();
    for (const r of q.docs.map(recetaADominio)) {
      const actual = vigentes.get(r.productoId);
      if (!actual || r.version > actual.version) vigentes.set(r.productoId, r);
    }
    return [...vigentes.values()];
  }

  async resumenVigentes(): Promise<ResumenReceta[]> {
    return (await this.vigentes()).map((r) => ({
      productoId: r.productoId,
      version: r.version,
      vigenteDesde: r.vigenteDesde,
      componentes: r.componentes.length,
    }));
  }

  /** Escritura pura (lecturas antes que escrituras). */
  async crear(receta: NuevaRecetaPt): Promise<RecetaPt> {
    const id = `${receta.productoId}_v${receta.version}`;
    await this.cliente.crearNuevo(this.coleccion().doc(id), receta);
    return { id, ...receta };
  }
}

// ---------- Cierres del día (conteo físico y merma) ----------

function cierreADominio(s: DocumentSnapshot): CierreInventario {
  const d = s.data()!;
  return {
    id: s.id,
    fechaOperativa: aDate(d.fechaOperativa),
    fechaHoraRegistro: aDate(d.fechaHoraRegistro),
    usuarioId: d.usuarioId,
    usuarioNombre: d.usuarioNombre,
    observacion: d.observacion ?? null,
    lineas: d.lineas ?? [],
  };
}

/**
 * `cierresInventario/{YYYY-MM-DD}` con las líneas embebidas. El id es la
 * fecha y se crea con `crearNuevo`: un segundo cierre del mismo día falla,
 * como la restricción única en PostgreSQL.
 */
export class CierreInventarioFirestoreRepository implements CierreInventarioRepository {
  constructor(private readonly cliente: ClienteFirestore) {}

  private coleccion() {
    return this.cliente.coleccion(COLECCION.cierresInventario);
  }

  async buscarPorFecha(fechaOperativa: Date): Promise<CierreInventario | null> {
    const s = await this.cliente.obtener(this.coleccion().doc(claveFecha(fechaOperativa)));
    return s.exists ? cierreADominio(s) : null;
  }

  async anteriorA(fechaOperativa: Date): Promise<CierreInventario | null> {
    const q = await this.cliente.consultar(
      this.coleccion().where('fechaOperativaTexto', '<', claveFecha(fechaOperativa)).orderBy('fechaOperativaTexto', 'desc').limit(1),
    );
    return q.empty ? null : cierreADominio(q.docs[0]);
  }

  async listar(desde: Date, hasta: Date): Promise<CierreInventario[]> {
    const q = await this.cliente.consultar(
      this.coleccion().where('fechaOperativaTexto', '>=', claveFecha(desde)).where('fechaOperativaTexto', '<=', claveFecha(hasta)),
    );
    return q.docs.map(cierreADominio).sort((a, b) => b.fechaOperativa.getTime() - a.fechaOperativa.getTime());
  }

  /** Escritura pura (lecturas antes que escrituras). */
  async crear(cierre: NuevoCierre): Promise<CierreInventario> {
    const id = claveFecha(cierre.fechaOperativa);
    await this.cliente.crearNuevo(this.coleccion().doc(id), { ...cierre, fechaOperativaTexto: id });
    return { id, ...cierre };
  }
}

// ---------- Entradas de mercancía ----------

function entradaADominio(s: DocumentSnapshot): EntradaMercancia {
  const d = s.data()!;
  return {
    id: s.id,
    documento: d.documento,
    remitente: d.remitente ?? null,
    observacion: d.observacion ?? null,
    fechaHoraRegistro: aDate(d.fechaHoraRegistro),
    fechaOperativa: aDate(d.fechaOperativa),
    turnoId: d.turnoId,
    usuarioId: d.usuarioId,
    usuarioNombre: d.usuarioNombre,
  };
}

/** `entradasMercancia/{id}`: solo el encabezado; las líneas son los movimientos con `entradaId`. */
export class EntradaMercanciaFirestoreRepository implements EntradaMercanciaRepository {
  constructor(private readonly cliente: ClienteFirestore) {}

  private coleccion() {
    return this.cliente.coleccion(COLECCION.entradasMercancia);
  }

  async crear(entrada: NuevaEntrada): Promise<EntradaMercancia> {
    const id = this.cliente.nuevoId(COLECCION.entradasMercancia);
    await this.cliente.guardar(this.coleccion().doc(id), { ...entrada, fechaOperativaTexto: claveFecha(entrada.fechaOperativa) });
    return { id, ...entrada };
  }

  async buscarPorId(id: string): Promise<EntradaMercancia | null> {
    const snap = await this.cliente.obtener(this.coleccion().doc(id));
    return snap.exists ? entradaADominio(snap) : null;
  }

  async listar(desde: Date, hasta: Date): Promise<EntradaMercancia[]> {
    const q = await this.cliente.consultar(
      this.coleccion().where('fechaOperativaTexto', '>=', claveFecha(desde)).where('fechaOperativaTexto', '<=', claveFecha(hasta)),
    );
    return q.docs.map(entradaADominio).sort((a, b) => b.fechaHoraRegistro.getTime() - a.fechaHoraRegistro.getTime());
  }
}
