/**
 * CATÁLOGOS — Implementación con Prisma
 * =====================================
 *
 * Lecturas simples; devuelven solo `id, codigo, nombre, activo`, que es
 * lo que declara `ItemCatalogo`. Los inactivos también se devuelven:
 * el frontend decide si los muestra (p. ej. atenuados en un histórico).
 */

import { Injectable } from '@nestjs/common';

import type {
  CatalogoRepository,
  ItemCatalogo,
} from '../../../domain/catalogo/catalogo.repository.js';
import type { ClientePrisma } from './cliente-prisma.js';

const CAMPOS = { id: true, codigo: true, nombre: true, activo: true } as const;
const ORDEN = { codigo: 'asc' } as const;

@Injectable()
export class CatalogoPrismaRepository implements CatalogoRepository {
  constructor(private readonly cliente: ClientePrisma) {}

  listarTurnos(): Promise<ItemCatalogo[]> {
    return this.cliente.turno.findMany({ select: CAMPOS, orderBy: ORDEN });
  }

  listarLugares(): Promise<ItemCatalogo[]> {
    return this.cliente.lugar.findMany({ select: CAMPOS, orderBy: ORDEN });
  }

  listarRoles(): Promise<ItemCatalogo[]> {
    return this.cliente.rol.findMany({ select: CAMPOS, orderBy: ORDEN });
  }
}
