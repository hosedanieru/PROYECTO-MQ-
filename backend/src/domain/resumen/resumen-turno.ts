/**
 * RESUMEN DEL TURNO (y del día)
 * =============================
 *
 * Decisiones del usuario (2026-10-03):
 *   - Al cerrar un turno se genera un resumen en PDF para los jefes y los
 *     coordinadores: producción y remisiones, personal, averías e
 *     inventario, y las NOVEDADES que escribe el coordinador (obligatorias).
 *   - Cuando se cierra el último turno del día, sale además el resumen del
 *     día operativo completo.
 *   - Sin logo; lleva los nombres, el CÓDIGO DEL FORMATO (lo aprueba el SIG,
 *     Sistema Integrado de Gestión) y un CONSECUTIVO propio de cada resumen.
 *
 * El resumen es una FOTO tomada al cerrar: se guarda tal cual y el PDF
 * siempre muestra lo mismo, aunque después se aprueben remisiones o se
 * corrijan datos. Un documento con consecutivo no puede cambiar.
 *
 * Series del consecutivo (por año del día operativo, como las remisiones):
 *   RT-2026-0001  resumen de un turno
 *   RD-2026-0001  resumen del día
 */

import { ErrorDominio } from '../shared/errores.js';

export type TipoResumen = 'TURNO' | 'DIA';

export const PREFIJO_RESUMEN: Record<TipoResumen, string> = { TURNO: 'RT', DIA: 'RD' };

export class NovedadesObligatoriasError extends ErrorDominio {
  readonly codigo = 'RESUMEN_NOVEDADES_OBLIGATORIAS';
  constructor() {
    super('Escriba las novedades del turno (mínimo 10 caracteres): qué pasó y qué queda pendiente.');
  }
}

export class ResumenNoEncontradoError extends ErrorDominio {
  readonly codigo = 'RESUMEN_NO_ENCONTRADO';
}

export const MINIMO_NOVEDADES = 10;
export const MAXIMO_NOVEDADES = 4000;

export function validarNovedades(novedades: string | null | undefined): string {
  const texto = novedades?.trim() ?? '';
  if (texto.length < MINIMO_NOVEDADES) throw new NovedadesObligatoriasError();
  if (texto.length > MAXIMO_NOVEDADES) throw new NovedadesObligatoriasError();
  return texto;
}

/** "RT-2026-0007". */
export function consecutivoResumen(tipo: TipoResumen, anio: number, numero: number): string {
  return `${PREFIJO_RESUMEN[tipo]}-${anio}-${String(numero).padStart(4, '0')}`;
}

/** Código del formato aprobado por el SIG. Mientras no exista, se marca como pendiente. */
export interface FormatoDocumento {
  codigo: string | null;
  version: string | null;
  vigencia: string | null;
}

// ---------- Contenido (la foto) ----------

export interface SeccionProduccion {
  programadoCajas: number;
  producidoCajas: number;
  cumplimiento: number | null;
  semaforo: string | null;
  porProducto: Array<{ codigo: string; descripcion: string; programadoCajas: number; producidoCajas: number; cumplimiento: number | null }>;
  porLinea: Array<{ codigo: string; programadoCajas: number }>;
  /** SKU por debajo de su target al cerrar ("ni menos"), con el motivo que se dio. */
  faltantes: Array<{ codigo: string; programadoCajas: number; producidoCajas: number }>;
  motivoFaltante: string | null;
  extraoficialesCajas: number;
}

export interface SeccionRemisiones {
  porEstado: Record<string, number>;
  lista: Array<{ consecutivo: string; codigo: string; descripcion: string; cajas: number; estado: string; motivoRechazo: string | null; extraoficial: boolean }>;
}

export interface SeccionPersonal {
  requeridasDpp: number;
  llegaron: number;
  coberturaDpp: number | null;
  estado: string;
  grupos: Array<{ nombre: string; esperadas: number | null; llegaron: number; estado: string }>;
}

export interface SeccionAverias {
  unidades: number;
  porcentaje: number | null;
  maximoPorcentaje: number;
  excede: boolean;
  porCausal: Array<{ causal: string; unidades: number }>;
}

export interface SeccionInventario {
  /** Lo que descontaron las recetas al aprobar remisiones en el periodo. */
  consumo: Array<{ codigo: string; descripcion: string; cantidad: number; unidad: string }>;
  /** Alertas críticas abiertas al cerrar. */
  alertas: Array<{ tipo: string; codigo: string; mensaje: string }>;
}

export interface DatosResumen {
  /** Nombre del turno ("T1 · Turno 1") o "Día operativo". */
  titulo: string;
  horario: string | null;
  produccion: SeccionProduccion;
  remisiones: SeccionRemisiones;
  personal: SeccionPersonal;
  averias: SeccionAverias;
  inventario: SeccionInventario;
  /** En el turno: lo que escribió el coordinador. En el día: las de cada turno. */
  novedades: Array<{ turno: string; texto: string }>;
}

export interface ResumenTurno {
  id: string;
  tipo: TipoResumen;
  anio: number;
  numero: number;
  fechaOperativa: Date;
  /** Null en el resumen del día. */
  turnoId: string | null;
  formato: FormatoDocumento;
  datos: DatosResumen;
  cerradoPorId: string;
  cerradoPorNombre: string;
  fechaHora: Date;
}

export type NuevoResumen = Omit<ResumenTurno, 'id' | 'numero'>;

export interface ResumenTurnoRepository {
  /**
   * Siguiente número de la serie del año. En PostgreSQL BLOQUEA la fila del
   * consecutivo hasta que termine la transacción; en Firestore la lectura
   * dentro de la transacción detecta el conflicto. Solo lee (regla de Firestore).
   */
  siguienteNumero(tipo: TipoResumen, anio: number): Promise<number>;
  /** Escribe el resumen con ese número y deja el consecutivo en él. */
  crear(resumen: NuevoResumen, numero: number): Promise<ResumenTurno>;
  buscarPorId(id: string): Promise<ResumenTurno | null>;
  listarPorFecha(fechaOperativa: Date): Promise<ResumenTurno[]>;
}

export const RESUMEN_TURNO_REPOSITORY = Symbol('ResumenTurnoRepository');

export interface GeneradorPdfResumen {
  generar(resumen: ResumenTurno): Promise<Buffer>;
}

export const GENERADOR_PDF_RESUMEN = Symbol('GeneradorPdfResumen');
