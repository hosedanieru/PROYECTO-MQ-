/**
 * CASOS DE USO: CATÁLOGO DE INVENTARIO
 * ====================================
 *
 *   CrearUnidadUseCase / ActualizarUnidadUseCase       unidades de medida (lista desplegable)
 *   CrearMaterialUseCase / ActualizarMaterialUseCase   PI e insumos, cada uno en su tabla
 *
 * Crear un PI o insumo crea su ítem de inventario (existencia 0) en la
 * misma transacción, igual que crear un PT (ver producto.use-cases.ts).
 * El "activo" del ítem sale del catálogo: desactivar el material basta.
 * Todo auditado.
 */

import {
  CatalogoInventarioNoEncontradoError,
  ItemInventarioDuplicadoError,
} from '../../domain/inventario/inventario.errors.js';
import {
  validarDatosMaterial,
  type DatosMaterial,
  type Material,
  type TipoMaterial,
} from '../../domain/inventario/material.js';
import { validarDatosUnidad, type DatosUnidad, type UnidadMedida } from '../../domain/inventario/unidad-medida.js';
import type { ContextoTransaccional, UnidadDeTrabajo } from '../../domain/shared/unidad-de-trabajo.js';

const sinIndefinidos = <T extends object>(o: T): Partial<T> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;

// ---------- Unidades ----------

export class CrearUnidadUseCase {
  constructor(private readonly uow: UnidadDeTrabajo) {}

  async ejecutar(comando: DatosUnidad & { usuarioId: string }): Promise<UnidadMedida> {
    const datos = validarDatosUnidad(comando);
    return this.uow.ejecutar(async ({ unidadesMedida, auditoria }) => {
      if (await unidadesMedida.buscarPorCodigo(datos.codigo)) {
        throw new ItemInventarioDuplicadoError(`Ya existe la unidad "${datos.codigo}".`);
      }
      const creada = await unidadesMedida.crear(datos);
      await auditoria.registrar({ entidad: 'unidad_medida', entidadId: creada.id, accion: 'CREAR', valorNuevo: creada, usuarioId: comando.usuarioId });
      return creada;
    });
  }
}

export class ActualizarUnidadUseCase {
  constructor(private readonly uow: UnidadDeTrabajo) {}

  async ejecutar(comando: { unidadId: string; cambios: Partial<DatosUnidad> & { activo?: boolean }; usuarioId: string }): Promise<UnidadMedida> {
    return this.uow.ejecutar(async ({ unidadesMedida, auditoria }) => {
      const actual = await unidadesMedida.buscarPorId(comando.unidadId);
      if (!actual) throw new CatalogoInventarioNoEncontradoError('La unidad de medida no existe.');
      const { activo, ...cambios } = sinIndefinidos(comando.cambios);
      const datos = validarDatosUnidad({ ...actual, ...cambios });
      if (datos.codigo !== actual.codigo) {
        const otra = await unidadesMedida.buscarPorCodigo(datos.codigo);
        if (otra && otra.id !== actual.id) throw new ItemInventarioDuplicadoError(`Ya existe la unidad "${datos.codigo}".`);
      }
      const actualizada = await unidadesMedida.actualizar(actual.id, { ...datos, ...(activo !== undefined ? { activo } : {}) });
      await auditoria.registrar({
        entidad: 'unidad_medida',
        entidadId: actual.id,
        accion: 'ACTUALIZAR',
        valorAnterior: actual,
        valorNuevo: actualizada,
        usuarioId: comando.usuarioId,
      });
      return actualizada;
    });
  }
}

// ---------- PI e insumos ----------

/** La unidad base debe existir y estar activa. */
async function exigirUnidad(ctx: ContextoTransaccional, unidadId: string): Promise<UnidadMedida> {
  const unidad = await ctx.unidadesMedida.buscarPorId(unidadId);
  if (!unidad || !unidad.activo) throw new CatalogoInventarioNoEncontradoError('La unidad de medida no existe o está inactiva.');
  return unidad;
}

