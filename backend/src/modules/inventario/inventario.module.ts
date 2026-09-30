import { Module } from '@nestjs/common';

import {
  ActualizarMaterialUseCase,
  ActualizarUnidadUseCase,
  CrearMaterialUseCase,
  CrearUnidadUseCase,
} from '../../application/inventario/catalogo-inventario.use-cases.js';
import {
  RegistrarEntradaMercanciaUseCase,
  RegistrarMovimientoUseCase,
} from '../../application/inventario/inventario.use-cases.js';
import { ConsultarRecetaUseCase, GuardarRecetaUseCase } from '../../application/inventario/receta.use-cases.js';
import { RELOJ, type Reloj } from '../../application/remision/crear-remision.use-case.js';
import { ITEM_INVENTARIO_REPOSITORY, type ItemInventarioRepository } from '../../domain/inventario/item-inventario.js';
import { RECETA_REPOSITORY, type RecetaRepository } from '../../domain/inventario/receta.js';
import { HORARIO_REPOSITORY, type HorarioRepository } from '../../domain/mfr/horas-turno.js';
import { UNIDAD_DE_TRABAJO, type UnidadDeTrabajo } from '../../domain/shared/unidad-de-trabajo.js';
import { PersistenciaModule } from '../../infrastructure/persistence/persistencia.module.js';
import { RelojSistema } from '../../infrastructure/shared/reloj-sistema.js';
import { CatalogoInventarioController } from './catalogo-inventario.controller.js';
import { InventarioController } from './inventario.controller.js';

const conUow = <T>(Clase: new (uow: UnidadDeTrabajo) => T) => ({
  provide: Clase,
  inject: [UNIDAD_DE_TRABAJO],
  useFactory: (uow: UnidadDeTrabajo) => new Clase(uow),
});

@Module({
  imports: [PersistenciaModule],
  controllers: [InventarioController, CatalogoInventarioController],
  providers: [
    { provide: RELOJ, useClass: RelojSistema },
    conUow(CrearUnidadUseCase),
    conUow(ActualizarUnidadUseCase),
    conUow(CrearMaterialUseCase),
    conUow(ActualizarMaterialUseCase),
    {
      provide: GuardarRecetaUseCase,
      inject: [UNIDAD_DE_TRABAJO, RELOJ],
      useFactory: (uow: UnidadDeTrabajo, reloj: Reloj) => new GuardarRecetaUseCase(uow, reloj),
    },
    {
      provide: ConsultarRecetaUseCase,
      inject: [RECETA_REPOSITORY, ITEM_INVENTARIO_REPOSITORY],
      useFactory: (recetas: RecetaRepository, items: ItemInventarioRepository) => new ConsultarRecetaUseCase(recetas, items),
    },
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
