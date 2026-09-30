/**
 * ÍTEM DE INVENTARIO — la existencia de un PT, PI o insumo
 * ========================================================
 *
 * Cada tipo tiene su catálogo en su propia tabla (usuario, 2026-09-29):
 *   PT       `producto` (se llama "PT" en pantallas; por dentro sigue
 *            siendo `producto`, opción A)
 *   PI       `pi`
 *   INSUMO   `insumo`
 *
 * El ítem de inventario apunta a exactamente UNO de los tres y guarda
 * solo la existencia. Código, descripción, unidad y "activo" se leen del
 * catálogo: no se duplican ni se desincronizan. Crear un PT, un PI o un
 * insumo crea su ítem en la misma transacción.
 *
 * `existencia` es la suma del kardex, en enteros (unidades cerradas). Se
 * guarda aquí porque es la fila que se bloquea para que dos movimientos
 * simultáneos no partan de la misma existencia, y en Firestore sumar el
 * kardex en cada movimiento crecería sin límite. Cada movimiento guarda
 * también el saldo que dejó, así que siempre se puede verificar.
 */

import type { Equivalencias } from './conteo.js';

export const TIPOS_ITEM = ['INSUMO', 'PI', 'PT'] as const;
export type TipoItem = (typeof TIPOS_ITEM)[number];

/** El PT se programa y se remisiona en cajas (área, 2026-09-17). */
export const UNIDAD_PT = 'CAJA';

export interface ItemInventario {
  id: string;
  tipo: TipoItem;
  /** Id en su catálogo: `producto`, `pi` o `insumo` según el tipo. */
  referenciaId: string;
  // Del catálogo:
  codigo: string;
  descripcion: string;
  /** Unidad base en que se cuenta: CAJA en el PT; la del PI o insumo. */
  unidadMedida: string;
  activo: boolean;
  /** Escalones para el conteo mixto (PI e insumos); null en el PT, que va en cajas. */
  equivalencias: Equivalencias | null;
  existencia: number;
}

/** Lo que el ítem toma de su catálogo. */
export interface DatosDelCatalogo {
  codigo: string;
  descripcion: string;
  unidadMedida: string;
  activo: boolean;
  equivalencias: Equivalencias | null;
}

export interface FiltroItems {
  tipo?: TipoItem;
  /** Busca en código y descripción (contiene, sin distinguir mayúsculas). */
  texto?: string;
  soloActivos?: boolean;
}

export interface ItemInventarioRepository {
  listar(filtro: FiltroItems): Promise<ItemInventario[]>;
  buscarPorId(id: string): Promise<ItemInventario | null>;
  buscarPorReferencia(tipo: TipoItem, referenciaId: string): Promise<ItemInventario | null>;
  /**
   * Crea el ítem (existencia 0) de un PT, PI o insumo recién creado en la
   * misma transacción. `catalogo` se pasa para no releerlo: en Firestore,
   * dentro de una transacción no se puede leer después de escribir.
   */
  crear(tipo: TipoItem, referenciaId: string, catalogo: DatosDelCatalogo): Promise<ItemInventario>;
  /**
   * Lee el ítem y lo BLOQUEA hasta que termine la transacción, para que
   * dos movimientos simultáneos no partan de la misma existencia. Solo
   * tiene sentido dentro de una unidad de trabajo.
   */
  bloquearParaMovimiento(id: string): Promise<ItemInventario | null>;
  fijarExistencia(id: string, existencia: number): Promise<void>;
}

export const ITEM_INVENTARIO_REPOSITORY = Symbol('ItemInventarioRepository');
