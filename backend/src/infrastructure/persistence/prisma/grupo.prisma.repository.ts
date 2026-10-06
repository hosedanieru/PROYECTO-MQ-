/**
 * GRUPOS — Implementación con Prisma
 * ==================================
 *
 * Las esperadas por turno viven en `grupo_esperadas_turno`; al actualizar
 * se reemplazan completas (lo que no se envía deja de esperarse).
 */

import { Injectable } from '@nestjs/common';

import type { DatosGrupo, EsperadasPorTurno, Grupo, GrupoRepository } from '../../../domain/grupo/grupo.repository.js';
import type { ClientePrisma } from './cliente-prisma.js';

const INCLUIR = { esperadasPorTurno: { select: { turnoId: true, personas: true } } } as const;

interface FilaGrupo {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  esperadasPorTurno: Array<{ turnoId: string; personas: number }>;
}

const aDominio = (f: FilaGrupo): Grupo => ({
  id: f.id,
  codigo: f.codigo,
  nombre: f.nombre,
  descripcion: f.descripcion,
  activo: f.activo,
  esperadasPorTurno: Object.fromEntries(f.esperadasPorTurno.map((e) => [e.turnoId, e.personas])),
});

const filas = (esperadas: EsperadasPorTurno) => Object.entries(esperadas).map(([turnoId, personas]) => ({ turnoId, personas }));

@Injectable()
export class GrupoPrismaRepository implements GrupoRepository {
  constructor(private readonly cliente: ClientePrisma) {}

  async listar(): Promise<Grupo[]> {
    return (await this.cliente.grupo.findMany({ orderBy: { codigo: 'asc' }, include: INCLUIR })).map(aDominio);
  }

  async buscarPorId(id: string): Promise<Grupo | null> {
    const fila = await this.cliente.grupo.findUnique({ where: { id }, include: INCLUIR });
    return fila ? aDominio(fila) : null;
  }

  async buscarPorCodigo(codigo: string): Promise<Grupo | null> {
    const fila = await this.cliente.grupo.findUnique({ where: { codigo }, include: INCLUIR });
    return fila ? aDominio(fila) : null;
  }

  async crear({ esperadasPorTurno, ...datos }: DatosGrupo): Promise<Grupo> {
    const fila = await this.cliente.grupo.create({
      data: { ...datos, esperadasPorTurno: { create: filas(esperadasPorTurno) } },
      include: INCLUIR,
    });
    return aDominio(fila);
  }

  async actualizar(id: string, { esperadasPorTurno, ...cambios }: Partial<DatosGrupo> & { activo?: boolean }): Promise<Grupo> {
    const fila = await this.cliente.grupo.update({
      where: { id },
      data: {
        ...cambios,
        ...(esperadasPorTurno ? { esperadasPorTurno: { deleteMany: {}, create: filas(esperadasPorTurno) } } : {}),
      },
      include: INCLUIR,
    });
    return aDominio(fila);
  }
}
