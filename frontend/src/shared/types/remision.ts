/**
 * Espejo de `presentar()` en `remision.controller.ts` del backend.
 */

export const ESTADOS_REMISION = [
  'BORRADOR',
  'ENTREGADA',
  'APROBADA',
  'RECHAZADA',
  'EN_RECTIFICACION',
  'VALIDADA',
] as const

export type EstadoRemision = (typeof ESTADOS_REMISION)[number]

export const ETIQUETA_ESTADO: Record<EstadoRemision, string> = {
  BORRADOR: 'Borrador',
  ENTREGADA: 'Entregada',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
  EN_RECTIFICACION: 'En rectificación',
  VALIDADA: 'Validada',
}

export interface Remision {
  id: string
  consecutivo: string
  anio: number
  numero: number
  version: number
  estado: EstadoRemision
  /** YYYY-MM-DD */
  fechaOperativa: string
  /** ISO */
  fechaHoraRegistro: string
  turnoId: string
  grupoId: string
  lugarId: string
  producto: { id: string; codigo: string; descripcion: string }
  /** YYYY-MM-DD */
  fechaVencimiento: string
  cantidadCajas: number
  cantidadUnidades: number
  estibasCompletas: number
  cajasSueltas: number
  descripcionEstibas: string
  numerosEstiba: number[]
  observaciones: string | null
  /** Pedido de emergencia fuera del DPP: no cuenta para el MFR ni para el tope. */
  extraoficial: boolean
  motivoExtraoficial: string | null
  entrega: { entregadaPorId: string | null; fecha: string | null }
  aprobacion: { opaNombre: string | null; opaCargo: string | null; fecha: string | null }
  validacion: {
    validadaPorId: string | null
    conciliadoCon: string | null
    fecha: string | null
  }
  motivoUltimoRechazo: string | null
  esEditable: boolean
  estaPendienteDeConciliar: boolean
}

export interface ResultadoPaginado<T> {
  items: T[]
  total: number
  pagina: number
  porPagina: number
}

/** Lo que devuelve GET /remisiones/resumen: seis números, sin documentos. */
export interface ResumenRemisiones {
  porEstado: Record<EstadoRemision, number>
  total: number
}

export interface FiltroRemisiones {
  anio?: number
  turnoId?: string
  grupoId?: string
  productoId?: string
  estado?: EstadoRemision
  /** YYYY-MM-DD, fecha operativa */
  desde?: string
  hasta?: string
  pagina?: number
  porPagina?: number
}

export interface CrearRemisionDatos {
  turnoId: string
  grupoId: string
  lugarId: string
  productoId: string
  /** YYYY-MM-DD */
  fechaVencimiento: string
  cantidadCajas: number
  cantidadUnidades: number
  estibasCompletas: number
  cajasSueltas: number
  numerosEstiba: number[]
  observaciones?: string
  extraoficial?: boolean
  motivoExtraoficial?: string
}

export interface VersionRemision {
  version: number
  motivoRechazo: string | null
  datosAnteriores: Record<string, unknown>
  rectificadaPor: { id: string; nombre: string }
  fechaRectificacion: string
}

export interface EntradaAuditoria {
  id: string
  accion: 'CREAR' | 'ACTUALIZAR' | 'CAMBIO_ESTADO' | 'ELIMINAR'
  valorAnterior: Record<string, unknown> | null
  valorNuevo: Record<string, unknown> | null
  motivo: string | null
  usuario: { id: string; nombre: string }
  fecha: string
}

/** Todo opcional: se envía lo que cambia. `observaciones: null` las borra. */
export type EditarRemisionDatos = Partial<Omit<CrearRemisionDatos, 'observaciones' | 'motivoExtraoficial'>> & {
  observaciones?: string | null
  motivoExtraoficial?: string | null
}
