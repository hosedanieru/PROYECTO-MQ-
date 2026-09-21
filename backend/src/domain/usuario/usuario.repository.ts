/**
 * USUARIO — Puerto de persistencia
 * ================================
 *
 * Lo que los casos de uso de autenticación necesitan de la base de datos.
 * La implementación con Prisma vive en infraestructura.
 */

import type { Usuario } from './usuario.entity.js';

export interface UsuarioRepository {
  buscarPorId(id: string): Promise<Usuario | null>;
  buscarPorDocumento(documento: string): Promise<Usuario | null>;
  /** Todos los usuarios, activos e inactivos, ordenados por nombre. */
  listar(): Promise<Usuario[]>;
  /**
   * Persiste un usuario nuevo y devuelve la instancia completa, con el
   * `id` asignado y los permisos del rol ya resueltos.
   */
  crear(usuario: Usuario): Promise<Usuario>;
  /** Guarda los cambios y devuelve la instancia con el rol re-resuelto. */
  actualizar(usuario: Usuario): Promise<Usuario>;
}

export const USUARIO_REPOSITORY = Symbol('UsuarioRepository');
