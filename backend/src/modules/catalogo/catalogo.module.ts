import { Module } from '@nestjs/common';

import { ActualizarGrupoUseCase, CrearGrupoUseCase } from '../../application/catalogo/grupo.use-cases.js';
import {
  ActualizarProductoUseCase,
  CrearProductoUseCase,
} from '../../application/catalogo/producto.use-cases.js';
import {
  UNIDAD_DE_TRABAJO,
  type UnidadDeTrabajo,
} from '../../domain/shared/unidad-de-trabajo.js';
import { PersistenciaModule } from '../../infrastructure/persistence/persistencia.module.js';
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
    conUow(CrearProductoUseCase),
    conUow(ActualizarProductoUseCase),
    conUow(CrearGrupoUseCase),
    conUow(ActualizarGrupoUseCase),
  ],
})
export class CatalogoModule {}
