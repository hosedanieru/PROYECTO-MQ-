/**
 * ASISTENCIA DEL TURNO — Firestore
 * ================================
 *
 * `asistenciasTurno/{fecha}_{turnoId}_{grupoId}`: el id es la identidad
 * de negocio, así "guardar" es siempre un `set` (crea o reemplaza).
 */

import type { DocumentSnapshot } from 'firebase-admin/firestore';

import type {
  AsistenciaRepository,
  AsistenciaTurno,
  DatosAsistencia,
} from '../../../domain/mfr/asistencia-turno.js';
import { aDate, claveFecha, COLECCION, type ClienteFirestore } from '../cliente-firestore.js';

function idDe(fechaOperativa: Date, turnoId: string, grupoId: string): string {
  return `${claveFecha(fechaOperativa)}_${turnoId}_${grupoId}`;
}

function aDominio(snap: DocumentSnapshot): AsistenciaTurno {
  const d = snap.data()!;
  return {
    id: snap.id,
    fechaOperativa: aDate(d.fechaOperativa),
    turnoId: d.turnoId,
    grupoId: d.grupoId,
    personasLlegaron: d.personasLlegaron,
    observacion: d.observacion ?? null,
    registradaPorId: d.registradaPorId,
    fechaRegistro: aDate(d.fechaRegistro),
  };
}

export class AsistenciaFirestoreRepository implements AsistenciaRepository {
  constructor(private readonly cliente: ClienteFirestore) {}

  async listarPorFecha(fechaOperativa: Date): Promise<AsistenciaTurno[]> {
    const q = await this.cliente.consultar(
      this.cliente.coleccion(COLECCION.asistenciasTurno).where('fechaOperativaTexto', '==', claveFecha(fechaOperativa)),
    );
    return q.docs.map(aDominio).sort((a, b) => a.turnoId.localeCompare(b.turnoId) || a.grupoId.localeCompare(b.grupoId));
  }

  async buscarPorIdentidad(fechaOperativa: Date, turnoId: string, grupoId: string): Promise<AsistenciaTurno | null> {
    const snap = await this.cliente.obtener(this.cliente.coleccion(COLECCION.asistenciasTurno).doc(idDe(fechaOperativa, turnoId, grupoId)));
    return snap.exists ? aDominio(snap) : null;
  }

  async guardar(datos: DatosAsistencia, registradaPorId: string, momento: Date): Promise<AsistenciaTurno> {
    const id = idDe(datos.fechaOperativa, datos.turnoId, datos.grupoId);
    await this.cliente.guardar(this.cliente.coleccion(COLECCION.asistenciasTurno).doc(id), {
      fechaOperativa: datos.fechaOperativa,
      fechaOperativaTexto: claveFecha(datos.fechaOperativa),
      turnoId: datos.turnoId,
      grupoId: datos.grupoId,
      personasLlegaron: datos.personasLlegaron,
      observacion: datos.observacion,
      registradaPorId,
      fechaRegistro: momento,
    });
    return { id, ...datos, registradaPorId, fechaRegistro: momento };
  }
}
