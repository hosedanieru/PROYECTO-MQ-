/** Tipos del módulo de averías, espejo de las respuestas de `/api/averias`. */

export const UNIDADES_MEDIDA_AVERIA = ['UNIDAD', 'DOCENA', 'SIX', 'BOLSA'] as const
export type UnidadMedidaAveria = (typeof UNIDADES_MEDIDA_AVERIA)[number]

export const NOMBRE_UNIDAD: Record<UnidadMedidaAveria, string> = {
  UNIDAD: 'Unidad',
  DOCENA: 'Docena',
  SIX: 'Six',
  BOLSA: 'Bag / Bolsa',
}

export const TIPOS_EVIDENCIA = ['UNIDAD', 'LOTE_FECHA', 'CONJUNTO'] as const
export type TipoEvidencia = (typeof TIPOS_EVIDENCIA)[number]

export const NOMBRE_EVIDENCIA: Record<TipoEvidencia, string> = {
  UNIDAD: 'Foto 1 · Unidad',
  LOTE_FECHA: 'Foto 2 · Lote y fecha',
  CONJUNTO: 'Foto 3 · Conjunto',
}

export type EstadoReporteAveria = 'REGISTRADO' | 'ANULADO'

export interface CausalAveria {
  id: string
  codigo: string
  nombre: string
  orden: number
  activo: boolean
}

export interface DatosCausal {
  codigo: string
  nombre: string
  orden: number
}

export interface RegistroAveria {
  id: string
  productoId: string
  productoCodigo: string
  productoDescripcion: string
  fechaVencimiento: string
  lote: string
  causalId: string
  cantidad: number
  unidadMedida: UnidadMedidaAveria
  evidencias: Array<{ tipo: TipoEvidencia }>
}

export interface TotalAverias {
  unidades: number
  /** Lo que no se pudo convertir a unidades (hoy: bolsas, equivalencia pendiente). */
  sinConvertir: Partial<Record<UnidadMedidaAveria, number>>
}

export interface ReporteAveria {
  id: string
  fechaHoraRegistro: string
  fechaOperativa: string
  turnoId: string
  grupoId: string
  reportadoPorId: string
  reportadoPorNombre: string
  estado: EstadoReporteAveria
  motivoAnulacion: string | null
  anuladoPorId: string | null
  fechaAnulacion: string | null
  registros: RegistroAveria[]
  total: TotalAverias
}

/** Lo que el formulario arma por cada fila antes de enviar. */
export interface RegistroNuevoAveria {
  productoId: string
  /** Solo para mostrar en la lista del formulario. */
  productoEtiqueta: string
  fechaVencimiento: string
  lote: string
  causalId: string
  cantidad: number
  unidadMedida: UnidadMedidaAveria
  fotos: Record<TipoEvidencia, File>
}

export interface FiltroAverias {
  desde: string
  hasta: string
  turnoId?: string
  grupoId?: string
  estado?: EstadoReporteAveria
}

export type CambiosRegistroAveria = Partial<
  Pick<RegistroAveria, 'productoId' | 'fechaVencimiento' | 'lote' | 'causalId' | 'cantidad' | 'unidadMedida'>
>
