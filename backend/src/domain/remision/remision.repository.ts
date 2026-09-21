/**
 * INTERFAZ DEL REPOSITORIO DE REMISIONES
 * ======================================
 *
 * El dominio declara QUÉ necesita; la infraestructura decide CÓMO.
 *
 *              DOMINIO
 *                 │
 *        RemisionRepository (esta interfaz)
 *                 │
 *        ┌────────┴─────────┐
 *        ↓                  ↓
 *  PrismaRemisionRepo   OtroRepo (futuro)
 *        │                  │
 *   PostgreSQL           Mongo / Firebase
 *
 * Gracias a esto, cambiar de base de datos no obliga a reescribir las
 * reglas del negocio.
 */

import type { EstadoRemision, Remision } from './remision.entity.js';

/** Criterios de búsqueda de remisiones. */
export interface FiltroRemisiones {
  anio?: number;
  fechaOperativaDesde?: Date;
  fechaOperativaHasta?: Date;
  turnoId?: string;
  grupoId?: string;
  productoId?: string;
  estado?: EstadoRemision;
  pagina?: number;
  porPagina?: number;
}

export interface ResultadoPaginado<T> {
  items: T[];
  total: number;
  pagina: number;
  porPagina: number;
}

export interface RemisionRepository {
  /**
   * Reserva el siguiente número consecutivo del año y persiste la
   * remisión, todo dentro de una misma transacción.
   *
   * La reserva del consecutivo debe hacerse con bloqueo de fila
   * (SELECT ... FOR UPDATE) sobre la tabla de consecutivos. Sin eso, dos
   * coordinadores creando remisiones al mismo tiempo obtendrían el mismo
   * número — inaceptable en un documento con valor legal.
   *
   * Por esa razón el número NO lo asigna el caso de uso: lo asigna el
   * repositorio, que es quien controla la transacción.
   */
  crearConConsecutivo(
    construir: (anio: number, numero: number) => Remision,
    anio: number,
  ): Promise<Remision>;

  /** Guarda los cambios de una remisión existente. */
  actualizar(remision: Remision): Promise<Remision>;

  /**
   * Registra una nueva versión del documento tras una rectificación,
   * conservando el estado anterior y el motivo del rechazo.
   */
  registrarVersion(parametros: {
    remisionId: string;
    version: number;
    motivoRechazo: string | null;
    datosAnteriores: unknown;
    rectificadaPorId: string;
  }): Promise<void>;

  buscarPorId(id: string): Promise<Remision | null>;

  buscarPorConsecutivo(anio: number, numero: number): Promise<Remision | null>;

  listar(filtro: FiltroRemisiones): Promise<ResultadoPaginado<Remision>>;

  /**
   * Todas las remisiones que cumplen el filtro, sin paginar, en orden
   * cronológico (fecha operativa y número ascendentes). Para exportar e
   * imprimir por lote. La implementación pone un tope de seguridad.
   */
  listarTodas(filtro: Omit<FiltroRemisiones, 'pagina' | 'porPagina'>): Promise<Remision[]>;

  /** Varias remisiones por id, en el orden pedido; omite las que no existan. */
  buscarPorIds(ids: string[]): Promise<Remision[]>;

  /**
   * Cajas remisionadas en un día operativo, agrupadas por turno, producto
   * y si son extraoficiales, contando solo los estados indicados.
   * Alimenta el MFR (que excluye las extraoficiales) y el tope de lo
   * programado.
   */
  totalizarCajas(fechaOperativa: Date, estados: readonly EstadoRemision[]): Promise<CajasAgrupadas[]>;
}

export interface CajasAgrupadas {
  turnoId: string;
  productoId: string;
  extraoficial: boolean;
  cajas: number;
}

/** Token de inyección de dependencias. */
export const REMISION_REPOSITORY = Symbol('RemisionRepository');
