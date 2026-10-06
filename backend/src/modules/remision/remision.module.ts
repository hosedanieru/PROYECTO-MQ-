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
import { PdfModule } from '../../infrastructure/pdf/pdf.module.js';
import {
  AprobarRemisionUseCase,
  EntregarRemisionUseCase,
  RechazarRemisionUseCase,
  RectificarRemisionUseCase,
  ValidarRemisionUseCase,
} from '../../application/remision/flujo-remision.use-cases.js';
import { HORARIO_REPOSITORY, type HorarioRepository } from '../../domain/mfr/horas-turno.js';
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
import { ConsultarFirmasUseCase, FirmaDeRemision, FirmarRemisionUseCase } from '../../application/remision/firma-remision.use-cases.js';
import {
  CALCULADOR_HUELLA,
  CONFIGURACION_FIRMA,
  FIRMA_REMISION_REPOSITORY,
  type CalculadorHuella,
  type ConfiguracionFirma,
  type FirmaRemisionRepository,
} from '../../domain/remision/firma-remision.js';
import { HASH_CONTRASENA, type HashContrasena } from '../../domain/usuario/contrasena.js';
import { USUARIO_REPOSITORY, type UsuarioRepository } from '../../domain/usuario/usuario.repository.js';
import { BcryptHashService } from '../../infrastructure/auth/bcrypt-hash.service.js';
import { CalculadorHuellaSha256 } from '../../infrastructure/shared/calculador-huella.js';

/**
 * Los casos de uso del flujo comparten la misma firma
 * (unidad de trabajo, reloj), así que se registran con un ayudante.
 */
const casosUsoFlujo = [
  EntregarRemisionUseCase,
  RechazarRemisionUseCase,
  RectificarRemisionUseCase,
].map((CasoUso) => ({
  provide: CasoUso,
  inject: [UNIDAD_DE_TRABAJO, RELOJ],
  useFactory: (uow: UnidadDeTrabajo, reloj: Reloj) =>
    new CasoUso(uow, reloj),
}));

@Module({
  imports: [PersistenciaModule, PdfModule],
  controllers: [RemisionController],
  providers: [
    { provide: RELOJ, useClass: RelojSistema },
    { provide: EXPORTADOR_EXCEL_REMISION, useClass: ExceljsExportadorService },
    {
      provide: ImprimirRemisionesUseCase,
      inject: [REMISION_REPOSITORY, CATALOGO_REPOSITORY, GRUPO_REPOSITORY, GENERADOR_PDF_REMISION, FIRMA_REMISION_REPOSITORY, CALCULADOR_HUELLA],
      useFactory: (
        remisiones: RemisionRepository,
        catalogos: CatalogoRepository,
        grupos: GrupoRepository,
        generador: GeneradorPdfRemision,
        firmas: FirmaRemisionRepository,
        huella: CalculadorHuella,
      ) => new ImprimirRemisionesUseCase(remisiones, { catalogos, grupos }, generador, firmas, huella),
    },
    // Firma electrónica (2026-10-05): la contraseña se verifica con el mismo hash del login.
    { provide: HASH_CONTRASENA, useClass: BcryptHashService },
    { provide: CALCULADOR_HUELLA, useClass: CalculadorHuellaSha256 },
    {
      provide: FirmaDeRemision,
      inject: [USUARIO_REPOSITORY, HASH_CONTRASENA, CALCULADOR_HUELLA, RELOJ],
      useFactory: (usuarios: UsuarioRepository, hash: HashContrasena, huella: CalculadorHuella, reloj: Reloj) =>
        new FirmaDeRemision(usuarios, hash, huella, reloj),
    },
    {
      // Fin del piloto = FIRMA_ELECTRONICA_PILOTO="false" (solo con el aval de PepsiCo y del área legal):
      // las firmas pasan a ser obligatorias para aprobar y validar.
      provide: CONFIGURACION_FIRMA,
      useFactory: (): ConfiguracionFirma => ({ modo: process.env.FIRMA_ELECTRONICA_PILOTO === 'false' ? 'OBLIGATORIA' : 'PILOTO' }),
    },
    {
      provide: ValidarRemisionUseCase,
      inject: [UNIDAD_DE_TRABAJO, RELOJ, FirmaDeRemision, CONFIGURACION_FIRMA],
      useFactory: (uow: UnidadDeTrabajo, reloj: Reloj, firma: FirmaDeRemision, configuracion: ConfiguracionFirma) =>
        new ValidarRemisionUseCase(uow, reloj, firma, configuracion),
    },
    {
      provide: FirmarRemisionUseCase,
      inject: [UNIDAD_DE_TRABAJO, FirmaDeRemision],
      useFactory: (uow: UnidadDeTrabajo, firma: FirmaDeRemision) => new FirmarRemisionUseCase(uow, firma),
    },
    {
      provide: ConsultarFirmasUseCase,
      inject: [REMISION_REPOSITORY, FIRMA_REMISION_REPOSITORY, CALCULADOR_HUELLA, CONFIGURACION_FIRMA],
      useFactory: (remisiones: RemisionRepository, firmas: FirmaRemisionRepository, huella: CalculadorHuella, configuracion: ConfiguracionFirma) =>
        new ConsultarFirmasUseCase(remisiones, firmas, huella, configuracion),
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
    {
      // Aprobar también descuenta PI e insumos (necesita el turno del momento)
      // y, si el OPA aprueba firmando, registra su firma en la misma transacción.
      provide: AprobarRemisionUseCase,
      inject: [UNIDAD_DE_TRABAJO, RELOJ, HORARIO_REPOSITORY, FirmaDeRemision, CONFIGURACION_FIRMA],
      useFactory: (uow: UnidadDeTrabajo, reloj: Reloj, horarios: HorarioRepository, firma: FirmaDeRemision, configuracion: ConfiguracionFirma) =>
        new AprobarRemisionUseCase(uow, reloj, horarios, firma, configuracion),
    },
  ],
  // El correo adjunta el mismo PDF que se imprime.
  exports: [ImprimirRemisionesUseCase],
})
export class RemisionModule {}
