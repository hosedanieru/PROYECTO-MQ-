import { Module } from '@nestjs/common';

import { ActualizarGrupoUseCase, CrearGrupoUseCase } from '../../application/catalogo/grupo.use-cases.js';
import {
  ActualizarProductoUseCase,
  CrearProductoUseCase,
} from '../../application/catalogo/producto.use-cases.js';
import { RELOJ, type Reloj } from '../../application/remision/crear-remision.use-case.js';
import {
  UNIDAD_DE_TRABAJO,
  type UnidadDeTrabajo,
} from '../../domain/shared/unidad-de-trabajo.js';
import { PersistenciaModule } from '../../infrastructure/persistence/persistencia.module.js';
import { RelojSistema } from '../../infrastructure/shared/reloj-sistema.js';
import { CatalogoController } from './catalogo.controller.js';
import { GrupoController } from './grupo.controller.js';
import { ProductoController } from './producto.controller.js';

const conUow = <T>(Clase: new (uow: UnidadDeTrabajo) => T) => ({
  provide: Clase,
  inject: [UNIDAD_DE_TRABAJO],
  useFactory: (uow: UnidadDeTrabajo) => new Clase(uow),
});

@Module({
  imports: [PersistenciaModule],
  controllers: [CatalogoController, ProductoController, GrupoController],
  providers: [
    { provide: RELOJ, useClass: RelojSistema },
    {
      // Crea también la versión 1 de la receta: necesita la hora.
      provide: CrearProductoUseCase,
      inject: [UNIDAD_DE_TRABAJO, RELOJ],
      useFactory: (uow: UnidadDeTrabajo, reloj: Reloj) => new CrearProductoUseCase(uow, reloj),
    },
    conUow(ActualizarProductoUseCase),
    conUow(CrearGrupoUseCase),
    conUow(ActualizarGrupoUseCase),
  ],
})
export class CatalogoModule {}
