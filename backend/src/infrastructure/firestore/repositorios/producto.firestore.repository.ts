/**
 * PRODUCTOS — Firestore
 * =====================
 *
 * Firestore no tiene búsqueda de texto ("contiene"). El catálogo es
 * pequeño (decenas a cientos de SKU), así que `listar` trae todo y
 * filtra en memoria. Si el catálogo creciera a miles, habría que
 * indexar aparte (Algolia u otro).
 */

import type { DocumentSnapshot } from 'firebase-admin/firestore';

import type {
  DatosNuevoProducto,
  DatosProducto,
  FiltroProductos,
  Producto,
  ProductoRepository,
} from '../../../domain/producto/producto.repository.js';
import { ahoraServidor, COLECCION, type ClienteFirestore } from '../cliente-firestore.js';

export class ProductoFirestoreRepository implements ProductoRepository {
  constructor(private readonly cliente: ClienteFirestore) {}

  async buscarPorId(id: string): Promise<Producto | null> {
    const snap = await this.cliente.obtener(this.cliente.coleccion(COLECCION.productos).doc(id));
    return snap.exists ? aDominio(snap) : null;
  }

  async buscarPorCodigo(codigo: string): Promise<Producto | null> {
    const q = await this.cliente.consultar(
      this.cliente.coleccion(COLECCION.productos).where('codigo', '==', codigo).limit(1),
    );
    return q.empty ? null : aDominio(q.docs[0]);
  }

  async listar(filtro: FiltroProductos): Promise<Producto[]> {
    const q = await this.cliente.consultar(this.cliente.coleccion(COLECCION.productos).orderBy('codigo'));
    const texto = filtro.texto?.trim().toLowerCase();
    return q.docs.map(aDominio).filter(
      (p) =>
        (!filtro.soloActivos || p.activo) &&
        (!texto || p.codigo.toLowerCase().includes(texto) || p.descripcion.toLowerCase().includes(texto)),
    );
  }

  async crear(datos: DatosNuevoProducto): Promise<Producto> {
    const id = this.cliente.nuevoId(COLECCION.productos);
    const documento = {
      ...datos,
      activo: true,
      cajasPorHora: datos.cajasPorHora ?? null,
      pesoNetoKg: datos.pesoNetoKg ?? null,
    };
    await this.cliente.guardar(this.cliente.coleccion(COLECCION.productos).doc(id), {
      ...documento,
      creadoEn: ahoraServidor(),
      actualizadoEn: ahoraServidor(),
    });
    return { id, ...documento };
  }

  async actualizar(
    id: string,
    cambios: Partial<DatosProducto> & { activo?: boolean },
  ): Promise<Producto> {
    const ref = this.cliente.coleccion(COLECCION.productos).doc(id);
    // El caso de uso ya leyó el producto antes; aquí solo se escribe y se
    // devuelve el resultado combinado (sin releer: regla de transacciones).
    const actual = await this.cliente.obtener(ref);
    await this.cliente.actualizar(ref, { ...cambios, actualizadoEn: ahoraServidor() });
    return { ...aDominio(actual), ...cambios };
  }
}

function aDominio(snap: DocumentSnapshot): Producto {
  const d = snap.data()!;
  return {
    id: snap.id,
    codigo: d.codigo,
    descripcion: d.descripcion,
    proceso: d.proceso ?? null,
    activo: d.activo ?? true,
    unidadesPorCaja: d.unidadesPorCaja ?? null,
    cajasPorEstiba: d.cajasPorEstiba ?? null,
    personasIdeal: d.personasIdeal ?? null,
    subdescripcion: d.subdescripcion ?? null,
    cajasPorHora: d.cajasPorHora ?? null,
    pesoNetoKg: d.pesoNetoKg ?? null,
  };
}
