/**
 * ÍTEM DE INVENTARIO
 * ==================
 *
 * Todo lo que se cuenta en MQ (usuario, 2026-09-29): INSUMOS (cajas,
 * cintas, bolsas…), PI (producto intermedio, con lo que se hace el PT)
 * y PT (producto terminado).
 *
 * Un solo catálogo para los tres (opción A, aprobada 2026-09-29). El PT
 * NO repite código ni descripción: se enlaza al `producto` que ya usan
 * las remisiones, y esos datos se leen de allí. Así hay una sola verdad
 * sobre cada SKU.
 *
 * `existencia` es la suma de los movimientos (kardex). Se guarda también
 * en el ítem por dos razones: es la fila que se bloquea para que dos
 * salidas simultáneas no saquen la misma existencia, y en Firestore
 * sumar todo el kardex en cada movimiento crecería sin límite. Cada
 * movimiento guarda además el saldo que dejó, así que siempre se puede
 * verificar.
 *
 * No se elimina: se desactiva. El tipo y el producto enlazado no se
 * cambian después de crear (el kardex depende de ellos).
 *
 * Un solo módulo (usuario, 2026-09-29: "productos e inventario son un
 * solo apartado"): crear un producto crea su ítem de PT, y el PT toma
 * código, descripción y ACTIVO de su producto. Se activa o desactiva
 * desde el producto; así nunca quedan desincronizados.
 */

import { DatosInventarioInvalidosError } from './inventario.errors.js';

export const TIPOS_ITEM = ['INSUMO', 'PI', 'PT'] as const;
export type TipoItem = (typeof TIPOS_ITEM)[number];

/** El PT se programa y se remisiona en cajas (área, 2026-09-17). */
export const UNIDAD_PT = 'CAJA';

export interface ItemInventario {
  id: string;
  tipo: TipoItem;
  /** Del propio ítem (INSUMO, PI) o del producto enlazado (PT). */
  codigo: string;
  descripcion: string;
  unidadMedida: string;
  /** Solo PT: el producto del catálogo de remisiones. */
  productoId: string | null;
  existencia: number;
  activo: boolean;
}

/**
 * Lo que se guarda. En PT, `codigo` y `descripcion` van en null: salen
 * del producto enlazado.
 */
export interface DatosItem {
  tipo: TipoItem;
  codigo: string | null;
  descripcion: string | null;
  unidadMedida: string;
  productoId: string | null;
}

export type CambiosItem = Partial<Pick<DatosItem, 'codigo' | 'descripcion' | 'unidadMedida'>> & { activo?: boolean };

export function validarDatosItem(datos: DatosItem): DatosItem {
  const exigir = (condicion: boolean, mensaje: string): void => {
    if (!condicion) throw new DatosInventarioInvalidosError(mensaje);
  };

  exigir(TIPOS_ITEM.includes(datos.tipo), `El tipo debe ser uno de: ${TIPOS_ITEM.join(', ')}.`);

  const unidadMedida = datos.unidadMedida?.trim().toUpperCase() ?? '';
  exigir(unidadMedida.length > 0 && unidadMedida.length <= 20, 'La unidad de medida es obligatoria (máx. 20 caracteres).');

  if (datos.tipo === 'PT') {
    exigir(!!datos.productoId?.trim(), 'Un ítem de PT debe enlazarse a un producto del catálogo.');
    return { tipo: 'PT', codigo: null, descripcion: null, unidadMedida, productoId: datos.productoId!.trim() };
  }

  exigir(!datos.productoId, 'Solo el PT se enlaza a un producto.');
  const codigo = datos.codigo?.trim().toUpperCase() ?? '';
  exigir(/^[A-Z0-9._-]{1,40}$/.test(codigo), 'El código: 1 a 40 letras, números, punto, guion o guion bajo.');
  const descripcion = datos.descripcion?.trim() ?? '';
  exigir(descripcion.length > 0 && descripcion.length <= 200, 'La descripción es obligatoria (máx. 200 caracteres).');

  return { tipo: datos.tipo, codigo, descripcion, unidadMedida, productoId: null };
}

/** Lo que el PT toma de su producto. */
export interface ProductoDelPt {
  codigo: string;
  descripcion: string;
  activo: boolean;
}

/** Ítem de PT que se crea junto con su producto (un producto = un PT en el inventario). */
export function datosItemDePt(productoId: string): DatosItem {
  return { tipo: 'PT', codigo: null, descripcion: null, unidadMedida: UNIDAD_PT, productoId };
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
  /** Código propio de INSUMO / PI. */
  buscarPorCodigo(codigo: string): Promise<ItemInventario | null>;
  buscarPorProducto(productoId: string): Promise<ItemInventario | null>;
  /**
   * `producto`: para un PT recién creado en la misma transacción. Se pasa
   * para que el repositorio no tenga que releerlo (en Firestore, dentro
   * de una transacción no se puede leer después de escribir).
   */
  crear(datos: DatosItem, producto?: ProductoDelPt): Promise<ItemInventario>;
  actualizar(id: string, cambios: CambiosItem): Promise<ItemInventario>;
  /**
   * Lee el ítem y lo BLOQUEA hasta que termine la transacción, para que
   * dos movimientos simultáneos no partan de la misma existencia. Solo
   * tiene sentido dentro de una unidad de trabajo.
   */
  bloquearParaMovimiento(id: string): Promise<ItemInventario | null>;
  fijarExistencia(id: string, existencia: number): Promise<void>;
}

export const ITEM_INVENTARIO_REPOSITORY = Symbol('ItemInventarioRepository');
