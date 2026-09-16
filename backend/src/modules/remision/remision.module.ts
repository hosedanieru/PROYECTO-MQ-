/**
 * MÓDULO DE REMISIONES
 * ====================
 *
 * Aquí se hace el "wiring": se le dice a NestJS qué implementación
 * concreta usar para cada interfaz del dominio.
 *
 * Fíjate en la dirección de las dependencias:
 *
 *   Controlador  →  Caso de uso  →  Interfaz del repositorio
 *                                          ↑
 *                                   Repositorio de Prisma
 *
 * El caso de uso depende de la INTERFAZ, nunca de Prisma. La flecha de
 * la implementación apunta hacia arriba, hacia el dominio.
 *
 * Por qué tantos `useFactory` en lugar de `useClass`: las interfaces de
 * TypeScript no existen en tiempo de ejecución, así que NestJS no puede
 * resolverlas solo. Los repositorios y la unidad de trabajo se registran
 * en `PersistenciaModule`; aquí solo se arman los casos de uso.
 */

import { Module } from '@nestjs/common';

import {
  CrearRemisionUseCase,
  RELOJ,
  type Reloj,
} from '../../application/remision/crear-remision.use-case.js';
import {
  AprobarRemisionUseCase,
  EntregarRemisionUseCase,
  RechazarRemisionUseCase,
  RectificarRemisionUseCase,
  ValidarRemisionUseCase,
} from '../../application/remision/flujo-remision.use-cases.js';
import {
  PRODUCTO_REPOSITORY,
  type ProductoRepository,
} from '../../domain/producto/producto.repository.js';
import {
  UNIDAD_DE_TRABAJO,
  type UnidadDeTrabajo,
} from '../../domain/shared/unidad-de-trabajo.js';
import { PersistenciaModule } from '../../infrastructure/persistence/prisma/persistencia.module.js';
import { RelojSistema } from '../../infrastructure/shared/reloj-sistema.js';
import { RemisionController } from './remision.controller.js';

/**
 * Los casos de uso del flujo comparten la misma firma
 * (unidad de trabajo, reloj), así que se registran con un ayudante.
 */
const casosUsoFlujo = [
  EntregarRemisionUseCase,
  AprobarRemisionUseCase,
  RechazarRemisionUseCase,
  RectificarRemisionUseCase,
  ValidarRemisionUseCase,
].map((CasoUso) => ({
  provide: CasoUso,
  inject: [UNIDAD_DE_TRABAJO, RELOJ],
  useFactory: (uow: UnidadDeTrabajo, reloj: Reloj) =>
    new CasoUso(uow, reloj),
}));

@Module({
  imports: [PersistenciaModule],
  controllers: [RemisionController],
  providers: [
    { provide: RELOJ, useClass: RelojSistema },
    {
      provide: CrearRemisionUseCase,
      inject: [UNIDAD_DE_TRABAJO, PRODUCTO_REPOSITORY, RELOJ],
      useFactory: (
        uow: UnidadDeTrabajo,
        productos: ProductoRepository,
        reloj: Reloj,
      ) => new CrearRemisionUseCase(uow, productos, reloj),
    },
    ...casosUsoFlujo,
  ],
})
export class RemisionModule {}
