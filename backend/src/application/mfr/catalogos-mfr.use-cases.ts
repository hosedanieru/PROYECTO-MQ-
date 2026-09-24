/**
 * CASOS DE USO: LÍNEAS DE PRODUCCIÓN Y ESTÁNDARES
 * ===============================================
 *
 * Catálogos que alimentan el cálculo de capacidad. El estándar de un
 * producto (BPM y peso neto) lo edita solo el administrador y con
 * motivo: es la base de la meta y no puede cambiar sin rastro.
 */

import {
  MAXIMO_ESTANDARES_POR_LOTE,
  validarEstandar,
  type CambioEstandarLote,
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

export interface ActualizarEstandaresEnLoteComando {
  cambios: CambioEstandarLote[];
  /** Un solo motivo para todo el lote; se copia en cada registro de auditoría. */
  motivo: string;
  usuarioId: string;
}

export interface ResultadoLoteEstandares {
  actualizados: EstandarProducto[];
  /** Los que venían con valores iguales a los que ya tenían: no se tocaron ni se auditaron. */
  sinCambios: string[];
}

/**
 * CARGA DE ESTÁNDARES EN LOTE
 * ===========================
 *
 * Pensado para el caso real: el administrador confirma de una vez el
 * peso neto por caja de los productos del DPP (el sistema lo sugiere
 * desde la descripción, él decide cuáles acepta). Sin peso no hay
 * kilogramos en el tablero.
 *
 * Todo el lote va en UNA transacción: o entran todos los cambios con su
 * auditoría, o no entra ninguno. El orden de las operaciones no es
 * casual — primero TODAS las lecturas y después TODAS las escrituras —
 * porque así lo exige una transacción de Firestore.
 *
 * Lo que no se envía no se toca: un lote de pesos no puede borrar las
 * cajas/hora del catálogo.
 */
export class ActualizarEstandaresEnLoteUseCase {
  constructor(private readonly uow: UnidadDeTrabajo) {}

  async ejecutar(comando: ActualizarEstandaresEnLoteComando): Promise<ResultadoLoteEstandares> {
    if (!comando.motivo?.trim()) {
      throw new MotivoObligatorioError();
    }
    if (comando.cambios.length === 0) {
      throw new DatosMfrInvalidosError('El lote no trae ningún producto.');
    }
    if (comando.cambios.length > MAXIMO_ESTANDARES_POR_LOTE) {
      throw new DatosMfrInvalidosError(
        `Un lote admite como máximo ${MAXIMO_ESTANDARES_POR_LOTE} productos y llegaron ${comando.cambios.length}.`,
      );
    }
    const repetidos = idsRepetidos(comando.cambios.map((c) => c.productoId));
    if (repetidos.length > 0) {
      throw new DatosMfrInvalidosError(
        `El lote trae el mismo producto más de una vez: ${repetidos.join(', ')}. No se puede saber cuál valor manda.`,
      );
    }

    const motivo = comando.motivo.trim();

    return this.uow.ejecutar(async ({ estandares, auditoria }) => {
      // ---------- 1) Todas las lecturas ----------
      const actuales = await estandares.listar();
      const actualDe = new Map(actuales.map((e) => [e.productoId, e]));

      const desconocidos = comando.cambios.map((c) => c.productoId).filter((id) => !actualDe.has(id));
      if (desconocidos.length > 0) {
        throw new DatosMfrInvalidosError(
          `Estos productos no existen o están inactivos: ${desconocidos.join(', ')}.`,
        );
      }

      // Lo que no viene en el cambio conserva su valor actual.
      const propuestos = comando.cambios.map((cambio) => {
        const actual = actualDe.get(cambio.productoId)!;
        const datos = validarEstandar({
          cajasPorHora: cambio.cajasPorHora === undefined ? actual.cajasPorHora : cambio.cajasPorHora,
          pesoNetoKg: cambio.pesoNetoKg === undefined ? actual.pesoNetoKg : cambio.pesoNetoKg,
        });
        return { actual, datos };
      });

      const efectivos = propuestos.filter(({ actual, datos }) => cambiaElEstandar(actual, datos));
      const sinCambios = propuestos
        .filter(({ actual, datos }) => !cambiaElEstandar(actual, datos))
        .map(({ actual }) => actual.codigo);

      if (efectivos.length === 0) {
        return { actualizados: [], sinCambios };
      }

      // ---------- 2) Todas las escrituras ----------
      await estandares.actualizarVarios(
        efectivos.map(({ actual, datos }) => ({ productoId: actual.productoId, datos })),
      );

      for (const { actual, datos } of efectivos) {
        await auditoria.registrar({
          entidad: 'producto',
          entidadId: actual.productoId,
          accion: 'ACTUALIZAR',
          valorAnterior: { cajasPorHora: actual.cajasPorHora, pesoNetoKg: actual.pesoNetoKg },
          valorNuevo: { cajasPorHora: datos.cajasPorHora, pesoNetoKg: datos.pesoNetoKg },
          motivo,
          usuarioId: comando.usuarioId,
        });
      }

      // El repositorio no relee (no puede); el resultado se compone aquí.
      return {
        actualizados: efectivos.map(({ actual, datos }) => ({ ...actual, ...datos })),
        sinCambios,
      };
    });
  }
}

function cambiaElEstandar(actual: EstandarProducto, datos: DatosEstandar): boolean {
  return actual.cajasPorHora !== datos.cajasPorHora || actual.pesoNetoKg !== datos.pesoNetoKg;
}

function idsRepetidos(ids: string[]): string[] {
  const vistos = new Set<string>();
  return [...new Set(ids.filter((id) => (vistos.has(id) ? true : (vistos.add(id), false))))];
}

function sinIndefinidos<T extends object>(objeto: T): Partial<T> {
  return Object.fromEntries(Object.entries(objeto).filter(([, v]) => v !== undefined)) as Partial<T>;
}
