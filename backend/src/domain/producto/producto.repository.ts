/**
 * PRODUCTO — Interfaz de consulta del catálogo
 * ============================================
 *
 * El catálogo se administra hoy desde el panel. Mañana podría
 * sincronizarse desde SAP. Al depender de esta interfaz y no de una
 * tabla concreta, el dominio no se entera del cambio.
 *
 *              DOMINIO
 *                 │
 *        ProductoRepository
 *                 │
 *        ┌────────┴─────────┐
 *        ↓                  ↓
 *   PrismaProductoRepo   SapSyncRepo (futuro)
 */

/** Vista del producto que necesita el dominio. */
export interface Producto {
  id: string;
  codigo: string;
  descripcion: string;
  activo: boolean;
  unidadesPorCaja: number | null;
  cajasPorEstiba: number | null;
}

export interface ProductoRepository {
  buscarPorId(id: string): Promise<Producto | null>;
  buscarPorCodigo(codigo: string): Promise<Producto | null>;
}

export const PRODUCTO_REPOSITORY = Symbol('ProductoRepository');
