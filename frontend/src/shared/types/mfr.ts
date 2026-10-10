/** Espejo de los tipos del dominio MFR y de lo que devuelve /api/mfr/*. */

import type { ResultadoCorreoCierre } from './correo'

export type Semaforo = 'VERDE' | 'AMARILLO' | 'ROJO'
export type TipoLinea = 'MULTIPACK' | 'MANUAL'
export type OrigenBloque = 'MANUAL' | 'DPP' | 'COPIA'

export interface LineaProduccion {
  id: string
  codigo: string
  nombre: string
  tipo: TipoLinea
  capacidadKgHora: number | null
  orden: number
  activo: boolean
}

export interface EstandarProducto {
  productoId: string
  codigo: string
  descripcion: string
  subdescripcion: string | null
  unidadesPorCaja: number | null
  /** Ritmo al 100 % (hoja TIEMPOS); por defecto al armar bloques a mano. */
  cajasPorHora: number | null
  pesoNetoKg: number | null
  /** Deducido de la descripción de PepsiCo, solo para proponerlo. */
  pesoSugeridoKg: number | null
}

/**
 * Un producto dentro de la carga en lote. Omitir un campo significa
 * "no lo toques"; `null` significa "bórralo". Por eso son opcionales y
 * no se envían siempre los dos.
 */
export interface CambioEstandarLote {
  productoId: string
  cajasPorHora?: number | null
  pesoNetoKg?: number | null
}

export interface ResultadoLoteEstandares {
  actualizados: EstandarProducto[]
  /** Códigos que ya tenían ese mismo valor: no se tocaron ni se auditaron. */
  sinCambios: string[]
}

/** Lo que se envía al crear o corregir un bloque. */
export interface DatosBloque {
  lineaId: string
  productoId: string
  horaInicio: string
  horaFin: string
  cajasPorHora: number
  eficienciaPorcentaje: number
  loop: string | null
  personasAsignadas: number | null
}

/** Bloque del día con Mx, T y kilos ya calculados por el backend. */
export interface BloqueCalculado {
  id: string
  lineaId: string
  turnoId: string
  productoId: string
  horaInicio: string
  horaFin: string
  horas: number
  cajasPorHora: number
  eficienciaPorcentaje: number
  loop: string | null
  personasAsignadas: number | null
  origen: OrigenBloque
  cerrado: boolean
  pesoNetoKg: number | null
  maxCajas: number
  targetCajas: number
  maxKg: number | null
  targetKg: number | null
}

export interface MfrPorProducto {
  productoId: string
  programadoCajas: number
  producidoCajas: number
  programadoKg: number | null
  producidoKg: number | null
  cumplimiento: number | null
  semaforo: Semaforo | null
}

/** Comparación de lo que llegó contra lo que el grupo debía enviar. */
export type EstadoPersonal = 'A_FIN' | 'AFECTADA' | 'SIN_DATO'

/** De dónde salen las esperadas: ajuste del día, fijas del turno (en el grupo) o sin dato. */
export type OrigenEsperadas = 'AJUSTE' | 'FIJA' | 'SIN_DATO'

export interface PersonalGrupo {
  grupoId: string
  codigo: string
  nombre: string
  esperadas: number | null
  origenEsperadas: OrigenEsperadas
  motivoAjuste: string | null
  /** false = se espera en el turno pero aún no se registró cuántos llegaron. */
  registrado: boolean
  llegaron: number
  faltante: number
  /** Personas por encima de las esperadas (registradas con observación). */
  deMas: number
  /** Σ personas del grupo asignadas a líneas en el turno. */
  asignadas: number | null
  observacion: string | null
  estado: EstadoPersonal
}

/** Personas en una línea contra la línea ideal del DPP. */
export type EstadoLinea = 'CUBIERTA' | 'INCOMPLETA' | 'SIN_DATO'

export interface PersonalLinea {
  lineaId: string
  codigo: string
  nombre: string
  grupos: Array<{ asignacionId: string; grupoId: string; codigo: string; nombre: string; personas: number }>
  personas: number
  requeridasDpp: number
  faltante: number
  estado: EstadoLinea
}

/**
 * Personal del turno (2026-09-30): dos comparaciones y el turno queda
 * AFECTADO si falla cualquiera: contra lo que pide el DPP (Σ por línea del
 * máximo de personas de sus bloques) y contra lo esperado de cada grupo.
 */
export interface PersonalTurno {
  grupos: PersonalGrupo[]
  lineas: PersonalLinea[]
  esperadas: number
  llegaron: number
  /** Faltante contra lo esperado de los grupos. */
  faltante: number
  requeridasDpp: number
  faltanteDpp: number
  /** llegaron ÷ requeridas DPP × 100; null sin DPP o sin asistencia. */
  coberturaDpp: number | null
  /** Líneas con bloques sin personas definidas (las requeridas quedan cortas). */
  lineasSinDato: number
  estadoDpp: EstadoPersonal
  estadoGrupos: EstadoPersonal
  estado: EstadoPersonal
}

