/**
 * REPORTES DE AVERÍAS — Firestore
 * ===============================
 *
 * `reportesAveria/{id}`: un documento por reporte con sus registros y
 * fotos (rutas) embebidos. Se leen siempre juntos y un reporte tiene como
 * máximo 30 registros, así que cabe holgado en el límite de 1 MB.
 *
 * Listado: rango por `fechaOperativaTexto` (índice simple) y el resto de
 * filtros en memoria, igual que remisiones.
 */

import type { DocumentSnapshot } from 'firebase-admin/firestore';

import type {
  FiltroReportesAveria,
  NuevoReporteAveria,
  RegistroAveria,
  ReporteAveria,
  ReporteAveriaRepository,
} from '../../../domain/averia/reporte-averia.js';
import { aDate, aDateONulo, claveFecha, COLECCION, type ClienteFirestore } from '../cliente-firestore.js';

function aDominio(snap: DocumentSnapshot): ReporteAveria {
  const d = snap.data()!;
  return {
    id: snap.id,
    fechaHoraRegistro: aDate(d.fechaHoraRegistro),
    fechaOperativa: aDate(d.fechaOperativa),
    turnoId: d.turnoId,
    grupoId: d.grupoId,
    reportadoPorId: d.reportadoPorId,
    reportadoPorNombre: d.reportadoPorNombre,
    estado: d.estado,
    motivoAnulacion: d.motivoAnulacion ?? null,
    anuladoPorId: d.anuladoPorId ?? null,
    fechaAnulacion: aDateONulo(d.fechaAnulacion),
    registros: (d.registros ?? []).map(
      (r: Record<string, unknown>): RegistroAveria => ({
        ...(r as unknown as RegistroAveria),
        fechaVencimiento: aDate(r.fechaVencimiento),
      }),
    ),
  };
}

function aDocumento(reporte: Omit<ReporteAveria, 'id'>) {
  return { ...reporte, fechaOperativaTexto: claveFecha(reporte.fechaOperativa) };
}

export class ReporteAveriaFirestoreRepository implements ReporteAveriaRepository {
  constructor(private readonly cliente: ClienteFirestore) {}

  async crear(nuevo: NuevoReporteAveria): Promise<ReporteAveria> {
    const id = this.cliente.nuevoId(COLECCION.reportesAveria);
    const reporte: ReporteAveria = {
      ...nuevo,
      id,
      registros: nuevo.registros.map((r) => ({ ...r, id: this.cliente.nuevoId(COLECCION.reportesAveria) })),
    };
    const { id: _, ...datos } = reporte;
    await this.cliente.guardar(this.cliente.coleccion(COLECCION.reportesAveria).doc(id), aDocumento(datos));
    return reporte;
  }

  async buscarPorId(id: string): Promise<ReporteAveria | null> {
    const snap = await this.cliente.obtener(this.cliente.coleccion(COLECCION.reportesAveria).doc(id));
    return snap.exists ? aDominio(snap) : null;
  }

  async listar(filtro: FiltroReportesAveria): Promise<ReporteAveria[]> {
    const q = await this.cliente.consultar(
      this.cliente
        .coleccion(COLECCION.reportesAveria)
        .where('fechaOperativaTexto', '>=', claveFecha(filtro.desde))
        .where('fechaOperativaTexto', '<=', claveFecha(filtro.hasta)),
    );
    return q.docs
      .map(aDominio)
      .filter(
        (r) =>
          (!filtro.turnoId || r.turnoId === filtro.turnoId) &&
          (!filtro.grupoId || r.grupoId === filtro.grupoId) &&
          (!filtro.estado || r.estado === filtro.estado),
      )
      .sort((a, b) => b.fechaHoraRegistro.getTime() - a.fechaHoraRegistro.getTime());
  }

  async actualizar(reporte: ReporteAveria): Promise<ReporteAveria> {
    const { id, ...datos } = reporte;
    await this.cliente.guardar(this.cliente.coleccion(COLECCION.reportesAveria).doc(id), aDocumento(datos));
    return reporte;
  }
}
