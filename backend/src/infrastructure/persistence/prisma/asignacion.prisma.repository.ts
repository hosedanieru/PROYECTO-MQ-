/**
 * ASIGNACIÓN DE GRUPOS A LÍNEAS — Prisma
 * ======================================
 */

import { Injectable } from '@nestjs/common';

import type {
  AsignacionLinea,
  AsignacionRepository,
  DatosAsignacion,
} from '../../../domain/mfr/asignacion-linea.js';
import type { ClientePrisma } from './cliente-prisma.js';

@Injectable()
export class AsignacionPrismaRepository implements AsignacionRepository {
  constructor(private readonly cliente: ClientePrisma) {}

  listarPorFecha(fechaOperativa: Date): Promise<AsignacionLinea[]> {
    return this.cliente.asignacionLinea.findMany({
      where: { fechaOperativa },
      orderBy: [{ turnoId: 'asc' }, { lineaId: 'asc' }, { grupoId: 'asc' }],
    });
  }

  buscarPorId(id: string): Promise<AsignacionLinea | null> {
    return this.cliente.asignacionLinea.findUnique({ where: { id } });
  }

  buscarPorIdentidad(fechaOperativa: Date, turnoId: string, lineaId: string, grupoId: string): Promise<AsignacionLinea | null> {
    return this.cliente.asignacionLinea.findUnique({
      where: { fechaOperativa_turnoId_lineaId_grupoId: { fechaOperativa, turnoId, lineaId, grupoId } },
    });
  }

  guardar(datos: DatosAsignacion, registradaPorId: string, momento: Date): Promise<AsignacionLinea> {
    const clave = { fechaOperativa: datos.fechaOperativa, turnoId: datos.turnoId, lineaId: datos.lineaId, grupoId: datos.grupoId };
    const valores = { personas: datos.personas, registradaPorId, fechaRegistro: momento };
    return this.cliente.asignacionLinea.upsert({
      where: { fechaOperativa_turnoId_lineaId_grupoId: clave },
      create: { ...clave, ...valores },
      update: valores,
    });
  }

  async eliminar(id: string): Promise<void> {
    await this.cliente.asignacionLinea.delete({ where: { id } });
  }
}
