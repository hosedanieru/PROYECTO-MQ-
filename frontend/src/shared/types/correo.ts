/** Tipos del correo, espejo de `/api/correos`. */

/**
 * Lista de distribución. Una lista de un turno va en el envío automático
 * cuando ese turno es el siguiente; una general va en todos si
 * `incluirEnCierres`. Siempre se pueden elegir a mano.
 */
/** Qué recibe la lista al cerrar el turno (usuario, 2026-10-03). */
export type RecibeLista = 'REMISIONES' | 'RESUMEN' | 'AMBOS'

export const ETIQUETA_RECIBE: Record<RecibeLista, string> = {
  REMISIONES: 'Remisiones aprobadas',
  RESUMEN: 'Resumen del turno',
  AMBOS: 'Remisiones y resumen',
}

export interface ListaDistribucion {
  id: string
  nombre: string
  recibe: RecibeLista
  turnoId: string | null
  incluirEnCierres: boolean
  correos: string[]
  activo: boolean
}

export interface DatosLista {
  nombre: string
  recibe: RecibeLista
  turnoId: string | null
  incluirEnCierres: boolean
  correos: string[]
}

export interface EnvioCorreo {
  id: string
  origen: 'MANUAL' | 'CIERRE_TURNO'
  fechaHora: string
  fechaOperativa: string
  turnoId: string | null
  destinatarios: string[]
  remisionIds: string[]
  asunto: string
  estado: 'ENVIADO' | 'FALLIDO'
  error: string | null
  usuarioNombre: string
}

export interface DatosEnvioRemisiones {
  remisionIds: string[]
  listaIds: string[]
  correos: string[]
}
