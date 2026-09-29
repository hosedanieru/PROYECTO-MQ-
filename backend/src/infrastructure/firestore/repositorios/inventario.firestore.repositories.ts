/**
 * INVENTARIO — Firestore
 * ======================
 *
 *   itemsInventario/{id}         el ítem con su existencia
 *   movimientosInventario/{id}   el kardex
 *
 * El PT resuelve código y descripción leyendo el producto enlazado. El
 * "bloqueo" del ítem es la lectura dentro de la transacción: si otra
 * transacción lo modifica antes de confirmar, Firestore reintenta.
 *
 * Kardex de un ítem: consulta por `itemId` y orden en memoria (evita un
 * índice compuesto). Si un ítem llega a miles de movimientos, conviene
 * crear el índice (itemId, fechaHoraRegistro) y ordenar en la consulta.
 */

import type { DocumentData, DocumentSnapshot } from 'firebase-admin/firestore';

import type {
  CambiosItem,
  DatosItem,
  FiltroItems,
  ItemInventario,
  ItemInventarioRepository,
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
} from '../../../domain/inventario/movimiento-inventario.js';
import { aDate, claveFecha, COLECCION, type ClienteFirestore } from '../cliente-firestore.js';

type ProductoBasico = { codigo: string; descripcion: string };

function itemADominio(id: string, d: DocumentData, producto: ProductoBasico | null): ItemInventario {
  return {
    id,
    tipo: d.tipo,
    codigo: producto?.codigo ?? d.codigo ?? '',
    descripcion: producto?.descripcion ?? d.descripcion ?? '',
    unidadMedida: d.unidadMedida,
    productoId: d.productoId ?? null,
    existencia: d.existencia ?? 0,
    activo: d.activo ?? true,
  };
}

export class ItemInventarioFirestoreRepository implements ItemInventarioRepository {
  constructor(private readonly cliente: ClienteFirestore) {}

  private coleccion() {
    return this.cliente.coleccion(COLECCION.itemsInventario);
  }

  private async producto(productoId: string | null | undefined): Promise<ProductoBasico | null> {
    if (!productoId) return null;
    const snap = await this.cliente.obtener(this.cliente.coleccion(COLECCION.productos).doc(productoId));
    return snap.exists ? { codigo: snap.data()!.codigo, descripcion: snap.data()!.descripcion } : null;
  }

  private async aDominio(snap: DocumentSnapshot): Promise<ItemInventario | null> {
    if (!snap.exists) return null;
    const d = snap.data()!;
    return itemADominio(snap.id, d, await this.producto(d.productoId));
  }

  async listar(filtro: FiltroItems): Promise<ItemInventario[]> {
    const [items, productos] = await Promise.all([
      this.cliente.consultar(this.coleccion()),
      this.cliente.consultar(this.cliente.coleccion(COLECCION.productos)),
    ]);
    const porId = new Map(productos.docs.map((p) => [p.id, { codigo: p.data().codigo, descripcion: p.data().descripcion }]));
    const texto = filtro.texto?.trim().toLowerCase();
    return items.docs
      .map((s) => itemADominio(s.id, s.data(), s.data().productoId ? (porId.get(s.data().productoId) ?? null) : null))
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

  async buscarPorCodigo(codigo: string): Promise<ItemInventario | null> {
    const q = await this.cliente.consultar(this.coleccion().where('codigo', '==', codigo).limit(1));
    return q.empty ? null : this.aDominio(q.docs[0]);
  }

  async buscarPorProducto(productoId: string): Promise<ItemInventario | null> {
    const q = await this.cliente.consultar(this.coleccion().where('productoId', '==', productoId).limit(1));
    return q.empty ? null : this.aDominio(q.docs[0]);
  }

  async crear(datos: DatosItem): Promise<ItemInventario> {
    // Lectura antes de la escritura (regla de las transacciones de Firestore).
    const producto = await this.producto(datos.productoId);
    const id = this.cliente.nuevoId(COLECCION.itemsInventario);
    const documento = { ...datos, existencia: 0, activo: true };
    await this.cliente.guardar(this.coleccion().doc(id), documento);
    return itemADominio(id, documento, producto);
  }

  async actualizar(id: string, cambios: CambiosItem): Promise<ItemInventario> {
    const ref = this.coleccion().doc(id);
    const snap = await this.cliente.obtener(ref);
    const producto = await this.producto(snap.data()!.productoId);
    await this.cliente.actualizar(ref, cambios);
    return itemADominio(id, { ...snap.data(), ...cambios }, producto);
  }

  bloquearParaMovimiento(id: string): Promise<ItemInventario | null> {
    return this.buscarPorId(id);
  }

  async fijarExistencia(id: string, existencia: number): Promise<void> {
    await this.cliente.actualizar(this.coleccion().doc(id), { existencia });
  }
}

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
