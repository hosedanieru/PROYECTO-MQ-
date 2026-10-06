/**
 * AJUSTE DE PERSONAS ESPERADAS DEL DÍA — Prisma
 * =============================================
 */

import type {
  AjusteEsperadas,
  AjusteEsperadasRepository,
  DatosAjusteEsperadas,
} from '../../../domain/mfr/esperadas-personal.js';
import type { ClientePrisma } from './cliente-prisma.js';

export class AjusteEsperadasPrismaRepository implements AjusteEsperadasRepository {
  constructor(private readonly cliente: ClientePrisma) {}

  listarPorFecha(fechaOperativa: Date): Promise<AjusteEsperadas[]> {
    return this.cliente.ajusteEsperadas.findMany({ where: { fechaOperativa }, orderBy: [{ turnoId: 'asc' }, { grupoId: 'asc' }] });
  }

  guardar(datos: DatosAjusteEsperadas, usuarioId: string, momento: Date): Promise<AjusteEsperadas> {
    const clave = { fechaOperativa: datos.fechaOperativa, turnoId: datos.turnoId, grupoId: datos.grupoId };
    const valores = { personas: datos.personas, motivo: datos.motivo, usuarioId, fechaRegistro: momento };
    return this.cliente.ajusteEsperadas.upsert({
      where: { fechaOperativa_turnoId_grupoId: clave },
      create: { ...clave, ...valores },
      update: valores,
    });
  }
}
