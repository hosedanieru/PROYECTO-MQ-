/**
 * GRUPOS — Firestore
 * ==================
 *
 * `grupos/{id}`: los sembrados llevan como id su código; los creados
 * desde el panel, un id generado. Colección anterior: `proveedores`
 * (renombrada el 2026-09-21; ver `convertir-proveedores-a-grupos`).
 */

import type { DocumentSnapshot } from 'firebase-admin/firestore';

import type { DatosGrupo, Grupo, GrupoRepository } from '../../../domain/grupo/grupo.repository.js';
import { COLECCION, type ClienteFirestore } from '../cliente-firestore.js';

function aDominio(snap: DocumentSnapshot): Grupo {
  const d = snap.data()!;
  return {
    id: snap.id,
    codigo: d.codigo,
    nombre: d.nombre,
    descripcion: d.descripcion ?? null,
    personasEsperadas: d.personasEsperadas ?? null,
    activo: d.activo ?? true,
  };
}

export class GrupoFirestoreRepository implements GrupoRepository {
  constructor(private readonly cliente: ClienteFirestore) {}

  async listar(): Promise<Grupo[]> {
    const q = await this.cliente.consultar(this.cliente.coleccion(COLECCION.grupos).orderBy('codigo'));
    return q.docs.map(aDominio);
  }

  async buscarPorId(id: string): Promise<Grupo | null> {
    const snap = await this.cliente.obtener(this.cliente.coleccion(COLECCION.grupos).doc(id));
    return snap.exists ? aDominio(snap) : null;
  }

  async buscarPorCodigo(codigo: string): Promise<Grupo | null> {
    const q = await this.cliente.consultar(this.cliente.coleccion(COLECCION.grupos).where('codigo', '==', codigo).limit(1));
    return q.empty ? null : aDominio(q.docs[0]);
  }

  async crear(datos: DatosGrupo): Promise<Grupo> {
    const id = this.cliente.nuevoId(COLECCION.grupos);
    await this.cliente.guardar(this.cliente.coleccion(COLECCION.grupos).doc(id), { ...datos, activo: true });
    return { id, ...datos, activo: true };
  }

  async actualizar(id: string, cambios: Partial<DatosGrupo> & { activo?: boolean }): Promise<Grupo> {
    const ref = this.cliente.coleccion(COLECCION.grupos).doc(id);
    const actual = await this.cliente.obtener(ref);
    await this.cliente.actualizar(ref, cambios);
    return { ...aDominio(actual), ...cambios };
  }
}
