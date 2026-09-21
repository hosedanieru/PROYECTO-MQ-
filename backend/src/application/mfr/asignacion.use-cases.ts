/**
 * CASOS DE USO: ASIGNAR GRUPOS A LÍNEAS
 * =====================================
 *
 * Asignar: crea o corrige (fecha, turno, línea, grupo) con su número de
 * personas; exige grupo activo y línea existente. Quitar: elimina una
 * asignación por id. Ambos se auditan.
 */

import type { Reloj } from '../remision/crear-remision.use-case.js';
import { GrupoNoEncontradoError } from '../../domain/grupo/grupo.errors.js';
import {
  validarAsignacion,
  type AsignacionLinea,
  type DatosAsignacion,
} from '../../domain/mfr/asignacion-linea.js';
import { AsignacionNoEncontradaError, LineaNoEncontradaError } from '../../domain/mfr/mfr.errors.js';
import type { UnidadDeTrabajo } from '../../domain/shared/unidad-de-trabajo.js';

export interface AsignarGrupoLineaComando extends DatosAsignacion {
  usuarioId: string;
}

export class AsignarGrupoLineaUseCase {
  constructor(
    private readonly uow: UnidadDeTrabajo,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(comando: AsignarGrupoLineaComando): Promise<AsignacionLinea> {
    const datos = validarAsignacion(comando);

    return this.uow.ejecutar(async ({ asignaciones, grupos, lineas, auditoria }) => {
      const grupo = await grupos.buscarPorId(datos.grupoId);
      if (!grupo || !grupo.activo) {
        throw new GrupoNoEncontradoError(`El grupo "${datos.grupoId}" no existe o está inactivo.`);
      }
      const linea = await lineas.buscarPorId(datos.lineaId);
      if (!linea) {
        throw new LineaNoEncontradaError(`La línea "${datos.lineaId}" no existe.`);
      }

      const anterior = await asignaciones.buscarPorIdentidad(datos.fechaOperativa, datos.turnoId, datos.lineaId, datos.grupoId);
      const guardada = await asignaciones.guardar(datos, comando.usuarioId, this.reloj.ahora());

      await auditoria.registrar({
        entidad: 'asignacion_linea',
        entidadId: guardada.id,
        accion: anterior ? 'ACTUALIZAR' : 'CREAR',
        valorAnterior: anterior ? { personas: anterior.personas } : undefined,
        valorNuevo: { fechaOperativa: datos.fechaOperativa, turnoId: datos.turnoId, lineaId: datos.lineaId, grupoId: datos.grupoId, personas: datos.personas },
        usuarioId: comando.usuarioId,
      });
      return guardada;
    });
  }
}

export class QuitarAsignacionUseCase {
  constructor(private readonly uow: UnidadDeTrabajo) {}

  async ejecutar(id: string, usuarioId: string): Promise<void> {
    await this.uow.ejecutar(async ({ asignaciones, auditoria }) => {
      const actual = await asignaciones.buscarPorId(id);
      if (!actual) {
        throw new AsignacionNoEncontradaError(`La asignación "${id}" no existe.`);
      }
      await asignaciones.eliminar(id);
      await auditoria.registrar({
        entidad: 'asignacion_linea',
        entidadId: id,
        accion: 'ELIMINAR',
        valorAnterior: { fechaOperativa: actual.fechaOperativa, turnoId: actual.turnoId, lineaId: actual.lineaId, grupoId: actual.grupoId, personas: actual.personas },
        usuarioId,
      });
    });
  }
}
