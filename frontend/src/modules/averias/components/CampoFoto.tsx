/**
 * Una de las 3 fotos obligatorias. En el celular, `capture` abre la
 * cámara trasera directamente; en el computador abre el selector de
 * archivos. La foto se comprime al elegirla y se muestra en miniatura.
 */

import { useId, useState } from 'react'

import { useUrlDeArchivo } from '../hooks/useUrlDeArchivo'
import { comprimirFoto, tamanoLegible } from '../utils/comprimir-foto'

interface Props {
  etiqueta: string
  archivo: File | null
  onCambio: (archivo: File | null) => void
}

export function CampoFoto({ etiqueta, archivo, onCambio }: Props) {
  const id = useId()
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const vista = useUrlDeArchivo(archivo)

  const elegir = async (elegido: File | undefined) => {
    setError(null)
    if (!elegido) return
    setProcesando(true)
    try {
      onCambio(await comprimirFoto(elegido))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer la foto.')
    } finally {
      setProcesando(false)
    }
  }

  return (
    <div className="space-y-1">
      <span className="block text-sm font-medium text-tinta-suave">{etiqueta} *</span>
      <label
        htmlFor={id}
        className={`flex h-28 cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed text-center text-xs transition ${
          archivo ? 'border-exito/50 bg-exito-claro/40' : 'border-borde bg-velo hover:border-marca/50'
        }`}
      >
        {vista ? (
          <img src={vista} alt={etiqueta} className="h-full w-full object-cover" />
        ) : (
          <span className="px-2 text-tinta-suave">{procesando ? 'Procesando…' : '📷 Tomar o elegir foto'}</span>
        )}
      </label>
      <input
        id={id}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          void elegir(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      {archivo && (
        <div className="flex items-center justify-between text-xs text-tinta-suave">
          <span>{tamanoLegible(archivo.size)}</span>
          <button type="button" className="text-critico hover:underline" onClick={() => onCambio(null)}>
            Quitar
          </button>
        </div>
      )}
      {error && <p className="text-xs text-critico">{error}</p>}
    </div>
  )
}
