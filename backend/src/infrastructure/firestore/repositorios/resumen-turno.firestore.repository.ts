/**
 * RESUMEN DEL TURNO — Firestore
 * =============================
 *
 *   resumenesTurno/{id}                 la foto, con fechaOperativaTexto para listar por día
 *   consecutivos/RESUMEN_TURNO-{anio}   y RESUMEN_DIA-{anio}
 *
 * `siguienteNumero` solo LEE el consecutivo (dentro de la transacción, así
 * Firestore detecta si otro cierre lo tomó y reintenta); `crear` escribe.
 * Por la regla de Firestore, el cierre lee los dos números antes de
 * escribir cualquiera de los dos resúmenes.
 */

import type { DocumentSnapshot } from 'firebase-admin/firestore';

import type {
  NuevoResumen,
  ResumenTurno,
  ResumenTurnoRepository,
  TipoResumen,
} from '../../../domain/resumen/resumen-turno.js';
import { aDate, claveFecha, COLECCION, type ClienteFirestore } from '../cliente-firestore.js';

const TIPO_CONSECUTIVO: Record<TipoResumen, string> = { TURNO: 'RESUMEN_TURNO', DIA: 'RESUMEN_DIA' };

const aDominio = (s: DocumentSnapshot): ResumenTurno => {
  const d = s.data()!;
  return {
    id: s.id,
    tipo: d.tipo,
    anio: d.anio,
    numero: d.numero,
    fechaOperativa: aDate(d.fechaOperativa),
    turnoId: d.turnoId ?? null,
    formato: d.formato,
    datos: d.datos,
    cerradoPorId: d.cerradoPorId,
    cerradoPorNombre: d.cerradoPorNombre,
    fechaHora: aDate(d.fechaHora),
  };
};

export class ResumenTurnoFirestoreRepository implements ResumenTurnoRepository {
  constructor(private readonly cliente: ClienteFirestore) {}

  private coleccion() {
    return this.cliente.coleccion(COLECCION.resumenesTurno);
  }

  private refConsecutivo(tipo: TipoResumen, anio: number) {
    return this.cliente.coleccion(COLECCION.consecutivos).doc(`${TIPO_CONSECUTIVO[tipo]}-${anio}`);
  }

  async siguienteNumero(tipo: TipoResumen, anio: number): Promise<number> {
    const actual = await this.cliente.obtener(this.refConsecutivo(tipo, anio));
    return ((actual.exists ? (actual.get('ultimo') as number) : 0) ?? 0) + 1;
  }

  async crear(resumen: NuevoResumen, numero: number): Promise<ResumenTurno> {
    await this.cliente.guardar(this.refConsecutivo(resumen.tipo, resumen.anio), { tipo: TIPO_CONSECUTIVO[resumen.tipo], anio: resumen.anio, ultimo: numero });
    const id = this.cliente.nuevoId(COLECCION.resumenesTurno);
    await this.cliente.guardar(this.coleccion().doc(id), { ...resumen, numero, fechaOperativaTexto: claveFecha(resumen.fechaOperativa) });
    return { id, ...resumen, numero };
  }

  async buscarPorId(id: string): Promise<ResumenTurno | null> {
    const s = await this.cliente.obtener(this.coleccion().doc(id));
    return s.exists ? aDominio(s) : null;
  }

  async listarPorFecha(fechaOperativa: Date): Promise<ResumenTurno[]> {
    const q = await this.cliente.consultar(this.coleccion().where('fechaOperativaTexto', '==', claveFecha(fechaOperativa)));
    return q.docs.map(aDominio).sort((a, b) => a.fechaHora.getTime() - b.fechaHora.getTime());
  }
}
