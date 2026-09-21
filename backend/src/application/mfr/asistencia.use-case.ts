/**
 * CASO DE USO: REGISTRAR ASISTENCIA DEL TURNO
 * ===========================================
 *
 * Cuántas personas de un grupo llegaron a un turno. Crea o corrige el
 * registro de (fecha, turno, grupo); la corrección se audita con el
 * valor anterior. Exige que el grupo exista y esté activo.
 */

import type { Reloj } from '../remision/crear-remision.use-case.js';
import { validarAsistencia, type AsistenciaTurno, type DatosAsistencia } from '../../domain/mfr/asistencia-turno.js';
import { GrupoNoEncontradoError } from '../../domain/grupo/grupo.errors.js';
import type { UnidadDeTrabajo } from '../../domain/shared/unidad-de-trabajo.js';

export interface RegistrarAsistenciaComando extends DatosAsistencia {
  usuarioId: string;
}

export class RegistrarAsistenciaUseCase {
  constructor(
    private readonly uow: UnidadDeTrabajo,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(comando: RegistrarAsistenciaComando): Promise<AsistenciaTurno> {
    const datos = validarAsistencia(comando);

    return this.uow.ejecutar(async ({ asistencias, grupos, auditoria }) => {
      const grupo = await grupos.buscarPorId(datos.grupoId);
      if (!grupo || !grupo.activo) {
        throw new GrupoNoEncontradoError(`El grupo "${datos.grupoId}" no existe o está inactivo.`);
      }

      const anterior = await asistencias.buscarPorIdentidad(datos.fechaOperativa, datos.turnoId, datos.grupoId);
      const guardada = await asistencias.guardar(datos, comando.usuarioId, this.reloj.ahora());

      await auditoria.registrar({
        entidad: 'asistencia_turno',
        entidadId: guardada.id,
        accion: anterior ? 'ACTUALIZAR' : 'CREAR',
        valorAnterior: anterior ? { personasLlegaron: anterior.personasLlegaron, observacion: anterior.observacion } : undefined,
        valorNuevo: { fechaOperativa: datos.fechaOperativa, turnoId: datos.turnoId, grupoId: datos.grupoId, personasLlegaron: datos.personasLlegaron, observacion: datos.observacion },
        usuarioId: comando.usuarioId,
      });
      return guardada;
    });
  }
}
