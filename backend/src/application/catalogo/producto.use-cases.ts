/**
 * CASOS DE USO: PRODUCTOS
 * =======================
 *
 * Crear y actualizar productos del catálogo. Ambos dentro de la unidad
 * de trabajo con auditoría: el catálogo es la fuente de los snapshots
 * que firman las remisiones, así que cada cambio debe quedar rastreado.
 */

import {
  validarDatosProducto,
  type DatosNuevoProducto,
  type DatosProducto,
  type Producto,
} from '../../domain/producto/producto.repository.js';
import {
  CodigoProductoDuplicadoError,
  ProductoNoEncontradoError,
} from '../../domain/producto/producto.errors.js';
import type { UnidadDeTrabajo } from '../../domain/shared/unidad-de-trabajo.js';

/** Al crear se admiten los estándares (cajas/h, peso) de una vez, sin motivo: es el valor inicial. */
export interface CrearProductoComando extends DatosNuevoProducto {
  usuarioId: string;
}

export class CrearProductoUseCase {
  constructor(private readonly uow: UnidadDeTrabajo) {}

  async ejecutar(comando: CrearProductoComando): Promise<Producto> {
    const datos = validarDatosProducto(comando);

    return this.uow.ejecutar(async ({ productos, auditoria }) => {
      const existente = await productos.buscarPorCodigo(datos.codigo);
      if (existente) {
        throw new CodigoProductoDuplicadoError(datos.codigo);
      }

      const creado = await productos.crear(datos);

      await auditoria.registrar({
        entidad: 'producto',
        entidadId: creado.id,
        accion: 'CREAR',
        valorNuevo: creado,
        usuarioId: comando.usuarioId,
      });

      return creado;
    });
  }
}

function sinIndefinidos<T extends object>(objeto: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(objeto).filter(([, valor]) => valor !== undefined),
  ) as Partial<T>;
}

export interface ActualizarProductoComando {
  productoId: string;
  cambios: Partial<DatosProducto> & { activo?: boolean };
  usuarioId: string;
}

export class ActualizarProductoUseCase {
  constructor(private readonly uow: UnidadDeTrabajo) {}

  async ejecutar(comando: ActualizarProductoComando): Promise<Producto> {
    return this.uow.ejecutar(async ({ productos, auditoria }) => {
      const actual = await productos.buscarPorId(comando.productoId);
      if (!actual) {
        throw new ProductoNoEncontradoError(
          `No existe el producto "${comando.productoId}".`,
        );
      }

      // Se valida el producto COMPLETO resultante, no solo los campos que
      // cambian: así una edición parcial no puede dejar datos incoherentes.
      // `sinIndefinidos`: un DTO puede traer claves presentes con valor
      // `undefined`; no deben pisar los valores actuales.
      const { activo, ...cambiosDatos } = sinIndefinidos(comando.cambios);
      // Los estándares (cajas/h, peso) no se editan por aquí: tienen su
      // propio caso de uso con motivo obligatorio.
      const { cajasPorHora: _c, pesoNetoKg: _p, ...base } = actual;
      const datos = validarDatosProducto({ ...base, ...cambiosDatos });

      if (datos.codigo !== actual.codigo) {
        const otro = await productos.buscarPorCodigo(datos.codigo);
        if (otro && otro.id !== actual.id) {
          throw new CodigoProductoDuplicadoError(datos.codigo);
        }
      }

      const actualizado = await productos.actualizar(actual.id, {
        ...datos,
        ...(activo !== undefined ? { activo } : {}),
      });

      await auditoria.registrar({
        entidad: 'producto',
        entidadId: actualizado.id,
        accion: 'ACTUALIZAR',
        valorAnterior: actual,
        valorNuevo: actualizado,
        usuarioId: comando.usuarioId,
      });

      return actualizado;
    });
  }
}
