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
  origen: 'MANUAL' | 'CIERRE_TURNO' | 'REENVIO'
  fechaHora: string
  fechaOperativa: string
  turnoId: string | null
  destinatarios: string[]
  remisionIds: string[]
  /** Resúmenes (RT/RD) adjuntos en el correo del cierre. */
  resumenIds: string[]
  asunto: string
  texto: string | null
  estado: 'ENVIADO' | 'FALLIDO'
  error: string | null
  usuarioNombre: string
}

/**
 * Resultado de cada correo del cierre del turno (usuario, 2026-10-10).
 * SIN_DESTINATARIOS: ninguna lista lo recibe; no se envió.
 */
export interface ResultadoCorreoCierre {
  contenido: 'RESUMEN' | 'REMISIONES'
  estado: 'ENVIADO' | 'FALLIDO' | 'SIN_DESTINATARIOS'
  envioId: string | null
  destinatarios: number
  error: string | null
}

export interface DatosEnvioRemisiones {
  remisionIds: string[]
  listaIds: string[]
  correos: string[]
}
