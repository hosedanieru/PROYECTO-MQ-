/**
 * MFR — Firestore
 * ===============
 *
 * `bloquesProgramacion/{id}` (id aleatorio; la regla de no solapamiento
 * la aplica el caso de uso dentro de la transacción), `lineasProduccion/{id}`.
 * Los estándares viven en `productos` (cajasPorHora, pesoNetoKg).
 *
 * Las colecciones `programaciones` y `configTurnos` del diseño anterior
 * ya no se usan; sus documentos de prueba pueden borrarse desde la
 * consola de Firebase.
 */

import type { DocumentSnapshot } from 'firebase-admin/firestore';

import {
  BloqueProgramacion,
  type BloqueRepository,
} from '../../../domain/mfr/bloque-programacion.js';
import type {
  DatosEstandar,
  EstandarProducto,
  EstandarRepository,
} from '../../../domain/mfr/estandar-produccion.js';
import type {
  DatosLinea,
  LineaProduccion,
  LineaRepository,
} from '../../../domain/mfr/linea-produccion.js';
import {
  aDate,
  aDateONulo,
  ahoraServidor,
  claveFecha,
  COLECCION,
  type ClienteFirestore,
} from '../cliente-firestore.js';

// ------------------------------------------------------------
// Líneas
// ------------------------------------------------------------

function lineaADominio(snap: DocumentSnapshot): LineaProduccion {
  const d = snap.data()!;
  return {
    id: snap.id,
    codigo: d.codigo,
    nombre: d.nombre,
    tipo: d.tipo ?? 'MANUAL',
    capacidadKgHora: d.capacidadKgHora ?? null,
    orden: d.orden ?? 0,
    activo: d.activo ?? true,
  };
}

export class LineaFirestoreRepository implements LineaRepository {
  constructor(private readonly cliente: ClienteFirestore) {}

  async listar(): Promise<LineaProduccion[]> {
    const q = await this.cliente.consultar(this.cliente.coleccion(COLECCION.lineasProduccion));
    return q.docs.map(lineaADominio).sort((a, b) => a.orden - b.orden || a.codigo.localeCompare(b.codigo));
  }

  async buscarPorId(id: string): Promise<LineaProduccion | null> {
    const snap = await this.cliente.obtener(this.cliente.coleccion(COLECCION.lineasProduccion).doc(id));
    return snap.exists ? lineaADominio(snap) : null;
  }

  async buscarPorCodigo(codigo: string): Promise<LineaProduccion | null> {
    const q = await this.cliente.consultar(
      this.cliente.coleccion(COLECCION.lineasProduccion).where('codigo', '==', codigo).limit(1),
    );
    return q.empty ? null : lineaADominio(q.docs[0]);
  }

  async crear(datos: DatosLinea): Promise<LineaProduccion> {
    const id = this.cliente.nuevoId(COLECCION.lineasProduccion);
    await this.cliente.guardar(this.cliente.coleccion(COLECCION.lineasProduccion).doc(id), { ...datos, activo: true });
    return { id, ...datos, activo: true };
  }

  async actualizar(id: string, cambios: Partial<DatosLinea> & { activo?: boolean }): Promise<LineaProduccion> {
    const ref = this.cliente.coleccion(COLECCION.lineasProduccion).doc(id);
    const actual = await this.cliente.obtener(ref);
    await this.cliente.actualizar(ref, cambios);
    return { ...lineaADominio(actual), ...cambios };
  }
}

// ------------------------------------------------------------
// Bloques de programación
// ------------------------------------------------------------

function bloqueADominio(snap: DocumentSnapshot): BloqueProgramacion {
  const d = snap.data()!;
  return BloqueProgramacion.desdePersistencia({
    id: snap.id,
    fechaOperativa: aDate(d.fechaOperativa),
    lineaId: d.lineaId,
    turnoId: d.turnoId,
    productoId: d.productoId,
    horaInicio: d.horaInicio,
    horaFin: d.horaFin,
    cajasPorHora: Number(d.cajasPorHora),
    eficienciaPorcentaje: Number(d.eficienciaPorcentaje),
    loop: d.loop ?? null,
    personasAsignadas: d.personasAsignadas ?? null,
    origen: d.origen ?? 'MANUAL',
    creadoPorId: d.creadoPorId,
    fechaCreacion: aDate(d.fechaCreacion),
    cerradoEn: aDateONulo(d.cerradoEn),
    cerradoPorId: d.cerradoPorId ?? null,
  });
}

export class BloqueFirestoreRepository implements BloqueRepository {
  constructor(private readonly cliente: ClienteFirestore) {}