/** Personal del día: contra el DPP (solo turnos ya evaluados) y total contra los grupos. */
export interface PersonalDia {
  requeridasDpp: number
  llegaron: number
  faltanteDpp: number
  coberturaDpp: number | null
  estado: EstadoPersonal
  /** Σ esperadas de los grupos en todos los turnos del día. */
  esperadasDia: number
  /** Σ personas que llegaron en todos los turnos. */
  llegaronDia: number
  porGrupo: Array<{ grupoId: string; codigo: string; nombre: string; esperadas: number; llegaron: number; deMas: number; faltante: number }>
}

/** Asignación de un grupo a una línea en un turno (lo que devuelve /mfr/asignaciones). */
export interface AsignacionLinea {
  id: string
  fechaOperativa: string
  turnoId: string
  lineaId: string
  grupoId: string
  personas: number
  registradaPorId: string
  fechaRegistro: string
}

export interface DatosAsignacion {
  fechaOperativa: string
  turnoId: string
  lineaId: string
  grupoId: string
  personas: number
}

/** Registro de asistencia de un grupo en un turno (lo que devuelve /mfr/asistencia). */
export interface AsistenciaTurno {
  id: string
  fechaOperativa: string
  turnoId: string
  grupoId: string
  personasLlegaron: number
  observacion: string | null
  registradaPorId: string
  fechaRegistro: string
}

export interface DatosAsistencia {
  fechaOperativa: string
  turnoId: string
  grupoId: string
  personasLlegaron: number
  observacion?: string
}

export interface ResumenTurno {
  turnoId: string
  codigo: string
  nombre: string
  horasTurno: number | null
  personal: PersonalTurno
  bloques: BloqueCalculado[]
  maxCajas: number
  targetCajas: number
  maxKg: number
  targetKg: number
  producidoCajas: number
  producidoKg: number
  personasAsignadas: number
  eficienciaPlaneada: number | null
  eficienciaReal: number | null
  cumplimiento: number | null
  semaforo: Semaforo | null
  cerrado: boolean
}

export interface ResumenLinea {
  lineaId: string
  codigo: string
  nombre: string
  tipo: TipoLinea
  capacidadKgHora: number | null
  bloques: BloqueCalculado[]
  horasProgramadas: number
  maxCajas: number
  targetCajas: number
  maxKg: number
  targetKg: number
}

export interface FilaHoraria {
  lineaId: string
  targetKg: number[]
  instantKg: number[]
  capacidadKg: number[]
  overpull: Array<number | null>
}

export interface IndicadoresDia {
  fechaOperativa: string
  meta: number
  bloques: BloqueCalculado[]
  mfr: {
    programadoCajas: number
    producidoCajas: number
    programadoKg: number
    producidoKg: number
    cumplimiento: number | null
    semaforo: Semaforo | null
    porProducto: MfrPorProducto[]
    producidoSinProgramar: Array<{ productoId: string; cajas: number }>
    /** Pedidos de emergencia (remisiones extraoficiales): fuera del MFR. */
    extraoficiales: Array<{ productoId: string; cajas: number }>
    extraoficialesCajas: number
  }
  turnos: ResumenTurno[]
  /** Personal del día contra el DPP: base del indicador de afectación. */
  personal: PersonalDia
  lineas: ResumenLinea[]
  horario: {
    horas: string[]
    lineas: FilaHoraria[]
    totalTargetKg: number[]
    totalInstantKg: number[]
  }
  /** "Flavor Breakdown": kg target por hora por familia (subdescripción). */
  familias: Array<{ familia: string; targetKg: number[]; totalKg: number }>
  advertencias: string[]
}

/** Fila de la propuesta que devuelve el análisis del PDF del DPP. */
export interface BloquePropuesto {
  linea: string
  tipoLinea: TipoLinea
  /** Fecha de calendario en que arranca, tal como la trae el PDF. */
  fechaInicio: string
  /** Día operativo al que pertenece (corte 06:00). Es el día en que se carga. */
  fechaOperativa: string
  horaInicio: string
  horaFin: string
  codigoPepsico: string
  sufijoItem: string
  descripcion: string
  targetCajas: number
  maxCajas: number
  eficienciaPorcentaje: number
  loop: string | null
  /** BPM del PDF, solo informativo. */
  bpm: number | null
  /** Ritmo que se guarda: Mx ÷ horas del bloque. */
  cajasPorHora: number
  lineaId: string | null
  productoId: string | null
  productoCodigo: string | null
  /** Estándar del catálogo, como referencia (manda el del PDF). */
  cajasPorHoraCatalogo: number | null
  pesoNetoKg: number | null
  pesoSugeridoKg: number | null
  advertencias: string[]
}

/** Un día dentro del DPP. Un archivo puede traer uno, una semana o un mes. */
export interface DiaPropuesto {
  fechaOperativa: string
  bloques: number
  listos: number
}