export interface CrearMaterialComando extends DatosMaterial {
  tipo: TipoMaterial;
  usuarioId: string;
}

export class CrearMaterialUseCase {
  constructor(private readonly uow: UnidadDeTrabajo) {}

  async ejecutar(comando: CrearMaterialComando): Promise<Material> {
    const datos = validarDatosMaterial(comando);
    return this.uow.ejecutar(async (ctx) => {
      // Lecturas primero (regla de Firestore).
      const unidad = await exigirUnidad(ctx, datos.unidadBaseId);
      const presentacion = datos.presentacionId ? await exigirUnidad(ctx, datos.presentacionId) : null;
      const repetido = await ctx.materiales.buscarPorCodigo(datos.codigo);
      if (repetido) {
        throw new ItemInventarioDuplicadoError(`El código "${datos.codigo}" ya existe como ${repetido.tipo}.`);
      }

      // Las unidades ya se leyeron: se completan aquí (Firestore no relee tras escribir).
      const creado = {
        ...(await ctx.materiales.crear(comando.tipo, datos)),
        unidadBase: unidad.codigo,
        presentacion: presentacion?.codigo ?? null,
      };
      // Todo PI e insumo nace con su existencia (0) en el inventario.
      const item = await ctx.itemsInventario.crear(comando.tipo, creado.id, {
        codigo: creado.codigo,
        descripcion: creado.descripcion,
        unidadMedida: unidad.codigo,
        activo: true,
        equivalencias: {
          presentacion: creado.presentacion,
          contenidoPresentacion: creado.contenidoPresentacion,
          unidadesPorCaja: creado.unidadesPorCaja,
          cajasPorEstiba: creado.cajasPorEstiba,
        },
      });
      await ctx.auditoria.registrar({ entidad: comando.tipo.toLowerCase(), entidadId: creado.id, accion: 'CREAR', valorNuevo: creado, usuarioId: comando.usuarioId });
      await ctx.auditoria.registrar({ entidad: 'item_inventario', entidadId: item.id, accion: 'CREAR', valorNuevo: item, usuarioId: comando.usuarioId });
      return creado;
    });
  }
}

export interface ActualizarMaterialComando {
  tipo: TipoMaterial;
  materialId: string;
  cambios: Partial<DatosMaterial> & { activo?: boolean };
  usuarioId: string;
}

export class ActualizarMaterialUseCase {
  constructor(private readonly uow: UnidadDeTrabajo) {}

  async ejecutar(comando: ActualizarMaterialComando): Promise<Material> {
    return this.uow.ejecutar(async (ctx) => {
      const actual = await ctx.materiales.buscarPorId(comando.tipo, comando.materialId);
      if (!actual) throw new CatalogoInventarioNoEncontradoError(`No existe el ${comando.tipo === 'PI' ? 'PI' : 'insumo'}.`);
      const { activo, ...cambios } = sinIndefinidos(comando.cambios);
      // Se revalida el material completo con los cambios aplicados.
      const datos = validarDatosMaterial({ ...actual, ...cambios });
      if (datos.unidadBaseId !== actual.unidadBaseId) await exigirUnidad(ctx, datos.unidadBaseId);
      if (datos.presentacionId && datos.presentacionId !== actual.presentacionId) await exigirUnidad(ctx, datos.presentacionId);
      if (datos.codigo !== actual.codigo) {
        const otro = await ctx.materiales.buscarPorCodigo(datos.codigo);
        if (otro && otro.id !== actual.id) throw new ItemInventarioDuplicadoError(`El código "${datos.codigo}" ya existe como ${otro.tipo}.`);
      }
      const actualizado = await ctx.materiales.actualizar(comando.tipo, actual.id, { ...datos, ...(activo !== undefined ? { activo } : {}) });
      await ctx.auditoria.registrar({
        entidad: comando.tipo.toLowerCase(),
        entidadId: actual.id,
        accion: 'ACTUALIZAR',
        valorAnterior: actual,
        valorNuevo: actualizado,
        usuarioId: comando.usuarioId,
      });
      return actualizado;
    });
  }
}
