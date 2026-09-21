/**
 * CATÁLOGOS DE REFERENCIA — Puerto de consulta
 * ============================================
 *
 * Listas cortas que el frontend necesita para llenar selectores:
 * turnos, lugares y roles. Se administran por seed; por ahora solo se
 * leen. Los grupos (antes "proveedores") tienen su propio puerto con
 * escritura: `domain/grupo/grupo.repository.ts`.
 */

export interface ItemCatalogo {
  id: string;
  codigo: string;
  nombre: string;
  activo: boolean;
}

export interface CatalogoRepository {
  listarTurnos(): Promise<ItemCatalogo[]>;
  listarLugares(): Promise<ItemCatalogo[]>;
  listarRoles(): Promise<ItemCatalogo[]>;
}

export const CATALOGO_REPOSITORY = Symbol('CatalogoRepository');