export interface PropuestaDpp {
  archivo: string
  /** Primer día del archivo; el detalle está en `dias`. */
  fechaOperativa: string | null
  dias: DiaPropuesto[]
  bloques: BloquePropuesto[]
  listos: number
  advertencias: string[]
}

/** Qué pasó con cada día de una carga por período. */
export interface ResultadoDiaCarga {
  fechaOperativa: string
  estado: 'CARGADO' | 'OMITIDO' | 'ERROR'
  bloquesCreados: number
  codigo?: string
  mensaje?: string
}

export interface ResultadoPeriodo {
  dias: ResultadoDiaCarga[]
  totalBloquesCreados: number
  diasCargados: number
}

// ---------- Resumen del turno / del día (foto tomada al cerrar el turno) ----------

export interface ReferenciaResumen {
  id: string
  /** RT-2026-0007 (turno) o RD-2026-0003 (día). */
  consecutivo: string
}

export interface ResultadoCierreTurno {
  bloques: BloqueCalculado[]
  resumenTurno: ReferenciaResumen
  /** Solo si este cierre terminó el día operativo. */
  resumenDia: ReferenciaResumen | null
  /** Los dos correos del cierre; salen después de guardar, un fallo no deshace el cierre. */
  correos: ResultadoCorreoCierre[]
}

export interface ResumenGuardado extends ReferenciaResumen {
  tipo: 'TURNO' | 'DIA'
  fechaOperativa: string
  turnoId: string | null
  titulo: string
  cerradoPorNombre: string
  fechaHora: string
}

// ------------------------------------------------------------
// Indicadores de producción (Ciclo 2, fase 1) — espejo de
// `backend/src/domain/mfr/indicadores-produccion.ts` y `ritmo-produccion.ts`.
// Las fechas llegan como texto ISO.
// ------------------------------------------------------------

export interface NombreIndicador {
  codigo: string
  nombre: string
}

export interface MedidaFr {
  programadoCajas: number
  aprobadoCajas: number
  porcentaje: number | null
}

export interface SkuOtif {
  fechaOperativa: string
  productoId: string
  programadoCajas: number
  aprobadoCajas: number
  limite: string
  completoEn: string | null
  completo: boolean
  aTiempo: boolean
  sinFechaAprobacion: boolean
}

export interface FilaRanking {
  productoId: string
  programadoCajas: number
  producidoCajas: number
  cumplimiento: number | null
  programado: boolean
}

export interface MedidaFabricado {
  fabricadoUnidades: number
  /** Parte de lo fabricado que viene de remisiones extraoficiales. */
  extraoficialUnidades: number
  averiadasUnidades: number
  porcentaje: number | null
}

export interface MedidaProductividad {
  cajas: number
  personas: number
  horasPersona: number
  cajasPorPersonaHora: number | null
}

export interface IndicadoresPeriodo {
  desde: string
  hasta: string
  fr: MedidaFr & { porDia: Array<MedidaFr & { fechaOperativa: string }> }
  otif: {
    skus: number
    completos: number
    cumplen: number
    porcentaje: number | null
    completosPorcentaje: number | null
    detalle: SkuOtif[]
  }
  averiasVsFabricado: {
    total: MedidaFabricado
    porDia: Array<MedidaFabricado & { fechaOperativa: string }>
    porTurno: Array<MedidaFabricado & { turnoId: string }>
    porProducto: Array<MedidaFabricado & { productoId: string }>
    bolsasSinConvertir: number
  }
  ranking: { filas: FilaRanking[]; mayor: FilaRanking | null; menor: FilaRanking | null }
  productividad: {
    total: MedidaProductividad
    porTurno: Array<MedidaProductividad & { turnoId: string }>
    porGrupo: Array<MedidaProductividad & { grupoId: string }>
    cajasSinAsistencia: number
  }
  productos: Record<string, NombreIndicador>
  turnos: Record<string, NombreIndicador>
  grupos: Record<string, NombreIndicador>
}

export type EstadoRitmo = 'ADELANTADO' | 'EN_LINEA' | 'RETRASADO' | 'SIN_DATO'

export interface PuntoRitmo {
  hora: string
  esperadoCajas: number
  realCajas: number | null
}

export interface MedidaRitmo {
  metaCajas: number
  esperadoAhoraCajas: number
  realAhoraCajas: number
  desviacionPorcentaje: number | null
  estado: EstadoRitmo
  diferenciaCajas: number
  serie: PuntoRitmo[]
}

export interface RitmoDia extends MedidaRitmo {
  fechaOperativa: string
  minutoActual: number
  tolerancia: number
  porTurno: Array<MedidaRitmo & { turnoId: string; empezo: boolean }>
  turnos: Record<string, NombreIndicador>
}

/** Lo mismo que valida el backend (`validarNovedades`). */
export const MINIMO_NOVEDADES = 10
export const MAXIMO_NOVEDADES = 4000
