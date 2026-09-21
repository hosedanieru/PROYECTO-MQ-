/**
 * CASOS DE USO: GRUPOS
 * ====================
 *
 * Crear y actualizar grupos (antes "proveedores") desde el panel. Igual
 * que productos: sin eliminar (se desactiva), todo auditado.
 */

import {
  validarDatosGrupo,
  type DatosGrupo,
  type Grupo,
} from '../../domain/grupo/grupo.repository.js';
import { CodigoGrupoDuplicadoError, GrupoNoEncontradoError } from '../../domain/grupo/grupo.errors.js';
import type { UnidadDeTrabajo } from '../../domain/shared/unidad-de-trabajo.js';

export interface CrearGrupoComando extends DatosGrupo {
  usuarioId: string;
}

export class CrearGrupoUseCase {
  constructor(private readonly uow: UnidadDeTrabajo) {}

  async ejecutar(comando: CrearGrupoComando): Promise<Grupo> {
    const datos = validarDatosGrupo(comando);
    return this.uow.ejecutar(async ({ grupos, auditoria }) => {
      if (await grupos.buscarPorCodigo(datos.codigo)) {
        throw new CodigoGrupoDuplicadoError(datos.codigo);
      }
      const creado = await grupos.crear(datos);
      await auditoria.registrar({
        entidad: 'grupo',
        entidadId: creado.id,
        accion: 'CREAR',
        valorNuevo: creado,
        usuarioId: comando.usuarioId,
      });
      return creado;
    });
  }
}

export interface ActualizarGrupoComando {
  grupoId: string;
  cambios: Partial<DatosGrupo> & { activo?: boolean };
  usuarioId: string;
}

export class ActualizarGrupoUseCase {
  constructor(private readonly uow: UnidadDeTrabajo) {}

  async ejecutar(comando: ActualizarGrupoComando): Promise<Grupo> {
    return this.uow.ejecutar(async ({ grupos, auditoria }) => {
      const actual = await grupos.buscarPorId(comando.grupoId);
      if (!actual) {
        throw new GrupoNoEncontradoError(`No existe el grupo "${comando.grupoId}".`);
      }
      const { activo, ...cambios } = sinIndefinidos(comando.cambios);
      const datos = validarDatosGrupo({ ...actual, ...cambios });
      if (datos.codigo !== actual.codigo) {
        const otro = await grupos.buscarPorCodigo(datos.codigo);
        if (otro && otro.id !== actual.id) {
          throw new CodigoGrupoDuplicadoError(datos.codigo);
        }
      }
      const actualizado = await grupos.actualizar(actual.id, { ...datos, ...(activo !== undefined ? { activo } : {}) });
      await auditoria.registrar({
        entidad: 'grupo',
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

function sinIndefinidos<T extends object>(objeto: T): Partial<T> {
  return Object.fromEntries(Object.entries(objeto).filter(([, v]) => v !== undefined)) as Partial<T>;
}
