import { Module } from '@nestjs/common';

import { IndicadorAveriasUseCase } from '../../application/averia/indicador-averias.use-case.js';
import { AlertasInventarioUseCase } from '../../application/inventario/alertas-inventario.use-case.js';
import { IndicadoresDiaUseCase } from '../../application/mfr/indicadores-dia.use-case.js';
import { ArmadorDeResumen } from '../../application/resumen/armar-resumen.js';
import { CAUSAL_AVERIA_REPOSITORY, type CausalAveriaRepository } from '../../domain/averia/causal-averia.js';
import { REPORTE_AVERIA_REPOSITORY, type ReporteAveriaRepository } from '../../domain/averia/reporte-averia.js';
import { CATALOGO_REPOSITORY, type CatalogoRepository } from '../../domain/catalogo/catalogo.repository.js';
import { GRUPO_REPOSITORY, type GrupoRepository } from '../../domain/grupo/grupo.repository.js';
import { ITEM_INVENTARIO_REPOSITORY, type ItemInventarioRepository } from '../../domain/inventario/item-inventario.js';
import { MOVIMIENTO_INVENTARIO_REPOSITORY, type MovimientoInventarioRepository } from '../../domain/inventario/movimiento-inventario.js';
import { RECETA_REPOSITORY, type RecetaRepository } from '../../domain/inventario/receta.js';
import { ASIGNACION_REPOSITORY, type AsignacionRepository } from '../../domain/mfr/asignacion-linea.js';
import { ASISTENCIA_REPOSITORY, type AsistenciaRepository } from '../../domain/mfr/asistencia-turno.js';
import { BLOQUE_REPOSITORY, type BloqueRepository } from '../../domain/mfr/bloque-programacion.js';
import { ESTANDAR_REPOSITORY, type EstandarRepository } from '../../domain/mfr/estandar-produccion.js';
import { HORARIO_REPOSITORY, type HorarioRepository } from '../../domain/mfr/horas-turno.js';
import { AJUSTE_ESPERADAS_REPOSITORY, type AjusteEsperadasRepository } from '../../domain/mfr/esperadas-personal.js';
import { LINEA_REPOSITORY, type LineaRepository } from '../../domain/mfr/linea-produccion.js';
import { PRODUCTO_REPOSITORY, type ProductoRepository } from '../../domain/producto/producto.repository.js';
import { REMISION_REPOSITORY, type RemisionRepository } from '../../domain/remision/remision.repository.js';
import { RESUMEN_TURNO_REPOSITORY, type FormatoDocumento, type ResumenTurnoRepository } from '../../domain/resumen/resumen-turno.js';
import { PdfModule } from '../../infrastructure/pdf/pdf.module.js';
import { PersistenciaModule } from '../../infrastructure/persistence/persistencia.module.js';
import { ResumenController } from './resumen.controller.js';

export const FORMATO_RESUMEN = Symbol('FormatoResumen');

/**
 * Código del formato que asigna el SIG (Sistema Integrado de Gestión).
 * Vive en el .env porque lo aprueba un área externa y puede cambiar de
 * versión sin tocar el código. Vacío = "PENDIENTE DE APROBACIÓN SIG".
 */
export function formatoResumenDesdeEntorno(): FormatoDocumento {
  const valor = (nombre: string) => process.env[nombre]?.trim() || null;
  return {
    codigo: valor('FORMATO_RESUMEN_CODIGO'),
    version: valor('FORMATO_RESUMEN_VERSION'),
    vigencia: valor('FORMATO_RESUMEN_VIGENCIA'),
  };
}

/**
 * Arma, guarda y muestra el resumen del turno / del día.
 *
 * Usa los cálculos del tablero MFR, del indicador de averías y de las
 * alertas de inventario. En vez de importar esos módulos (MfrModule
 * importa a este: sería circular), arma aquí sus propias instancias con
 * los repositorios de lectura: se repite el cableado, no la lógica.
 */
@Module({
  imports: [PersistenciaModule, PdfModule],
  controllers: [ResumenController],
  providers: [
    { provide: FORMATO_RESUMEN, useFactory: formatoResumenDesdeEntorno },
    {
      provide: ArmadorDeResumen,
      inject: [
        BLOQUE_REPOSITORY, LINEA_REPOSITORY, ESTANDAR_REPOSITORY, HORARIO_REPOSITORY, REMISION_REPOSITORY,
        CATALOGO_REPOSITORY, ASISTENCIA_REPOSITORY, GRUPO_REPOSITORY, ASIGNACION_REPOSITORY,
        REPORTE_AVERIA_REPOSITORY, PRODUCTO_REPOSITORY, CAUSAL_AVERIA_REPOSITORY,
        ITEM_INVENTARIO_REPOSITORY, RECETA_REPOSITORY, MOVIMIENTO_INVENTARIO_REPOSITORY, RESUMEN_TURNO_REPOSITORY,
        AJUSTE_ESPERADAS_REPOSITORY,
      ],
      useFactory: (
        bloques: BloqueRepository, lineas: LineaRepository, estandares: EstandarRepository, horarios: HorarioRepository, remisiones: RemisionRepository,
        catalogo: CatalogoRepository, asistencias: AsistenciaRepository, grupos: GrupoRepository, asignaciones: AsignacionRepository,
        reportesAveria: ReporteAveriaRepository, productos: ProductoRepository, causales: CausalAveriaRepository,
        items: ItemInventarioRepository, recetas: RecetaRepository, movimientos: MovimientoInventarioRepository, resumenes: ResumenTurnoRepository,
        ajustes: AjusteEsperadasRepository,
      ) =>
        new ArmadorDeResumen({
          indicadoresDia: new IndicadoresDiaUseCase(bloques, lineas, estandares, horarios, remisiones, catalogo, asistencias, grupos, asignaciones, ajustes),
          indicadorAverias: new IndicadorAveriasUseCase(bloques, reportesAveria, productos),
          alertasInventario: new AlertasInventarioUseCase(items, recetas, bloques, estandares, remisiones),
          remisiones,
          productos,
          reportesAveria,
          causales,
          movimientos,
          items,
          horarios,
          resumenes,
        }),
    },
  ],
  exports: [ArmadorDeResumen, FORMATO_RESUMEN],
})
export class ResumenModule {}
