/**
 * ASIGNACIÓN DE GRUPOS A LÍNEAS — Firestore
 * =========================================
 *
 * `asignacionesLinea/{fecha}_{turnoId}_{lineaId}_{grupoId}`: el id es la
 * identidad de negocio, así "guardar" es siempre un `set`.
 */

import type { DocumentSnapshot } from 'firebase-admin/firestore';

import type {
  AsignacionLinea,
  AsignacionRepository,
  DatosAsignacion,
} from '../../../domain/mfr/asignacion-linea.js';
import { aDate, claveFecha, COLECCION, type ClienteFirestore } from '../cliente-firestore.js';

function idDe(fechaOperativa: Date, turnoId: string, lineaId: string, grupoId: string): string {
  return `${claveFecha(fechaOperativa)}_${turnoId}_${lineaId}_${grupoId}`;
}

function aDominio(snap: DocumentSnapshot): AsignacionLinea {
  const d = snap.data()!;
  return {
    id: snap.id,
    fechaOperativa: aDate(d.fechaOperativa),
    turnoId: d.turnoId,
    lineaId: d.lineaId,
    grupoId: d.grupoId,
    personas: d.personas,
    registradaPorId: d.registradaPorId,
    fechaRegistro: aDate(d.fechaRegistro),
  };
}

export class AsignacionFirestoreRepository implements AsignacionRepository {
  constructor(private readonly cliente: ClienteFirestore) {}

  private ref(id: string) {
    return this.cliente.coleccion(COLECCION.asignacionesLinea).doc(id);
  }

  async listarPorFecha(fechaOperativa: Date): Promise<AsignacionLinea[]> {
    const q = await this.cliente.consultar(
      this.cliente.coleccion(COLECCION.asignacionesLinea).where('fechaOperativaTexto', '==', claveFecha(fechaOperativa)),
    );
    return q.docs
      .map(aDominio)
      .sort((a, b) => a.turnoId.localeCompare(b.turnoId) || a.lineaId.localeCompare(b.lineaId) || a.grupoId.localeCompare(b.grupoId));
  }

  async buscarPorId(id: string): Promise<AsignacionLinea | null> {
    const snap = await this.cliente.obtener(this.ref(id));
    return snap.exists ? aDominio(snap) : null;
  }

  buscarPorIdentidad(fechaOperativa: Date, turnoId: string, lineaId: string, grupoId: string): Promise<AsignacionLinea | null> {
    return this.buscarPorId(idDe(fechaOperativa, turnoId, lineaId, grupoId));
  }

  async guardar(datos: DatosAsignacion, registradaPorId: string, momento: Date): Promise<AsignacionLinea> {
    const id = idDe(datos.fechaOperativa, datos.turnoId, datos.lineaId, datos.grupoId);
    await this.cliente.guardar(this.ref(id), {
      fechaOperativa: datos.fechaOperativa,
      fechaOperativaTexto: claveFecha(datos.fechaOperativa),
      turnoId: datos.turnoId,
      lineaId: datos.lineaId,
      grupoId: datos.grupoId,
      personas: datos.personas,
      registradaPorId,
      fechaRegistro: momento,
    });
    return { id, ...datos, registradaPorId, fechaRegistro: momento };
  }

  eliminar(id: string): Promise<void> {
    return this.cliente.eliminar(this.ref(id));
  }
}
