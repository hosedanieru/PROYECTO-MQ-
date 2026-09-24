/**
 * CLIENTE HTTP
 * ============
 *
 * Única puerta de salida hacia la API. Nada más en el frontend debe
 * llamar a `axios` o `fetch` directamente: así el token, la URL base y
 * el formato de error se resuelven en un solo lugar.
 *
 *   petición  → añade `Authorization: Bearer <token>` si hay sesión
 *   respuesta → si es 401, borra la sesión y manda al login
 *             → cualquier error se convierte en `ErrorApi`
 */

import axios, { AxiosError, isAxiosError } from 'axios'

import type { ErrorApi } from '../shared/types/api'
import { almacenToken } from './almacen-token'

export const http = axios.create({
  baseURL: '/api',
  timeout: 15_000,
})

http.interceptors.request.use((config) => {
  const token = almacenToken.leer()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

/**
 * Se registra desde el contexto de sesión. Es un callback y no un
 * `window.location = '/login'` porque así la navegación la hace React
 * Router y el estado de sesión se limpia en el mismo acto.
 */
let alExpirarSesion: (() => void) | null = null

export function registrarManejoSesionExpirada(manejador: () => void): void {
  alExpirarSesion = manejador
}

http.interceptors.response.use(
  (respuesta) => respuesta,
  async (error: unknown) => {
    // Al pedir un archivo (responseType 'blob'), el cuerpo del error llega
    // como Blob: se lee para no perder el mensaje del servidor.
    if (isAxiosError(error) && error.response?.data instanceof Blob) {
      try {
        error.response.data = JSON.parse(await error.response.data.text())
      } catch {
        error.response.data = {}
      }
    }
    const normalizado = aErrorApi(error)

    // 401 en cualquier ruta salvo el propio login = el token ya no sirve.
    const esLogin =
      isAxiosError(error) && error.config?.url?.endsWith('/auth/login')
    if (normalizado.estado === 401 && !esLogin) {
      almacenToken.borrar()
      alExpirarSesion?.()
    }

    return Promise.reject(normalizado)
  },
)

function aErrorApi(error: unknown): ErrorApi {
  if (!isAxiosError(error)) {
    return { estado: 0, codigo: 'DESCONOCIDO', mensaje: 'Error inesperado.' }
  }

  const axiosError = error as AxiosError<Record<string, unknown>>
  const { response } = axiosError

  // Se agotó el tiempo de espera. Axios tampoco trae respuesta aquí, pero
  // decir "no se pudo conectar" engaña: el servidor sí respondió al
  // contacto y puede seguir trabajando. Importa porque una operación larga
  // (cargar un DPP de varios días) puede completarse aunque el navegador
  // ya se haya rendido.
  if (!response && (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT')) {
    return {
      estado: 0,
      codigo: 'TIEMPO_AGOTADO',
      mensaje:
        'La operación tardó más de lo esperado y el navegador dejó de esperar. ' +
        'Puede que el servidor la haya terminado: recargue y verifique antes de repetirla.',
    }
  }

  if (!response) {
    return {
      estado: 0,
      codigo: 'SIN_CONEXION',
      mensaje: 'No se pudo conectar con el servidor.',
    }
  }

  const cuerpo = response.data instanceof Blob ? {} : (response.data ?? {})

  // Error de dominio del backend: { codigo, mensaje }
  if (typeof cuerpo.codigo === 'string' && typeof cuerpo.mensaje === 'string') {
    const { codigo, mensaje, ...detalle } = cuerpo
    return { estado: response.status, codigo, mensaje, detalle }
  }

  // Error de NestJS (validación, 401, 404...): message puede ser lista.
  const message = cuerpo.message
  const mensaje = Array.isArray(message)
    ? message.join('. ')
    : typeof message === 'string'
      ? message
      : `Error ${response.status}`

  return {
    estado: response.status,
    codigo: typeof cuerpo.error === 'string' ? cuerpo.error : 'HTTP',
    mensaje,
  }
}

/** Ayuda para los `catch`: convierte lo que sea en un ErrorApi. */
export function comoErrorApi(error: unknown): ErrorApi {
  if (
    typeof error === 'object' &&
    error !== null &&
    'estado' in error &&
    'mensaje' in error
  ) {
    return error as ErrorApi
  }
  return aErrorApi(error)
}
