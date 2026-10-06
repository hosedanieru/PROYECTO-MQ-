/**
 * FIRMAS DE REMISIÓN — Prisma
 * ===========================
 *
 * Solo se crean y se leen: una firma nunca se edita ni se borra. La
 * restricción única (remision, versión, tipo) impide dos firmas en la
 * misma casilla aunque dos personas firmen a la vez.
 */

import type {
  FirmaRemision,
  FirmaRemisionRepository,
  NuevaFirma,
  TipoFirma,
} from '../../../domain/remision/firma-remision.js';
import type { ClientePrisma } from './cliente-prisma.js';

export class FirmaRemisionPrismaRepository implements FirmaRemisionRepository {
  constructor(private readonly cliente: ClientePrisma) {}

  async listarPorRemision(remisionId: string): Promise<FirmaRemision[]> {
    const filas = await this.cliente.firmaRemision.findMany({ where: { remisionId }, orderBy: [{ version: 'asc' }, { fechaHora: 'asc' }] });
    return filas.map((f) => ({ ...f, tipo: f.tipo as TipoFirma }));
  }

  async crear(firma: NuevaFirma): Promise<FirmaRemision> {
    const f = await this.cliente.firmaRemision.create({ data: firma });
    return { ...f, tipo: f.tipo as TipoFirma };
  }
}
