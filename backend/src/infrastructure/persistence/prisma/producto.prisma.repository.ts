/**
 * REPOSITORIO DE PRODUCTOS — Implementación con Prisma
 * ===================================================
 *
 * Devuelve solo los campos declarados en la interfaz `Producto`: el
 * dominio no se entera de columnas como estándares de producción o
 * fechas de auditoría.
 *
 * El enum `ProcesoProducto` del dominio y el de Prisma tienen hoy los
 * mismos valores, pero se traducen con un `Record` explícito: si un
 * día divergen, TypeScript lo señala aquí y no en producción.
 */

import { Injectable } from '@nestjs/common';

import type {
  DatosNuevoProducto,
  DatosProducto,
  FiltroProductos,
  ProcesoProducto,
  Producto,
  ProductoRepository,
} from '../../../domain/producto/producto.repository.js';
import {
  ProcesoProducto as ProcesoPrisma,
  type Prisma,
} from '../../../generated/prisma/client.js';
import type { ClientePrisma } from './cliente-prisma.js';

const CAMPOS_PRODUCTO = {
  id: true,
  codigo: true,
  descripcion: true,
  proceso: true,
  activo: true,
  unidadesPorCaja: true,
  cajasPorEstiba: true,
  personasIdeal: true,
  subdescripcion: true,
  cajasPorHora: true,
  pesoNetoKg: true,
} as const;

type RegistroProducto = Prisma.ProductoGetPayload<{ select: typeof CAMPOS_PRODUCTO }>;

const A_PRISMA: Record<ProcesoProducto, ProcesoPrisma> = {
  MANUAL: ProcesoPrisma.MANUAL,
  AUTOMATICA: ProcesoPrisma.AUTOMATICA,
};

const A_DOMINIO: Record<ProcesoPrisma, ProcesoProducto> = {
  [ProcesoPrisma.MANUAL]: 'MANUAL',
  [ProcesoPrisma.AUTOMATICA]: 'AUTOMATICA',
};

@Injectable()
export class ProductoPrismaRepository implements ProductoRepository {
  constructor(private readonly cliente: ClientePrisma) {}

  async buscarPorId(id: string): Promise<Producto | null> {
    const registro = await this.cliente.producto.findUnique({
      where: { id },
      select: CAMPOS_PRODUCTO,
    });
    return registro ? aDominio(registro) : null;
  }

  async buscarPorCodigo(codigo: string): Promise<Producto | null> {
    const registro = await this.cliente.producto.findUnique({
      where: { codigo },
      select: CAMPOS_PRODUCTO,
    });
    return registro ? aDominio(registro) : null;
  }

  async listar(filtro: FiltroProductos): Promise<Producto[]> {
    const texto = filtro.texto?.trim();
    const registros = await this.cliente.producto.findMany({
      where: {
        ...(filtro.soloActivos ? { activo: true } : {}),
        ...(texto
          ? {
              OR: [
                { codigo: { contains: texto, mode: 'insensitive' } },
                { descripcion: { contains: texto, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: CAMPOS_PRODUCTO,
      orderBy: { codigo: 'asc' },
    });
    return registros.map(aDominio);
  }

  async crear(datos: DatosNuevoProducto): Promise<Producto> {
    const registro = await this.cliente.producto.create({
      data: {
        codigo: datos.codigo,
        descripcion: datos.descripcion,
        proceso: datos.proceso ? A_PRISMA[datos.proceso] : null,
        unidadesPorCaja: datos.unidadesPorCaja,
        cajasPorEstiba: datos.cajasPorEstiba,
        personasIdeal: datos.personasIdeal,
        subdescripcion: datos.subdescripcion,
        cajasPorHora: datos.cajasPorHora ?? null,
        pesoNetoKg: datos.pesoNetoKg ?? null,
      },
      select: CAMPOS_PRODUCTO,
    });
    return aDominio(registro);
  }

  async actualizar(
    id: string,
    cambios: Partial<DatosProducto> & { activo?: boolean },
  ): Promise<Producto> {
    const { activo, ...datos } = cambios;
    const registro = await this.cliente.producto.update({
      where: { id },
      data: { ...aPrisma(datos), ...(activo !== undefined ? { activo } : {}) },
      select: CAMPOS_PRODUCTO,
    });
    return aDominio(registro);
  }
}

function aDominio(registro: RegistroProducto): Producto {
  return {
    ...registro,
    proceso: registro.proceso ? A_DOMINIO[registro.proceso] : null,
    cajasPorHora: registro.cajasPorHora === null ? null : registro.cajasPorHora.toNumber(),
    pesoNetoKg: registro.pesoNetoKg === null ? null : registro.pesoNetoKg.toNumber(),
  };
}

function aPrisma(datos: Partial<DatosProducto>): Prisma.ProductoUpdateInput {
  return {
    ...(datos.codigo !== undefined ? { codigo: datos.codigo } : {}),
    ...(datos.descripcion !== undefined ? { descripcion: datos.descripcion } : {}),
    ...(datos.proceso !== undefined
      ? { proceso: datos.proceso ? A_PRISMA[datos.proceso] : null }
      : {}),
    ...(datos.unidadesPorCaja !== undefined
      ? { unidadesPorCaja: datos.unidadesPorCaja }
      : {}),
    ...(datos.cajasPorEstiba !== undefined
      ? { cajasPorEstiba: datos.cajasPorEstiba }
      : {}),
    ...(datos.personasIdeal !== undefined ? { personasIdeal: datos.personasIdeal } : {}),
    ...(datos.subdescripcion !== undefined ? { subdescripcion: datos.subdescripcion } : {}),
  };
}
