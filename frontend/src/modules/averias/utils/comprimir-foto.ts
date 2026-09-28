/**
 * COMPRESIÓN DE FOTOS EN EL NAVEGADOR
 * ===================================
 *
 * Una foto de celular pesa 3–8 MB. Subir 3 por avería con la señal de
 * la planta sería lento, y guardarlas así llenaría el disco. Aquí se
 * reduce a un máximo de 1600 px por lado en JPEG: queda en unos cientos
 * de KB y el lote y la fecha impresos se siguen leyendo.
 *
 * `createImageBitmap` respeta la orientación EXIF, así que la foto no
 * sale acostada.
 */

const LADO_MAXIMO = 1600
const CALIDAD = 0.75

export async function comprimirFoto(original: File): Promise<File> {
  if (!original.type.startsWith('image/')) {
    throw new Error('El archivo no es una imagen.')
  }
  const imagen = await createImageBitmap(original)
  const escala = Math.min(1, LADO_MAXIMO / Math.max(imagen.width, imagen.height))
  const ancho = Math.round(imagen.width * escala)
  const alto = Math.round(imagen.height * escala)

  const lienzo = document.createElement('canvas')
  lienzo.width = ancho
  lienzo.height = alto
  const contexto = lienzo.getContext('2d')
  if (!contexto) throw new Error('El navegador no permite procesar la imagen.')
  contexto.drawImage(imagen, 0, 0, ancho, alto)
  imagen.close()

  const blob = await new Promise<Blob | null>((resolver) => lienzo.toBlob(resolver, 'image/jpeg', CALIDAD))
  if (!blob) throw new Error('No se pudo comprimir la imagen.')

  // Si ya venía liviana, no se gana nada re-comprimiendo.
  if (blob.size >= original.size && original.type === 'image/jpeg') return original
  const nombre = original.name.replace(/\.[^.]+$/, '') || 'foto'
  return new File([blob], `${nombre}.jpg`, { type: 'image/jpeg' })
}

/** "245 KB" / "1,2 MB" */
export function tamanoLegible(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / (1024 * 1024)).toLocaleString('es-CO', { maximumFractionDigits: 1 })} MB`
}
