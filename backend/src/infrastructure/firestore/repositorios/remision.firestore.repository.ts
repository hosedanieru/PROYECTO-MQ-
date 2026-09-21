/**
 * REMISIONES — Firestore
 * ======================
 *
 * Documento `remisiones/{id}` con todos los campos de la entidad,
 * las estibas embebidas (`numerosEstiba: number[]`) y dos campos
 * auxiliares para consultar:
 *   - `fechaOperativaTexto` "YYYY-MM-DD"  → igualdad y rangos
 *   - `anioNumero` "2026-0001"            → búsqueda por consecutivo
 *
 * CONSECUTIVO: `consecutivos/REMISION-{anio}` con `ultimo`. Dentro de la
 * transacción se lee, se incrementa y se escribe. Si dos coordinadores
 * crean a la vez, Firestore detecta el conflicto sobre ese documento y
 * reintenta una de las dos transacciones: es el equivalente al bloqueo
 * de fila de PostgreSQL, por reintento optimista en vez de espera.
 *
 * LISTADO: Firestore exige un índice compuesto por cada combinación de
 * filtros + orden. Para no mantener decenas de índices, se consulta por
 * fecha operativa (el filtro que más recorta) ordenado por fecha, y el
 * resto de filtros y la paginación se resuelven en memoria. A la escala
 * de MQ (~2.000 remisiones/año) es correcto; se limita a 5.000 docs.
 */

import type { DocumentSnapshot } from 'firebase-admin/firestore';

import type {
  EntradaAuditoriaRemision,
  HistorialRemisionRepository,
  VersionRemision,
} from '../../../domain/remision/historial.repository.js';
import {
  Remision,
  type EstadoPersistidoRemision,
  type EstadoRemision,
} from '../../../domain/remision/remision.entity.js';
import type {
  CajasAgrupadas,
  FiltroRemisiones,
  RemisionRepository,
  ResultadoPaginado,
} from '../../../domain/remision/remision.repository.js';
import {
  aDate,
  aDateONulo,
  ahoraServidor,
  claveFecha,
  COLECCION,
  type ClienteFirestore,
} from '../cliente-firestore.js';
import { aJson } from './auditoria.firestore.repository.js';

const TIPO_CONSECUTIVO = 'REMISION';
const TOPE_LECTURA = 5000;

export class RemisionFirestoreRepository implements RemisionRepository {
  constructor(private readonly cliente: ClienteFirestore) {}

  async crearConConsecutivo(
    construir: (anio: number, numero: number) => Remision,
    anio: number,
  ): Promise<Remision> {
    const refConsecutivo = this.cliente.coleccion(COLECCION.consecutivos).doc(`${TIPO_CONSECUTIVO}-${anio}`);
    const actual = await this.cliente.obtener(refConsecutivo);
    const ultimo = actual.exists ? Number(actual.get('ultimo') ?? 0) : 0;
    const numero = ultimo + 1;

    const remision = construir(anio, numero);
    const id = this.cliente.nuevoId(COLECCION.remisiones);
    const guardada = Remision.desdePersistencia({ ...remision.aObjeto(), id });

    await this.cliente.guardar(refConsecutivo, { tipo: TIPO_CONSECUTIVO, anio, ultimo: numero });
    await this.cliente.guardar(this.cliente.coleccion(COLECCION.remisiones).doc(id), aDocumento(guardada));
    return guardada;
  }

  async actualizar(remision: Remision): Promise<Remision> {
    await this.cliente.guardar(
      this.cliente.coleccion(COLECCION.remisiones).doc(remision.id),
      aDocumento(remision),
    );
    return remision;
  }

  async registrarVersion(parametros: {
    remisionId: string;
    version: number;
    motivoRechazo: string | null;
    datosAnteriores: unknown;
    rectificadaPorId: string;
  }): Promise<void> {
    const id = `${parametros.remisionId}-v${parametros.version}`;
    await this.cliente.guardar(this.cliente.coleccion(COLECCION.remisionVersiones).doc(id), {
      remisionId: parametros.remisionId,
      version: parametros.version,
      motivoRechazo: parametros.motivoRechazo,
      datosAnteriores: aJson(parametros.datosAnteriores),
      rectificadaPorId: parametros.rectificadaPorId,
      fechaRectificacion: ahoraServidor(),
    });
  }

  async buscarPorId(id: string): Promise<Remision | null> {
    const snap = await this.cliente.obtener(this.cliente.coleccion(COLECCION.remisiones).doc(id));
    return snap.exists ? aDominio(snap) : null;
  }

  async buscarPorConsecutivo(anio: number, numero: number): Promise<Remision | null> {
    const q = await this.cliente.consultar(
      this.cliente
        .coleccion(COLECCION.remisiones)
        .where('anioNumero', '==', `${anio}-${String(numero).padStart(4, '0')}`)
        .limit(1),
    );
    return q.empty ? null : aDominio(q.docs[0]);
  }

