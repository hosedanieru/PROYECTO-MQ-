import { Module } from '@nestjs/common';

import { ActualizarCausalUseCase, CrearCausalUseCase } from '../../application/averia/causal-averia.use-cases.js';
import {
  AnularReporteAveriaUseCase,
  CorregirRegistroAveriaUseCase,
  CrearReporteAveriaUseCase,
} from '../../application/averia/reporte-averia.use-cases.js';
import { RELOJ, type Reloj } from '../../application/remision/crear-remision.use-case.js';
import { ALMACEN_DE_EVIDENCIAS, type AlmacenDeEvidencias } from '../../domain/averia/almacen-evidencias.js';
import { HORARIO_REPOSITORY, type HorarioRepository } from '../../domain/mfr/horas-turno.js';
import { UNIDAD_DE_TRABAJO, type UnidadDeTrabajo } from '../../domain/shared/unidad-de-trabajo.js';
import { AlmacenEvidenciasDisco } from '../../infrastructure/evidencias/almacen-disco.js';
import { PersistenciaModule } from '../../infrastructure/persistence/persistencia.module.js';
import { RelojSistema } from '../../infrastructure/shared/reloj-sistema.js';
import { CausalAveriaController } from './causal-averia.controller.js';
import { ReporteAveriaController } from './reporte-averia.controller.js';

const conUow = <T>(Clase: new (uow: UnidadDeTrabajo) => T) => ({
  provide: Clase,
  inject: [UNIDAD_DE_TRABAJO],
  useFactory: (uow: UnidadDeTrabajo) => new Clase(uow),
});

@Module({
  imports: [PersistenciaModule],
  // Causales primero: GET /averias/causales no debe caer en GET /averias/:id.
  controllers: [CausalAveriaController, ReporteAveriaController],
  providers: [
    { provide: RELOJ, useClass: RelojSistema },
    // El almacén de fotos no depende de PERSISTENCIA: hoy es el disco local.
    { provide: ALMACEN_DE_EVIDENCIAS, useClass: AlmacenEvidenciasDisco },
    conUow(CrearCausalUseCase),
    conUow(ActualizarCausalUseCase),
    conUow(CorregirRegistroAveriaUseCase),
    {
      provide: CrearReporteAveriaUseCase,
      inject: [UNIDAD_DE_TRABAJO, HORARIO_REPOSITORY, ALMACEN_DE_EVIDENCIAS, RELOJ],
      useFactory: (uow: UnidadDeTrabajo, h: HorarioRepository, a: AlmacenDeEvidencias, reloj: Reloj) =>
        new CrearReporteAveriaUseCase(uow, h, a, reloj),
    },
    {
      provide: AnularReporteAveriaUseCase,
      inject: [UNIDAD_DE_TRABAJO, RELOJ],
      useFactory: (uow: UnidadDeTrabajo, reloj: Reloj) => new AnularReporteAveriaUseCase(uow, reloj),
    },
  ],
})
export class AveriaModule {}
