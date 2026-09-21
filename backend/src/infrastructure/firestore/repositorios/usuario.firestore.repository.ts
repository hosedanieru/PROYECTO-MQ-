/**
 * USUARIOS — Firestore
 * ====================
 *
 * Documento `usuarios/{id}`: documento, nombre, email, passwordHash,
 * activo, rolId, creadoEn, actualizadoEn.
 *
 * El rol (`roles/{id}`) lleva sus permisos EMBEBIDOS como lista de
 * códigos: sin joins, un usuario se resuelve con dos lecturas. El seed
 * los mantiene sincronizados.
 */

import type { DocumentSnapshot } from 'firebase-admin/firestore';

import { Usuario } from '../../../domain/usuario/usuario.entity.js';
import type { UsuarioRepository } from '../../../domain/usuario/usuario.repository.js';
import { ahoraServidor, COLECCION, type ClienteFirestore } from '../cliente-firestore.js';

interface RolDoc {
  codigo: string;
  permisos: string[];
}

export class UsuarioFirestoreRepository implements UsuarioRepository {
  constructor(private readonly cliente: ClienteFirestore) {}

  async buscarPorId(id: string): Promise<Usuario | null> {
    const snap = await this.cliente.obtener(this.cliente.coleccion(COLECCION.usuarios).doc(id));
    return snap.exists ? this.aDominio(snap, await this.rolDe(snap.get('rolId'))) : null;
  }

  async buscarPorDocumento(documento: string): Promise<Usuario | null> {
    const q = await this.cliente.consultar(
      this.cliente.coleccion(COLECCION.usuarios).where('documento', '==', documento).limit(1),
    );
    if (q.empty) return null;
    const snap = q.docs[0];
    return this.aDominio(snap, await this.rolDe(snap.get('rolId')));
  }

  async listar(): Promise<Usuario[]> {
    const q = await this.cliente.consultar(this.cliente.coleccion(COLECCION.usuarios).orderBy('nombre'));
    const roles = await this.todosLosRoles();
    return q.docs.map((snap) => this.aDominio(snap, roles.get(snap.get('rolId')) ?? null));
  }

  async crear(usuario: Usuario): Promise<Usuario> {
    const datos = usuario.aObjeto();
    // El rol se lee ANTES de escribir (regla de las transacciones de Firestore).
    const rol = await this.rolDe(datos.rolId);
    const id = this.cliente.nuevoId(COLECCION.usuarios);
    await this.cliente.guardar(this.cliente.coleccion(COLECCION.usuarios).doc(id), {
      documento: datos.documento,
      nombre: datos.nombre,
      email: datos.email ?? null,
      passwordHash: datos.passwordHash,
      activo: datos.activo,
      rolId: datos.rolId,
      creadoEn: ahoraServidor(),
      actualizadoEn: ahoraServidor(),
    });
    return Usuario.desdePersistencia({ ...datos, id, rolCodigo: rol?.codigo ?? '', permisos: rol?.permisos ?? [] });
  }

  async actualizar(usuario: Usuario): Promise<Usuario> {
    const datos = usuario.aObjeto();
    const rol = await this.rolDe(datos.rolId);
    await this.cliente.actualizar(this.cliente.coleccion(COLECCION.usuarios).doc(datos.id), {
      nombre: datos.nombre,
      email: datos.email ?? null,
      passwordHash: datos.passwordHash,
      activo: datos.activo,
      rolId: datos.rolId,
      actualizadoEn: ahoraServidor(),
    });
    return Usuario.desdePersistencia({ ...datos, rolCodigo: rol?.codigo ?? '', permisos: rol?.permisos ?? [] });
  }

  private async rolDe(rolId: string): Promise<RolDoc | null> {
    const snap = await this.cliente.obtener(this.cliente.coleccion(COLECCION.roles).doc(rolId));
    return snap.exists ? { codigo: snap.get('codigo'), permisos: snap.get('permisos') ?? [] } : null;
  }

  private async todosLosRoles(): Promise<Map<string, RolDoc>> {
    const q = await this.cliente.consultar(this.cliente.coleccion(COLECCION.roles));
    return new Map(q.docs.map((d) => [d.id, { codigo: d.get('codigo'), permisos: d.get('permisos') ?? [] }]));
  }

  private aDominio(snap: DocumentSnapshot, rol: RolDoc | null): Usuario {
    const d = snap.data()!;
    return Usuario.desdePersistencia({
      id: snap.id,
      documento: d.documento,
      nombre: d.nombre,
      email: d.email ?? null,
      passwordHash: d.passwordHash,
      activo: d.activo,
      rolId: d.rolId,
      rolCodigo: rol?.codigo ?? '',
      permisos: rol?.permisos ?? [],
    });
  }
}
