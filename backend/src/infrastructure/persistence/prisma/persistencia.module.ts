/**
 * MÓDULO DE PERSISTENCIA
 * ======================
 *
 * Registra las piezas de persistencia que comparten varios módulos de
 * negocio: la unidad de trabajo y los repositorios de solo lectura.
 *
 * Antes la unidad de trabajo vivía en `RemisionModule`. Al aparecer el
 * módulo de autenticación (que también escribe con auditoría), se movió
 * aquí para que ambos la importen de un solo lugar.
 *
 * Las instancias de solo lectura van ligadas al cliente normal (sin
 * transacción). Las ESCRITURAS no pasan por ellas: van por la unidad de
 * trabajo, que crea sus propias instancias ligadas a la transacción.
 */

import { Module } from '@nestjs/common';

import { PRODUCTO_REPOSITORY } from '../../../domain/producto/producto.repository.js';
import { REMISION_REPOSITORY } from '../../../domain/remision/remision.repository.js';
import { UNIDAD_DE_TRABAJO } from '../../../domain/shared/unidad-de-trabajo.js';
import { USUARIO_REPOSITORY } from '../../../domain/usuario/usuario.repository.js';
import { PrismaModule } from '../../database/prisma/prisma.module.js';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { ProductoPrismaRepository } from './producto.prisma.repository.js';
import { RemisionPrismaRepository } from './remision.prisma.repository.js';
import { UnidadDeTrabajoPrisma } from './unidad-de-trabajo.prisma.js';
import { UsuarioPrismaRepository } from './usuario.prisma.repository.js';

@Module({
  imports: [PrismaModule],
  providers: [
    { provide: UNIDAD_DE_TRABAJO, useClass: UnidadDeTrabajoPrisma },
    {
      provide: REMISION_REPOSITORY,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) =>
        new RemisionPrismaRepository(prisma),
    },
    {
      provide: PRODUCTO_REPOSITORY,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) =>
        new ProductoPrismaRepository(prisma),
    },
    {
      provide: USUARIO_REPOSITORY,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) =>
        new UsuarioPrismaRepository(prisma),
    },
  ],
  exports: [
    UNIDAD_DE_TRABAJO,
    REMISION_REPOSITORY,
    PRODUCTO_REPOSITORY,
    USUARIO_REPOSITORY,
  ],
})
export class PersistenciaModule {}
