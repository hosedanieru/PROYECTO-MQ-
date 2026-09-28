/**
 * REPORTE DE AVERÍAS
 * ==================
 *
 * El formulario "Inlotrans | Reporte de averías MQ" (2026-09-28): un
 * encabezado y uno o más registros, cada uno con sus 3 fotos.
 *
 *   Encabezado   fecha y hora (automáticas, del servidor), fecha
 *                operativa (corte 06:00), turno (sale de la hora),
 *                grupo ("Operador MQ") y quién reporta (del token).
 *
 * Es un reporte, no un flujo: se envía y queda REGISTRADO. No hay
 * aprobación. El administrador puede corregir un registro o ANULAR el
 * reporte con motivo; nunca se elimina (trazabilidad: evitar pérdidas y
 * desbalances).
 *
 * Las averías NO justifican el faltante del MFR (usuario, 2026-09-28).
 */

import { DatosAveriaInvalidosError, ReporteAveriaNoModificableError } from './averia.errors.js';
import type { DatosRegistroAveria, TipoEvidencia, UnidadMedidaAveria } from './registro-averia.js';

export type EstadoReporteAveria = 'REGISTRADO' | 'ANULADO';

/**
 * Límite técnico, no del negocio: un reporte con sus registros debe
 * caber en un documento de Firestore (1 MB) y en una sola petición con
 * las fotos. Si el área necesita más, se envían dos reportes.
 */
export const MAXIMO_REGISTROS_POR_REPORTE = 30;

export interface RegistroAveria extends DatosRegistroAveria {
  id: string;
  /** Copia congelada del producto al reportar (como en la remisión). */
  productoCodigo: string;
  productoDescripcion: string;
}

export interface ReporteAveria {
  id: string;
  fechaHoraRegistro: Date;
  fechaOperativa: Date;
  turnoId: string;
  grupoId: string;
  reportadoPorId: string;
  /** Copia del nombre al reportar: el documento sigue diciendo quién fue aunque el usuario cambie. */
  reportadoPorNombre: string;
  estado: EstadoReporteAveria;
  motivoAnulacion: string | null;
  anuladoPorId: string | null;
  fechaAnulacion: Date | null;
  registros: RegistroAveria[];
}

/** Lo que el repositorio recibe para crear: sin ids (los asigna la base). */
export type NuevoReporteAveria = Omit<ReporteAveria, 'id' | 'registros'> & {
  registros: Omit<RegistroAveria, 'id'>[];
};

export function validarCantidadRegistros(cantidad: number): void {
  if (cantidad === 0) {
    throw new DatosAveriaInvalidosError('El reporte debe tener al menos una avería.');
  }
  if (cantidad > MAXIMO_REGISTROS_POR_REPORTE) {
    throw new DatosAveriaInvalidosError(
      `Un reporte admite máximo ${MAXIMO_REGISTROS_POR_REPORTE} averías; envíe el resto en otro reporte.`,
    );
  }
}

export function exigirRegistrado(reporte: ReporteAveria): void {
  if (reporte.estado !== 'REGISTRADO') {
    throw new ReporteAveriaNoModificableError('El reporte está anulado: ya no se puede modificar.');
  }
}

/** Anula el reporte. Motivo obligatorio: saber qué cambió sin saber por qué no sirve. */
export function anularReporte(reporte: ReporteAveria, motivo: string, usuarioId: string, ahora: Date): ReporteAveria {
  exigirRegistrado(reporte);
  const texto = motivo?.trim() ?? '';
  if (texto.length === 0 || texto.length > 500) {
    throw new DatosAveriaInvalidosError('El motivo de anulación es obligatorio (máx. 500 caracteres).');
  }
  return { ...reporte, estado: 'ANULADO', motivoAnulacion: texto, anuladoPorId: usuarioId, fechaAnulacion: ahora };
}

export interface FiltroReportesAveria {
  /** Fechas operativas, inclusive. */
  desde: Date;
  hasta: Date;
  turnoId?: string;
  grupoId?: string;
  estado?: EstadoReporteAveria;
}

/** Tope técnico del rango del listado (mismo criterio que remisiones en Firestore). */
export const MAXIMO_DIAS_LISTADO = 93;

export interface ReporteAveriaRepository {
  crear(reporte: NuevoReporteAveria): Promise<ReporteAveria>;
  buscarPorId(id: string): Promise<ReporteAveria | null>;
  /** Más recientes primero. */
  listar(filtro: FiltroReportesAveria): Promise<ReporteAveria[]>;
  /** Guarda el encabezado (estado, anulación) y los campos de los registros; las fotos no cambian. */
  actualizar(reporte: ReporteAveria): Promise<ReporteAveria>;
}

export const REPORTE_AVERIA_REPOSITORY = Symbol('ReporteAveriaRepository');

export type { TipoEvidencia, UnidadMedidaAveria };
