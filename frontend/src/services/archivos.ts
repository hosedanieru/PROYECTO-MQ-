/**
 * Descarga de archivos generados por la API (PDF, Excel).
 *
 * No se puede usar un `<a href="/api/...">` directo: el navegador no
 * enviaría el token. Se pide con axios como `blob` y se entrega al
 * navegador como URL temporal.
 */

import { http } from './http'

/** Pide el archivo y lo descarga con el nombre indicado. */
export async function descargarArchivo(ruta: string, params: Record<string, unknown>, nombre: string): Promise<void> {
  const { data } = await http.get<Blob>(ruta, { params, responseType: 'blob' })
  const url = URL.createObjectURL(data)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  enlace.click()
  URL.revokeObjectURL(url)
}

/** Pide un PDF y lo abre en una pestaña nueva (para ver e imprimir). */
export async function abrirPdf(ruta: string, params: Record<string, unknown> = {}): Promise<void> {
  const { data } = await http.get<Blob>(ruta, { params, responseType: 'blob' })
  const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }))
  window.open(url, '_blank', 'noopener')
  // Se libera después de que la pestaña haya cargado el contenido.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
