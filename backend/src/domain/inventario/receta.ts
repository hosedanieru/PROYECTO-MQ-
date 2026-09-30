/**
 * RECETA DEL PT — lista de materiales
 * ===================================
 *
 * Qué PI e insumos lleva UNA caja de PT, en la medida exacta de cada
 * componente, con decimales (usuario, 2026-09-29):
 *
 *   12 UNIDAD de bolsa por caja     → { cantidad: 12 }
 *   1,8 METRO de cinta por caja     → { cantidad: 1.8 }
 *
 * Se descarta "1 rollo por cada N cajas": un rollo no se gasta por caja y
 * varía según el producto. Con la medida exacta, el PT descuenta lo que
 * de verdad gasta (cajas × cantidad).
 *
 * VERSIONADA (usuario, 2026-09-29): cada guardado crea una versión nueva
 * con fecha y autor; nunca se edita encima. La vigente es la de número
 * más alto. Motivo: el consumo teórico de una remisión de marzo debe
 * calcularse con la receta que regía en marzo, no con la de hoy.
 *
 * OBLIGATORIA para los PT nuevos (usuario, 2026-09-29): se crea con el
 * PT, en la misma transacción. Los PT que existían antes quedan "sin
 * receta" hasta que se digite.
 *
 * Los componentes apuntan al ítem de inventario del PI o insumo (no al
 * catálogo): así las alertas de agotado leen la existencia directamente.
 * La receta guarda solo la referencia y la equivalencia; código,
 * descripción y unidad se leen del ítem.
 */

import { DECIMALES_CANTIDAD, esCantidadPositiva, redondear } from './cantidad.js';
import { DatosInventarioInvalidosError, ItemInventarioNoEncontradoError } from './inventario.errors.js';
import type { ItemInventario, TipoItem } from './item-inventario.js';

/** Límite técnico, igual que las líneas de una entrada de mercancía. */
export const MAXIMO_COMPONENTES_RECETA = 30;
export const TIPOS_COMPONENTE = ['PI', 'INSUMO'] as const satisfies readonly TipoItem[];

export interface ComponenteReceta {
  /** Ítem de inventario del PI o del insumo. */
  itemId: string;
  /** Cuánto gasta UNA caja de PT, en la medida del componente (hasta 3 decimales). */
  cantidad: number;
}

export interface RecetaPt {
  id: string;
  productoId: string;
  version: number;
  vigenteDesde: Date;
  creadaPorId: string;
  /** Copia del nombre al guardar. */
  creadaPorNombre: string;
  componentes: ComponenteReceta[];
}

export type NuevaRecetaPt = Omit<RecetaPt, 'id'>;

/** Lo mínimo para listar qué PT tienen receta y cuál versión rige. */
export interface ResumenReceta {
  productoId: string;
  version: number;
  vigenteDesde: Date;
  componentes: number;
}

/** Forma de la lista: al menos un componente, cantidades positivas, sin repetidos. */
export function validarComponentes(componentes: ComponenteReceta[]): ComponenteReceta[] {
  if (componentes.length === 0) {
    throw new DatosInventarioInvalidosError('La receta del PT debe tener al menos un PI o insumo.');
  }
  if (componentes.length > MAXIMO_COMPONENTES_RECETA) {
    throw new DatosInventarioInvalidosError(`La receta admite máximo ${MAXIMO_COMPONENTES_RECETA} componentes.`);
  }
  const vistos = new Set<string>();
  for (const c of componentes) {
    if (!esCantidadPositiva(c.cantidad)) {
      throw new DatosInventarioInvalidosError(`La cantidad por caja debe ser mayor que cero, con máximo ${DECIMALES_CANTIDAD} decimales.`);
    }
    if (vistos.has(c.itemId)) {
      throw new DatosInventarioInvalidosError('Un mismo PI o insumo no puede ir dos veces en la receta.');
    }
    vistos.add(c.itemId);
  }
  return componentes.map(({ itemId, cantidad }) => ({ itemId, cantidad }));
}

/** Lo que gastan `cajas` cajas de PT de un componente, redondeado a 3 decimales. */
export function consumoDe(componente: ComponenteReceta, cajas: number): number {
  return redondear(componente.cantidad * cajas);
}

/**
 * Cada componente debe ser un PI o insumo que exista y esté activo en el
 * momento de guardar. (Si después se desactiva, la receta se conserva y
 * la alerta lo señala.)
 */
export function exigirComponentesValidos(componentes: ComponenteReceta[], items: Map<string, ItemInventario | null>): void {
  for (const c of componentes) {
    const item = items.get(c.itemId);
    if (!item) throw new ItemInventarioNoEncontradoError('Un componente de la receta no existe en el inventario.');
    if (!(TIPOS_COMPONENTE as readonly TipoItem[]).includes(item.tipo)) {
      throw new DatosInventarioInvalidosError(`"${item.codigo}" es un PT: la receta solo lleva PI e insumos.`);
    }
    if (!item.activo) {
      throw new DatosInventarioInvalidosError(`"${item.codigo}" está inactivo: no se puede usar en una receta nueva.`);
    }
  }
}

export interface RecetaRepository {
  /** La versión vigente (la de número más alto), o null si el PT no tiene receta. */
  vigente(productoId: string): Promise<RecetaPt | null>;
  /** Todas las versiones, la más reciente primero. */
  versiones(productoId: string): Promise<RecetaPt[]>;
  /** La versión vigente de cada PT que tiene receta. */
  resumenVigentes(): Promise<ResumenReceta[]>;
  /**
   * Escritura pura (regla de Firestore: lecturas antes que escrituras).
   * El número de versión lo decide el caso de uso; la base impide dos
   * versiones con el mismo número del mismo PT.
   */
  crear(receta: NuevaRecetaPt): Promise<RecetaPt>;
}

export const RECETA_REPOSITORY = Symbol('RecetaRepository');
