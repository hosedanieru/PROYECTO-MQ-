/**
 * CAUSALES DE AVERÍA — Firestore
 * ==============================
 *
 * `causalesAveria/{id}`: las sembradas llevan como id su código; las
 * creadas desde el panel, un id generado. Son pocas: se ordenan en
 * memoria con la misma regla del dominio (sin índice compuesto).
 */

import type { DocumentSnapshot } from 'firebase-admin/firestore';

import {
  ordenarCausales,
  type CausalAveria,
  type CausalAveriaRepository,
  type DatosCausal,
} from '../../../domain/averia/causal-averia.js';
import { COLECCION, type ClienteFirestore } from '../cliente-firestore.js';

function aDominio(snap: DocumentSnapshot): CausalAveria {
  const d = snap.data()!;
  return {
    id: snap.id,
    codigo: d.codigo,
    nombre: d.nombre,
    orden: d.orden ?? 0,
    activo: d.activo ?? true,
  };
}

export class CausalAveriaFirestoreRepository implements CausalAveriaRepository {
  constructor(private readonly cliente: ClienteFirestore) {}

  async listar(): Promise<CausalAveria[]> {
    const q = await this.cliente.consultar(this.cliente.coleccion(COLECCION.causalesAveria));
    return ordenarCausales(q.docs.map(aDominio));
  }

  async buscarPorId(id: string): Promise<CausalAveria | null> {
    const snap = await this.cliente.obtener(this.cliente.coleccion(COLECCION.causalesAveria).doc(id));
    return snap.exists ? aDominio(snap) : null;
  }

  async buscarPorCodigo(codigo: string): Promise<CausalAveria | null> {
    const q = await this.cliente.consultar(
      this.cliente.coleccion(COLECCION.causalesAveria).where('codigo', '==', codigo).limit(1),
    );
    return q.empty ? null : aDominio(q.docs[0]);
  }

  async crear(datos: DatosCausal): Promise<CausalAveria> {
    const id = this.cliente.nuevoId(COLECCION.causalesAveria);
    await this.cliente.guardar(this.cliente.coleccion(COLECCION.causalesAveria).doc(id), { ...datos, activo: true });
    return { id, ...datos, activo: true };
  }

  async actualizar(id: string, cambios: Partial<DatosCausal> & { activo?: boolean }): Promise<CausalAveria> {
    const ref = this.cliente.coleccion(COLECCION.causalesAveria).doc(id);
    const actual = await this.cliente.obtener(ref);
    await this.cliente.actualizar(ref, cambios);
    return { ...aDominio(actual), ...cambios };
  }
}
