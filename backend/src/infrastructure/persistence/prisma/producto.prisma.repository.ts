/**
 * REPOSITORIO DE PRODUCTOS — Implementación con Prisma
 * ===================================================
 *
 * Implementa la vista de catálogo que necesita el dominio. Devuelve solo
 * los campos declarados en la interfaz `Producto`: el dominio no se
 * entera de columnas como estándares de producción o auditoría.
 */

import { Injectable } from '@nestjs/common';

import type {
  Producto,
  ProductoRepository,
} from '../../../domain/producto/producto.repository.js';
import { PrismaService } from '../../database/prisma/prisma.service.js';

const CAMPOS_PRODUCTO = {
  id: true,
  codigo: true,
  descripcion: true,
  activo: true,
  unidadesPorCaja: true,
  cajasPorEstiba: true,
} as const;

@Injectable()
export class ProductoPrismaRepository implements ProductoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async buscarPorId(id: string): Promise<Producto | null> {
    return this.prisma.producto.findUnique({
      where: { id },
      select: CAMPOS_PRODUCTO,
    });
  }

  async buscarPorCodigo(codigo: string): Promise<Producto | null> {
    return this.prisma.producto.findUnique({
      where: { codigo },
      select: CAMPOS_PRODUCTO,
    });
  }
}
