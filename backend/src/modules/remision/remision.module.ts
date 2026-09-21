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
import { EditarRemisionUseCase } from '../../application/remision/editar-remision.use-case.js';
import { ExportarRemisionesUseCase } from '../../application/remision/exportar-remisiones.use-case.js';
import { ImprimirRemisionesUseCase } from '../../application/remision/imprimir-remisiones.use-case.js';
import {
  CATALOGO_REPOSITORY,
  type CatalogoRepository,
} from '../../domain/catalogo/catalogo.repository.js';
import { GRUPO_REPOSITORY, type GrupoRepository } from '../../domain/grupo/grupo.repository.js';
import {
  EXPORTADOR_EXCEL_REMISION,
  type ExportadorExcelRemision,
} from '../../domain/remision/exportador-excel.js';
import {
  GENERADOR_PDF_REMISION,
  type GeneradorPdfRemision,
} from '../../domain/remision/generador-pdf.js';
import {
  REMISION_REPOSITORY,
  type RemisionRepository,
} from '../../domain/remision/remision.repository.js';
import { ExceljsExportadorService } from '../../infrastructure/excel/exceljs-exportador.service.js';
import { PuppeteerPdfService } from '../../infrastructure/pdf/puppeteer-pdf.service.js';
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
import { PersistenciaModule } from '../../infrastructure/persistence/persistencia.module.js';
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
    { provide: GENERADOR_PDF_REMISION, useClass: PuppeteerPdfService },
    { provide: EXPORTADOR_EXCEL_REMISION, useClass: ExceljsExportadorService },
    {
      provide: ImprimirRemisionesUseCase,
      inject: [REMISION_REPOSITORY, CATALOGO_REPOSITORY, GRUPO_REPOSITORY, GENERADOR_PDF_REMISION],
      useFactory: (
        remisiones: RemisionRepository,
        catalogos: CatalogoRepository,
        grupos: GrupoRepository,
        generador: GeneradorPdfRemision,
      ) => new ImprimirRemisionesUseCase(remisiones, { catalogos, grupos }, generador),
    },
    {
      provide: ExportarRemisionesUseCase,
      inject: [REMISION_REPOSITORY, CATALOGO_REPOSITORY, GRUPO_REPOSITORY, EXPORTADOR_EXCEL_REMISION],
      useFactory: (
        remisiones: RemisionRepository,
        catalogos: CatalogoRepository,
        grupos: GrupoRepository,
        exportador: ExportadorExcelRemision,
      ) => new ExportarRemisionesUseCase(remisiones, { catalogos, grupos }, exportador),
    },
    {
      provide: CrearRemisionUseCase,
      inject: [UNIDAD_DE_TRABAJO, PRODUCTO_REPOSITORY, RELOJ],
      useFactory: (
        uow: UnidadDeTrabajo,
        productos: ProductoRepository,
        reloj: Reloj,
      ) => new CrearRemisionUseCase(uow, productos, reloj),
    },
    {
      provide: EditarRemisionUseCase,
      inject: [UNIDAD_DE_TRABAJO, PRODUCTO_REPOSITORY],
      useFactory: (uow: UnidadDeTrabajo, productos: ProductoRepository) =>
        new EditarRemisionUseCase(uow, productos),
    },
    ...casosUsoFlujo,
  ],
})
export class RemisionModule {}
