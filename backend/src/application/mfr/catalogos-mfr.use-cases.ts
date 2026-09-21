/**
 * CASOS DE USO: LÍNEAS DE PRODUCCIÓN Y ESTÁNDARES
 * ===============================================
 *
 * Catálogos que alimentan el cálculo de capacidad. El estándar de un
 * producto (BPM y peso neto) lo edita solo el administrador y con
 * motivo: es la base de la meta y no puede cambiar sin rastro.
 */

import {
  validarEstandar,
  type DatosEstandar,
  type EstandarProducto,
} from '../../domain/mfr/estandar-produccion.js';
import {
  validarLinea,
  type DatosLinea,
  type LineaProduccion,
} from '../../domain/mfr/linea-produccion.js';
import {
  CodigoLineaDuplicadoError,
  DatosMfrInvalidosError,
  LineaNoEncontradaError,
  MotivoObligatorioError,
} from '../../domain/mfr/mfr.errors.js';
import type { UnidadDeTrabajo } from '../../domain/shared/unidad-de-trabajo.js';

export class CrearLineaUseCase {
  constructor(private readonly uow: UnidadDeTrabajo) {}

  async ejecutar(datos: DatosLinea, usuarioId: string): Promise<LineaProduccion> {
    const validos = validarLinea(datos);
    return this.uow.ejecutar(async ({ lineas, auditoria }) => {
      if (await lineas.buscarPorCodigo(validos.codigo)) {
        throw new CodigoLineaDuplicadoError(validos.codigo);
      }
      const creada = await lineas.crear(validos);
      await auditoria.registrar({
        entidad: 'linea_produccion',
        entidadId: creada.id,
        accion: 'CREAR',
        valorNuevo: creada,
        usuarioId,
      });
      return creada;
    });
  }
}

export class ActualizarLineaUseCase {
  constructor(private readonly uow: UnidadDeTrabajo) {}

  async ejecutar(
    id: string,
    cambios: Partial<DatosLinea> & { activo?: boolean },
    usuarioId: string,
  ): Promise<LineaProduccion> {
    return this.uow.ejecutar(async ({ lineas, auditoria }) => {
      const actual = await lineas.buscarPorId(id);
      if (!actual) {
        throw new LineaNoEncontradaError(`No existe la línea "${id}".`);
      }
      const { activo, ...datos } = cambios;
      const validos = validarLinea({ ...actual, ...sinIndefinidos(datos) });
      if (validos.codigo !== actual.codigo) {
        const otra = await lineas.buscarPorCodigo(validos.codigo);
        if (otra && otra.id !== id) {
          throw new CodigoLineaDuplicadoError(validos.codigo);
        }
      }
      const actualizada = await lineas.actualizar(id, {
        ...validos,
        ...(activo !== undefined ? { activo } : {}),
      });
      await auditoria.registrar({
        entidad: 'linea_produccion',
        entidadId: id,
        accion: 'ACTUALIZAR',
        valorAnterior: actual,
        valorNuevo: actualizada,
        usuarioId,
      });
      return actualizada;
    });
  }
}

export interface ActualizarEstandarComando extends DatosEstandar {
  productoId: string;
  motivo: string;
  usuarioId: string;
}

export class ActualizarEstandarUseCase {
  constructor(private readonly uow: UnidadDeTrabajo) {}

  async ejecutar(comando: ActualizarEstandarComando): Promise<EstandarProducto> {
    if (!comando.motivo?.trim()) {
      throw new MotivoObligatorioError();
    }
    const datos = validarEstandar(comando);

    return this.uow.ejecutar(async ({ estandares, auditoria }) => {
      const anterior = await estandares.buscarPorProducto(comando.productoId);
      if (!anterior) {
        throw new DatosMfrInvalidosError(`No existe el producto "${comando.productoId}".`);
      }
      const actualizado = await estandares.actualizar(comando.productoId, datos);
      await auditoria.registrar({
        entidad: 'producto',
        entidadId: comando.productoId,
        accion: 'ACTUALIZAR',
        valorAnterior: { cajasPorHora: anterior.cajasPorHora, pesoNetoKg: anterior.pesoNetoKg },
        valorNuevo: { cajasPorHora: actualizado.cajasPorHora, pesoNetoKg: actualizado.pesoNetoKg },
        motivo: comando.motivo.trim(),
        usuarioId: comando.usuarioId,
      });
      return actualizado;
    });
  }
}

function sinIndefinidos<T extends object>(objeto: T): Partial<T> {
  return Object.fromEntries(Object.entries(objeto).filter(([, v]) => v !== undefined)) as Partial<T>;
}
