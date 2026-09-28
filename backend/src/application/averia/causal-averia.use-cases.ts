/**
 * CASOS DE USO: CAUSALES DE AVERÍA
 * ================================
 *
 * Crear y actualizar causales desde el panel. Igual que grupos: sin
 * eliminar (se desactiva), código único, todo auditado.
 */

import { CausalNoEncontradaError, CodigoCausalDuplicadoError } from '../../domain/averia/averia.errors.js';
import { validarDatosCausal, type CausalAveria, type DatosCausal } from '../../domain/averia/causal-averia.js';
import type { UnidadDeTrabajo } from '../../domain/shared/unidad-de-trabajo.js';

export interface CrearCausalComando extends DatosCausal {
  usuarioId: string;
}

export class CrearCausalUseCase {
  constructor(private readonly uow: UnidadDeTrabajo) {}

  async ejecutar(comando: CrearCausalComando): Promise<CausalAveria> {
    const datos = validarDatosCausal(comando);
    return this.uow.ejecutar(async ({ causales, auditoria }) => {
      if (await causales.buscarPorCodigo(datos.codigo)) {
        throw new CodigoCausalDuplicadoError(datos.codigo);
      }
      const creada = await causales.crear(datos);
      await auditoria.registrar({
        entidad: 'causal_averia',
        entidadId: creada.id,
        accion: 'CREAR',
        valorNuevo: creada,
        usuarioId: comando.usuarioId,
      });
      return creada;
    });
  }
}

export interface ActualizarCausalComando {
  causalId: string;
  cambios: Partial<DatosCausal> & { activo?: boolean };
  usuarioId: string;
}

export class ActualizarCausalUseCase {
  constructor(private readonly uow: UnidadDeTrabajo) {}

  async ejecutar(comando: ActualizarCausalComando): Promise<CausalAveria> {
    return this.uow.ejecutar(async ({ causales, auditoria }) => {
      const actual = await causales.buscarPorId(comando.causalId);
      if (!actual) {
        throw new CausalNoEncontradaError(`No existe la causal "${comando.causalId}".`);
      }
      const { activo, ...cambios } = sinIndefinidos(comando.cambios);
      const datos = validarDatosCausal({ ...actual, ...cambios });
      if (datos.codigo !== actual.codigo) {
        const otra = await causales.buscarPorCodigo(datos.codigo);
        if (otra && otra.id !== actual.id) {
          throw new CodigoCausalDuplicadoError(datos.codigo);
        }
      }
      const actualizada = await causales.actualizar(actual.id, { ...datos, ...(activo !== undefined ? { activo } : {}) });
      await auditoria.registrar({
        entidad: 'causal_averia',
        entidadId: actualizada.id,
        accion: 'ACTUALIZAR',
        valorAnterior: actual,
        valorNuevo: actualizada,
        usuarioId: comando.usuarioId,
      });
      return actualizada;
    });
  }
}

function sinIndefinidos<T extends object>(objeto: T): Partial<T> {
  return Object.fromEntries(Object.entries(objeto).filter(([, v]) => v !== undefined)) as Partial<T>;
}
