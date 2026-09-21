/**
 * PRODUCTO — Catálogo
 * ===================
 *
 * El catálogo se administra desde el panel (decisión del 2026-09-16:
 * el administrador crea los productos uno a uno; la importación desde
 * Excel queda para después). Mañana podría sincronizarse desde SAP. Al
 * depender de esta interfaz y no de una tabla concreta, el dominio no
 * se entera del cambio.
 *
 *              DOMINIO
 *                 │
 *        ProductoRepository
 *                 │
 *        ┌────────┴─────────┐
 *        ↓                  ↓
 *   PrismaProductoRepo   SapSyncRepo (futuro)
 *
 * Los estándares de producción (`cajasPorHora`, `pesoNetoKg`) se pueden
 * indicar AL CREAR el producto (decisión del área, 2026-09-19: se cargan
 * desde el mismo formulario). Después son del módulo MFR: se editan con
 * permiso propio (`catalogo.editar_estandares`) y motivo obligatorio,
 * por eso `actualizar` no los recibe.
 */

import { DatosProductoInvalidosError } from './producto.errors.js';

export const PROCESOS_PRODUCTO = ['MANUAL', 'AUTOMATICA'] as const;
export type ProcesoProducto = (typeof PROCESOS_PRODUCTO)[number];

/** Vista del producto que necesita el dominio. */
export interface Producto {
  id: string;
  codigo: string;
  descripcion: string;
  proceso: ProcesoProducto | null;
  activo: boolean;
  unidadesPorCaja: number | null;
  cajasPorEstiba: number | null;
  /**
   * Personas necesarias en la línea para sacar la producción de ese SKU
   * (columna LINEA IDEAL de la hoja TIEMPOS; área, 2026-09-19). Es el
   * valor por defecto de `personasAsignadas` en los bloques del DPP.
   */
  personasIdeal: number | null;
  /** Familia del producto (SUBDESCRIPCION: SURTIDO, OFERTA, REEMPAQUE, MULTIPACK…). Agrupa el "Flavor Breakdown". */
  subdescripcion: string | null;
  /** Estándar de producción (solo lectura aquí; ver `domain/mfr/estandar-produccion.ts`). */
  cajasPorHora: number | null;
  pesoNetoKg: number | null;
}

/** Datos editables por el administrador. */
export interface DatosProducto {
  codigo: string;
  descripcion: string;
  proceso: ProcesoProducto | null;
  unidadesPorCaja: number | null;
  cajasPorEstiba: number | null;
  personasIdeal: number | null;
  subdescripcion: string | null;
}

/** Al crear se pueden indicar los estándares de una vez. */
export interface DatosNuevoProducto extends DatosProducto {
  cajasPorHora?: number | null;
  pesoNetoKg?: number | null;
}

export interface FiltroProductos {
  /** Búsqueda por código o descripción (contiene, sin distinguir mayúsculas). */
  texto?: string;
  /** `undefined` = todos; `true` = solo activos. */
  soloActivos?: boolean;
}

export interface ProductoRepository {
  buscarPorId(id: string): Promise<Producto | null>;
  buscarPorCodigo(codigo: string): Promise<Producto | null>;
  listar(filtro: FiltroProductos): Promise<Producto[]>;
  crear(datos: DatosNuevoProducto): Promise<Producto>;
  actualizar(
    id: string,
    cambios: Partial<DatosProducto> & { activo?: boolean },
  ): Promise<Producto>;
}

export const PRODUCTO_REPOSITORY = Symbol('ProductoRepository');

/**
 * Reglas de forma y coherencia de un producto. Viven aquí, no en el
 * DTO, para que apliquen también cuando el dato entre por un script o
 * por la importación futura.
 */
export function validarDatosProducto(datos: DatosProducto): DatosProducto;
export function validarDatosProducto(datos: DatosNuevoProducto): DatosNuevoProducto;
export function validarDatosProducto(datos: DatosNuevoProducto): DatosNuevoProducto {
  const exigir = (condicion: boolean, mensaje: string): void => {
    if (!condicion) {
      throw new DatosProductoInvalidosError(mensaje);
    }
  };

  const codigo = datos.codigo?.trim() ?? '';
  exigir(codigo.length > 0, 'El código del producto es obligatorio.');
  exigir(
    /^[A-Za-z0-9._-]{1,40}$/.test(codigo),
    'El código solo admite letras, números, punto, guion y guion bajo (máx. 40).',
  );

  const descripcion = datos.descripcion?.trim() ?? '';
  exigir(descripcion.length > 0, 'La descripción es obligatoria.');
  exigir(descripcion.length <= 200, 'La descripción no puede superar 200 caracteres.');

  if (datos.proceso !== null) {
    exigir(
      PROCESOS_PRODUCTO.includes(datos.proceso),
      `El proceso debe ser uno de: ${PROCESOS_PRODUCTO.join(', ')}.`,
    );
  }

  const enteroPositivoONulo = (valor: number | null, nombre: string): void => {
    if (valor !== null) {
      exigir(
        Number.isInteger(valor) && valor > 0,
        `${nombre} debe ser un entero mayor que cero.`,
      );
    }
  };
  enteroPositivoONulo(datos.unidadesPorCaja, 'Unidades por caja');
  enteroPositivoONulo(datos.cajasPorEstiba, 'Cajas por estiba');
  if (datos.personasIdeal !== null) {
    exigir(
      Number.isInteger(datos.personasIdeal) && datos.personasIdeal >= 0,
      'Las personas de línea ideal deben ser un entero mayor o igual a cero.',
    );
  }
  const subdescripcion = datos.subdescripcion?.trim().toUpperCase() || null;
  exigir(subdescripcion === null || subdescripcion.length <= 40, 'La subdescripción no puede superar 40 caracteres.');

  const positivoONulo = (valor: number | null | undefined, nombre: string): void => {
    if (valor !== null && valor !== undefined) {
      exigir(Number.isFinite(valor) && valor > 0, `${nombre} debe ser un número mayor que cero.`);
    }
  };
  positivoONulo(datos.cajasPorHora, 'Cajas por hora');
  positivoONulo(datos.pesoNetoKg, 'El peso neto por caja');

  return {
    codigo,
    descripcion,
    proceso: datos.proceso,
    unidadesPorCaja: datos.unidadesPorCaja,
    cajasPorEstiba: datos.cajasPorEstiba,
    personasIdeal: datos.personasIdeal,
    subdescripcion,
    ...(datos.cajasPorHora !== undefined ? { cajasPorHora: datos.cajasPorHora } : {}),
    ...(datos.pesoNetoKg !== undefined ? { pesoNetoKg: datos.pesoNetoKg } : {}),
  };
}
