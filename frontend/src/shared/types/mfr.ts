/** Espejo de los tipos del dominio MFR y de lo que devuelve /api/mfr/*. */

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

export interface PersonalGrupo {
  grupoId: string
  codigo: string
  nombre: string
  esperadas: number | null
  llegaron: number
  faltante: number
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

export interface PersonalTurno {
  grupos: PersonalGrupo[]
  lineas: PersonalLinea[]
  esperadas: number
  llegaron: number
  faltante: number
  /** Referencia del DPP (línea ideal por línea); no decide el estado. */
  requeridasDpp: number
  estado: EstadoPersonal
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
