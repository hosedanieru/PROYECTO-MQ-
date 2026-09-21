/**
 * Fecha operativa de las pantallas de MFR. Vive en la URL (`?fecha=`)
 * para poder compartir el enlace; por defecto, el día operativo actual
 * (corte 06:00).
 */

import { useSearchParams } from 'react-router-dom'

import { fechaOperativaDe } from '../../../shared/utils/fechas'

export function useFechaOperativa(): [string, (f: string) => void] {
  const [params, setParams] = useSearchParams()
  const fecha = params.get('fecha') || fechaOperativaDe(new Date())
  const cambiar = (f: string) => {
    const siguiente = new URLSearchParams(params)
    if (f) siguiente.set('fecha', f)
    else siguiente.delete('fecha')
    setParams(siguiente)
  }
  return [fecha, cambiar]
}
