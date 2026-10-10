import { Module } from '@nestjs/common';

import { AnalizarDppUseCase } from '../../application/mfr/analizar-dpp.use-case.js';
import { AsignarGrupoLineaUseCase, QuitarAsignacionUseCase } from '../../application/mfr/asignacion.use-cases.js';
import { AjustarEsperadasUseCase, RegistrarAsistenciaUseCase } from '../../application/mfr/asistencia.use-case.js';
import {
  CargarDiaUseCase,
  CargarPeriodoUseCase,
  CerrarTurnoUseCase,
  CopiarDiaUseCase,
  EliminarBloqueUseCase,
  GuardarBloqueUseCase,
} from '../../application/mfr/bloques.use-cases.js';
import {
  ActualizarEstandaresEnLoteUseCase,
  ActualizarEstandarUseCase,
  ActualizarLineaUseCase,
  CrearLineaUseCase,
} from '../../application/mfr/catalogos-mfr.use-cases.js';
import { IndicadoresDiaUseCase } from '../../application/mfr/indicadores-dia.use-case.js';
import { IndicadoresPeriodoUseCase, RitmoDiaUseCase } from '../../application/mfr/indicadores-produccion.use-case.js';
import { REPORTE_AVERIA_REPOSITORY, type ReporteAveriaRepository } from '../../domain/averia/reporte-averia.js';
import { RELOJ, type Reloj } from '../../application/remision/crear-remision.use-case.js';
import { CATALOGO_REPOSITORY, type CatalogoRepository } from '../../domain/catalogo/catalogo.repository.js';
import { GRUPO_REPOSITORY, type GrupoRepository } from '../../domain/grupo/grupo.repository.js';
import { ASIGNACION_REPOSITORY, type AsignacionRepository } from '../../domain/mfr/asignacion-linea.js';
import { ASISTENCIA_REPOSITORY, type AsistenciaRepository } from '../../domain/mfr/asistencia-turno.js';
import { BLOQUE_REPOSITORY, type BloqueRepository } from '../../domain/mfr/bloque-programacion.js';
import { ESTANDAR_REPOSITORY, type EstandarRepository } from '../../domain/mfr/estandar-produccion.js';
import { HORARIO_REPOSITORY, type HorarioRepository } from '../../domain/mfr/horas-turno.js';
import { AJUSTE_ESPERADAS_REPOSITORY, type AjusteEsperadasRepository } from '../../domain/mfr/esperadas-personal.js';
import { LINEA_REPOSITORY, type LineaRepository } from '../../domain/mfr/linea-produccion.js';
import { PRODUCTO_REPOSITORY, type ProductoRepository } from '../../domain/producto/producto.repository.js';
import { REMISION_REPOSITORY, type RemisionRepository } from '../../domain/remision/remision.repository.js';
import { UNIDAD_DE_TRABAJO, type UnidadDeTrabajo } from '../../domain/shared/unidad-de-trabajo.js';
import { LectorPdfService } from '../../infrastructure/dpp/lector-pdf.js';
import { PersistenciaModule } from '../../infrastructure/persistence/persistencia.module.js';
import { RelojSistema } from '../../infrastructure/shared/reloj-sistema.js';
import { ArmadorDeResumen } from '../../application/resumen/armar-resumen.js';
import type { FormatoDocumento } from '../../domain/resumen/resumen-turno.js';
import { CorreoModule } from '../correo/correo.module.js';
import { FORMATO_RESUMEN, ResumenModule } from '../resumen/resumen.module.js';
import { MfrController } from './mfr.controller.js';

/**
 * Los repositorios (Prisma o Firestore) los entrega `PersistenciaModule`;
 * aquí solo se arman los casos de uso.
 */
