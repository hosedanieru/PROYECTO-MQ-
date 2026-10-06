/**
 * AJUSTE DE PERSONAS ESPERADAS DEL DÍA — Firestore
 * ================================================
 *
 * `ajustesEsperadas/{fecha}_{turnoId}_{grupoId}`: el id es la identidad de
 * negocio, así "guardar" es un `set` (crea o reemplaza).
 */

import type { DocumentSnapshot } from 'firebase-admin/firestore';

import type {
  AjusteEsperadas,
  AjusteEsperadasRepository,
  DatosAjusteEsperadas,
} from '../../../domain/mfr/esperadas-personal.js';
import { aDate, claveFecha, COLECCION, type ClienteFirestore } from '../cliente-firestore.js';

function aDominio(snap: DocumentSnapshot): AjusteEsperadas {
  const d = snap.data()!;
  return {
    id: snap.id,
    fechaOperativa: aDate(d.fechaOperativa),
    turnoId: d.turnoId,
    grupoId: d.grupoId,
    personas: d.personas,
    motivo: d.motivo,
    usuarioId: d.usuarioId,
    fechaRegistro: aDate(d.fechaRegistro),
  };
}

export class AjusteEsperadasFirestoreRepository implements AjusteEsperadasRepository {
  constructor(private readonly cliente: ClienteFirestore) {}

  async listarPorFecha(fechaOperativa: Date): Promise<AjusteEsperadas[]> {
    const q = await this.cliente.consultar(
      this.cliente.coleccion(COLECCION.ajustesEsperadas).where('fechaOperativaTexto', '==', claveFecha(fechaOperativa)),
    );
    return q.docs.map(aDominio).sort((a, b) => a.turnoId.localeCompare(b.turnoId) || a.grupoId.localeCompare(b.grupoId));
  }

  async guardar(datos: DatosAjusteEsperadas, usuarioId: string, momento: Date): Promise<AjusteEsperadas> {
    const id = `${claveFecha(datos.fechaOperativa)}_${datos.turnoId}_${datos.grupoId}`;
    await this.cliente.guardar(this.cliente.coleccion(COLECCION.ajustesEsperadas).doc(id), {
      ...datos,
      fechaOperativaTexto: claveFecha(datos.fechaOperativa),
      usuarioId,
      fechaRegistro: momento,
    });
    return { id, ...datos, usuarioId, fechaRegistro: momento };
  }
}
