import { Module } from '@nestjs/common';

import {
  ActualizarItemUseCase,
  CrearItemUseCase,
  RegistrarEntradaMercanciaUseCase,
  RegistrarMovimientoUseCase,
} from '../../application/inventario/inventario.use-cases.js';
import { RELOJ, type Reloj } from '../../application/remision/crear-remision.use-case.js';
import { HORARIO_REPOSITORY, type HorarioRepository } from '../../domain/mfr/horas-turno.js';
import { UNIDAD_DE_TRABAJO, type UnidadDeTrabajo } from '../../domain/shared/unidad-de-trabajo.js';
import { PersistenciaModule } from '../../infrastructure/persistence/persistencia.module.js';
import { RelojSistema } from '../../infrastructure/shared/reloj-sistema.js';
import { InventarioController } from './inventario.controller.js';

const conUow = <T>(Clase: new (uow: UnidadDeTrabajo) => T) => ({
  provide: Clase,
  inject: [UNIDAD_DE_TRABAJO],
  useFactory: (uow: UnidadDeTrabajo) => new Clase(uow),
});

@Module({
  imports: [PersistenciaModule],
  controllers: [InventarioController],
  providers: [
    { provide: RELOJ, useClass: RelojSistema },
    conUow(CrearItemUseCase),
    conUow(ActualizarItemUseCase),
    {
      provide: RegistrarEntradaMercanciaUseCase,
      inject: [UNIDAD_DE_TRABAJO, HORARIO_REPOSITORY, RELOJ],
      useFactory: (uow: UnidadDeTrabajo, h: HorarioRepository, reloj: Reloj) => new RegistrarEntradaMercanciaUseCase(uow, h, reloj),
    },
    {
      provide: RegistrarMovimientoUseCase,
      inject: [UNIDAD_DE_TRABAJO, HORARIO_REPOSITORY, RELOJ],
      useFactory: (uow: UnidadDeTrabajo, h: HorarioRepository, reloj: Reloj) => new RegistrarMovimientoUseCase(uow, h, reloj),
    },
  ],
})
export class InventarioModule {}
