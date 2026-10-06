import { Logger, Module } from '@nestjs/common';

import { ActualizarListaUseCase, CrearListaUseCase, EnviarRemisionesUseCase } from '../../application/correo/correo.use-cases.js';
import { RELOJ, type Reloj } from '../../application/remision/crear-remision.use-case.js';
import { ImprimirRemisionesUseCase } from '../../application/remision/imprimir-remisiones.use-case.js';
import {
  ENVIADOR_DE_CORREO,
  LISTA_DISTRIBUCION_REPOSITORY,
  type EnviadorDeCorreo,
  type ListaDistribucionRepository,
} from '../../domain/correo/correo.js';
import { REMISION_REPOSITORY, type RemisionRepository } from '../../domain/remision/remision.repository.js';
import { UNIDAD_DE_TRABAJO, type UnidadDeTrabajo } from '../../domain/shared/unidad-de-trabajo.js';
import { configCorreoDesdeEntorno, EnviadorNodemailer } from '../../infrastructure/correo/enviador-nodemailer.js';
import { PersistenciaModule } from '../../infrastructure/persistence/persistencia.module.js';
import { RelojSistema } from '../../infrastructure/shared/reloj-sistema.js';
import { RemisionModule } from '../remision/remision.module.js';
import { CorreoController } from './correo.controller.js';

const conUow = <T>(Clase: new (uow: UnidadDeTrabajo) => T) => ({ provide: Clase, inject: [UNIDAD_DE_TRABAJO], useFactory: (uow: UnidadDeTrabajo) => new Clase(uow) });

@Module({
  imports: [PersistenciaModule, RemisionModule],
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
  // La fase 2 (envío automático al cerrar el turno) usa el mismo enviador.
  exports: [ENVIADOR_DE_CORREO],
})
export class CorreoModule {}
