/**
 * GRUPOS — Implementación con Prisma
 * ==================================
 */

import { Injectable } from '@nestjs/common';

import type { DatosGrupo, Grupo, GrupoRepository } from '../../../domain/grupo/grupo.repository.js';
import type { ClientePrisma } from './cliente-prisma.js';

@Injectable()
export class GrupoPrismaRepository implements GrupoRepository {
  constructor(private readonly cliente: ClientePrisma) {}

  listar(): Promise<Grupo[]> {
    return this.cliente.grupo.findMany({ orderBy: { codigo: 'asc' } });
  }

  buscarPorId(id: string): Promise<Grupo | null> {
    return this.cliente.grupo.findUnique({ where: { id } });
  }

  buscarPorCodigo(codigo: string): Promise<Grupo | null> {
    return this.cliente.grupo.findUnique({ where: { codigo } });
  }

  crear(datos: DatosGrupo): Promise<Grupo> {
    return this.cliente.grupo.create({ data: datos });
  }

  actualizar(id: string, cambios: Partial<DatosGrupo> & { activo?: boolean }): Promise<Grupo> {
    return this.cliente.grupo.update({ where: { id }, data: cambios });
  }
}
