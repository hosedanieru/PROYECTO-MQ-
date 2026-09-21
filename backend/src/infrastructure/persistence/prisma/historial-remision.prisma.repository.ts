import { Injectable } from '@nestjs/common';

import type {
  EntradaAuditoriaRemision,
  HistorialRemisionRepository,
  VersionRemision,
} from '../../../domain/remision/historial.repository.js';
import type { ClientePrisma } from './cliente-prisma.js';

const USUARIO = { select: { id: true, nombre: true } } as const;

@Injectable()
export class HistorialRemisionPrismaRepository implements HistorialRemisionRepository {
  constructor(private readonly cliente: ClientePrisma) {}

  async versiones(remisionId: string): Promise<VersionRemision[]> {
    const filas = await this.cliente.remisionVersion.findMany({
      where: { remisionId },
      orderBy: { version: 'asc' },
      include: { rectificadaPor: USUARIO },
    });
    return filas.map((f) => ({
      version: f.version,
      motivoRechazo: f.motivoRechazo,
      datosAnteriores: f.datosAnteriores,
      rectificadaPor: f.rectificadaPor,
      fechaRectificacion: f.fechaRectificacion,
    }));
  }

  async auditoria(remisionId: string): Promise<EntradaAuditoriaRemision[]> {
    const filas = await this.cliente.auditoria.findMany({
      where: { entidad: 'remision', entidadId: remisionId },
      orderBy: { creadoEn: 'asc' },
      include: { usuario: USUARIO },
    });
    return filas.map((f) => ({
      id: f.id,
      accion: f.accion,
      valorAnterior: f.valorAnterior,
      valorNuevo: f.valorNuevo,
      motivo: f.motivo,
      usuario: f.usuario,
      fecha: f.creadoEn,
    }));
  }
}
