/**
 * REPOSITORIO DE USUARIOS — Implementación con Prisma
 * ===================================================
 *
 * Al leer un usuario se traen también el código de su rol y los códigos
 * de permiso de ese rol, en una sola consulta. Así la entidad `Usuario`
 * sale completa y puede responder `tienePermiso()` sin volver a la base.
 *
 * Recibe `ClientePrisma` (no `PrismaService`) para poder usarse dentro
 * de una transacción de la unidad de trabajo, igual que el de remisiones.
 */

import { Injectable } from '@nestjs/common';

import { Usuario } from '../../../domain/usuario/usuario.entity.js';
import type { UsuarioRepository } from '../../../domain/usuario/usuario.repository.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import type { ClientePrisma } from './cliente-prisma.js';

const INCLUIR_ROL_Y_PERMISOS = {
  rol: {
    select: {
      codigo: true,
      permisos: { select: { permiso: { select: { codigo: true } } } },
    },
  },
} satisfies Prisma.UsuarioInclude;

type RegistroUsuario = Prisma.UsuarioGetPayload<{
  include: typeof INCLUIR_ROL_Y_PERMISOS;
}>;

@Injectable()
export class UsuarioPrismaRepository implements UsuarioRepository {
  constructor(private readonly cliente: ClientePrisma) {}

  async buscarPorId(id: string): Promise<Usuario | null> {
    const registro = await this.cliente.usuario.findUnique({
      where: { id },
      include: INCLUIR_ROL_Y_PERMISOS,
    });
    return registro ? this.aDominio(registro) : null;
  }

  async buscarPorDocumento(documento: string): Promise<Usuario | null> {
    const registro = await this.cliente.usuario.findUnique({
      where: { documento },
      include: INCLUIR_ROL_Y_PERMISOS,
    });
    return registro ? this.aDominio(registro) : null;
  }

  async listar(): Promise<Usuario[]> {
    const registros = await this.cliente.usuario.findMany({
      include: INCLUIR_ROL_Y_PERMISOS,
      orderBy: { nombre: 'asc' },
    });
    return registros.map((r) => this.aDominio(r));
  }

  async actualizar(usuario: Usuario): Promise<Usuario> {
    const datos = usuario.aObjeto();

    const registro = await this.cliente.usuario.update({
      where: { id: datos.id },
      data: {
        nombre: datos.nombre,
        email: datos.email ?? null,
        passwordHash: datos.passwordHash,
        activo: datos.activo,
        rolId: datos.rolId,
      },
      include: INCLUIR_ROL_Y_PERMISOS,
    });

    return this.aDominio(registro);
  }

  async crear(usuario: Usuario): Promise<Usuario> {
    const datos = usuario.aObjeto();

    const registro = await this.cliente.usuario.create({
      data: {
        documento: datos.documento,
        nombre: datos.nombre,
        email: datos.email ?? null,
        passwordHash: datos.passwordHash,
        activo: datos.activo,
        rolId: datos.rolId,
      },
      include: INCLUIR_ROL_Y_PERMISOS,
    });

    return this.aDominio(registro);
  }

  private aDominio(registro: RegistroUsuario): Usuario {
    return Usuario.desdePersistencia({
      id: registro.id,
      documento: registro.documento,
      nombre: registro.nombre,
      email: registro.email,
      passwordHash: registro.passwordHash,
      activo: registro.activo,
      rolId: registro.rolId,
      rolCodigo: registro.rol.codigo,
      permisos: registro.rol.permisos.map((rp) => rp.permiso.codigo),
    });
  }
}