  async listar(filtro: FiltroRemisiones): Promise<ResultadoPaginado<Remision>> {
    const pagina = Math.max(1, filtro.pagina ?? 1);
    const porPagina = Math.min(100, Math.max(1, filtro.porPagina ?? 20));
    const todas = await this.consultarFiltradas(filtro);
    // Orden operativo: lo más reciente primero.
    todas.sort((a, b) => {
      const da = a.aObjeto(), db = b.aObjeto();
      return db.fechaOperativa.getTime() - da.fechaOperativa.getTime() || db.numero - da.numero;
    });
    const inicio = (pagina - 1) * porPagina;
    return { items: todas.slice(inicio, inicio + porPagina), total: todas.length, pagina, porPagina };
  }

  async listarTodas(filtro: Omit<FiltroRemisiones, 'pagina' | 'porPagina'>): Promise<Remision[]> {
    const todas = await this.consultarFiltradas(filtro);
    todas.sort((a, b) => {
      const da = a.aObjeto(), db = b.aObjeto();
      return da.fechaOperativa.getTime() - db.fechaOperativa.getTime() || da.anio - db.anio || da.numero - db.numero;
    });
    return todas;
  }

  async buscarPorIds(ids: string[]): Promise<Remision[]> {
    const snaps = await Promise.all(
      ids.map((id) => this.cliente.obtener(this.cliente.coleccion(COLECCION.remisiones).doc(id))),
    );
    return snaps.filter((s) => s.exists).map(aDominio);
  }

  async totalizarCajas(
    fechaOperativa: Date,
    estados: readonly EstadoRemision[],
  ): Promise<CajasAgrupadas[]> {
    const q = await this.cliente.consultar(
      this.cliente.coleccion(COLECCION.remisiones).where('fechaOperativaTexto', '==', claveFecha(fechaOperativa)),
    );
    const grupos = new Map<string, CajasAgrupadas>();
    for (const d of q.docs) {
      if (!estados.includes(d.get('estado'))) continue;
      const extraoficial = d.get('extraoficial') === true;
      const clave = `${d.get('turnoId')}|${d.get('productoId')}|${extraoficial}`;
      const g = grupos.get(clave) ?? { turnoId: d.get('turnoId'), productoId: d.get('productoId'), extraoficial, cajas: 0 };
      g.cajas += Number(d.get('cantidadCajas') ?? 0);
      grupos.set(clave, g);
    }
    return [...grupos.values()];
  }

  /** Consulta por rango de fecha en Firestore; el resto de filtros en memoria. */
  private async consultarFiltradas(filtro: Omit<FiltroRemisiones, 'pagina' | 'porPagina'>): Promise<Remision[]> {
    let q = this.cliente.coleccion(COLECCION.remisiones).orderBy('fechaOperativaTexto', 'desc');
    if (filtro.fechaOperativaDesde) q = q.where('fechaOperativaTexto', '>=', claveFecha(filtro.fechaOperativaDesde));
    if (filtro.fechaOperativaHasta) q = q.where('fechaOperativaTexto', '<=', claveFecha(filtro.fechaOperativaHasta));
    if (!filtro.fechaOperativaDesde && !filtro.fechaOperativaHasta && filtro.anio !== undefined) {
      q = q.where('fechaOperativaTexto', '>=', `${filtro.anio}-01-01`).where('fechaOperativaTexto', '<=', `${filtro.anio}-12-31`);
    }
    const snap = await this.cliente.consultar(q.limit(TOPE_LECTURA));
    return snap.docs.map(aDominio).filter((r) => {
      const d = r.aObjeto();
      return (
        (filtro.anio === undefined || d.anio === filtro.anio) &&
        (!filtro.turnoId || d.turnoId === filtro.turnoId) &&
        (!filtro.grupoId || d.grupoId === filtro.grupoId) &&
        (!filtro.productoId || d.productoId === filtro.productoId) &&
        (!filtro.estado || d.estado === filtro.estado)
      );
    });
  }
}

// ------------------------------------------------------------
// Historial (versiones y auditoría de una remisión)
// ------------------------------------------------------------

export class HistorialRemisionFirestoreRepository implements HistorialRemisionRepository {
  constructor(private readonly cliente: ClienteFirestore) {}

  async versiones(remisionId: string): Promise<VersionRemision[]> {
    const q = await this.cliente.consultar(
      this.cliente.coleccion(COLECCION.remisionVersiones).where('remisionId', '==', remisionId),
    );
    const usuarios = await this.nombresDe(q.docs.map((d) => d.get('rectificadaPorId')));
    return q.docs
      .map((d) => ({
        version: d.get('version'),
        motivoRechazo: d.get('motivoRechazo') ?? null,
        datosAnteriores: d.get('datosAnteriores'),
        rectificadaPor: { id: d.get('rectificadaPorId'), nombre: usuarios.get(d.get('rectificadaPorId')) ?? '—' },
        fechaRectificacion: aDate(d.get('fechaRectificacion')),
      }))
      .sort((a, b) => a.version - b.version);
  }

