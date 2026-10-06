/**
 * FIRMAS DE REMISIÓN — Firestore
 * ==============================
 *
 * `firmasRemision/{remisionId}_v{version}_{tipo}`: el id es la casilla, y
 * `crearNuevo` (create) falla si ya existe → una firma por casilla y
 * versión, como la restricción única de PostgreSQL.
 */

import type { DocumentSnapshot } from 'firebase-admin/firestore';

import type { FirmaRemision, FirmaRemisionRepository, NuevaFirma } from '../../../domain/remision/firma-remision.js';
import { aDate, COLECCION, type ClienteFirestore } from '../cliente-firestore.js';

function aDominio(s: DocumentSnapshot): FirmaRemision {
  const d = s.data()!;
  return {
    id: s.id,
    remisionId: d.remisionId,
    version: d.version,
    tipo: d.tipo,
    usuarioId: d.usuarioId,
    usuarioNombre: d.usuarioNombre,
    usuarioDocumento: d.usuarioDocumento,
    usuarioRol: d.usuarioRol,
    declaracion: d.declaracion,
    huella: d.huella,
    trazo: d.trazo,
    dispositivo: d.dispositivo ?? null,
    ip: d.ip ?? null,
    fechaHora: aDate(d.fechaHora),
  };
}

export class FirmaRemisionFirestoreRepository implements FirmaRemisionRepository {
  constructor(private readonly cliente: ClienteFirestore) {}

  private coleccion() {
    return this.cliente.coleccion(COLECCION.firmasRemision);
  }

  async listarPorRemision(remisionId: string): Promise<FirmaRemision[]> {
    const q = await this.cliente.consultar(this.coleccion().where('remisionId', '==', remisionId));
    return q.docs.map(aDominio).sort((a, b) => a.version - b.version || a.fechaHora.getTime() - b.fechaHora.getTime());
  }

  async crear(firma: NuevaFirma): Promise<FirmaRemision> {
    const id = `${firma.remisionId}_v${firma.version}_${firma.tipo}`;
    await this.cliente.crearNuevo(this.coleccion().doc(id), firma);
    return { id, ...firma };
  }
}
