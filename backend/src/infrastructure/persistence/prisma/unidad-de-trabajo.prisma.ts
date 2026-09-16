/**
 * UNIDAD DE TRABAJO — Implementación con Prisma
 * =============================================
 *
 * Abre una transacción interactiva y construye, ligados al cliente `tx`,
 * los repositorios que el caso de uso necesita. Todo lo que ocurra
 * dentro del callback se confirma o se revierte como un solo bloque.
 *
 * Es el ÚNICO lugar de la aplicación donde se llama a `$transaction`.
 * Los repositorios reciben `ClientePrisma` (sin `$transaction`) para que
 * no puedan abrir transacciones anidadas por accidente.
 */

import { Injectable } from '@nestjs/common';

import type {
  ContextoTransaccional,
  UnidadDeTrabajo,
} from '../../../domain/shared/unidad-de-trabajo.js';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { AuditoriaPrismaRepository } from './auditoria.prisma.repository.js';
import { RemisionPrismaRepository } from './remision.prisma.repository.js';
import { UsuarioPrismaRepository } from './usuario.prisma.repository.js';

/**
 * Cuánto puede tardar el trabajo antes de que Prisma revierta la
 * transacción. Las operaciones de remisión son pocas escrituras, pero
 * el bloqueo de fila del consecutivo puede hacer esperar a un segundo
 * coordinador, así que se deja margen sobre el default (5 s).
 */
const TIEMPO_MAXIMO_MS = 15_000;

@Injectable()
export class UnidadDeTrabajoPrisma implements UnidadDeTrabajo {
  constructor(private readonly prisma: PrismaService) {}

  ejecutar<T>(
    trabajo: (contexto: ContextoTransaccional) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(
      (tx) =>
        trabajo({
          remisiones: new RemisionPrismaRepository(tx),
          usuarios: new UsuarioPrismaRepository(tx),
          auditoria: new AuditoriaPrismaRepository(tx),
        }),
      { timeout: TIEMPO_MAXIMO_MS },
    );
  }
}
