/**
 * ASISTENCIA DEL TURNO — Prisma
 * =============================
 */

import { Injectable } from '@nestjs/common';

import type {
  AsistenciaRepository,
  AsistenciaTurno,
  DatosAsistencia,
} from '../../../domain/mfr/asistencia-turno.js';
import type { ClientePrisma } from './cliente-prisma.js';

@Injectable()
export class AsistenciaPrismaRepository implements AsistenciaRepository {
  constructor(private readonly cliente: ClientePrisma) {}

  listarPorFecha(fechaOperativa: Date): Promise<AsistenciaTurno[]> {
    return this.cliente.asistenciaTurno.findMany({ where: { fechaOperativa }, orderBy: [{ turnoId: 'asc' }, { grupoId: 'asc' }] });
  }

  buscarPorIdentidad(fechaOperativa: Date, turnoId: string, grupoId: string): Promise<AsistenciaTurno | null> {
    return this.cliente.asistenciaTurno.findUnique({
      where: { fechaOperativa_turnoId_grupoId: { fechaOperativa, turnoId, grupoId } },
    });
  }

  guardar(datos: DatosAsistencia, registradaPorId: string, momento: Date): Promise<AsistenciaTurno> {
    const clave = { fechaOperativa: datos.fechaOperativa, turnoId: datos.turnoId, grupoId: datos.grupoId };
    const valores = { personasLlegaron: datos.personasLlegaron, observacion: datos.observacion, registradaPorId, fechaRegistro: momento };
    return this.cliente.asistenciaTurno.upsert({
      where: { fechaOperativa_turnoId_grupoId: clave },
      create: { ...clave, ...valores },
      update: valores,
    });
  }
}
