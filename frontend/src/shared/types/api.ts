/**
 * Tipos de lo que devuelve la API. Espejo de los `aPerfil()` y
 * `presentar()` del backend; si allá cambia la forma, aquí se refleja.
 */

export interface PerfilUsuario {
  id: string
  documento: string
  nombre: string
  email: string | null
  activo: boolean
  rolId: string
  rolCodigo: string
  permisos: string[]
}

export interface SesionIniciada {
  token: string
  usuario: PerfilUsuario
}

/**
 * Error normalizado. El backend responde de dos formas distintas:
 *   - errores de dominio:  { codigo, mensaje }
 *   - errores de NestJS:   { statusCode, error, message: string | string[] }
 * `services/http.ts` las unifica en esta.
 */
export interface ErrorApi {
  estado: number
  codigo: string
  mensaje: string
  /** Datos adicionales que algunos errores de dominio traen (p. ej. `faltantes` al cerrar un turno). */
  detalle?: Record<string, unknown>
}
