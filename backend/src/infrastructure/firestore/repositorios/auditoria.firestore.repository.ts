/**
 * AUDITORÍA — Firestore
 * =====================
 *
 * Misma regla que en Prisma: sin try/catch. Si registrar falla dentro
 * de la transacción, la operación completa se revierte.
 */

import type {
  AuditoriaRepository,
  EntradaAuditoria,
} from '../../../domain/auditoria/auditoria.repository.js';
import { ahoraServidor, COLECCION, type ClienteFirestore } from '../cliente-firestore.js';

export class AuditoriaFirestoreRepository implements AuditoriaRepository {
  constructor(private readonly cliente: ClienteFirestore) {}

  async registrar(entrada: EntradaAuditoria): Promise<void> {
    if (!entrada.usuarioId?.trim()) {
      throw new Error('La auditoría requiere el usuario que ejecuta la acción.');
    }
    const id = this.cliente.nuevoId(COLECCION.auditoria);
    await this.cliente.guardar(this.cliente.coleccion(COLECCION.auditoria).doc(id), {
      entidad: entrada.entidad,
      entidadId: entrada.entidadId,
      accion: entrada.accion,
      valorAnterior: aJson(entrada.valorAnterior),
      valorNuevo: aJson(entrada.valorNuevo),
      motivo: entrada.motivo ?? null,
      usuarioId: entrada.usuarioId,
      ip: entrada.ip ?? null,
      creadoEn: ahoraServidor(),
    });
  }
}

/** Fechas a texto ISO y sin `undefined`, como en la versión Prisma. */
export function aJson(valor: unknown): unknown {
  return valor === undefined || valor === null ? null : JSON.parse(JSON.stringify(valor));
}