  async auditoria(remisionId: string): Promise<EntradaAuditoriaRemision[]> {
    const q = await this.cliente.consultar(
      this.cliente.coleccion(COLECCION.auditoria).where('entidad', '==', 'remision').where('entidadId', '==', remisionId),
    );
    const usuarios = await this.nombresDe(q.docs.map((d) => d.get('usuarioId')));
    return q.docs
      .map((d) => ({
        id: d.id,
        accion: d.get('accion'),
        valorAnterior: d.get('valorAnterior') ?? null,
        valorNuevo: d.get('valorNuevo') ?? null,
        motivo: d.get('motivo') ?? null,
        usuario: { id: d.get('usuarioId'), nombre: usuarios.get(d.get('usuarioId')) ?? '—' },
        fecha: aDate(d.get('creadoEn')),
      }))
      .sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  }

  private async nombresDe(ids: string[]): Promise<Map<string, string>> {
    const unicos = [...new Set(ids.filter(Boolean))];
    const snaps = await Promise.all(unicos.map((id) => this.cliente.obtener(this.cliente.coleccion(COLECCION.usuarios).doc(id))));
    return new Map(snaps.filter((s) => s.exists).map((s) => [s.id, s.get('nombre') as string]));
  }
}

// ------------------------------------------------------------
// Conversión
// ------------------------------------------------------------

function aDocumento(remision: Remision) {
  const d = remision.aObjeto();
  return {
    anio: d.anio,
    numero: d.numero,
    anioNumero: remision.consecutivo,
    version: d.version,
    estado: d.estado,
    fechaOperativa: d.fechaOperativa,
    fechaOperativaTexto: claveFecha(d.fechaOperativa),
    fechaHoraRegistro: d.fechaHoraRegistro,
    turnoId: d.turnoId,
    grupoId: d.grupoId,
    lugarId: d.lugarId,
    productoId: d.productoId,
    codigoSnapshot: d.codigoSnapshot,
    descripcionSnapshot: d.descripcionSnapshot,
    fechaVencimiento: d.fechaVencimiento,
    cantidadCajas: d.cantidadCajas,
    cantidadUnidades: d.cantidadUnidades,
    estibasCompletas: d.estibasCompletas,
    cajasSueltas: d.cajasSueltas,
    numerosEstiba: d.numerosEstiba,
    observaciones: d.observaciones ?? null,
    extraoficial: d.extraoficial,
    motivoExtraoficial: d.motivoExtraoficial,
    creadaPorId: d.creadaPorId,
    entregadaPorId: d.entregadaPorId ?? null,
    fechaEntrega: d.fechaEntrega ?? null,
    opaNombre: d.opaNombre ?? null,
    opaCargo: d.opaCargo ?? null,
    fechaAprobacion: d.fechaAprobacion ?? null,
    motivoUltimoRechazo: d.motivoUltimoRechazo ?? null,
    validadaPorId: d.validadaPorId ?? null,
    fechaValidacion: d.fechaValidacion ?? null,
    conciliadoCon: d.conciliadoCon ?? null,
  };
}

function aDominio(snap: DocumentSnapshot): Remision {
  const d = snap.data()!;
  const estado: EstadoPersistidoRemision = {
    id: snap.id,
    anio: d.anio,
    numero: d.numero,
    version: d.version,
    estado: d.estado,
    fechaOperativa: aDate(d.fechaOperativa),
    fechaHoraRegistro: aDate(d.fechaHoraRegistro),
    turnoId: d.turnoId,
    grupoId: d.grupoId,
    lugarId: d.lugarId,
    productoId: d.productoId,
    codigoSnapshot: d.codigoSnapshot,
    descripcionSnapshot: d.descripcionSnapshot,
    fechaVencimiento: aDate(d.fechaVencimiento),
    cantidadCajas: d.cantidadCajas,
    cantidadUnidades: d.cantidadUnidades,
    estibasCompletas: d.estibasCompletas,
    cajasSueltas: d.cajasSueltas,
    numerosEstiba: [...(d.numerosEstiba ?? [])].sort((a: number, b: number) => a - b),
    observaciones: d.observaciones ?? null,
    // Documentos anteriores al 2026-09-18 no traen el campo: son oficiales.
    extraoficial: d.extraoficial === true,
    motivoExtraoficial: d.motivoExtraoficial ?? null,
    creadaPorId: d.creadaPorId,
    entregadaPorId: d.entregadaPorId ?? null,
    fechaEntrega: aDateONulo(d.fechaEntrega),
    opaNombre: d.opaNombre ?? null,
    opaCargo: d.opaCargo ?? null,
    fechaAprobacion: aDateONulo(d.fechaAprobacion),
    motivoRechazo: d.motivoUltimoRechazo ?? null,
    motivoUltimoRechazo: d.motivoUltimoRechazo ?? null,
    validadaPorId: d.validadaPorId ?? null,
    fechaValidacion: aDateONulo(d.fechaValidacion),
    conciliadoCon: d.conciliadoCon ?? null,
  };
  return Remision.desdePersistencia(estado);
}