  async listarPorFecha(fechaOperativa: Date): Promise<BloqueProgramacion[]> {
    const q = await this.cliente.consultar(
      this.cliente.coleccion(COLECCION.bloquesProgramacion).where('fechaOperativaTexto', '==', claveFecha(fechaOperativa)),
    );
    // El orden final (por línea y hora) lo da el caso de uso, que conoce las líneas.
    return q.docs.map(bloqueADominio);
  }

  async buscarPorId(id: string): Promise<BloqueProgramacion | null> {
    const snap = await this.cliente.obtener(this.cliente.coleccion(COLECCION.bloquesProgramacion).doc(id));
    return snap.exists ? bloqueADominio(snap) : null;
  }

  async crear(bloque: BloqueProgramacion): Promise<BloqueProgramacion> {
    const d = bloque.aObjeto();
    const id = this.cliente.nuevoId(COLECCION.bloquesProgramacion);
    await this.cliente.guardar(this.cliente.coleccion(COLECCION.bloquesProgramacion).doc(id), {
      fechaOperativa: d.fechaOperativa,
      fechaOperativaTexto: claveFecha(d.fechaOperativa),
      lineaId: d.lineaId,
      turnoId: d.turnoId,
      productoId: d.productoId,
      horaInicio: d.horaInicio,
      horaFin: d.horaFin,
      cajasPorHora: d.cajasPorHora,
      eficienciaPorcentaje: d.eficienciaPorcentaje,
      loop: d.loop,
      personasAsignadas: d.personasAsignadas,
      origen: d.origen,
      creadoPorId: d.creadoPorId,
      fechaCreacion: d.fechaCreacion,
      cerradoEn: null,
      cerradoPorId: null,
    });
    return BloqueProgramacion.desdePersistencia({ ...d, id });
  }

  async actualizar(bloque: BloqueProgramacion): Promise<BloqueProgramacion> {
    const d = bloque.aObjeto();
    await this.cliente.actualizar(this.cliente.coleccion(COLECCION.bloquesProgramacion).doc(d.id), {
      turnoId: d.turnoId,
      productoId: d.productoId,
      horaInicio: d.horaInicio,
      horaFin: d.horaFin,
      cajasPorHora: d.cajasPorHora,
      eficienciaPorcentaje: d.eficienciaPorcentaje,
      loop: d.loop,
      personasAsignadas: d.personasAsignadas,
      cerradoEn: d.cerradoEn,
      cerradoPorId: d.cerradoPorId,
    });
    return bloque;
  }

  async eliminar(id: string): Promise<void> {
    await this.cliente.eliminar(this.cliente.coleccion(COLECCION.bloquesProgramacion).doc(id));
  }
}

// ------------------------------------------------------------
// Estándares (en productos)
// ------------------------------------------------------------

function estandarADominio(snap: DocumentSnapshot): EstandarProducto {
  const d = snap.data()!;
  return {
    productoId: snap.id,
    codigo: d.codigo,
    descripcion: d.descripcion,
    subdescripcion: d.subdescripcion ?? null,
    unidadesPorCaja: d.unidadesPorCaja ?? null,
    cajasPorHora: d.cajasPorHora ?? null,
    pesoNetoKg: d.pesoNetoKg ?? null,
  };
}

export class EstandarFirestoreRepository implements EstandarRepository {
  constructor(private readonly cliente: ClienteFirestore) {}

  async listar(): Promise<EstandarProducto[]> {
    const q = await this.cliente.consultar(this.cliente.coleccion(COLECCION.productos).orderBy('codigo'));
    return q.docs.filter((d) => d.get('activo') !== false).map(estandarADominio);
  }

  async buscarPorProducto(productoId: string): Promise<EstandarProducto | null> {
    const snap = await this.cliente.obtener(this.cliente.coleccion(COLECCION.productos).doc(productoId));
    return snap.exists ? estandarADominio(snap) : null;
  }

  async actualizar(productoId: string, datos: DatosEstandar): Promise<EstandarProducto> {
    const ref = this.cliente.coleccion(COLECCION.productos).doc(productoId);
    const actual = await this.cliente.obtener(ref);
    await this.cliente.actualizar(ref, { ...datos, actualizadoEn: ahoraServidor() });
    return { ...estandarADominio(actual), ...datos };
  }

  /**
   * Escritura pura, sin una sola lectura: por eso el lote cabe en una
   * transacción. `actualizar` (arriba) relee para poder devolver el
   * estándar completo, y eso solo es válido como PRIMERA operación.
   */
  async actualizarVarios(cambios: Array<{ productoId: string; datos: DatosEstandar }>): Promise<void> {
    for (const { productoId, datos } of cambios) {
      await this.cliente.actualizar(this.cliente.coleccion(COLECCION.productos).doc(productoId), {
        ...datos,
        actualizadoEn: ahoraServidor(),
      });
    }
  }
}