@Module({
  imports: [PersistenciaModule, ResumenModule, CorreoModule],
  controllers: [MfrController],
  providers: [
    { provide: RELOJ, useClass: RelojSistema },
    LectorPdfService,
    {
      provide: IndicadoresDiaUseCase,
      inject: [
        BLOQUE_REPOSITORY, LINEA_REPOSITORY, ESTANDAR_REPOSITORY, HORARIO_REPOSITORY,
        REMISION_REPOSITORY, CATALOGO_REPOSITORY, ASISTENCIA_REPOSITORY, GRUPO_REPOSITORY, ASIGNACION_REPOSITORY, AJUSTE_ESPERADAS_REPOSITORY,
      ],
      useFactory: (
        b: BloqueRepository, l: LineaRepository, e: EstandarRepository, h: HorarioRepository,
        r: RemisionRepository, cat: CatalogoRepository, a: AsistenciaRepository, g: GrupoRepository, asig: AsignacionRepository,
        aj: AjusteEsperadasRepository,
      ) => new IndicadoresDiaUseCase(b, l, e, h, r, cat, a, g, asig, aj),
    },
    {
      provide: IndicadoresPeriodoUseCase,
      inject: [
        BLOQUE_REPOSITORY, REMISION_REPOSITORY, REPORTE_AVERIA_REPOSITORY, ASISTENCIA_REPOSITORY,
        HORARIO_REPOSITORY, PRODUCTO_REPOSITORY, CATALOGO_REPOSITORY, GRUPO_REPOSITORY,
      ],
      useFactory: (
        b: BloqueRepository, r: RemisionRepository, av: ReporteAveriaRepository, a: AsistenciaRepository,
        h: HorarioRepository, p: ProductoRepository, cat: CatalogoRepository, g: GrupoRepository,
      ) => new IndicadoresPeriodoUseCase(b, r, av, a, h, p, cat, g),
    },
    {
      provide: RitmoDiaUseCase,
      inject: [BLOQUE_REPOSITORY, REMISION_REPOSITORY, CATALOGO_REPOSITORY, RELOJ],
      useFactory: (b: BloqueRepository, r: RemisionRepository, cat: CatalogoRepository, reloj: Reloj) => new RitmoDiaUseCase(b, r, cat, reloj),
    },
    {
      provide: RegistrarAsistenciaUseCase,
      inject: [UNIDAD_DE_TRABAJO, RELOJ],
      useFactory: (uow: UnidadDeTrabajo, reloj: Reloj) => new RegistrarAsistenciaUseCase(uow, reloj),
    },
    {
      provide: AjustarEsperadasUseCase,
      inject: [UNIDAD_DE_TRABAJO, RELOJ],
      useFactory: (uow: UnidadDeTrabajo, reloj: Reloj) => new AjustarEsperadasUseCase(uow, reloj),
    },
    {
      provide: AsignarGrupoLineaUseCase,
      inject: [UNIDAD_DE_TRABAJO, RELOJ],
      useFactory: (uow: UnidadDeTrabajo, reloj: Reloj) => new AsignarGrupoLineaUseCase(uow, reloj),
    },
    { provide: QuitarAsignacionUseCase, inject: [UNIDAD_DE_TRABAJO], useFactory: (uow: UnidadDeTrabajo) => new QuitarAsignacionUseCase(uow) },
    {
      provide: GuardarBloqueUseCase,
      inject: [UNIDAD_DE_TRABAJO, PRODUCTO_REPOSITORY, HORARIO_REPOSITORY, RELOJ],
      useFactory: (uow: UnidadDeTrabajo, p: ProductoRepository, h: HorarioRepository, reloj: Reloj) =>
        new GuardarBloqueUseCase(uow, p, h, reloj),
    },
    { provide: EliminarBloqueUseCase, inject: [UNIDAD_DE_TRABAJO], useFactory: (uow: UnidadDeTrabajo) => new EliminarBloqueUseCase(uow) },
    {
      provide: CargarDiaUseCase,
      inject: [UNIDAD_DE_TRABAJO, PRODUCTO_REPOSITORY, HORARIO_REPOSITORY, RELOJ],
      useFactory: (uow: UnidadDeTrabajo, p: ProductoRepository, h: HorarioRepository, reloj: Reloj) =>
        new CargarDiaUseCase(uow, p, h, reloj),
    },
    {
      provide: CargarPeriodoUseCase,
      inject: [CargarDiaUseCase],
      useFactory: (cargar: CargarDiaUseCase) => new CargarPeriodoUseCase(cargar),
    },
    {
      provide: CopiarDiaUseCase,
      inject: [CargarDiaUseCase, BLOQUE_REPOSITORY],
      useFactory: (cargar: CargarDiaUseCase, bloques: BloqueRepository) => new CopiarDiaUseCase(cargar, bloques),
    },
    {
      provide: CerrarTurnoUseCase,
      inject: [UNIDAD_DE_TRABAJO, RELOJ, ArmadorDeResumen, FORMATO_RESUMEN],
      useFactory: (uow: UnidadDeTrabajo, reloj: Reloj, armador: ArmadorDeResumen, formato: FormatoDocumento) =>
        new CerrarTurnoUseCase(uow, reloj, { armador, formato }),
    },
    {
      provide: AnalizarDppUseCase,
      inject: [LINEA_REPOSITORY, ESTANDAR_REPOSITORY],
      useFactory: (l: LineaRepository, e: EstandarRepository) => new AnalizarDppUseCase(l, e),
    },
    { provide: CrearLineaUseCase, inject: [UNIDAD_DE_TRABAJO], useFactory: (uow: UnidadDeTrabajo) => new CrearLineaUseCase(uow) },
    { provide: ActualizarLineaUseCase, inject: [UNIDAD_DE_TRABAJO], useFactory: (uow: UnidadDeTrabajo) => new ActualizarLineaUseCase(uow) },
    { provide: ActualizarEstandarUseCase, inject: [UNIDAD_DE_TRABAJO], useFactory: (uow: UnidadDeTrabajo) => new ActualizarEstandarUseCase(uow) },
    {
      provide: ActualizarEstandaresEnLoteUseCase,
      inject: [UNIDAD_DE_TRABAJO],
      useFactory: (uow: UnidadDeTrabajo) => new ActualizarEstandaresEnLoteUseCase(uow),
    },
  ],
})
export class MfrModule {}
