import { Logger, Module } from '@nestjs/common';

import { EnviarCorreosDelCierreUseCase, ReenviarEnvioUseCase, type FuentesDeAdjuntos } from '../../application/correo/correo-cierre.use-cases.js';
import {
  ActualizarListaUseCase,
  CrearListaUseCase,
  EnviarRemisionesUseCase,
  type DependenciasEnvio,
} from '../../application/correo/correo.use-cases.js';
import { RELOJ, type Reloj } from '../../application/remision/crear-remision.use-case.js';
import { ImprimirRemisionesUseCase } from '../../application/remision/imprimir-remisiones.use-case.js';
import { CATALOGO_REPOSITORY, type CatalogoRepository } from '../../domain/catalogo/catalogo.repository.js';
import {
  ENVIADOR_DE_CORREO,
  ENVIO_CORREO_REPOSITORY,
  LISTA_DISTRIBUCION_REPOSITORY,
  type EnviadorDeCorreo,
  type EnvioCorreoRepository,
  type ListaDistribucionRepository,
} from '../../domain/correo/correo.js';
import { REMISION_REPOSITORY, type RemisionRepository } from '../../domain/remision/remision.repository.js';
import {
  GENERADOR_PDF_RESUMEN,
  RESUMEN_TURNO_REPOSITORY,
  type GeneradorPdfResumen,
  type ResumenTurnoRepository,
} from '../../domain/resumen/resumen-turno.js';
import { UNIDAD_DE_TRABAJO, type UnidadDeTrabajo } from '../../domain/shared/unidad-de-trabajo.js';
import { configCorreoDesdeEntorno, EnviadorNodemailer } from '../../infrastructure/correo/enviador-nodemailer.js';
import { PdfModule } from '../../infrastructure/pdf/pdf.module.js';
import { PersistenciaModule } from '../../infrastructure/persistence/persistencia.module.js';
import { RelojSistema } from '../../infrastructure/shared/reloj-sistema.js';
import { RemisionModule } from '../remision/remision.module.js';
import { CorreoController } from './correo.controller.js';

const DEPENDENCIAS_ENVIO = Symbol('DependenciasEnvio');
const FUENTES_ADJUNTOS = Symbol('FuentesDeAdjuntos');

const conUow =<T>(Clase: new (uow: UnidadDeTrabajo) => T) => ({ provide: Clase, inject: [UNIDAD_DE_TRABAJO], useFactory: (uow: UnidadDeTrabajo) => new Clase(uow) });

@Module({
  imports: [PersistenciaModule, RemisionModule, PdfModule],
  controllers: [CorreoController],
  providers: [
    { provide: RELOJ, useClass: RelojSistema },
    {
      provide: ENVIADOR_DE_CORREO,
      useFactory: () => {
        const enviador = new EnviadorNodemailer(configCorreoDesdeEntorno());
        if (enviador.enArchivo) {
          new Logger('Correo').warn('Sin CORREO_HOST en el .env: los correos se guardan como .eml en la carpeta de salida, no se envían.');
        }
        return enviador;
      },
    },
    conUow(CrearListaUseCase),
    conUow(ActualizarListaUseCase),
    {
      provide: DEPENDENCIAS_ENVIO,
      inject: [UNIDAD_DE_TRABAJO, ENVIADOR_DE_CORREO, RELOJ],
      useFactory: (uow: UnidadDeTrabajo, enviador: EnviadorDeCorreo, reloj: Reloj): DependenciasEnvio => ({ uow, enviador, reloj }),
    },
    {
      provide: FUENTES_ADJUNTOS,
      inject: [RESUMEN_TURNO_REPOSITORY, GENERADOR_PDF_RESUMEN, ImprimirRemisionesUseCase],
      useFactory: (resumenes: ResumenTurnoRepository, pdfResumen: GeneradorPdfResumen, imprimir: ImprimirRemisionesUseCase): FuentesDeAdjuntos => ({
        resumenes,
        pdfResumen,
        imprimir,
      }),
    },
    {
      provide: EnviarCorreosDelCierreUseCase,
      inject: [DEPENDENCIAS_ENVIO, FUENTES_ADJUNTOS, LISTA_DISTRIBUCION_REPOSITORY, CATALOGO_REPOSITORY, REMISION_REPOSITORY],
      useFactory: (deps: DependenciasEnvio, fuentes: FuentesDeAdjuntos, listas: ListaDistribucionRepository, catalogos: CatalogoRepository, remisiones: RemisionRepository) =>
        new EnviarCorreosDelCierreUseCase(deps, fuentes, listas, catalogos, remisiones),
    },
    {
      provide: ReenviarEnvioUseCase,
      inject: [DEPENDENCIAS_ENVIO, FUENTES_ADJUNTOS, ENVIO_CORREO_REPOSITORY, REMISION_REPOSITORY],
      useFactory: (deps: DependenciasEnvio, fuentes: FuentesDeAdjuntos, envios: EnvioCorreoRepository, remisiones: RemisionRepository) =>
        new ReenviarEnvioUseCase(deps, fuentes, envios, remisiones),
    },
    {
      provide: EnviarRemisionesUseCase,
      inject: [UNIDAD_DE_TRABAJO, REMISION_REPOSITORY, LISTA_DISTRIBUCION_REPOSITORY, ImprimirRemisionesUseCase, ENVIADOR_DE_CORREO, RELOJ],
      useFactory: (
        uow: UnidadDeTrabajo,
        remisiones: RemisionRepository,
        listas: ListaDistribucionRepository,
        imprimir: ImprimirRemisionesUseCase,
        enviador: EnviadorDeCorreo,
        reloj: Reloj,
      ) => new EnviarRemisionesUseCase(uow, remisiones, listas, imprimir, enviador, reloj),
    },
  ],
  // El cierre del turno (MfrModule) manda sus correos con este caso de uso.
  exports: [ENVIADOR_DE_CORREO, EnviarCorreosDelCierreUseCase],
})
export class CorreoModule {}
